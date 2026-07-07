'''Finn learning glue.

Preference *weights* are no longer accumulated here — they are recomputed
fresh from raw signals by ``preference_engine.compute_user_affinity`` (the
single source of truth). This module now only:

  * bumps ``BaristaProfile.preference_version`` when a new interaction lands,
    which busts both the recommendation cache and the affinity cache, and
  * answers "which books did this user recently reject?" for the recommender's
    30-day hard-exclusion (declines, swipe-lefts and tarot reshuffles all
    funnel through ``user_response='declined'`` / ``reaction='not_for_me'``).
'''

from datetime import datetime, timezone, timedelta

from app.models.barista import BaristaProfile, BaristaInteractionLog


def get_recently_declined_book_ids(user_id: int, days: int = 30) -> list[int]:
    """Return book IDs the user declined or reacted 'not_for_me' to in the
    last *days* days — used by the recommender to avoid re-suggesting a book
    the user has already rejected (swipe-left, tarot reshuffle, or an explicit
    decline all count).
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
    """Register that a new interaction happened so learned preferences update
    live. Bumps ``preference_version`` (busting the recommendation + affinity
    caches) and purges the user's cached affinity for an immediate recompute.

    Intentionally side-effect-only. Expects ``log`` to be persisted.
    """
    profile = BaristaProfile.query.filter_by(user_id=log.user_id).first()
    if not profile:
        return

    profile.preference_version = (profile.preference_version or 0) + 1

    from app.extensions import db
    db.session.add(profile)
    db.session.commit()

    # Force an immediate affinity recompute on next read (the version bump
    # already changes the cache key; this is belt-and-suspenders).
    from app.services.preference_engine import invalidate_user_affinity
    invalidate_user_affinity(log.user_id)
