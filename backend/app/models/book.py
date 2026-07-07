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
    # Mild "famous book" boost, normalized ~0..1. Backfilled from borrow
    # count; used by the preference engine for popularity sensitivity.
    popularity_score = db.Column(db.Float, nullable=False, default=0.0)
    # Publication year — powers the recency-affinity signal (nudge only).
    publish_year = db.Column(db.Integer, nullable=True)
    # Length in pages — matched against the reader's skill_level / pace so
    # beginners get shorter picks and advanced readers get meatier ones.
    page_count = db.Column(db.Integer, nullable=True)
    # Short pull-quote from the book, shown inside the Spotlight card when this
    # book is the current spotlight. 240-char cap enforced here + in BookSchema.
    quote_text = db.Column(db.String(240), nullable=True)
    # Optional context for the quote, e.g. "Ch. 3".
    quote_source = db.Column(db.String(80), nullable=True)
    # Admin has confirmed the quote is accurate and correctly attributed.
    quote_verified = db.Column(db.Boolean, nullable=False, default=False)
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
            'popularity_score': self.popularity_score,
            'publish_year': self.publish_year,
            'page_count': self.page_count,
            'quote_text': self.quote_text,
            'quote_source': self.quote_source,
            'quote_verified': self.quote_verified,
            'total_copies': self.total_copies,
            'available_copies': self.available_copies,
            'gutenberg_id': self.gutenberg_id,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None
        }

    def __repr__(self):
        return f'<Book {self.title}>'
