import time
import requests
from app import create_app
from app.extensions import db
from app.models.book import Book

app = create_app()

def clean_covers():
    with app.app_context():
        books = Book.query.filter(Book.cover_image_url.isnot(None)).all()
        fixed = 0
        removed = 0
        for book in books:
            url = book.cover_image_url
            if not url:
                continue
                
            try:
                # Add default=false so OpenLibrary returns 404 instead of a blank 1x1 image
                test_url = url
                if 'openlibrary.org' in url and 'default=false' not in url:
                    test_url = f"{url}?default=false"
                
                # We use GET because sometimes HEAD is blocked or doesn't return full headers correctly
                r = requests.get(test_url, timeout=5)
                
                if r.status_code != 200 or len(r.content) < 100: # 1x1 gif is ~43 bytes
                    print(f"[{r.status_code}] Removing broken cover for: {book.title}")
                    book.cover_image_url = None
                    removed += 1
                else:
                    print(f"[{r.status_code}] Keeping cover for: {book.title}")
                    if test_url != url:
                         book.cover_image_url = test_url
                    fixed += 1
            except Exception as e:
                print(f"Error checking {book.title}: {e}")
                book.cover_image_url = None
                removed += 1
                
            db.session.commit()
            time.sleep(0.1) # Be nice to OpenLibrary

        print(f"Done! Kept {fixed} covers, removed {removed} broken covers.")

if __name__ == '__main__':
    clean_covers()
