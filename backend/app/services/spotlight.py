import random
from app.services.event import get_today_events
from datetime import datetime, timezone, timedelta

from app.extensions import db
from app.models import Book
from app.models.spotlight import SpotlightSetting

ROTATION_HOURS = 24


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _has_quote():
    return Book.quote_text.isnot(None) & (Book.quote_text != '')


def _eligible_books():
    """Pool the spotlight rotates through.

    Prefer books that have a pull-quote (so the Spotlight card always shows a
    quote) AND a cover image. Fall back gracefully — quote-only, then
    cover-only, then everything — so the pool is never empty even before any
    quotes are seeded.
    """
    pool = Book.query.filter(
        Book.cover_image_url.isnot(None), _has_quote()
    ).all()
    if pool:
        return pool
    pool = Book.query.filter(_has_quote()).all()
    if pool:
        return pool
    pool = Book.query.filter(Book.cover_image_url.isnot(None)).all()
    if pool:
        return pool
    return Book.query.all()


def _pick_random_book(exclude_id=None):
    # NOTE: This function remains for fallback when no event‑matching book is found.

    # NOTE: This function remains for fallback when no event‑matching book is found.

    pool = _eligible_books()
    if exclude_id and len(pool) > 1:
        pool = [book for book in pool if book.id != exclude_id]
    if not pool:
        return None
    return random.choice(pool)


def _pick_event_book(exclude_id=None):
    """Select a book that matches today's event keywords.
    Returns ``None`` if no matching book is found.
    """
    try:
        today_events = get_today_events()
    except Exception as e:
        from flask import current_app
        current_app.logger.error(f"Event fetch failed in spotlight: {e}")
        return None
    if not today_events:
        return None
    # Flatten all keywords from the events.
    keywords = {kw for ev in today_events for kw in ev.get("keywords", [])}
    if not keywords:
        return None
    pool = _eligible_books()
    matches = []
    for b in pool:
        if exclude_id and b.id == exclude_id:
            continue
        title_words = set(b.title.lower().split())
        desc_words = set((b.description or "").lower().split())
        if keywords & (title_words | desc_words):
            matches.append(b)
    return random.choice(matches) if matches else None


def _get_or_create_setting():
    setting = SpotlightSetting.query.first()
    if setting:
        return setting
    book = _pick_random_book()
    if not book:
        return None
    setting = SpotlightSetting(
        book_id=book.id,
        set_at=_now(),
        is_admin_override=False,
    )
    db.session.add(setting)
    db.session.commit()
    return setting


def rotate_spotlight_if_expired():
    """Rotate spotlight when the 24‑hour window has passed, preferring
    a book that matches today’s event keywords (if any)."""
    setting = SpotlightSetting.query.first()
    if not setting:
        _get_or_create_setting()
        return

    now = _now()
    if (now - setting.set_at) < timedelta(hours=ROTATION_HOURS):
        return

    exclude_id = setting.book_id
    book = _pick_event_book(exclude_id=exclude_id) or _pick_random_book(exclude_id=exclude_id)
    if not book:
        return

    setting.book_id = book.id
    setting.set_at = now
    setting.is_admin_override = False
    setting.set_by_id = None
    db.session.commit()


def get_current_spotlight():
    rotate_spotlight_if_expired()
    setting = SpotlightSetting.query.first()
    if not setting:
        setting = _get_or_create_setting()
    if not setting:
        return None, None

    book = Book.query.get(setting.book_id)
    if not book:
        book = _pick_random_book()
        if not book:
            return None, None
        setting.book_id = book.id
        setting.set_at = _now()
        setting.is_admin_override = False
        setting.set_by_id = None
        db.session.commit()

    expires_at = setting.set_at + timedelta(hours=ROTATION_HOURS)
    return book, {
        **setting.to_dict(),
        'expires_at': expires_at.isoformat() + 'Z',
    }


def set_admin_spotlight(book_id, admin_user_id):
    book = Book.query.get(book_id)
    if not book:
        return None, None

    now = _now()
    setting = SpotlightSetting.query.first()
    if not setting:
        setting = SpotlightSetting()
        db.session.add(setting)

    setting.book_id = book.id
    setting.set_at = now
    setting.is_admin_override = True
    setting.set_by_id = admin_user_id
    db.session.commit()

    expires_at = setting.set_at + timedelta(hours=ROTATION_HOURS)
    return book, {
        **setting.to_dict(),
        'expires_at': expires_at.isoformat() + 'Z',
    }
