"""
dedupe_book.py — safely merge one duplicate book record into another.

Reassigns every dependent row (reservations, transactions, reviews, likes,
inventory logs, spotlights, barista recommendations) from the duplicate to
the keeper, then deletes the duplicate book.

Usage:
    python dedupe_book.py --keep <KEEP_ID> --remove <REMOVE_ID>
    python dedupe_book.py --keep <KEEP_ID> --remove <REMOVE_ID> --dry-run

Always run --dry-run first and eyeball the two titles. Deleting a book is
not reversible.
"""
import sys
import argparse
from app import create_app
from app.extensions import db
from app.models.book import Book
from app.models.reservation import Reservation
from app.models.transaction import Transaction
from app.models.review import Review
from app.models.like import UserBookLike
from app.models.inventory import InventoryLog
from app.models.barista import BaristaInteractionLog

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--keep', type=int, required=True, help='book id to keep')
    parser.add_argument('--remove', type=int, required=True, help='duplicate book id to delete')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()

    if args.keep == args.remove:
        print("ERROR: --keep and --remove must differ.")
        sys.exit(1)

    app = create_app()
    with app.app_context():
        keeper = db.session.get(Book, args.keep)
        dupe = db.session.get(Book, args.remove)

        if not keeper:
            print(f"ERROR: keep id={args.keep} not found.")
            sys.exit(1)
        if not dupe:
            print(f"ERROR: remove id={args.remove} not found.")
            sys.exit(1)

        print(f"KEEP   id={keeper.id}  title={keeper.title!r}")
        print(f"REMOVE id={dupe.id}  title={dupe.title!r}")

        # Preserve inventory: keep the larger copy counts so deleting the
        # duplicate never silently loses stock.
        new_total = max(keeper.total_copies, dupe.total_copies)
        new_avail = max(keeper.available_copies, dupe.available_copies)
        if new_total != keeper.total_copies or new_avail != keeper.available_copies:
            print(f"  copies: total {keeper.total_copies}->{new_total}, "
                  f"available {keeper.available_copies}->{new_avail}")
            if not args.dry_run:
                keeper.total_copies = new_total
                keeper.available_copies = new_avail

        # (model, column) pairs that reference book.id
        reassign = [
            (Reservation, 'book_id'),
            (Transaction, 'book_id'),
            (Review, 'book_id'),
            (UserBookLike, 'book_id'),
            (InventoryLog, 'book_id'),
            (BaristaInteractionLog, 'book_recommended_id'),
        ]

        moved_total = 0
        for model, col in reassign:
            rows = model.query.filter(getattr(model, col) == dupe.id).all()
            if rows:
                print(f"  reassigning {len(rows)} {model.__name__} row(s) -> book {keeper.id}")
                moved_total += len(rows)
                if not args.dry_run:
                    for r in rows:
                        setattr(r, col, keeper.id)

        # Likes carry a unique (user_id, book_id) constraint — a user who liked
        # both records would collide on reassign. Drop those redundant likes.
        keeper_likers = {l.user_id for l in UserBookLike.query.filter_by(book_id=keeper.id)}
        for like in UserBookLike.query.filter_by(book_id=dupe.id):
            if like.user_id in keeper_likers:
                print(f"  dropping duplicate like from user {like.user_id}")
                if not args.dry_run:
                    db.session.delete(like)

        if args.dry_run:
            print(f"\nDRY RUN: would move {moved_total} dependent row(s) then delete book {dupe.id}. No changes written.")
            db.session.rollback()
            return

        db.session.delete(dupe)
        db.session.commit()
        print(f"\nDone. Moved {moved_total} dependent row(s); deleted book {dupe.id}.")
        remaining = Book.query.count()
        print(f"Total books in catalog now: {remaining}")


if __name__ == '__main__':
    main()
