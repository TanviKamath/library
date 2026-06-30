from app.extensions import db
from datetime import datetime, timezone

class UserBookLike(db.Model):
    __tablename__ = 'user_book_like'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id', ondelete='CASCADE'), nullable=False)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id', ondelete='CASCADE'), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    # Define a unique constraint to prevent duplicate likes
    __table_args__ = (
        db.UniqueConstraint('user_id', 'book_id', name='uq_user_book_like'),
    )

    user = db.relationship('User', backref=db.backref('liked_books_assoc', cascade='all, delete-orphan', lazy='dynamic'))
    book = db.relationship('Book', backref=db.backref('liked_by_users_assoc', cascade='all, delete-orphan', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'book_id': self.book_id,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None
        }

    def __repr__(self):
        return f'<UserBookLike user={self.user_id} book={self.book_id}>'
