"""
find_duplicate_books.py — READ ONLY. Report books with duplicate titles.

Groups books by normalized title (case/whitespace/punctuation-insensitive)
and, for each duplicate group, prints each record's id, exact title,
gutenberg_id, and how many dependent rows reference it (reservations,
transactions, reviews, likes, inventory logs, spotlights). Nothing is
modified — use this to decide which duplicate to keep.
"""
import re
import sys
from collections import defaultdict
from app import create_app

# Windows consoles default to cp1252 and choke on non-Latin titles.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
from app.models.book import Book
from app.models.reservation import Reservation
from app.models.transaction import Transaction
from app.models.review import Review
from app.models.like import UserBookLike
from app.models.inventory import InventoryLog


def norm(title):
    # lower, strip punctuation but keep unicode letters/digits, collapse whitespace
    t = (title or '').lower().strip()
    t = re.sub(r'[^\w\s]+', ' ', t, flags=re.UNICODE)
    return re.sub(r'\s+', ' ', t).strip()


def main():
    app = create_app()
    with app.app_context():
        books = Book.query.all()

        groups = defaultdict(list)
        for b in books:
            groups[norm(b.title)].append(b)

        dupes = {k: v for k, v in groups.items() if len(v) > 1}

        if not dupes:
            print("No duplicate titles found.")
            return

        print(f"Found {len(dupes)} duplicate title group(s):\n")
        for key, group in dupes.items():
            print(f"=== '{key}' ({len(group)} records) ===")
            for b in group:
                deps = {
                    'reservations': Reservation.query.filter_by(book_id=b.id).count(),
                    'transactions': Transaction.query.filter_by(book_id=b.id).count(),
                    'reviews': Review.query.filter_by(book_id=b.id).count(),
                    'likes': UserBookLike.query.filter_by(book_id=b.id).count(),
                    'inventory': InventoryLog.query.filter_by(book_id=b.id).count(),
                }
                dep_str = ', '.join(f"{k}={v}" for k, v in deps.items() if v)
                dep_str = dep_str or 'no dependents'
                print(f"  id={b.id}  gutenberg_id={b.gutenberg_id}  "
                      f"copies={getattr(b, 'total_copies', '?')}  "
                      f"title={b.title!r}")
                print(f"       deps: {dep_str}")
            print()


if __name__ == '__main__':
    main()
