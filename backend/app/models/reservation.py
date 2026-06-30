from app.extensions import db
from datetime import datetime, timezone

class Reservation(db.Model):
    __tablename__ = 'reservation'

    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default='waiting', index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    ready_at = db.Column(db.DateTime, nullable=True)

    book = db.relationship('Book', backref=db.backref('reservations', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('reservations', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'book_id': self.book_id,
            'book_title': self.book.title if self.book else None,
            'book_cover': self.book.cover_image_url if self.book else None,
            'user_id': self.user_id,
            'user_name': self.user.username if self.user else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'ready_at': self.ready_at.isoformat() + 'Z' if self.ready_at else None
        }

    def __repr__(self):
        return f'<Reservation {self.id} (Book {self.book_id}, User {self.user_id}, Status {self.status})>'
