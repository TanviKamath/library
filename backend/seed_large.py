import sys
import random
import requests
from faker import Faker
from app import create_app
from app.extensions import db
from app.models import User, Book, Author, Category, Transaction
from datetime import datetime, timezone, timedelta

app = create_app()
faker = Faker()

def fetch_books_from_openlibrary(subject, limit=50):
    try:
        url = f"https://openlibrary.org/subjects/{subject}.json?limit={limit}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json().get('works', [])
    except Exception as e:
        print(f"OpenLibrary fetch error for {subject}: {e}")
    return []

def fetch_books_from_google(subject, limit=40):
    try:
        url = f"https://www.googleapis.com/books/v1/volumes?q=subject:{subject}&maxResults={min(limit, 40)}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            items = response.json().get('items', [])
            works = []
            for item in items:
                vol = item.get('volumeInfo', {})
                if not vol.get('title') or not vol.get('authors'):
                    continue
                works.append({
                    'title': vol.get('title'),
                    'authors': [{'name': a} for a in vol.get('authors', [])],
                    'cover_id': None,
                    'cover_url': vol.get('imageLinks', {}).get('thumbnail') or vol.get('imageLinks', {}).get('smallThumbnail'),
                    'description': vol.get('description', f"A fascinating book about {subject.replace('_', ' ')}.")
                })
            return works
    except Exception as e:
        print(f"Google Books fetch error for {subject}: {e}")
    return []

def seed_large_data():
    with app.app_context():
        # Clear existing data
        db.drop_all()
        db.create_all()

        print("Creating users...")
        # Users
        admin = User(username='admin', email='admin@bookworm.com', full_name='Admin User', role='admin') # pyrefly: ignore
        admin.set_password('admin123')
        
        librarian = User(username='librarian', email='librarian@bookworm.com', full_name='Librarian User', role='librarian') # pyrefly: ignore
        librarian.set_password('lib123')
        
        member1 = User(username='member1', email='member@bookworm.com', full_name='Aarav Sharma', role='member') # pyrefly: ignore
        member1.set_password('member123')
        
        db.session.add_all([admin, librarian, member1])

        # Generate 50 fake members
        members = []
        for i in range(50):
            profile = faker.profile()
            username = profile['username']
            # ensure unique username
            username = f"{username}_{i}"
            email = faker.unique.email()
            full_name = profile['name']
            member = User(username=username, email=email, full_name=full_name, role='member') # pyrefly: ignore
            member.set_password('password123')
            members.append(member)
            
        db.session.add_all(members)
        db.session.commit()

        print("Fetching and creating categories and books from Open Library & Google Books API...")
        # Expanded to 10 categories with limit=50 to easily surpass 200 books
        subjects = [
            'fiction', 'science_fiction', 'romance', 'history', 'programming',
            'mystery', 'fantasy', 'thriller', 'biography', 'business'
        ]
        colors = [
            '#D48C8C', '#8CB0D4', '#8CD49E', '#D9D2C5', '#C7A98E',
            '#B08CB0', '#8CD4C7', '#E0C9A6', '#C5D9D2', '#D4A68C'
        ]
        
        for i, subject in enumerate(subjects):
            cat_name = subject.replace('_', ' ').title()
            cat = Category(name=cat_name, color=colors[i], book_count=0) # pyrefly: ignore
            db.session.add(cat)
            db.session.commit() # Commit to get ID

            print(f"Fetching books for {cat_name}...")
            works = fetch_books_from_openlibrary(subject, limit=50)
            
            # If Open Library returns fewer books than expected, supplement with Google Books API
            if len(works) < 30:
                print(f"Supplementing {cat_name} with Google Books API...")
                google_works = fetch_books_from_google(subject, limit=40)
                works.extend(google_works)
            
            for work in works:
                # Open Library / Google Books authors
                authors_data = work.get('authors', [])
                if not authors_data:
                    continue
                author_name = authors_data[0].get('name')
                if not author_name:
                    continue
                
                # Check if author exists
                author = Author.query.filter_by(name=author_name).first()
                if not author:
                    author = Author(name=author_name, bio='') # pyrefly: ignore
                    db.session.add(author)
                    db.session.commit()
                
                # Title
                title = work.get('title')
                if not title:
                    continue
                
                # Check if book already exists to prevent duplicate titles
                existing_book = Book.query.filter_by(title=title).first()
                if existing_book:
                    continue

                isbn = faker.unique.isbn13().replace('-', '')

                # Cover Image
                cover_id = work.get('cover_id')
                cover_url = work.get('cover_url')
                if cover_id:
                    cover_image_url = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"
                elif cover_url:
                    cover_image_url = cover_url
                else:
                    cover_image_url = None
                
                description = work.get('description') or ("A fascinating book about " + subject.replace('_', ' ') + ".")
                if isinstance(description, dict):
                    description = description.get('value', "A fascinating book about " + subject.replace('_', ' ') + ".")

                # Create Book
                book = Book( # pyrefly: ignore
                    title=title,
                    isbn=isbn,
                    author=author,
                    category=cat,
                    cover_color=random.choice(['#C9CBB0', '#D7CBB8', '#C1B8A5', '#D9D2C5', '#C7A98E', '#E0C9A6', '#D4C4A0']),
                    cover_image_url=cover_image_url,
                    description=description[:500],
                    rating=round(random.uniform(3.0, 5.0), 1),
                    total_copies=random.randint(1, 10),
                )
                book.available_copies = book.total_copies
                db.session.add(book)
                cat.book_count += 1
            
            db.session.commit()
            
        print("Adding Gutenberg classic e-books...")
        gutenberg_author1 = Author.query.filter_by(name='Jane Austen').first() or Author(name='Jane Austen', bio='English novelist')
        gutenberg_author2 = Author.query.filter_by(name='Mary Shelley').first() or Author(name='Mary Shelley', bio='English novelist')
        gutenberg_author3 = Author.query.filter_by(name='Lewis Carroll').first() or Author(name='Lewis Carroll', bio='English author')
        db.session.add_all([gutenberg_author1, gutenberg_author2, gutenberg_author3])
        db.session.commit()
        
        cat_fiction_obj = Category.query.filter_by(name='Fiction').first() or cat
        cat_scifi_obj = Category.query.filter_by(name='Science Fiction').first() or cat
        
        gb1 = Book(
            title='Pride and Prejudice',
            isbn='GUT-1342',
            author=gutenberg_author1,
            category=cat_fiction_obj,
            cover_color='#D88C9A',
            cover_image_url='https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
            description='A romantic clash between the opinionated Elizabeth Bennet and her arrogant suitor Mr. Darcy.',
            rating=4.9,
            total_copies=10,
            available_copies=10,
            gutenberg_id=1342
        )
        gb2 = Book(
            title='Frankenstein; Or, The Modern Prometheus',
            isbn='GUT-84',
            author=gutenberg_author2,
            category=cat_scifi_obj,
            cover_color='#4A5759',
            cover_image_url='https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
            description='Victor Frankenstein creates a sapient creature in an unorthodox scientific experiment.',
            rating=4.7,
            total_copies=8,
            available_copies=8,
            gutenberg_id=84
        )
        gb3 = Book(
            title="Alice's Adventures in Wonderland",
            isbn='GUT-11',
            author=gutenberg_author3,
            category=cat_fiction_obj,
            cover_color='#8CB0D4',
            cover_image_url='https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg',
            description='A young girl named Alice falls through a rabbit hole into a fantasy world of anthropomorphic creatures.',
            rating=4.8,
            total_copies=12,
            available_copies=12,
            gutenberg_id=11
        )
        db.session.add_all([gb1, gb2, gb3])
        db.session.commit()

        print("Creating mock transactions...")
        all_books = Book.query.all()
        all_members = User.query.filter_by(role='member').all()
        now = datetime.now(timezone.utc)
        
        for _ in range(45):
            m = random.choice(all_members)
            b = random.choice(all_books)
            if b.available_copies > 0:
                st = random.choice(['active', 'returned', 'overdue', 'renewed'])
                issued_at = now - timedelta(days=random.randint(4, 35))
                due_date = issued_at + timedelta(days=14)
                
                txn = Transaction(
                    book=b,
                    user=m,
                    type='issue',
                    issued_at=issued_at,
                    due_date=due_date,
                    status=st
                )
                if st == 'returned':
                    txn.returned_at = issued_at + timedelta(days=random.randint(1, 13))
                    txn.type = 'return'
                elif st == 'overdue':
                    txn.fine_amount = round(random.uniform(15.0, 75.0), 2)
                    txn.fine_paid = random.choice([True, False])
                    b.available_copies -= 1
                else:
                    b.available_copies -= 1
                db.session.add(txn)
        db.session.commit()

        print("Database seeded successfully with large dataset!")
        print(f"  Users: {User.query.count()} (admin, librarian, 50 members)")
        print(f"  Books: {Book.query.count()}")
        print(f"  Categories: {Category.query.count()}")
        print(f"  Authors: {Author.query.count()}")
        print(f"  Transactions: {Transaction.query.count()}")

if __name__ == '__main__':
    seed_large_data()
