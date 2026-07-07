"""
download_all_covers.py
----------------------
Downloads cover images for all books in the database and stores them in
<workspace_root>/public/covers/<book_id>.jpg

Updates each book's cover_image_url in the DB to /covers/<id>.jpg so the
frontend serves them directly — no more proxy-image calls.

Run from the backend directory:
    python download_all_covers.py
"""

import os
import time
import requests
import urllib.parse
from app import create_app
from app.extensions import db
from app.models.book import Book

app = create_app()

# Workspace root is one level above backend/
WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# In the production image the frontend build lands at backend/static/covers (see Dockerfile),
# and there's no public/ dir. Prefer that when present; fall back to public/covers for local dev.
_STATIC_COVERS = os.path.join(os.path.dirname(__file__), 'static', 'covers')
_PUBLIC_COVERS = os.path.join(WORKSPACE_ROOT, 'public', 'covers')
COVER_DIR = _STATIC_COVERS if os.path.isdir(_STATIC_COVERS) else _PUBLIC_COVERS

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/125.0.0.0 Safari/537.36'
    ),
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://openlibrary.org/',
    'Cache-Control': 'no-cache',
}


def is_valid_image(content: bytes) -> bool:
    """Reject OpenLibrary's 1×1 blank GIF / tiny placeholder."""
    return len(content) > 1500


def download_url(url: str, timeout: int = 10) -> bytes | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        if r.status_code == 200 and is_valid_image(r.content):
            return r.content
    except Exception:
        pass
    return None


def openlibrary_search(title: str, author: str = '', isbn: str = '') -> str | None:
    """Search OpenLibrary for a cover ID by title (+ optional author) or ISBN."""
    if isbn:
        try:
            resp = requests.get(f"https://openlibrary.org/isbn/{isbn}.json", headers=HEADERS, timeout=10)
            covers = resp.json().get('covers', [])
            if covers:
                return f"https://covers.openlibrary.org/b/id/{covers[0]}-L.jpg"
        except Exception:
            pass
    query = urllib.parse.quote(f"{title} {author}".strip())
    try:
        resp = requests.get(
            f"https://openlibrary.org/search.json?title={query}&limit=1",
            headers=HEADERS,
            timeout=12
        )
        docs = resp.json().get('docs', [])
        if docs:
            cover_i = docs[0].get('cover_i')
            if cover_i:
                return f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg"
    except Exception:
        pass
    return None


def google_books_cover(title: str, author: str = '', isbn: str = '') -> str | None:
    """Search Google Books for a cover thumbnail URL."""
    queries = []
    if isbn:
        queries.append(f"isbn:{isbn}")
    queries.append(f"{title} {author}".strip())
    
    for q in queries:
        query = urllib.parse.quote(q)
        try:
            resp = requests.get(
                f"https://www.googleapis.com/books/v1/volumes?q={query}&maxResults=1",
                headers=HEADERS,
                timeout=12
            )
            items = resp.json().get('items', [])
            if items:
                img = items[0].get('volumeInfo', {}).get('imageLinks', {})
                # Prefer largest available
                for key in ['extraLarge', 'large', 'medium', 'thumbnail']:
                    url = img.get(key)
                    if url:
                        # Force HTTPS and request larger size
                        url = url.replace('http://', 'https://')
                        url = url.replace('&zoom=1', '&zoom=0')
                        return url
        except Exception:
            pass
    return None


def process_book(book: Book) -> bool:
    """
    Returns True if a cover was saved, False otherwise.
    """
    file_path = os.path.join(COVER_DIR, f"{book.id}.jpg")

    # Already downloaded locally
    if os.path.exists(file_path):
        if not book.cover_image_url or not book.cover_image_url.startswith('/covers/'):
            book.cover_image_url = f"/covers/{book.id}.jpg"
            db.session.commit()
        return True

    # --- Strategy 1: existing URL in DB ---
    existing_url = book.cover_image_url
    if existing_url and existing_url.startswith('http'):
        # Try sizes in order: L → M (L sometimes 404s)
        base_url = existing_url.split('?')[0]
        for size in ['-L.jpg', '-M.jpg']:
            fetch_url = base_url
            # Normalise to the target size
            for s in ['-L.jpg', '-M.jpg', '-S.jpg']:
                fetch_url = fetch_url.replace(s, size)
            content = download_url(fetch_url + '?default=false')
            if content:
                with open(file_path, 'wb') as f:
                    f.write(content)
                book.cover_image_url = f"/covers/{book.id}.jpg"
                db.session.commit()
                return True

    # --- Strategy 2: Google Books (more reliable, no auth needed) ---
    author_name = book.author.name if book.author else ''
    isbn = getattr(book, 'isbn', '') or ''
    gb_url = google_books_cover(book.title, author_name, isbn)
    if gb_url:
        content = download_url(gb_url)
        if content:
            with open(file_path, 'wb') as f:
                f.write(content)
            book.cover_image_url = f"/covers/{book.id}.jpg"
            db.session.commit()
            return True

    # --- Strategy 3: OpenLibrary search fallback ---
    ol_url = openlibrary_search(book.title, author_name, isbn)
    if ol_url:
        content = download_url(ol_url)
        if content:
            with open(file_path, 'wb') as f:
                f.write(content)
            book.cover_image_url = f"/covers/{book.id}.jpg"
            db.session.commit()
            return True

    return False


def main():
    os.makedirs(COVER_DIR, exist_ok=True)
    print(f"Saving covers to: {COVER_DIR}\n")

    with app.app_context():
        books = Book.query.all()
        total = len(books)
        print(f"Total books: {total}\n")

        ok = 0
        failed = []

        for i, book in enumerate(books, 1):
            title_safe = book.title.encode('ascii', 'replace').decode('ascii')
            prefix = f"[{i:>3}/{total}] {title_safe[:50]:<50}"
            success = process_book(book)
            if success:
                ok += 1
                print(f"{prefix} [OK]")
            else:
                failed.append(f"  ID {book.id}: {title_safe}")
                print(f"{prefix} [FAIL]  (no cover found)")

            # Polite delay to avoid rate-limiting
            time.sleep(0.15)

        print(f"\n{'─'*60}")
        print(f"Done. {ok}/{total} covers downloaded.")
        if failed:
            print(f"\nMissing covers ({len(failed)}):")
            for line in failed:
                print(line)


if __name__ == '__main__':
    main()
