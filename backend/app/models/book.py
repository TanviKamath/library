from app.extensions import db
from datetime import datetime, timezone

class Author(db.Model):
    __tablename__ = 'author'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False, index=True)
    bio = db.Column(db.Text)

    books = db.relationship('Book', back_populates='author')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'bio': self.bio
        }

class Category(db.Model):
    __tablename__ = 'category'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    color = db.Column(db.String(20)) # hex color
    book_count = db.Column(db.Integer, default=0)

    books = db.relationship('Book', back_populates='category')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'book_count': self.book_count
        }

class Book(db.Model):
    __tablename__ = 'book'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False, index=True)
    isbn = db.Column(db.String(20), unique=True, nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('author.id'), nullable=False, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=False, index=True)
    cover_color = db.Column(db.String(20))
    cover_image_url = db.Column(db.String(255))
    description = db.Column(db.Text)
    rating = db.Column(db.Float, default=0.0, index=True)
    total_copies = db.Column(db.Integer, nullable=False, default=0)
    available_copies = db.Column(db.Integer, nullable=False, default=0)
    gutenberg_id = db.Column(db.Integer, nullable=True, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

    author = db.relationship('Author', back_populates='books')
    category = db.relationship('Category', back_populates='books')
    transactions = db.relationship('Transaction', back_populates='book', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'isbn': self.isbn,
            'author_id': self.author_id,
            'author_name': self.author.name if self.author else None,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'cover_color': self.cover_color,
            'cover_image_url': self.cover_image_url,
            'description': self.description,
            'rating': self.rating,
            'total_copies': self.total_copies,
            'available_copies': self.available_copies,
            'gutenberg_id': self.gutenberg_id,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None
        }

    def __repr__(self):
        return f'<Book {self.title}>'
