import os
import time
import requests
from app import create_app
from app.extensions import db
from app.models.book import Book

app = create_app()

COVER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'covers'))

def download_covers():
    with app.app_context():
        books = Book.query.filter(Book.cover_image_url.isnot(None)).all()
        print(f"Found {len(books)} books with covers. Downloading...")
        
        for book in books:
            url = book.cover_image_url
            if not url or url.startswith('/covers/'):
                continue
                
            fetch_url = url.split('?')[0]
            if 'covers.openlibrary.org' in fetch_url:
                fetch_url = fetch_url.replace('-L.jpg', '-M.jpg')
                
            file_path = os.path.join(COVER_DIR, f"{book.id}.jpg")
            
            try:
                if 'covers.openlibrary.org' in fetch_url:
                     fetch_url += '?default=false'
                     
                r = requests.get(fetch_url, timeout=5)
                if r.status_code == 200 and len(r.content) > 100:
                    with open(file_path, 'wb') as f:
                        f.write(r.content)
                    
                    book.cover_image_url = f"/covers/{book.id}.jpg"
                    db.session.commit()
                    print(f"Downloaded cover for book ID {book.id}")
                else:
                    book.cover_image_url = None
                    db.session.commit()
                    print(f"Removed broken cover for book ID {book.id}")
            except Exception as e:
                print(f"Failed to download for book ID {book.id}")
                book.cover_image_url = None
                db.session.commit()
                
            time.sleep(0.1)

        print("Finished downloading covers locally.")

if __name__ == '__main__':
    if not os.path.exists(COVER_DIR):
        os.makedirs(COVER_DIR)
    download_covers()
