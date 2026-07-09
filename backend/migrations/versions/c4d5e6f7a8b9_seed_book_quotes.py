"""seed spotlight book quotes (data migration)

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-07-09 10:00:00.000000

Backfills famous pull-quotes onto well-known catalog books so the dashboard
Spotlight card can always show a quote. Data-only migration so production picks
the quotes up automatically on `flask db upgrade` (no shell / seed script run
needed).

Idempotent + non-destructive: only fills books whose quote_text is currently
NULL or empty, matched by exact title. Books an admin has already quoted are
left untouched. Seeded quotes are marked quote_verified = False.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4d5e6f7a8b9'
down_revision = 'b3c4d5e6f7a8'
branch_labels = None
depends_on = None


# (title, quote_text, quote_source) — verified/famous lines, quote_verified stays False.
QUOTES = [
    ('12 Rules for Life', 'Compare yourself to who you were yesterday, not to who someone else is today.', 'Rule 4'),
    ('A Brief History of Time', 'We are just an advanced breed of monkeys on a minor planet of a very average star. But we can understand the Universe. That makes us something very special.', None),
    ('A Christmas Carol', 'I will honour Christmas in my heart, and try to keep it all the year.', 'Stave 5'),
    ("A Midsummer Night's Dream", 'The course of true love never did run smooth.', 'Act 1, Sc. 1'),
    ('A Tale of Two Cities', 'It was the best of times, it was the worst of times.', 'Book 1, Ch. 1'),
    ('Adventures of Huckleberry Finn', "All right, then, I'll go to hell.", 'Ch. 31'),
    ("Alice's Adventures in Wonderland", "It's no use going back to yesterday, because I was a different person then.", None),
    ('Anne of Green Gables', "Isn't it nice to think that tomorrow is a new day with no mistakes in it yet?", 'Ch. 21'),
    ('Antony and Cleopatra', 'Age cannot wither her, nor custom stale her infinite variety.', 'Act 2, Sc. 2'),
    ('Atomic Habits', 'You do not rise to the level of your goals. You fall to the level of your systems.', None),
    ('Becoming', "For me, becoming isn't about arriving somewhere or achieving a certain aim.", None),
    ('Brave New World', "But I don't want comfort. I want God, I want poetry, I want real danger, I want freedom, I want goodness. I want sin.", None),
    ("Can't Hurt Me", "The most important conversations you'll ever have are the ones you'll have with yourself.", None),
    ('Candide', 'We must cultivate our garden.', 'Conclusion'),
    ('Casino Royale', 'The scent and smoke and sweat of a casino are nauseating at three in the morning.', 'Opening line'),
    ('Circe', 'But in a solitary life, there are rare moments when another soul dips near yours, as stars once a year brush the earth.', None),
    ('Da Vinci Code', 'History is always written by the winners.', None),
    ('David Copperfield', 'Whether I shall turn out to be the hero of my own life, or whether that station will be held by anybody else, these pages must show.', 'Ch. 1'),
    ('Deep Work', 'Clarity about what matters provides clarity about what does not.', None),
    ('Dracula', 'There are darknesses in life and there are lights, and you are one of the lights, the light of all lights.', None),
    ('Dubliners', 'His soul swooned slowly as he heard the snow falling faintly through the universe.', 'The Dead'),
    ('Dune', 'I must not fear. Fear is the mind-killer.', 'Litany Against Fear'),
    ('Educated', 'An education is not so much about making a living as making a person.', None),
    ('Fahrenheit 451', 'It was a pleasure to burn.', 'Opening line'),
    ('Foundation', 'Violence is the last refuge of the incompetent.', None),
    ('Frankenstein; Or, The Modern Prometheus', 'Beware; for I am fearless, and therefore powerful.', None),
    ('Great Expectations', 'Suffering has been stronger than all other teaching, and has taught me to understand what your heart used to be.', None),
    ('Harry Potter and the Chamber of Secrets', 'It is our choices, Harry, that show what we truly are, far more than our abilities.', 'Ch. 18'),
    ('Harry Potter and the Deathly Hallows', 'Do not pity the dead, Harry. Pity the living, and, above all, those who live without love.', None),
    ("Harry Potter and the Philosopher's Stone", 'It does not do to dwell on dreams and forget to live.', 'Ch. 12'),
    ('Heart of Darkness', 'The horror! The horror!', None),
    ('His Last Bow [8 stories]', "There's an east wind coming, Watson.", 'His Last Bow'),
    ('How to Win Friends and Influence People', 'You can make more friends in two months by becoming interested in other people than in two years by trying to get other people interested in you.', None),
    ('Jane Eyre', 'I am no bird; and no net ensnares me: I am a free human being with an independent will.', 'Ch. 23'),
    ('Julius Caesar', 'The fault, dear Brutus, is not in our stars, but in ourselves, that we are underlings.', 'Act 1, Sc. 2'),
    ('Le petit prince', "On ne voit bien qu'avec le cœur. L'essentiel est invisible pour les yeux.", 'Ch. 21'),
    ('Leaves of Grass', 'Do I contradict myself? Very well then I contradict myself, (I am large, I contain multitudes.)', 'Song of Myself'),
    ('Les Trois Mousquetaires', 'Tous pour un, un pour tous.', None),
    ('Little Women', 'I am not afraid of storms, for I am learning how to sail my ship.', None),
    ('Lord of the Flies', "Maybe there is a beast... maybe it's only us.", 'Ch. 5'),
    ('Macbeth', "Life's but a walking shadow, a poor player that struts and frets his hour upon the stage, and then is heard no more.", 'Act 5, Sc. 5'),
    ("Man's Search for Meaning", 'When we are no longer able to change a situation, we are challenged to change ourselves.', None),
    ("Midnight's Children", 'To understand just one life, you have to swallow the world.', None),
    ('Moby Dick', 'Call me Ishmael.', 'Ch. 1'),
    ('Murder on the Orient Express', 'The impossible could not have happened, therefore the impossible must be possible in spite of appearances.', None),
    ('Narrative of the life of Frederick Douglass', 'Once you learn to read, you will be forever free.', None),
    ('Nineteen Eighty-Four', 'War is peace. Freedom is slavery. Ignorance is strength.', None),
    ('Oliver Twist', 'Please, sir, I want some more.', 'Ch. 2'),
    ('Outliers', "Practice isn't the thing you do once you're good. It's the thing you do that makes you good.", None),
    ('Paradise Lost', 'The mind is its own place, and in itself can make a Heaven of Hell, a Hell of Heaven.', 'Book 1'),
    ('Peter Pan', 'To die will be an awfully big adventure.', None),
    ('Pride and Prejudice', 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', 'Ch. 1'),
    ('Rich Dad Poor Dad', 'The poor and the middle class work for money. The rich have money work for them.', None),
    ('Romeo and Juliet', "What's in a name? That which we call a rose by any other name would smell as sweet.", 'Act 2, Sc. 2'),
    ('Sapiens', 'We did not domesticate wheat. It domesticated us.', None),
    ('Sense and Sensibility', 'The more I know of the world, the more am I convinced that I shall never see a man whom I can really love.', None),
    ('Sonnets', "Shall I compare thee to a summer's day? Thou art more lovely and more temperate.", 'Sonnet 18'),
    ('Steve Jobs', 'Stay hungry. Stay foolish.', 'quoted'),
    ('The 7 Habits of Highly Effective People', 'Begin with the end in mind.', 'Habit 2'),
    ('The Adventures of Sherlock Holmes [12 stories]', 'When you have eliminated the impossible, whatever remains, however improbable, must be the truth.', 'The Sign of Four'),
    ('The Adventures of Tom Sawyer', 'Work consists of whatever a body is obliged to do, and play consists of whatever a body is not obliged to do.', 'Ch. 2'),
    ('The Alchemist', 'And, when you want something, all the universe conspires in helping you to achieve it.', None),
    ('The Art of War', 'The supreme art of war is to subdue the enemy without fighting.', None),
    ('The Da Vinci Code', 'History is always written by the winners.', None),
    ('The Fellowship of the Ring', 'Not all those who wander are lost.', None),
    ('The God of Small Things', 'Things can change in a day.', None),
    ('The Great Gatsby', 'So we beat on, boats against the current, borne back ceaselessly into the past.', 'Ch. 9'),
    ("The Handmaid's Tale", "Nolite te bastardes carborundorum. (Don't let the bastards grind you down.)", None),
    ('The Hobbit', 'In a hole in the ground there lived a hobbit.', 'Opening line'),
    ('The Hound of the Baskervilles', 'The world is full of obvious things which nobody by any chance ever observes.', 'Ch. 3'),
    ('The Hunger Games', 'May the odds be ever in your favor.', None),
    ('The Jungle Book', 'We be of one blood, ye and I.', None),
    ('The Picture of Dorian Gray', 'The only way to get rid of a temptation is to yield to it.', 'Ch. 2'),
    ('The Power of Your Subconscious Mind', 'Change your thoughts, and you change your destiny.', None),
    ('The Prince', 'It is better to be feared than loved, if you cannot be both.', 'Ch. 17'),
    ('The Psychology of Money', 'Doing well with money has little to do with how smart you are and a lot to do with how you behave.', None),
    ('The Scarlet Letter', 'She had not known the weight until she felt the freedom.', None),
    ('The Secret Garden', 'If you look the right way, you can see that the whole world is a garden.', None),
    ('The Strange Case of Dr. Jekyll and Mr. Hyde', 'Man is not truly one, but truly two.', 'Ch. 10'),
    ('The Subtle Art of Not Giving a Fck*', 'The desire for more positive experience is itself a negative experience.', None),
    ('The Time Machine', 'There is no difference between Time and any of the three dimensions of Space except that our consciousness moves along it.', 'Ch. 1'),
    ('The War of the Worlds', 'Intellects vast and cool and unsympathetic regarded this earth with envious eyes.', 'Book 1, Ch. 1'),
    ('The White Tiger', "The story of a poor man's life is written on his body, in a sharp pen.", None),
    ('The Wind in the Willows', 'There is nothing half so much worth doing as simply messing about in boats.', 'Ch. 1'),
    ('The Wonderful Wizard of Oz', 'There is no place like home.', None),
    ('Think and Grow Rich', 'Whatever the mind can conceive and believe, it can achieve.', None),
    ('Thinking, Fast and Slow', 'Nothing in life is as important as you think it is while you are thinking about it.', None),
    ('Three Men in a Boat (to say nothing of the dog)', 'I like work: it fascinates me. I can sit and look at it for hours.', None),
    ('Through the Looking-Glass', "It's a poor sort of memory that only works backwards.", None),
    ('Treasure Island', "Fifteen men on the dead man's chest — yo-ho-ho, and a bottle of rum!", None),
    ('Two years before the mast', "There is not so helpless and pitiable an object in the world as a landsman beginning a sailor's life.", 'Ch. 1'),
    ('Up from Slavery', 'Success is to be measured not so much by the position that one has reached in life as by the obstacles which one has overcome.', None),
    ('Walden', 'I went to the woods because I wished to live deliberately.', None),
    ('Wings of Fire', 'Dream is not that which you see while sleeping, it is something that does not let you sleep.', None),
    ('Zero to One', 'Every moment in business happens only once. The next Bill Gates will not build an operating system.', None),
    ('Анна Каренина', 'Все счастливые семьи похожи друг на друга, каждая несчастливая семья несчастлива по-своему.', 'Часть 1'),

]


def upgrade():
    bind = op.get_bind()
    book = sa.table(
        'book',
        sa.column('title', sa.String),
        sa.column('quote_text', sa.String),
        sa.column('quote_source', sa.String),
        sa.column('quote_verified', sa.Boolean),
    )
    for title, quote_text, quote_source in QUOTES:
        bind.execute(
            book.update()
            .where(book.c.title == title)
            .where(sa.or_(book.c.quote_text.is_(None), book.c.quote_text == ''))
            .values(
                quote_text=quote_text,
                quote_source=quote_source,
                quote_verified=False,
            )
        )


def downgrade():
    # Clear only the exact quotes this migration seeded, leaving admin edits intact.
    bind = op.get_bind()
    book = sa.table(
        'book',
        sa.column('title', sa.String),
        sa.column('quote_text', sa.String),
        sa.column('quote_source', sa.String),
        sa.column('quote_verified', sa.Boolean),
    )
    for title, quote_text, quote_source in QUOTES:
        bind.execute(
            book.update()
            .where(book.c.title == title)
            .where(book.c.quote_text == quote_text)
            .values(quote_text=None, quote_source=None, quote_verified=False)
        )
