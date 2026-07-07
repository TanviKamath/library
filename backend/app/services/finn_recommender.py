"""Finn's book recommender.

Scoring is a transparent weighted sum over the user's affinity (computed by
``preference_engine.compute_user_affinity``) plus each book's own quality,
recency and popularity signals. Every point a book earns traces back to a
named weight times a concrete signal, so we can always explain *why* a book
was chosen. No black-box ML.
"""

import random
from typing import List, Tuple

from app.models import Book, BaristaProfile, Transaction
from sqlalchemy.orm import joinedload

from app.services import preference_engine as pe

# Mapping from mood tags to category names — a light situational nudge.
MOOD_MAP = {
    'cozy': ['Fiction', 'Romance'],
    'thrilling': ['Mystery', 'Sci-Fi'],
    'focus': ['Non-Fiction', 'Biography'],
}


def _get_candidates(profile: BaristaProfile) -> list:
    """Return available books excluding past borrows and recently-declined
    books, eagerly loading category + author.  Used by recommend(),
    get_swipe_deck(), and get_spin_candidates().
    """
    from app.services.finn_learning import get_recently_declined_book_ids

    query = Book.query.filter(Book.available_copies > 0)

    # Exclude books already borrowed.
    past_tx_ids = [
        tx.book_id
        for tx in Transaction.query.filter_by(user_id=profile.user_id).all()
    ]
    if past_tx_ids:
        query = query.filter(~Book.id.in_(past_tx_ids))

    # Exclude books declined/disliked in the last 30 days (swipe-left, tarot
    # reshuffle and explicit declines all funnel through this).
    declined_ids = get_recently_declined_book_ids(profile.user_id)
    if declined_ids:
        query = query.filter(~Book.id.in_(declined_ids))

    return query.options(
        joinedload(Book.category),
        joinedload(Book.author),
    ).all()


def _score_book(book: Book, affinity: dict,
                mood_tag: str | None) -> Tuple[float, List[Tuple[str, float]]]:
    """Score a candidate as a weighted sum over the affinity dict.

    Returns ``(score, contributions)`` where *contributions* is a list of
    ``(reason_text, points)`` for the positive signals that drove the score —
    used to build the "why this book" line.
    """
    score = 0.0
    contributions: List[Tuple[str, float]] = []

    genre = book.category.name if book.category else None
    author = book.author.name if book.author else None

    # 1. Genre affinity.
    gw = affinity['genre_weights'].get(genre, 0.0) if genre else 0.0
    if gw:
        pts = gw * pe.GENRE_W
        score += pts
        if pts >= pe.WHY_THRESHOLD:
            contributions.append((f"matches your taste for {genre}", pts))

    # 2. Author affinity (weighted higher than genre).
    aw = affinity['author_weights'].get(author, 0.0) if author else 0.0
    if aw:
        pts = aw * pe.AUTHOR_W
        score += pts
        if pts >= pe.WHY_THRESHOLD:
            contributions.append((f"you've enjoyed {author}'s writing", pts))

    # 3. Rating — quality floor. Penalize very low-rated books, but soften the
    #    penalty for users whose history shows they enjoy divisive/niche picks.
    rating = book.rating or 0.0
    rating_pts = (rating / 5.0) * pe.RATING_W
    if rating and rating < pe.LOW_RATING_CUTOFF:
        penalty = ((pe.LOW_RATING_CUTOFF - rating) * pe.LOW_RATING_PENALTY
                   * (1.0 - affinity['divisive_tolerance']))
        rating_pts -= penalty
    score += rating_pts
    if rating >= 4.3:
        contributions.append((f"highly rated at {rating:.1f}★", rating_pts))

    # 4. Recency — nudge toward the era (recent vs classic) the user skews to.
    if book.publish_year and affinity['recency_bias']:
        rec_pts = pe.recency_score(book.publish_year) * affinity['recency_bias'] * pe.RECENCY_W
        score += rec_pts
        if rec_pts >= pe.WHY_THRESHOLD:
            era = "a recent release" if affinity['recency_bias'] > 0 else "a timeless classic"
            contributions.append((f"{era}, just how you like them", rec_pts))

    # 5. Popularity — mild "famous book" boost, strong for apprentices who have
    #    no taste history, weak for regulars who've earned personalization.
    pop = book.popularity_score or 0.0
    pop_pts = pop * affinity['popularity_sensitivity'] * pe.POPULARITY_W
    score += pop_pts
    if pop_pts >= pe.WHY_THRESHOLD:
        contributions.append(("a crowd-pleaser other patrons love", pop_pts))

    # 6. Mood — situational nudge for the current request.
    if mood_tag and genre and genre in MOOD_MAP.get(mood_tag, []):
        score += pe.MOOD_W
        contributions.append((f"fits your '{mood_tag}' mood", pe.MOOD_W))

    # 7. Reading level / pace — match book length to the reader. A reader who
    #    is advanced OR prefers a slow burn leans long; a beginner OR fast
    #    reader leans short. Skipped entirely when page_count is unknown.
    pages = book.page_count
    if pages:
        skill = affinity.get('skill_level')
        pace = affinity.get('pace_preference')
        wants_long = skill == 'advanced' or pace == 'slow_burn'
        wants_short = skill == 'beginner' or pace == 'fast_read'
        if wants_long and pages >= pe.LONG_BOOK_PAGES:
            score += pe.SKILL_LENGTH_W
            contributions.append(("a substantial, in-depth read", pe.SKILL_LENGTH_W))
        elif wants_short and pages <= pe.SHORT_BOOK_PAGES:
            score += pe.SKILL_LENGTH_W
            contributions.append(("an approachable, quick read", pe.SKILL_LENGTH_W))
        elif wants_short and pages >= pe.LONG_BOOK_PAGES:
            # Gently steer a beginner / fast reader away from a doorstop.
            score -= pe.MISMATCH_PENALTY

    return score, contributions


def _top_reasons(contributions: List[Tuple[str, float]], limit: int = 3) -> List[str]:
    """Pick the highest-impact positive contributions as why-line reasons."""
    positive = [c for c in contributions if c[1] > 0]
    positive.sort(key=lambda c: c[1], reverse=True)
    return [text for text, _ in positive[:limit]]


def recommend(profile: BaristaProfile, mood_tag: str) -> Tuple[Book, List[str]]:
    """Select a book for the given profile and mood.

    Returns the chosen ``Book`` and the 2-3 signals that contributed most to
    its score (for the why-line). Scores every available candidate with
    ``_score_book`` against the user's affinity, then picks one of the top-3
    at random for variety.
    """
    candidates = _get_candidates(profile)
    if not candidates:
        return None, []

    affinity = pe.compute_user_affinity(profile.user_id)

    scored = []
    for book in candidates:
        score, contribs = _score_book(book, affinity, mood_tag)
        scored.append((book, score, contribs))

    # Sort by score, breaking ties with popularity so a stronger crowd-pleaser
    # wins an otherwise even matchup.
    scored.sort(key=lambda x: (x[1], x[0].popularity_score or 0.0), reverse=True)

    top = scored[:3]
    chosen_book, _, chosen_contribs = random.choice(top)
    return chosen_book, _top_reasons(chosen_contribs)


def get_swipe_deck(profile: BaristaProfile, count: int = 5) -> list[dict]:
    """Return *count* diverse candidate books for the swipe-deck mode.

    Fills from the user's top genres (via affinity), then pads with wildcards
    from genres they haven't positively engaged with. Apprentices get more
    wildcards to promote exploration.
    """
    candidates = _get_candidates(profile)
    if not candidates:
        return []

    affinity = pe.compute_user_affinity(profile.user_id)
    is_apprentice = (profile.relationship_stage == 'apprentice')

    # Wildcard budget — apprentices explore more.
    wildcard_count = 2 if is_apprentice else 1
    if count > 5:
        wildcard_count = 3 if is_apprentice else 2
    preference_count = max(1, count - wildcard_count)

    scored = []
    for book in candidates:
        score, contribs = _score_book(book, affinity, mood_tag=None)
        scored.append((book, score, _top_reasons(contribs)))
    scored.sort(key=lambda x: x[1], reverse=True)

    interacted_genres = {g for g, w in affinity['genre_weights'].items() if w > 0}
    pref_pool = [s for s in scored if s[0].category and s[0].category.name in interacted_genres]
    wild_pool = [s for s in scored if not (s[0].category and s[0].category.name in interacted_genres)]

    # No learned preferences yet → everything is a wildcard.
    if not pref_pool:
        pref_pool = scored
        wild_pool = []

    selected = []
    for book, score, reasons in pref_pool:
        if len(selected) >= preference_count:
            break
        genre = book.category.name if book.category else None
        genre_occurrences = sum(
            1 for b, _, _ in selected if b.category and b.category.name == genre)
        if genre_occurrences < 3:   # max 3 per genre for variety
            selected.append((book, score, reasons))

    random.shuffle(wild_pool)
    selected.extend(wild_pool[:wildcard_count])
    random.shuffle(selected)

    return [
        {'book': book.to_dict(), 'score': round(score, 3), 'reasons': reasons}
        for book, score, reasons in selected[:count]
    ]


def get_spin_candidates(profile: BaristaProfile, count: int = 6) -> list:
    """Return *count* books for the spin-wheel mode.

    Regulars: 4 preference + 2 wildcards.  Apprentices: 3 + 3.
    """
    candidates = _get_candidates(profile)
    if not candidates:
        return []

    affinity = pe.compute_user_affinity(profile.user_id)
    is_apprentice = (profile.relationship_stage == 'apprentice')
    wildcard_count = 3 if is_apprentice else 2
    preference_count = count - wildcard_count

    scored = []
    for book in candidates:
        score, _ = _score_book(book, affinity, mood_tag=None)
        scored.append((book, score))
    scored.sort(key=lambda x: x[1], reverse=True)

    interacted_genres = {g for g, w in affinity['genre_weights'].items() if w > 0}
    pref_pool = [s for s in scored if s[0].category and s[0].category.name in interacted_genres]
    wild_pool = [s for s in scored if not (s[0].category and s[0].category.name in interacted_genres)]

    if not pref_pool:
        pref_pool = scored
        wild_pool = []

    selected_books = [book for book, _ in pref_pool[:preference_count]]
    random.shuffle(wild_pool)
    selected_books.extend([book for book, _ in wild_pool[:wildcard_count]])

    # Pad if short.
    if len(selected_books) < count:
        remaining = [book for book, _ in scored if book not in selected_books]
        selected_books.extend(remaining[:count - len(selected_books)])

    random.shuffle(selected_books)
    return selected_books[:count]
