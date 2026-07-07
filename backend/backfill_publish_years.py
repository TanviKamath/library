"""
Backfill Book.publish_year from the Open Library API.

Populates the publish_year column (added for the recency-affinity signal in
the recommender) using the work-level ``first_publish_year`` from Open Library
search — robust to the synthetic ISBNs on Gutenberg imports.

Idempotent: only touches books where publish_year IS NULL, and commits per book
so it's safe to re-run or interrupt. 0.4s between calls to be nice to the API.

    python backfill_publish_years.py
"""
import time
import requests
from app import create_app
from app.extensions import db
from app.models.book import Book

# Sanity bounds — ignore absurd/garbage years.
MIN_YEAR = 1400
MAX_YEAR = 2100


def fetch_publish_year(title, author):
    """Return an int first-publication year for the book, or None."""
    try:
        resp = requests.get(
            "https://openlibrary.org/search.json",
            params={'title': title, 'author': author, 'limit': 1,
                    'fields': 'first_publish_year'},
            timeout=15,
        )
        if resp.status_code != 200:
            return None
        docs = resp.json().get('docs', [])
        if not docs:
            return None
        year = docs[0].get('first_publish_year')
        if isinstance(year, int) and MIN_YEAR <= year <= MAX_YEAR:
            return year
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None


def main():
    app = create_app()
    with app.app_context():
        books = Book.query.filter(Book.publish_year.is_(None)).all()
        total = len(books)
        updated = 0
        missing = 0
        print(f"Backfilling publish_year for {total} books with no value...\n")

        for idx, book in enumerate(books, 1):
            author = book.author.name if book.author else ''
            year = fetch_publish_year(book.title, author)
            if year:
                book.publish_year = year
                try:
                    db.session.commit()
                    updated += 1
                    tag = str(year)
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
        print(f"Done. Set publish_year on {updated}/{total} books "
              f"({missing} had no Open Library year data).")


if __name__ == '__main__':
    main()
