import shutil
import sqlite3
import random
from app import create_app
from app.extensions import db
from app.models import User, Book, Author, Category, Transaction
from datetime import datetime, timezone, timedelta

print("Copying backups/app_backup_20260623_195047.db to app.db...")
shutil.copyfile('backups/app_backup_20260623_195047.db', 'app.db')

conn = sqlite3.connect('app.db')
cursor = conn.cursor()
try:
    cursor.execute('ALTER TABLE book ADD COLUMN gutenberg_id INTEGER NULL;')
    conn.commit()
    print("Added gutenberg_id column to book table.")
except Exception as e:
    print("Column gutenberg_id might already exist:", e)
conn.close()

app = create_app()
with app.app_context():
    member1 = User.query.filter_by(email='member@bookworm.com').first()
    if not member1:
        member1 = User(username='member1', email='member@bookworm.com', full_name='Aarav Sharma', role='member') # pyrefly: ignore
        member1.set_password('member123')
        db.session.add(member1)
        db.session.commit()

    cat_fiction = Category.query.filter_by(name='Fiction').first() or Category.query.first()
    cat_scifi = Category.query.filter_by(name='Science Fiction').first() or Category.query.first()

    austen = Author.query.filter_by(name='Jane Austen').first() or Author(name='Jane Austen', bio='') # pyrefly: ignore
    shelley = Author.query.filter_by(name='Mary Shelley').first() or Author(name='Mary Shelley', bio='') # pyrefly: ignore
    carroll = Author.query.filter_by(name='Lewis Carroll').first() or Author(name='Lewis Carroll', bio='') # pyrefly: ignore
    db.session.add_all([austen, shelley, carroll])
    db.session.commit()

    print("Adding Gutenberg Free E-Books...")
    gb1 = Book(title='Pride and Prejudice', isbn='GUT-1342', author=austen, category=cat_fiction, cover_color='#D88C9A', cover_image_url='https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg', description='A romantic clash between Elizabeth Bennet and Mr. Darcy.', rating=4.9, total_copies=10, available_copies=10, gutenberg_id=1342) # pyrefly: ignore
    gb2 = Book(title='Frankenstein; Or, The Modern Prometheus', isbn='GUT-84', author=shelley, category=cat_scifi, cover_color='#4A5759', cover_image_url='https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg', description='Victor Frankenstein creates a sapient creature.', rating=4.7, total_copies=8, available_copies=8, gutenberg_id=84) # pyrefly: ignore
    gb3 = Book(title="Alice's Adventures in Wonderland", isbn='GUT-11', author=carroll, category=cat_fiction, cover_color='#8CB0D4', cover_image_url='https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg', description='Alice falls through a rabbit hole into a fantasy world.', rating=4.8, total_copies=12, available_copies=12, gutenberg_id=11) # pyrefly: ignore
    
    db.session.add_all([gb1, gb2, gb3])
    db.session.commit()

    print("Creating mock transactions...")
    all_books = Book.query.all()
    all_members = User.query.filter_by(role='member').all()
    now = datetime.now(timezone.utc)

    for i in range(15):
        b = random.choice(all_books)
        st = random.choice(['active', 'returned', 'overdue'])
        issued_at = now - timedelta(days=random.randint(3, 30))
        due_date = issued_at + timedelta(days=14)
        txn = Transaction(book=b, user=member1, type='issue', issued_at=issued_at, due_date=due_date, status=st)
        if st == 'returned':
            txn.returned_at = issued_at + timedelta(days=5)
            txn.type = 'return'
        elif st == 'overdue':
            txn.fine_amount = 45.0
            txn.fine_paid = False
        db.session.add(txn)

    for _ in range(25):
        m = random.choice(all_members)
        b = random.choice(all_books)
        st = random.choice(['active', 'returned', 'overdue'])
        issued_at = now - timedelta(days=random.randint(2, 30))
        due_date = issued_at + timedelta(days=14)
        txn = Transaction(book=b, user=m, type='issue', issued_at=issued_at, due_date=due_date, status=st)
        if st == 'returned':
            txn.returned_at = issued_at + timedelta(days=4)
            txn.type = 'return'
        elif st == 'overdue':
            txn.fine_amount = 50.0
            txn.fine_paid = random.choice([True, False])
        db.session.add(txn)

    db.session.commit()
    print("Restore Complete! Total Books:", Book.query.count(), "Total Txns:", Transaction.query.count())
