from datetime import datetime, timezone
from app.extensions import db


class SpotlightSetting(db.Model):
    __tablename__ = 'spotlight_setting'

    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id', ondelete='CASCADE'), nullable=False)
    set_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    is_admin_override = db.Column(db.Boolean, nullable=False, default=False)
    set_by_id = db.Column(db.Integer, db.ForeignKey('app_user.id', ondelete='SET NULL'), nullable=True)

    book = db.relationship('Book')
    set_by = db.relationship('User')

    def to_dict(self):
        return {
            'book_id': self.book_id,
            'set_at': self.set_at.isoformat() + 'Z' if self.set_at else None,
            'is_admin_override': self.is_admin_override,
            'set_by_id': self.set_by_id,
        }
