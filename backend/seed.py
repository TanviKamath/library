import random
from app import create_app
from app.extensions import db
from app.models import User, Book, Author, Category, Transaction
from datetime import datetime, timezone, timedelta

app = create_app()

def seed_data():
    with app.app_context():
        print("Clearing existing database...")
        db.drop_all()
        db.create_all()

        print("Seeding Users...")
        admin = User(username='admin', email='admin@bookworm.com', full_name='Admin User', role='admin')  # pyrefly: ignore
        admin.set_password('admin123')
        
        librarian = User(username='librarian', email='librarian@bookworm.com', full_name='Librarian User', role='librarian')  # pyrefly: ignore
        librarian.set_password('lib123')
        
        member1 = User(username='member1', email='member@bookworm.com', full_name='Aarav Sharma', role='member')  # pyrefly: ignore
        member1.set_password('member123')

        member2 = User(username='member2', email='priya@bookworm.com', full_name='Priya Patel', role='member')  # pyrefly: ignore
        member2.set_password('member123')

        member3 = User(username='member3', email='rahul@bookworm.com', full_name='Rahul Verma', role='member')  # pyrefly: ignore
        member3.set_password('member123')

        extra_members = []
        names = ["Ananya Gupta", "Rohan Mehta", "Ishita Singh", "Vikram Malhotra", "Kavya Reddy", "Aditya Joshi", "Neha Kapoor", "Siddharth Rao", "Pooja Nair", "Arjun Das"]
        for i, name in enumerate(names):
            m = User(username=f'member_{i+4}', email=f'user{i+4}@bookworm.com', full_name=name, role='member') # pyrefly: ignore
            m.set_password('password123')
            extra_members.append(m)

        all_members = [member1, member2, member3] + extra_members
        db.session.add_all([admin, librarian] + all_members)
        db.session.commit()

        print("Seeding Categories & Authors...")
        categories = {
            'Fiction': Category(name='Fiction', color='#D48C8C', book_count=0), # pyrefly: ignore
            'Non-Fiction': Category(name='Non-Fiction', color='#8CB0D4', book_count=0), # pyrefly: ignore
            'Sci-Fi': Category(name='Sci-Fi', color='#8CD49E', book_count=0), # pyrefly: ignore
            'Biography': Category(name='Biography', color='#D9D2C5', book_count=0), # pyrefly: ignore
            'Mystery': Category(name='Mystery', color='#C7A98E', book_count=0), # pyrefly: ignore
            'Romance': Category(name='Romance', color='#D88C9A', book_count=0) # pyrefly: ignore
        }
        db.session.add_all(categories.values())
        db.session.commit()

        print("Seeding Normal Library Catalog Books...")
        normal_books_data = [
            ("The Great Gatsby", "F. Scott Fitzgerald", "Fiction", "9780743273565", "#C9CBB0", "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=774&auto=format&fit=crop", "A tragic story of Jay Gatsby and his unrequited love for Daisy Buchanan.", 4.6, 6),
            ("Atomic Habits", "James Clear", "Non-Fiction", "9780735211292", "#D7CBB8", "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=774&auto=format&fit=crop", "An easy and proven way to build good habits and break bad ones.", 4.8, 8),
            ("Dune", "Frank Herbert", "Sci-Fi", "9780441172719", "#C1B8A5", "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=774&auto=format&fit=crop", "Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides.", 4.7, 5),
            ("Steve Jobs", "Walter Isaacson", "Biography", "9781451648539", "#D9D2C5", "https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=774&auto=format&fit=crop", "The exclusive biography of Steve Jobs, based on more than forty interviews.", 4.5, 4),
            ("Circe", "Madeline Miller", "Fiction", "9780316556347", "#C7A98E", "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=774&auto=format&fit=crop", "In the house of Helios, god of the sun, a daughter is born.", 4.3, 5),
            ("Sapiens", "Yuval Noah Harari", "Non-Fiction", "9780062316097", "#E0C9A6", "https://images.unsplash.com/photo-1495640388908-05fa85288e61?q=80&w=774&auto=format&fit=crop", "A brief history of humankind, exploring how Homo sapiens came to dominate.", 4.6, 7),
            ("The Alchemist", "Paulo Coelho", "Fiction", "9780062315007", "#D4C4A0", "https://images.unsplash.com/photo-1463320726281-696a485928c7?q=80&w=774&auto=format&fit=crop", "A magical fable about following your dream.", 4.1, 6),
            ("Project Hail Mary", "Andy Weir", "Sci-Fi", "9780593135204", "#8CD49E", "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=774&auto=format&fit=crop", "Ryland Grace is the sole survivor on a desperate, last-chance mission.", 4.9, 9),
            ("Silent Patient", "Alex Michaelides", "Mystery", "9781250301697", "#4A5759", "https://images.unsplash.com/photo-1476275466078-4007374efbbe?q=80&w=774&auto=format&fit=crop", "Alicia Berenson’s life is seemingly perfect until she shoots her husband.", 4.4, 5),
            ("Gone Girl", "Gillian Flynn", "Mystery", "9780307588371", "#D48C8C", "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=774&auto=format&fit=crop", "On the occasion of his fifth wedding anniversary, Nick Dunne reports his wife missing.", 4.2, 4),
            ("Becoming", "Michelle Obama", "Biography", "9781524763138", "#C7A98E", "https://images.unsplash.com/photo-1513001900722-370f803f498d?q=80&w=774&auto=format&fit=crop", "An intimate, powerful, and inspiring memoir by the former First Lady.", 4.8, 6),
            ("Educated", "Tara Westover", "Biography", "9780399590504", "#D9D2C5", "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?q=80&w=774&auto=format&fit=crop", "A memoir about a young girl who leaves her survivalist family and goes to college.", 4.7, 5),
            ("Thinking, Fast and Slow", "Daniel Kahneman", "Non-Fiction", "9780374533557", "#8CB0D4", "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=774&auto=format&fit=crop", "The renowned psychologist explains the two systems that drive the way we think.", 4.5, 6),
            ("Neuromancer", "William Gibson", "Sci-Fi", "9780441569595", "#C1B8A5", "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=774&auto=format&fit=crop", "The quintessential cyberpunk novel that introduced the matrix.", 4.3, 4),
            ("Normal People", "Sally Rooney", "Romance", "9781984822178", "#D88C9A", "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=774&auto=format&fit=crop", "A story of mutual fascination, friendship and love between Connell and Marianne.", 4.1, 5),
            ("Red, White & Royal Blue", "Casey McQuiston", "Romance", "9781250316776", "#D48C8C", "https://images.unsplash.com/photo-1511108690759-009998864025?q=80&w=774&auto=format&fit=crop", "What happens when America's First Son falls in love with the Prince of Wales.", 4.6, 7),
            ("Da Vinci Code", "Dan Brown", "Mystery", "9780307474278", "#C7A98E", "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=774&auto=format&fit=crop", "A murder in the Louvre Museum leads to a sinister religious conspiracy.", 4.0, 8),
            ("Foundation", "Isaac Asimov", "Sci-Fi", "9780553293357", "#8CD49E", "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=774&auto=format&fit=crop", "For twelve thousand years the Galactic Empire has ruled supreme.", 4.6, 5),
            ("Deep Work", "Cal Newport", "Non-Fiction", "9781455586691", "#E0C9A6", "https://images.unsplash.com/photo-1507842229356-51c6150fe5a3?q=80&w=774&auto=format&fit=crop", "Rules for focused success in a distracted world.", 4.6, 6),
            ("Klara and the Sun", "Kazuo Ishiguro", "Sci-Fi", "9780593318171", "#8CB0D4", "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=774&auto=format&fit=crop", "The story of Klara, an Artificial Friend with outstanding observational qualities.", 4.4, 4)
        ]

        authors = {}
        books_objs = []
        
        for title, auth_name, cat_name, isbn, color, cover_url, desc, rating, copies in normal_books_data:
            if auth_name not in authors:
                authors[auth_name] = Author(name=auth_name, bio='') # pyrefly: ignore
                db.session.add(authors[auth_name])
                db.session.commit()
            
            cat_obj = categories[cat_name]
            b = Book( # pyrefly: ignore
                title=title,
                author=authors[auth_name],
                category=cat_obj,
                isbn=isbn,
                cover_color=color,
                cover_image_url=cover_url,
                description=desc,
                rating=rating,
                total_copies=copies,
                available_copies=copies
            )
            db.session.add(b)
            cat_obj.book_count += 1
            books_objs.append(b)
        db.session.commit()

        print("Seeding Gutenberg Free E-Books...")
        ebooks_data = [
            ("Pride and Prejudice", "Jane Austen", "Romance", "GUT-1342", "#D88C9A", "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg", "A romantic clash between the opinionated Elizabeth Bennet and her arrogant suitor Mr. Darcy.", 4.9, 1342),
            ("Frankenstein; Or, The Modern Prometheus", "Mary Shelley", "Sci-Fi", "GUT-84", "#4A5759", "https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg", "Victor Frankenstein creates a sapient creature in an unorthodox scientific experiment.", 4.7, 84),
            ("Alice's Adventures in Wonderland", "Lewis Carroll", "Fiction", "GUT-11", "#8CB0D4", "https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg", "A young girl named Alice falls through a rabbit hole into a fantasy world.", 4.8, 11),
            ("The Yellow Wallpaper", "Charlotte Perkins Gilman", "Mystery", "GUT-1952", "#E0C9A6", "https://www.gutenberg.org/cache/epub/1952/pg1952.cover.medium.jpg", "A chilling collection of journal entries written by a woman suffering from post-partum depression.", 4.6, 1952)
        ]

        for title, auth_name, cat_name, isbn, color, cover_url, desc, rating, gid in ebooks_data:
            if auth_name not in authors:
                authors[auth_name] = Author(name=auth_name, bio='') # pyrefly: ignore
                db.session.add(authors[auth_name])
                db.session.commit()
            cat_obj = categories[cat_name]
            b = Book( # pyrefly: ignore
                title=title,
                author=authors[auth_name],
                category=cat_obj,
                isbn=isbn,
                cover_color=color,
                cover_image_url=cover_url,
                description=desc,
                rating=rating,
                total_copies=10,
                available_copies=10,
                gutenberg_id=gid
            )
            db.session.add(b)
            cat_obj.book_count += 1
            books_objs.append(b)
        db.session.commit()

        print("Seeding Mock Transactions & History...")
        now = datetime.now(timezone.utc)
        
        # Create 10 transactions specifically for member1 (Aarav Sharma)
        for i in range(10):
            b = random.choice(books_objs)
            st = random.choice(['active', 'returned', 'overdue'])
            issued_at = now - timedelta(days=random.randint(3, 25))
            due_date = issued_at + timedelta(days=14)
            
            txn = Transaction(
                book=b,
                user=member1,
                type='issue',
                issued_at=issued_at,
                due_date=due_date,
                status=st
            )
            if st == 'returned':
                txn.returned_at = issued_at + timedelta(days=random.randint(1, 12))
                txn.type = 'return'
            elif st == 'overdue':
                txn.fine_amount = 35.0 + (i * 10)
                txn.fine_paid = False
                if b.available_copies > 0: b.available_copies -= 1
            else:
                if b.available_copies > 0: b.available_copies -= 1
            db.session.add(txn)

        # Create 25 random transactions for extra members
        for _ in range(25):
            m = random.choice(extra_members)
            b = random.choice(books_objs)
            if b.available_copies > 0:
                st = random.choice(['active', 'returned', 'overdue'])
                issued_at = now - timedelta(days=random.randint(2, 30))
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
                    txn.returned_at = issued_at + timedelta(days=random.randint(1, 10))
                    txn.type = 'return'
                elif st == 'overdue':
                    txn.fine_amount = 50.0
                    txn.fine_paid = random.choice([True, False])
                    b.available_copies -= 1
                else:
                    b.available_copies -= 1
                db.session.add(txn)
        db.session.commit()

        print("Offline Seed Complete!")
        print(f"  Users: {User.query.count()}")
        print(f"  Books: {Book.query.count()} (20 normal + 4 ebooks)")
        print(f"  Transactions: {Transaction.query.count()}")

if __name__ == '__main__':
    seed_data()
