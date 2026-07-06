"""
Script to fetch and update book descriptions from Open Library API
Run this to populate your books with actual plot summaries
"""
import requests
import time
from app import create_app
from app.extensions import db
from app.models.book import Book
import re

def fetch_open_library_description(title, author):
    """Fetch book description from Open Library API"""
    try:
        # Search for the book
        search_url = "https://openlibrary.org/search.json"
        params = {
            'title': title,
            'author': author,
            'limit': 1
        }
        
        response = requests.get(search_url, params=params, timeout=15)
        if response.status_code == 200:
            data = response.json()
            if data.get('numFound', 0) > 0:
                doc = data['docs'][0]
                
                # Try to get the work key to fetch full description
                if 'key' in doc:
                    work_key = doc['key']
                    work_url = f"https://openlibrary.org{work_key}.json"
                    work_response = requests.get(work_url, timeout=10)
                    
                    if work_response.status_code == 200:
                        work_data = work_response.json()
                        description = None
                        
                        # Description can be a string or dict with value
                        if 'description' in work_data:
                            desc = work_data['description']
                            if isinstance(desc, dict):
                                description = desc.get('value', '')
                            else:
                                description = desc
                        
                        if description:
                            # Clean HTML tags
                            description = re.sub('<[^<]+?>', '', description)
                            # Clean up markdown links
                            description = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', description)
                            # Limit length
                            if len(description) > 600:
                                description = description[:597] + '...'
                            return description
                
                # Fallback to first_sentence if available
                if 'first_sentence' in doc:
                    sentences = doc['first_sentence']
                    if isinstance(sentences, list) and len(sentences) > 0:
                        return sentences[0]
                    elif isinstance(sentences, str):
                        return sentences
        
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None

def update_book_descriptions():
    """Update descriptions for all books in the database"""
    app = create_app()
    
    with app.app_context():
        # Only get books with generic or missing descriptions
        books = Book.query.filter(
            (Book.description == None) | 
            (Book.description == '') | 
            (Book.description.like('%fascinating book%')) |
            (Book.description.like('%timeless volume%'))
        ).all()
        
        total = len(books)
        updated = 0
        failed = []
        
        print(f"Found {total} books with generic/missing descriptions...\n")
        
        for idx, book in enumerate(books, 1):
            print(f"[{idx}/{total}] {book.title} by {book.author.name}")
            
            description = fetch_open_library_description(book.title, book.author.name)
            
            if description and len(description) > 50:
                book.description = description
                try:
                    db.session.commit()
                    updated += 1
                    print(f"  ✓ Updated: {description[:80]}...")
                except Exception as e:
                    db.session.rollback()
                    print(f"  ✗ Database error: {e}")
                    failed.append(book.title)
            else:
                print(f"  ✗ No description found")
                failed.append(book.title)
            
            # Be nice to the API
            time.sleep(0.5)
        
        print(f"\n{'='*60}")
        print(f"Completed! Updated {updated} out of {total} books.")
        if failed:
            print(f"\nFailed to fetch descriptions for {len(failed)} books:")
            for title in failed[:10]:
                print(f"  - {title}")
            if len(failed) > 10:
                print(f"  ... and {len(failed) - 10} more")

if __name__ == '__main__':
    update_book_descriptions()
