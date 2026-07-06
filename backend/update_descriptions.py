"""
Script to fetch and update book descriptions from Google Books API
Run this to populate your books with actual plot summaries
"""
import requests
import time
from app import create_app
from app.extensions import db
from app.models.book import Book

def fetch_google_books_description(title, author):
    """Fetch book description from Google Books API"""
    try:
        # Clean up the query
        query = f"{title} {author}".strip()
        url = "https://www.googleapis.com/books/v1/volumes"
        params = {
            'q': query,
            'maxResults': 1
        }
        
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get('totalItems', 0) > 0:
                volume_info = data['items'][0].get('volumeInfo', {})
                description = volume_info.get('description', '')
                
                # Clean up the description - remove HTML tags if present
                if description:
                    # Basic HTML tag removal
                    import re
                    description = re.sub('<[^<]+?>', '', description)
                    # Limit to reasonable length (around 300-500 characters)
                    if len(description) > 500:
                        description = description[:497] + '...'
                    return description
        return None
    except Exception as e:
        print(f"Error fetching description: {e}")
        return None

def update_book_descriptions():
    """Update descriptions for all books in the database"""
    app = create_app()
    
    with app.app_context():
        books = Book.query.all()
        total = len(books)
        updated = 0
        
        print(f"Found {total} books to process...")
        
        for idx, book in enumerate(books, 1):
            # Skip if already has a good description (more than 50 chars)
            if book.description and len(book.description) > 50:
                print(f"[{idx}/{total}] Skipping '{book.title}' - already has description")
                continue
            
            print(f"[{idx}/{total}] Fetching description for: {book.title} by {book.author.name}")
            
            description = fetch_google_books_description(book.title, book.author.name)
            
            if description:
                book.description = description
                db.session.commit()
                updated += 1
                print(f"  ✓ Updated successfully")
            else:
                print(f"  ✗ No description found")
            
            # Be nice to the API - add delay
            time.sleep(1)
        
        print(f"\nCompleted! Updated {updated} out of {total} books.")

if __name__ == '__main__':
    update_book_descriptions()
