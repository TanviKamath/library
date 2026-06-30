import random
from datetime import datetime, timezone, timedelta

from app.extensions import db
from app.models import Book
from app.models.spotlight import SpotlightSetting

ROTATION_HOURS = 24


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _eligible_books():
    pool = Book.query.filter(Book.cover_image_url.isnot(None)).all()
    if pool:
        return pool
    return Book.query.all()


def _pick_random_book(exclude_id=None):
    pool = _eligible_books()
    if exclude_id and len(pool) > 1:
        pool = [book for book in pool if book.id != exclude_id]
    if not pool:
        return None
    return random.choice(pool)


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
    """Rotate spotlight when the 24-hour window has passed."""
    setting = SpotlightSetting.query.first()
    if not setting:
        _get_or_create_setting()
        return

    now = _now()
    if (now - setting.set_at) < timedelta(hours=ROTATION_HOURS):
        return

    exclude_id = setting.book_id
    book = _pick_random_book(exclude_id=exclude_id)
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
