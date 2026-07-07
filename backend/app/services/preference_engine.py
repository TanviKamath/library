"""Deterministic, explainable user-affinity engine for Brew & Borrow.

This is the *single source of truth* for a user's learned taste. It
recomputes affinity fresh from raw signals on every call (cached 60s) so
there is no incremental drift and every weight traces back to a concrete
interaction:

    * Favorites            (UserBookLike)            — strongest positive
    * Borrows              (Transaction, type=issue) — positive
    * Recommendation/spin  (BaristaInteractionLog)   — accepted / declined
    * Swipe deck           (BaristaInteractionLog)   — right / left swipe
    * Tarot draw           (BaristaInteractionLog)   — reserve / reshuffle

Positive signals raise a genre's / author's weight; negative signals lower
it. Because weights are an *additive sum* of per-signal deltas, a single
rejection can never blacklist a category the user otherwise loves — it just
nudges the total down. Repeated rejections accumulate and meaningfully
suppress the category (the "gradual decay" requirement).

Public API:
    compute_user_affinity(user_id) -> {
        'genre_weights':          {genre_name: float in ~[-1, 1]},
        'author_weights':         {author_name: float in ~[-1, 1]},
        'recency_bias':           float in [-1, 1],   # + = likes recent
        'popularity_sensitivity': float in [0, 1],    # high for apprentices
        'divisive_tolerance':     float in [0, 1],     # + = enjoys low-rated
    }

All tunables are named constants at the top of this module.
"""

from datetime import datetime, timezone

from app.extensions import cache
from app.models import Book, Transaction
from app.models.like import UserBookLike
from app.models.review import Review
from app.models.barista import BaristaProfile, BaristaInteractionLog

# ---------------------------------------------------------------------------
# Per-signal weights — the raw "points" each interaction contributes to the
# genre/author it touches. Tune these to rebalance how much each signal
# matters relative to the others.
# ---------------------------------------------------------------------------
FAVORITE_WEIGHT      = 3.0    # UserBookLike — explicit, highest-confidence
BORROW_WEIGHT        = 1.2    # completed checkout (issue transaction)
ACCEPTED_WEIGHT      = 1.5    # accepted a Finn recommendation / spin winner
DECLINED_WEIGHT      = -1.0   # declined a Finn recommendation / spin winner
SWIPE_RIGHT_WEIGHT   = 1.0    # swipe-deck "like"
SWIPE_LEFT_WEIGHT    = -0.8   # swipe-deck "nope"
TAROT_LIKE_WEIGHT    = 1.0    # tarot: reserved the drawn card
TAROT_DISLIKE_WEIGHT = -0.5   # tarot: revealed then reshuffled (soft signal)

# Onboarding answer — a stated genre preference, used to seed taste so a
# brand-new user isn't a cold start. Weaker than a real behavioral favorite
# so actual reading/likes accumulate and override the initial guess over time.
ONBOARD_GENRE_WEIGHT = 2.0

# Explicit post-recommendation feedback refines the base response signal.
REACTION_DELTAS = {
    'loved':        +2.0,
    'liked':        +1.0,
    'not_for_me':   -1.0,
    'already_read': -0.3,   # redundant, not disliked
}
RATING_DELTAS = {5: +2.0, 4: +1.0, 3: 0.0, 2: -1.0, 1: -1.5}

# ---------------------------------------------------------------------------
# Normalization / derived-signal tuning.
# ---------------------------------------------------------------------------
# Genre/author sums are divided by max(observed_abs, this) so a lone lukewarm
# signal can't normalize up to a dominant 1.0 — a genre must accumulate real
# weight (~one favorite) to approach the ceiling.
MIN_NORM_DENOM = FAVORITE_WEIGHT

# Popularity sensitivity: apprentices lean on crowd-pleasers, regulars exploit
# their own learned taste. Decays as the user accumulates positive signals.
APPRENTICE_POP_SENS = 1.0
REGULAR_POP_SENS    = 0.35
POP_SENS_DECAY      = 0.04    # reduction per positive signal
POP_SENS_FLOOR      = 0.15

# Recency axis pivots (see recency_score): a book from CURRENT_YEAR scores +1,
# one ~RECENCY_SPREAD years old scores 0, twice that scores -1 (a "classic").
RECENCY_SPREAD = 30

# A book counts as low-rated below this; divisive_tolerance softens the penalty.
LOW_RATING_CUTOFF = 3.0
MIN_SIGNALS_FOR_RECENCY = 3   # need this many dated positive books to trust bias

# ---------------------------------------------------------------------------
# Recommender scoring weights — how the affinity dict is combined into a book's
# final score:  genre*GENRE_W + author*AUTHOR_W + norm_rating*RATING_W
#             + recency*recency_bias*RECENCY_W + popularity*pop_sens*POPULARITY_W
# Author is weighted above genre (author affinity is the stronger predictor).
# ---------------------------------------------------------------------------
GENRE_W       = 4.0
AUTHOR_W      = 6.0
RATING_W      = 2.0
RECENCY_W     = 2.0
POPULARITY_W  = 3.0
MOOD_W        = 3.0    # flat nudge when a book fits the requested mood
LOW_RATING_PENALTY = 2.0   # per rating-point below the cutoff (softened by tolerance)
WHY_THRESHOLD = 1.0    # a contribution must clear this to appear in the why-line

# Reading-level / pace ↔ book length. skill_level and pace_preference are
# matched against Book.page_count so beginners / fast readers get shorter
# picks and advanced / slow-burn readers get longer ones.
LONG_BOOK_PAGES   = 450    # at/above this a book counts as "long / meaty"
SHORT_BOOK_PAGES  = 250    # at/below this a book counts as "short / quick"
SKILL_LENGTH_W    = 2.0    # reward for a length that matches the reader
MISMATCH_PENALTY  = 1.0    # gentle steer away from a clearly-wrong length


def _log_signal(log: BaristaInteractionLog) -> float:
    """Return the affinity delta a single interaction log contributes.

    Each log yields exactly one delta (no double counting). Swipe and tarot
    interactions use their own dedicated constants because the *direction*
    is the signal; recommendation/spin fall back to reaction > rating >
    accepted/declined.
    """
    itype = log.interaction_type
    resp = log.user_response
    reaction = log.reaction

    if itype == 'swipe':
        if reaction == 'not_for_me' or resp == 'declined':
            return SWIPE_LEFT_WEIGHT
        if reaction in ('liked', 'loved') or resp == 'accepted':
            return SWIPE_RIGHT_WEIGHT
        return 0.0

    if itype == 'tarot':
        if reaction == 'not_for_me' or resp == 'declined':
            return TAROT_DISLIKE_WEIGHT
        if reaction in ('liked', 'loved') or resp == 'accepted':
            return TAROT_LIKE_WEIGHT
        return 0.0

    # recommendation / spin / check_in: most explicit signal wins.
    if reaction in REACTION_DELTAS:
        return REACTION_DELTAS[reaction]
    if log.rating in RATING_DELTAS:
        return RATING_DELTAS[log.rating]
    if resp == 'accepted':
        return ACCEPTED_WEIGHT
    if resp == 'declined':
        return DECLINED_WEIGHT
    return 0.0


def recency_score(publish_year: int | None) -> float:
    """Map a publication year to a recent↔classic axis in [-1, 1].

    +1 = brand new, 0 = ~RECENCY_SPREAD years old, -1 = a clear classic.
    """
    if not publish_year:
        return 0.0
    current_year = datetime.now(timezone.utc).year
    raw = (publish_year - (current_year - RECENCY_SPREAD)) / RECENCY_SPREAD
    return max(-1.0, min(1.0, raw))


def _normalize(weights: dict) -> dict:
    """Rescale raw weight sums into ~[-1, 1], preserving ratios.

    Divides by max(largest absolute weight, MIN_NORM_DENOM) so weak signals
    stay small instead of being amplified to the ceiling.
    """
    if not weights:
        return {}
    denom = max(MIN_NORM_DENOM, max(abs(w) for w in weights.values()))
    return {k: round(v / denom, 4) for k, v in weights.items()}


def compute_user_affinity(user_id: int) -> dict:
    """Public entry point. Cheap wrapper that keys the cache on the user's
    ``preference_version`` so any new interaction (which bumps the version)
    invalidates the cached affinity automatically."""
    profile = BaristaProfile.query.filter_by(user_id=user_id).first()
    version = (profile.preference_version or 0) if profile else 0
    is_apprentice = bool(profile and profile.relationship_stage == 'apprentice')
    return _compute_affinity_cached(user_id, version, is_apprentice)


@cache.memoize(60)
def _compute_affinity_cached(user_id: int, version: int, is_apprentice: bool) -> dict:
    """Heavy recompute from raw signals. Cached 60s per (user, version)."""
    genre_weights: dict[str, float] = {}
    author_weights: dict[str, float] = {}

    # Running tallies for derived signals.
    positive_signal_count = 0
    recent_years: list[int] = []      # publish years of positively-signaled books
    low_rated_positive = 0            # positive signals on low-rated books
    total_positive_rated = 0

    def add(book: Book, delta: float):
        nonlocal positive_signal_count, low_rated_positive, total_positive_rated
        if delta == 0.0 or book is None:
            return
        if book.category and book.category.name:
            g = book.category.name
            genre_weights[g] = genre_weights.get(g, 0.0) + delta
        if book.author and book.author.name:
            a = book.author.name
            author_weights[a] = author_weights.get(a, 0.0) + delta
        if delta > 0:
            positive_signal_count += 1
            if book.publish_year:
                recent_years.append(book.publish_year)
            if book.rating:
                total_positive_rated += 1
                if book.rating < LOW_RATING_CUTOFF:
                    low_rated_positive += 1

    # ── 1. Favorites — strongest positive ──────────────────────────────────
    likes = UserBookLike.query.filter_by(user_id=user_id).all()
    if likes:
        liked_books = {b.id: b for b in Book.query.filter(
            Book.id.in_([l.book_id for l in likes])).all()}
        for l in likes:
            add(liked_books.get(l.book_id), FAVORITE_WEIGHT)

    # ── 2. Borrows — completed checkouts ───────────────────────────────────
    txns = Transaction.query.filter_by(user_id=user_id, type='issue').all()
    if txns:
        tx_books = {b.id: b for b in Book.query.filter(
            Book.id.in_([t.book_id for t in txns])).all()}
        for t in txns:
            add(tx_books.get(t.book_id), BORROW_WEIGHT)

    # ── 3. All Finn interactions (recommendation / swipe / spin / tarot) ────
    logs = BaristaInteractionLog.query.filter(
        BaristaInteractionLog.user_id == user_id,
        BaristaInteractionLog.book_recommended_id.isnot(None),
    ).all()
    if logs:
        log_books = {b.id: b for b in Book.query.filter(
            Book.id.in_([lg.book_recommended_id for lg in logs])).all()}
        for lg in logs:
            add(log_books.get(lg.book_recommended_id), _log_signal(lg))

    # ── 3b. Book reviews — the user's own star rating is a strong explicit
    #        signal (5★ -> +2.0, 1★ -> -1.5 via RATING_DELTAS). Independent of
    #        borrows: reading a book and loving it are two separate signals, so
    #        both legitimately reinforce the genre/author.
    reviews = Review.query.filter_by(user_id=user_id).all()
    if reviews:
        review_books = {b.id: b for b in Book.query.filter(
            Book.id.in_([r.book_id for r in reviews])).all()}
        for r in reviews:
            add(review_books.get(r.book_id), RATING_DELTAS.get(r.rating, 0.0))

    # ── 4. Onboarding seed — solve cold start from stated genre preferences ─
    # A freshly onboarded user has no behavioral signals yet, so seed their
    # declared favorite genres. This is deliberately kept OUT of the positive
    # signal count above, so a brand-new user still gets full exploration
    # (high popularity_sensitivity) — we only steer *which* genres, not how
    # confident we are in their taste.
    profile = BaristaProfile.query.filter_by(user_id=user_id).first()
    for genre_name in (profile.favorite_categories_cache or []) if profile else []:
        if genre_name:
            genre_weights[genre_name] = genre_weights.get(genre_name, 0.0) + ONBOARD_GENRE_WEIGHT

    # ── Derived: recency bias ──────────────────────────────────────────────
    recency_bias = 0.0
    if len(recent_years) >= MIN_SIGNALS_FOR_RECENCY:
        recency_bias = sum(recency_score(y) for y in recent_years) / len(recent_years)

    # ── Derived: popularity sensitivity (apprentice-high, decays w/ history) ─
    base_sens = APPRENTICE_POP_SENS if is_apprentice else REGULAR_POP_SENS
    popularity_sensitivity = max(
        POP_SENS_FLOOR,
        min(1.0, base_sens - positive_signal_count * POP_SENS_DECAY),
    )

    # ── Derived: divisive tolerance (does the user enjoy low-rated picks?) ──
    divisive_tolerance = 0.0
    if total_positive_rated:
        divisive_tolerance = round(low_rated_positive / total_positive_rated, 4)

    return {
        'genre_weights': _normalize(genre_weights),
        'author_weights': _normalize(author_weights),
        'recency_bias': round(recency_bias, 4),
        'popularity_sensitivity': round(popularity_sensitivity, 4),
        'divisive_tolerance': divisive_tolerance,
        # Passed through from onboarding so the recommender can match book
        # length to the reader (see _score_book length term).
        'skill_level': profile.skill_level if profile else None,
        'pace_preference': profile.pace_preference if profile else None,
    }


def invalidate_user_affinity(user_id: int):
    """Best-effort cache purge for a user's affinity.

    Not strictly required — bumping ``preference_version`` already changes the
    memoize key — but lets callers force an immediate recompute.
    """
    try:
        profile = BaristaProfile.query.filter_by(user_id=user_id).first()
        version = (profile.preference_version or 0) if profile else 0
        for stage in (True, False):
            cache.delete_memoized(_compute_affinity_cached, user_id, version, stage)
    except Exception:
        pass
