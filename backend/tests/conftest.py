# pyrefly: ignore [missing-import]
import pytest
from app import create_app
from app.extensions import db
from app.models import User, Book, Category, Author

@pytest.fixture
def app():
    class TestConfig:
        TESTING = True
        SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
        SQLALCHEMY_TRACK_MODIFICATIONS = False
        JWT_SECRET_KEY = 'test-secret'
        SECRET_KEY = 'test-secret'
        # Disable rate limiting for tests
        RATELIMIT_ENABLED = False

    app = create_app(TestConfig)
    # Set up the in‑memory SQLite DB
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def init_db(app):
    admin = User(username='admin', email='admin@test.com', full_name='Admin Test', role='admin') # type: ignore
    admin.set_password('admin')

    member = User(username='member', email='member@test.com', full_name='Member Test', role='member') # type: ignore
    member.set_password('member')

    cat = Category(name='Fiction') # type: ignore
    author = Author(name='Test Author') # type: ignore
    db.session.add_all([admin, member, cat, author])
    db.session.commit()

    book = Book(title='Test Book', isbn='1234567890', author=author, category=cat, total_copies=5, available_copies=5) # type: ignore
    db.session.add(book)
    db.session.commit()

    return {'admin': admin, 'member': member, 'book': book}
