import os
import time
import requests
import urllib.parse
from app import create_app
from app.extensions import db
from app.models.book import Book

app = create_app()
COVER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'covers'))

def fetch_missing_covers():
    with app.app_context():
        books = Book.query.filter((Book.cover_image_url == None) | (Book.cover_image_url == '')).all()
        print(f"Found {len(books)} books missing covers. Fetching from OpenLibrary...")
        
        for book in books:
            title = book.title.encode('ascii', 'ignore').decode('ascii')
            print(f"Fetching cover for: {title}")
            try:
                # Query OpenLibrary API
                query = urllib.parse.quote(title)
                search_url = f"https://openlibrary.org/search.json?title={query}&limit=1"
                resp = requests.get(search_url, timeout=10)
                data = resp.json()
                
                cover_i = None
                if 'docs' in data and len(data['docs']) > 0:
                    cover_i = data['docs'][0].get('cover_i')
                
                if cover_i:
                    img_url = f"https://covers.openlibrary.org/b/id/{cover_i}-M.jpg"
                    
                    r = requests.get(img_url, timeout=10)
                    # Check if it's not a 1x1 blank image
                    if r.status_code == 200 and len(r.content) > 1000:
                        file_path = os.path.join(COVER_DIR, f"{book.id}.jpg")
                        with open(file_path, 'wb') as f:
                            f.write(r.content)
                        
                        book.cover_image_url = f"/covers/{book.id}.jpg"
                        db.session.commit()
                        print(f" -> Success! Downloaded for {title}")
                    else:
                        print(f" -> Failed or invalid image from {img_url}")
                else:
                    print(f" -> No cover found in OpenLibrary for {title}")
            except Exception as e:
                print(f" -> Error for {title}: {e}")
            
            time.sleep(1) # Be nice to API to avoid limits

if __name__ == '__main__':
    if not os.path.exists(COVER_DIR):
        os.makedirs(COVER_DIR)
    fetch_missing_covers()
