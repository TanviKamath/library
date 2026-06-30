import sys
import time
import requests
import urllib.parse
from app import create_app
from app.extensions import db
from app.models.book import Book

app = create_app()

def get_google_books_cover(title, author_name):
    query = f"intitle:\"{title}\""
    url = f"https://www.googleapis.com/books/v1/volumes?q={urllib.parse.quote(query)}"
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            data = r.json()
            if 'items' in data and len(data['items']) > 0:
                for item in data['items']:
                    image_links = item.get('volumeInfo', {}).get('imageLinks', {})
                    # Prefer thumbnail, fallback to smallThumbnail
                    cover = image_links.get('thumbnail') or image_links.get('smallThumbnail')
                    if cover:
                        return cover.replace('http://', 'https://')
    except Exception as e:
        print(f"Error fetching for {title}: {e}")
    return None

def fix_covers():
    with app.app_context():
        books = Book.query.all()
        for book in books:
            author_name = book.author.name if book.author else ''
            print(f"Fetching cover for: {book.title}")
            new_cover = get_google_books_cover(book.title, author_name)
            if new_cover:
                print(f"  -> Found cover: {new_cover}")
                book.cover_image_url = new_cover
            else:
                print("  -> No cover found on Google Books.")
                book.cover_image_url = None
            db.session.commit()
            time.sleep(0.2)
        print("Done!")

if __name__ == '__main__':
    fix_covers()
