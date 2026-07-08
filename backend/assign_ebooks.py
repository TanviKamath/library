"""
assign_ebooks.py — flag catalog books as e-books by assigning gutenberg_id.

A book shows up in the E-Book Library only if it has a gutenberg_id
(see /books?ebook_only=true). This script matches books already in your
catalog against a map of classic titles and sets their gutenberg_id.

It does NOT download anything — the reader streams text live from
gutenberg.org, so assigning the id is all that's needed.

Matching is case-insensitive and ignores surrounding whitespace, so minor
title differences (e.g. "Frankenstein; or," vs "Frankenstein; Or,") still match.

Run it against whichever database DATABASE_URL points at:

    python assign_ebooks.py            # apply changes
    python assign_ebooks.py --dry-run  # report only, change nothing

Idempotent: books that already have a gutenberg_id are left untouched.
"""
import sys
from app import create_app
from app.extensions import db
from app.models.book import Book

# title -> Project Gutenberg id
CLASSIC_GUTENBERG_MAP = {
    "Alice's Adventures in Wonderland": 11,
    "Frankenstein; or, The Modern Prometheus": 84,
    "Frankenstein; Or, The Modern Prometheus": 84,
    "The Wonderful Wizard of Oz": 55,
    "Dracula": 345,
    "The Time Machine": 35,
    "Flatland": 201,
    "The Invisible Man": 5230,
    "The War of the Worlds": 36,
    "A Princess of Mars": 62,
    "Pride and Prejudice": 1342,
    "The Picture of Dorian Gray": 174,
    "The Adventures of Sherlock Holmes": 1661,
    "Moby Dick": 2701,
    "Moby-Dick; or, The Whale": 2701,
    "Romeo and Juliet": 1513,
    "Great Expectations": 1400,
    "Jane Eyre": 1260,
    "Wuthering Heights": 768,
    "Sailing Alone Around the World": 6317,
    "Sailing alone around the world": 6317,
    "The Yellow Wallpaper": 1952,
    "The Yellow Wall-Paper": 1952,
}

# normalized-title -> id, so lookups are case/whitespace insensitive
_NORMALIZED_MAP = {k.strip().lower(): v for k, v in CLASSIC_GUTENBERG_MAP.items()}


def main():
    dry_run = '--dry-run' in sys.argv

    app = create_app()
    with app.app_context():
        books = Book.query.all()

        assigned = []       # (title, gid)
        already = []        # titles that already had an id
        matched_titles = set()

        for b in books:
            key = (b.title or '').strip().lower()
            gid = _NORMALIZED_MAP.get(key)
            if gid is None:
                continue
            matched_titles.add(key)
            if b.gutenberg_id:
                already.append(b.title)
                continue
            if not dry_run:
                b.gutenberg_id = gid
            assigned.append((b.title, gid))

        if not dry_run and assigned:
            db.session.commit()

        # gutenberg ids in the map that were NOT matched to any catalog book
        matched_ids = {_NORMALIZED_MAP[k] for k in matched_titles}
        # one representative title per unmatched id
        missing_by_id = {}
        for title, gid in CLASSIC_GUTENBERG_MAP.items():
            if gid not in matched_ids and gid not in missing_by_id:
                missing_by_id[gid] = title

        print("\n--- Assign E-Books Summary ---")
        print(f"Mode: {'DRY RUN (no changes written)' if dry_run else 'APPLIED'}")
        print(f"Newly assigned gutenberg_id: {len(assigned)}")
        for title, gid in assigned:
            print(f"  [+] {title}  ->  {gid}")
        print(f"Already had gutenberg_id: {len(already)}")
        for title in already:
            print(f"  [=] {title}")

        total_ebooks = Book.query.filter(Book.gutenberg_id.isnot(None)).count()
        print(f"\nTotal e-books in catalog now: {total_ebooks}")

        if missing_by_id:
            print(f"\nClassic titles in the map NOT found in this catalog "
                  f"({len(missing_by_id)} books):")
            for gid, title in missing_by_id.items():
                print(f"  [ ] {title}  (id {gid})")
            print("\nTo offer these too, add matching books to the catalog first,\n"
                  "then re-run this script.")


if __name__ == '__main__':
    main()
