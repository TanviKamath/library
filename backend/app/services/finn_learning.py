'''Finn deterministic preference learning service.

This module updates a user's `BaristaProfile` based on explicit feedback
(rating/reaction) and implicit response (`accepted`/`declined`). The
updates are deterministic, simple weighted increments that are easy to
audit and explain.

The public entry point is `process_interaction(log)` which inspects a
`BaristaInteractionLog` record, adjusts the profile's genre and author
weights, bumps the `preference_version` (used to bust the recommendation
cache), and commits the changes.
'''

from datetime import datetime, timezone, timedelta

from app.models.barista import BaristaProfile, BaristaInteractionLog
from app.models import Book, Transaction

# ---------------------------------------------------------------------------
# Graduated weight deltas — stronger signals produce larger adjustments.
# ---------------------------------------------------------------------------
REACTION_DELTAS = {
    'loved':        +2.0,
    'liked':        +1.0,
    'not_for_me':   -1.0,
    'already_read': -0.5,   # not negative taste, just redundant
}

RATING_DELTAS = {
    5: +2.0,
    4: +1.0,
    3:  0.0,   # neutral — no update
    2: -1.0,
    1: -1.5,
}

# Implicit response deltas (used only when no explicit rating/reaction).
RESPONSE_DELTAS = {
    'accepted': +1.0,
    'declined': -1.0,
}


def _update_weights(profile: BaristaProfile, genre: str | None, author: str | None, delta: float):
    """Apply *delta* to the stored weight for *genre* and *author*.

    ``profile.genre_weights`` and ``profile.author_weights`` are JSON
    dicts mapping the name to a numeric weight. If the key does not yet
    exist we treat the current weight as ``0``.
    """
    if genre:
        gw = dict(profile.genre_weights or {})
        gw[genre] = gw.get(genre, 0) + delta
        profile.genre_weights = gw
    if author:
        aw = dict(profile.author_weights or {})
        aw[author] = aw.get(author, 0) + delta
        profile.author_weights = aw


def _book_meta(book_id: int):
    """Return (genre_name, author_name) for *book_id* or (None, None)."""
    book = Book.query.get(book_id)
    if not book:
        return None, None
    genre = book.category.name if book.category else None
    author = book.author.name if book.author else None
    return genre, author


def get_recently_declined_book_ids(user_id: int, days: int = 30) -> list[int]:
    """Return book IDs the user declined or reacted with 'not_for_me' in
    the last *days* days.  Used by the recommender to avoid re-suggesting
    books the user has already rejected.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    logs = BaristaInteractionLog.query.filter(
        BaristaInteractionLog.user_id == user_id,
        BaristaInteractionLog.created_at >= cutoff,
        BaristaInteractionLog.book_recommended_id.isnot(None),
        (
            (BaristaInteractionLog.user_response == 'declined') |
            (BaristaInteractionLog.reaction == 'not_for_me')
        )
    ).all()
    return [log.book_recommended_id for log in logs]


def process_interaction(log: BaristaInteractionLog):
    """Update preference weights based on a completed interaction.

    The function is deliberately side‑effect‑only – it does not return
    anything. It expects ``log`` to be already persisted (i.e. it has an
    ``id`` and ``user_id``). After mutating the profile we increment its
    ``preference_version`` so that any cached recommendation that used the
    previous version will be regenerated.
    """
    # Load the user's profile – it must exist.
    profile = BaristaProfile.query.filter_by(user_id=log.user_id).first()
    if not profile:
        return  # Should never happen, but we guard against it.

    # Determine the weight delta using a graduated system.
    # Priority: explicit reaction > explicit rating > implicit response.
    delta = 0.0

    # 1. Reaction enum (most explicit signal).
    if log.reaction and log.reaction in REACTION_DELTAS:
        delta = REACTION_DELTAS[log.reaction]
    # 2. Explicit rating (1‑5).
    elif log.rating is not None and log.rating in RATING_DELTAS:
        delta = RATING_DELTAS[log.rating]
    # 3. Implicit response – accepted/declined (weakest signal).
    elif log.user_response in RESPONSE_DELTAS:
        delta = RESPONSE_DELTAS[log.user_response]

    # No change needed.
    if delta == 0.0:
        return

    # Determine genre/author from the associated book.
    genre, author = _book_meta(log.book_recommended_id)

    # Apply the delta to the profile weights.
    _update_weights(profile, genre, author, delta)

    # Bump version to invalidate the cached recommendation.
    profile.preference_version = (profile.preference_version or 0) + 1

    # Persist changes.
    from app.extensions import db
    db.session.add(profile)
    db.session.commit()
