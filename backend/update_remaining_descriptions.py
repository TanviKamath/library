"""
Script to update remaining generic descriptions with better fallback text
"""
from app import create_app
from app.extensions import db
from app.models.book import Book

# Better generic descriptions based on category
CATEGORY_DESCRIPTIONS = {
    'Fiction': 'An engaging work of fiction that explores compelling characters and intricate storytelling.',
    'Science Fiction': 'A thought-provoking science fiction tale that explores futuristic concepts and technological possibilities.',
    'Fantasy': 'An imaginative fantasy adventure filled with magical elements and extraordinary worlds.',
    'Mystery': 'A gripping mystery that will keep you guessing until the final reveal.',
    'Thriller': 'A pulse-pounding thriller filled with suspense, danger, and unexpected twists.',
    'Romance': 'A heartwarming romance that explores the complexities of love and relationships.',
    'Biography': 'An insightful biography chronicling the life and achievements of a remarkable individual.',
    'History': 'A comprehensive historical account that brings past events and figures to life.',
    'Non-Fiction': 'An informative non-fiction work that provides valuable insights and knowledge.',
    'Classic': 'A timeless literary classic that has captivated readers for generations.',
    'Adventure': 'An exciting adventure story filled with action, exploration, and daring exploits.',
    'Horror': 'A chilling horror tale that will keep you on the edge of your seat.',
    'Poetry': 'A beautiful collection of poetry that explores the depths of human emotion and experience.',
    'Drama': 'A powerful dramatic work that delves into complex human relationships and conflicts.',
    'Philosophy': 'A profound philosophical work that examines fundamental questions about existence and knowledge.',
    'Self-Help': 'A practical guide offering insights and strategies for personal growth and improvement.',
}

def update_remaining_descriptions():
    """Update books with generic descriptions"""
    app = create_app()
    
    with app.app_context():
        # Find books with generic descriptions
        books = Book.query.filter(
            (Book.description.like('%fascinating book%')) |
            (Book.description.like('%timeless volume%')) |
            (Book.description == '') |
            (Book.description == None)
        ).all()
        
        total = len(books)
        updated = 0
        
        print(f"Found {total} books with generic descriptions\n")
        
        for book in books:
            category_name = book.category.name if book.category else 'Fiction'
            
            # Get appropriate description based on category
            new_desc = CATEGORY_DESCRIPTIONS.get(
                category_name, 
                'A captivating book that offers readers an enriching literary experience.'
            )
            
            # For well-known classics, add more specific info
            title_lower = book.title.lower()
            author_lower = book.author.name.lower() if book.author else ''
            
            # Special cases for famous authors/books
            if 'james bond' in title_lower or 'ian fleming' in author_lower:
                new_desc = f"A thrilling James Bond adventure featuring espionage, action, and international intrigue as 007 faces dangerous enemies and impossible odds."
            elif 'shakespeare' in author_lower:
                new_desc = f"A masterful work by William Shakespeare, exploring timeless themes of human nature through powerful language and unforgettable characters."
            elif 'dickens' in author_lower:
                new_desc = f"A vivid portrayal of Victorian society by Charles Dickens, known for memorable characters and insightful social commentary."
            elif 'austen' in author_lower:
                new_desc = f"A witty and romantic novel by Jane Austen, offering sharp observations on society, relationships, and the human heart."
            elif 'tolkien' in author_lower:
                new_desc = f"An epic fantasy adventure set in Middle-earth, featuring rich world-building, memorable characters, and timeless themes of heroism and friendship."
            elif 'rowling' in author_lower or 'harry potter' in title_lower:
                new_desc = f"A magical adventure in the wizarding world, filled with friendship, courage, and the eternal battle between good and evil."
            
            book.description = new_desc
            updated += 1
            print(f"[{updated}/{total}] Updated: {book.title}")
        
        try:
            db.session.commit()
            print(f"\n✓ Successfully updated {updated} books!")
        except Exception as e:
            db.session.rollback()
            print(f"\n✗ Error: {e}")

if __name__ == '__main__':
    update_remaining_descriptions()
