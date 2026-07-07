"""
download_newest_covers.py
-------------------------
Downloads covers starting from the MOST RECENTLY added books (ID descending),
so the newly added 70 books get their covers immediately without waiting for old 1800s gutenberg books.
"""

import os
import time
from app.extensions import db
from app.models.book import Book
from download_all_covers import process_book, app, COVER_DIR

def main():
    with app.app_context():
        books = Book.query.order_by(Book.id.desc()).all()
        total = len(books)
        print(f"Checking covers for {total} books (starting from newest additions)...\n")

        ok = 0
        skipped = 0
        failed = 0

        for i, book in enumerate(books, 1):
            file_path = os.path.join(COVER_DIR, f"{book.id}.jpg")
            title_safe = book.title.encode('ascii', 'replace').decode('ascii')
            
            # If already downloaded, skip quickly
            if os.path.exists(file_path):
                if not book.cover_image_url or not book.cover_image_url.startswith('/covers/'):
                    book.cover_image_url = f"/covers/{book.id}.jpg"
                    db.session.commit()
                skipped += 1
                continue

            print(f"[{i:>3}/{total}] Fetching: {title_safe[:55]:<55} ", end="", flush=True)
            success = process_book(book)
            if success:
                ok += 1
                print("[OK]")
            else:
                failed += 1
                print("[FAIL]")

            time.sleep(0.12)

        print(f"\nDone! Downloaded: {ok}, Skipped (existing): {skipped}, Failed/Missing: {failed}")

if __name__ == "__main__":
    main()
