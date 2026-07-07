"""
seed_book_quotes.py
-------------------
Seeds a set of SEED / EXAMPLE spotlight pull-quotes for classic books that are
likely already in the catalog. Each quote is written onto the matching Book row
(quote_text / quote_source), so it rides along on GET /spotlight and shows inside
the dashboard Spotlight card when that book is spotlighted.

IMPORTANT — these are STARTER quotes only:
  * They are marked quote_verified = False. An admin must review each one in
    Admin Panel -> Books -> Edit and tick "Quote verified" once accuracy and
    attribution are confirmed.
  * Only ~15-20 classics are covered here. Every other book still needs a quote
    added per-book via the admin book form.

Matching is by title (case-insensitive, substring) and is idempotent: a book
that already has a quote_text is left untouched, so re-running never clobbers
admin edits.

Run from the backend/ directory:  python seed_book_quotes.py
"""

from app import create_app
from app.extensions import db
from app.models.book import Book

# (title_match, quote_text, source_note)
# Keep quote_text <= 240 chars — the column and the API schema both cap it.
SEED_QUOTES = [
    ("Sherlock Holmes",
     "When you have eliminated the impossible, whatever remains, however improbable, must be the truth.",
     "The Sign of Four"),
    ("Adventures of Sherlock Holmes",
     "You see, but you do not observe. The distinction is clear.",
     "A Scandal in Bohemia"),
    ("Hound of the Baskervilles",
     "The world is full of obvious things which nobody by any chance ever observes.",
     "Ch. 3"),
    ("Pride and Prejudice",
     "It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.",
     "Ch. 1"),
    ("Moby Dick",
     "Call me Ishmael.",
     "Ch. 1"),
    ("Moby-Dick",
     "Call me Ishmael.",
     "Ch. 1"),
    ("A Tale of Two Cities",
     "It was the best of times, it was the worst of times.",
     "Book 1, Ch. 1"),
    ("Great Expectations",
     "Suffering has been stronger than all other teaching, and has taught me to understand what your heart used to be.",
     None),
    ("Frankenstein",
     "Beware; for I am fearless, and therefore powerful.",
     None),
    ("Dracula",
     "There are darknesses in life and there are lights, and you are one of the lights, the light of all lights.",
     None),
    ("The Picture of Dorian Gray",
     "The only way to get rid of a temptation is to yield to it.",
     "Ch. 2"),
    ("Alice's Adventures in Wonderland",
     "It's no use going back to yesterday, because I was a different person then.",
     None),
    ("Alice in Wonderland",
     "It's no use going back to yesterday, because I was a different person then.",
     None),
    ("Jane Eyre",
     "I am no bird; and no net ensnares me: I am a free human being with an independent will.",
     "Ch. 23"),
    ("Wuthering Heights",
     "Whatever our souls are made of, his and mine are the same.",
     "Ch. 9"),
    ("The Adventures of Huckleberry Finn",
     "All right, then, I'll go to hell.",
     "Ch. 31"),
    ("The Adventures of Tom Sawyer",
     "Work consists of whatever a body is obliged to do, and play consists of whatever a body is not obliged to do.",
     "Ch. 2"),
    ("War and Peace",
     "The strongest of all warriors are these two — Time and Patience.",
     None),
    ("Crime and Punishment",
     "Pain and suffering are always inevitable for a large intelligence and a deep heart.",
     None),
    ("The Great Gatsby",
     "So we beat on, boats against the current, borne back ceaselessly into the past.",
     "Ch. 9"),
]


def seed_quotes():
    app = create_app()
    with app.app_context():
        print("=" * 70)
        print("  SEED / EXAMPLE spotlight quotes")
        print("  These are UNVERIFIED starter quotes — confirm each per book in")
        print("  Admin Panel -> Books -> Edit -> 'Quote verified'.")
        print("=" * 70)

        applied = 0
        skipped_existing = 0
        skipped_missing = 0

        for title_match, quote_text, source_note in SEED_QUOTES:
            book = Book.query.filter(Book.title.ilike(f"%{title_match}%")).first()
            if not book:
                skipped_missing += 1
                print(f"[MISS ] no catalog book matches '{title_match}'")
                continue
            if book.quote_text:
                skipped_existing += 1
                print(f"[SKIP ] '{book.title}' already has a quote — left untouched")
                continue

            book.quote_text = quote_text[:240]
            book.quote_source = source_note
            book.quote_verified = False
            applied += 1
            print(f"[SEED ] '{book.title}' <- \"{quote_text[:50]}...\"")

        db.session.commit()

        print("-" * 70)
        print(f"Applied: {applied}   Skipped (already had quote): {skipped_existing}"
              f"   Skipped (no matching book): {skipped_missing}")
        print("Remember: add quotes for the rest of the catalog via the admin form,")
        print("and verify these seeded quotes before relying on them.")


if __name__ == "__main__":
    seed_quotes()
