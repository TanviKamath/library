"""
seed_more_book_quotes.py
------------------------
Second, larger batch of SEED / EXAMPLE spotlight pull-quotes for well-known
books in the catalog. Complements seed_book_quotes.py (which only covered ~13
matched classics) so that far more of the 391-book catalog has a quote to show
inside the dashboard Spotlight card.

Differences from seed_book_quotes.py:
  * Matching is by EXACT title (case-insensitive), NOT substring. This avoids
    collisions like the one-word title "It" matching every book that merely
    contains "it".
  * Idempotent: a book that already has a quote_text is left untouched, so
    re-running never clobbers admin edits or the first seed batch.

IMPORTANT — these are STARTER quotes only:
  * They are marked quote_verified = False. An admin must review each one in
    Admin Panel -> Books -> Edit and tick "Quote verified" once accuracy and
    attribution are confirmed.
  * Only famous, widely-attributed lines were included. Technical manuals,
    obscure titles, and most non-English editions were deliberately skipped.

Run from the backend/ directory:  python seed_more_book_quotes.py
"""

from app import create_app
from app.extensions import db
from app.models.book import Book

# (exact_title, quote_text, source_note)
# Keep quote_text <= 240 chars — the column and the API schema both cap it.
SEED_QUOTES = [
    # ---- Classic fiction (public domain) ----
    ("A Christmas Carol",
     "I will honour Christmas in my heart, and try to keep it all the year.",
     "Stave 5"),
    ("Adventures of Huckleberry Finn",
     "All right, then, I'll go to hell.",
     "Ch. 31"),
    ("A Midsummer Night's Dream",
     "The course of true love never did run smooth.",
     "Act 1, Sc. 1"),
    ("Anne of Green Gables",
     "Isn't it nice to think that tomorrow is a new day with no mistakes in it yet?",
     "Ch. 21"),
    ("Antony and Cleopatra",
     "Age cannot wither her, nor custom stale her infinite variety.",
     "Act 2, Sc. 2"),
    ("Brave New World",
     "But I don't want comfort. I want God, I want poetry, I want real danger, I want freedom, I want goodness. I want sin.",
     None),
    ("Candide",
     "We must cultivate our garden.",
     "Conclusion"),
    ("David Copperfield",
     "Whether I shall turn out to be the hero of my own life, or whether that station will be held by anybody else, these pages must show.",
     "Ch. 1"),
    ("Dubliners",
     "His soul swooned slowly as he heard the snow falling faintly through the universe.",
     "The Dead"),
    ("Fahrenheit 451",
     "It was a pleasure to burn.",
     "Opening line"),
    ("Foundation",
     "Violence is the last refuge of the incompetent.",
     None),
    ("Heart of Darkness",
     "The horror! The horror!",
     None),
    ("His Last Bow [8 stories]",
     "There's an east wind coming, Watson.",
     "His Last Bow"),
    ("Julius Caesar",
     "The fault, dear Brutus, is not in our stars, but in ourselves, that we are underlings.",
     "Act 1, Sc. 2"),
    ("Little Women",
     "I am not afraid of storms, for I am learning how to sail my ship.",
     None),
    ("Lord of the Flies",
     "Maybe there is a beast... maybe it's only us.",
     "Ch. 5"),
    ("Macbeth",
     "Life's but a walking shadow, a poor player that struts and frets his hour upon the stage, and then is heard no more.",
     "Act 5, Sc. 5"),
    ("Nineteen Eighty-Four",
     "War is peace. Freedom is slavery. Ignorance is strength.",
     None),
    ("Oliver Twist",
     "Please, sir, I want some more.",
     "Ch. 2"),
    ("Paradise Lost",
     "The mind is its own place, and in itself can make a Heaven of Hell, a Hell of Heaven.",
     "Book 1"),
    ("Peter Pan",
     "To die will be an awfully big adventure.",
     None),
    ("Romeo and Juliet",
     "What's in a name? That which we call a rose by any other name would smell as sweet.",
     "Act 2, Sc. 2"),
    ("Sense and Sensibility",
     "The more I know of the world, the more am I convinced that I shall never see a man whom I can really love.",
     None),
    ("Sonnets",
     "Shall I compare thee to a summer's day? Thou art more lovely and more temperate.",
     "Sonnet 18"),
    ("Through the Looking-Glass",
     "It's a poor sort of memory that only works backwards.",
     None),
    ("Treasure Island",
     "Fifteen men on the dead man's chest — yo-ho-ho, and a bottle of rum!",
     None),
    ("Two years before the mast",
     "There is not so helpless and pitiable an object in the world as a landsman beginning a sailor's life.",
     "Ch. 1"),
    ("Walden",
     "I went to the woods because I wished to live deliberately.",
     None),
    ("Leaves of Grass",
     "Do I contradict myself? Very well then I contradict myself, (I am large, I contain multitudes.)",
     "Song of Myself"),
    ("Narrative of the life of Frederick Douglass",
     "Once you learn to read, you will be forever free.",
     None),
    ("Up from Slavery",
     "Success is to be measured not so much by the position that one has reached in life as by the obstacles which one has overcome.",
     None),
    ("Three Men in a Boat (to say nothing of the dog)",
     "I like work: it fascinates me. I can sit and look at it for hours.",
     None),
    ("Murder on the Orient Express",
     "The impossible could not have happened, therefore the impossible must be possible in spite of appearances.",
     None),
    ("Casino Royale",
     "The scent and smoke and sweat of a casino are nauseating at three in the morning.",
     "Opening line"),

    # ---- Fantasy / sci-fi ----
    ("Dune",
     "I must not fear. Fear is the mind-killer.",
     "Litany Against Fear"),
    ("The Hobbit",
     "In a hole in the ground there lived a hobbit.",
     "Opening line"),
    ("The Fellowship of the Ring",
     "Not all those who wander are lost.",
     None),
    ("The Wonderful Wizard of Oz",
     "There is no place like home.",
     None),
    ("The Time Machine",
     "There is no difference between Time and any of the three dimensions of Space except that our consciousness moves along it.",
     "Ch. 1"),
    ("The War of the Worlds",
     "Intellects vast and cool and unsympathetic regarded this earth with envious eyes.",
     "Book 1, Ch. 1"),
    ("The Handmaid's Tale",
     "Nolite te bastardes carborundorum. (Don't let the bastards grind you down.)",
     None),
    ("The Hunger Games",
     "May the odds be ever in your favor.",
     None),
    ("Harry Potter and the Philosopher's Stone",
     "It does not do to dwell on dreams and forget to live.",
     "Ch. 12"),
    ("Harry Potter and the Chamber of Secrets",
     "It is our choices, Harry, that show what we truly are, far more than our abilities.",
     "Ch. 18"),
    ("Harry Potter and the Deathly Hallows",
     "Do not pity the dead, Harry. Pity the living, and, above all, those who live without love.",
     None),

    # ---- Children's / all-ages classics ----
    ("The Jungle Book",
     "We be of one blood, ye and I.",
     None),
    ("The Wind in the Willows",
     "There is nothing half so much worth doing as simply messing about in boats.",
     "Ch. 1"),
    ("The Secret Garden",
     "If you look the right way, you can see that the whole world is a garden.",
     None),
    ("The Strange Case of Dr. Jekyll and Mr. Hyde",
     "Man is not truly one, but truly two.",
     "Ch. 10"),

    # ---- Political / philosophical ----
    ("The Prince",
     "It is better to be feared than loved, if you cannot be both.",
     "Ch. 17"),
    ("The Art of War",
     "The supreme art of war is to subdue the enemy without fighting.",
     None),
    ("The Scarlet Letter",
     "She had not known the weight until she felt the freedom.",
     None),

    # ---- Modern / contemporary fiction ----
    ("The Alchemist",
     "And, when you want something, all the universe conspires in helping you to achieve it.",
     None),
    ("Circe",
     "But in a solitary life, there are rare moments when another soul dips near yours, as stars once a year brush the earth.",
     None),
    ("Midnight's Children",
     "To understand just one life, you have to swallow the world.",
     None),
    ("The White Tiger",
     "The story of a poor man's life is written on his body, in a sharp pen.",
     None),
    ("The God of Small Things",
     "Things can change in a day.",
     None),
    ("The Da Vinci Code",
     "History is always written by the winners.",
     None),
    ("Da Vinci Code",
     "History is always written by the winners.",
     None),

    # ---- Non-fiction / self-help / business ----
    ("Sapiens",
     "We did not domesticate wheat. It domesticated us.",
     None),
    ("Thinking, Fast and Slow",
     "Nothing in life is as important as you think it is while you are thinking about it.",
     None),
    ("Atomic Habits",
     "You do not rise to the level of your goals. You fall to the level of your systems.",
     None),
    ("The 7 Habits of Highly Effective People",
     "Begin with the end in mind.",
     "Habit 2"),
    ("How to Win Friends and Influence People",
     "You can make more friends in two months by becoming interested in other people than in two years by trying to get other people interested in you.",
     None),
    ("Rich Dad Poor Dad",
     "The poor and the middle class work for money. The rich have money work for them.",
     None),
    ("Think and Grow Rich",
     "Whatever the mind can conceive and believe, it can achieve.",
     None),
    ("The Power of Your Subconscious Mind",
     "Change your thoughts, and you change your destiny.",
     None),
    ("The Subtle Art of Not Giving a Fck*",
     "The desire for more positive experience is itself a negative experience.",
     None),
    ("Can't Hurt Me",
     "The most important conversations you'll ever have are the ones you'll have with yourself.",
     None),
    ("The Psychology of Money",
     "Doing well with money has little to do with how smart you are and a lot to do with how you behave.",
     None),
    ("Deep Work",
     "Clarity about what matters provides clarity about what does not.",
     None),
    ("Outliers",
     "Practice isn't the thing you do once you're good. It's the thing you do that makes you good.",
     None),
    ("Zero to One",
     "Every moment in business happens only once. The next Bill Gates will not build an operating system.",
     None),
    ("12 Rules for Life",
     "Compare yourself to who you were yesterday, not to who someone else is today.",
     "Rule 4"),
    ("Man's Search for Meaning",
     "When we are no longer able to change a situation, we are challenged to change ourselves.",
     None),
    ("A Brief History of Time",
     "We are just an advanced breed of monkeys on a minor planet of a very average star. But we can understand the Universe. That makes us something very special.",
     None),
    ("Steve Jobs",
     "Stay hungry. Stay foolish.",
     "quoted"),
    ("Becoming",
     "For me, becoming isn't about arriving somewhere or achieving a certain aim.",
     None),
    ("Educated",
     "An education is not so much about making a living as making a person.",
     None),
    ("Wings of Fire",
     "Dream is not that which you see while sleeping, it is something that does not let you sleep.",
     None),

    # ---- Non-English editions with iconic native-language lines ----
    ("Le petit prince",
     "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.",
     "Ch. 21"),
    ("Les Trois Mousquetaires",
     "Tous pour un, un pour tous.",
     None),
    ("Анна Каренина",
     "Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему.",
     "Часть 1"),
]


def seed_quotes():
    app = create_app()
    with app.app_context():
        print("=" * 72)
        print("  SEED / EXAMPLE spotlight quotes (batch 2 — exact-title match)")
        print("  These are UNVERIFIED starter quotes — confirm each per book in")
        print("  Admin Panel -> Books -> Edit -> 'Quote verified'.")
        print("=" * 72)

        applied = 0
        skipped_existing = 0
        skipped_missing = 0

        for exact_title, quote_text, source_note in SEED_QUOTES:
            # SQLite's lower() only folds ASCII, so a lowered comparison misses
            # non-Latin titles (e.g. Cyrillic). Try an exact match first, then
            # fall back to the ASCII-case-insensitive one.
            book = (
                Book.query.filter(Book.title == exact_title).first()
                or Book.query.filter(
                    db.func.lower(Book.title) == exact_title.lower()
                ).first()
            )
            if not book:
                skipped_missing += 1
                print(f"[MISS ] no catalog book titled exactly '{exact_title}'")
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

        print("-" * 72)
        print(f"Applied: {applied}   Skipped (already had quote): {skipped_existing}"
              f"   Skipped (no matching book): {skipped_missing}")
        print("Remember: verify these seeded quotes in the admin form before")
        print("relying on them for public display.")


if __name__ == "__main__":
    seed_quotes()
