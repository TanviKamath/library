"""
Backfill Book.page_count from the Open Library API.

Populates the page_count column (added for skill_level / pace matching in the
recommender). Uses the work-level ``number_of_pages_median`` from Open Library
search, which is robust to the synthetic ISBNs on Gutenberg imports.

Idempotent: only touches books where page_count IS NULL, and commits per book
so it's safe to re-run or interrupt. Be nice to the API — 0.4s between calls.

    python backfill_page_counts.py
"""
import time
import requests
from app import create_app
from app.extensions import db
from app.models.book import Book

# Sanity bounds — ignore absurd values (box sets, bad data).
MIN_PAGES = 20
MAX_PAGES = 5000


def fetch_page_count(title, author):
    """Return an int page count for the book, or None if unavailable."""
    try:
        resp = requests.get(
            "https://openlibrary.org/search.json",
            params={'title': title, 'author': author, 'limit': 1,
                    'fields': 'number_of_pages_median'},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        docs = resp.json().get('docs', [])
        if not docs:
            return None
        pages = docs[0].get('number_of_pages_median')
        if isinstance(pages, int) and MIN_PAGES <= pages <= MAX_PAGES:
            return pages
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None


def main():
    app = create_app()
    with app.app_context():
        books = Book.query.filter(Book.page_count.is_(None)).all()
        total = len(books)
        updated = 0
        missing = 0
        print(f"Backfilling page_count for {total} books with no value...\n")

        for idx, book in enumerate(books, 1):
            author = book.author.name if book.author else ''
            pages = fetch_page_count(book.title, author)
            if pages:
                book.page_count = pages
                try:
                    db.session.commit()
                    updated += 1
                    tag = f"{pages}pg"
                except Exception as e:
                    db.session.rollback()
                    tag = f"DB error: {e}"
            else:
                missing += 1
                tag = "no data"
            if idx % 20 == 0 or idx == total:
                print(f"[{idx}/{total}] updated={updated} missing={missing}  "
                      f"(last: {book.title[:40]} -> {tag})")
            time.sleep(0.4)

        print(f"\n{'='*60}")
        print(f"Done. Set page_count on {updated}/{total} books "
              f"({missing} had no Open Library page data).")


if __name__ == '__main__':
    main()
