import random
from typing import List, Tuple, Optional
from app.models import Book, BaristaProfile, Transaction
from app.models.barista import BaristaInteractionLog
from sqlalchemy.orm import joinedload

# Mapping from mood tags to category names
MOOD_MAP = {
    'cozy': ['Fiction', 'Romance'],
    'thrilling': ['Mystery', 'Sci-Fi'],
    'focus': ['Non-Fiction', 'Biography']
}

# Weight clamping range to prevent runaway scores from learned preferences.
WEIGHT_FLOOR = -5
WEIGHT_CEIL  = 10


def _get_candidates(profile: BaristaProfile) -> list:
    """Return available books excluding past borrows and recently‑declined
    books, eagerly loading category + author.  Used by recommend(),
    get_swipe_deck(), and get_spin_candidates().
    """
    from app.services.finn_learning import get_recently_declined_book_ids

    query = Book.query.filter(Book.available_copies > 0)

    # Exclude books already borrowed
    past_tx_ids = [
        tx.book_id
        for tx in Transaction.query.filter_by(user_id=profile.user_id).all()
    ]
    if past_tx_ids:
        query = query.filter(~Book.id.in_(past_tx_ids))

    # Exclude books declined in the last 30 days
    declined_ids = get_recently_declined_book_ids(profile.user_id)
    if declined_ids:
        query = query.filter(~Book.id.in_(declined_ids))

    candidates = query.options(
        joinedload(Book.category),
        joinedload(Book.author),
    ).all()
    return candidates


def _score_book(book: Book, profile: BaristaProfile, mood_tag: str) -> Tuple[int, List[str]]:
    """Return a numeric score and a list of human‑readable reasons."""
    score = 0
    reasons = []

    # 1. Preferred categories (favorite_categories_cache)
    favs = profile.favorite_categories_cache or []
    if favs and book.category and book.category.name in favs:
        score += 5
        reasons.append('matches your favorite genres')

    # 2. Mood match
    if mood_tag and book.category and book.category.name in MOOD_MAP.get(mood_tag, []):
        score += 3
        reasons.append(f"fits your '{mood_tag}' mood")

    # 3. Pace preference – fast readers prefer shorter books (approx <300 pages)
    if profile.pace_preference == 'fast_read':
        page_count = getattr(book, 'page_count', None)
        if page_count is not None and page_count < 300:
            score += 2
            reasons.append('a quick read')

    # 4. Skill level – advanced readers get longer / more complex books
    if profile.skill_level == 'advanced':
        page_count = getattr(book, 'page_count', None)
        if page_count is not None and page_count > 500:
            score += 2
            reasons.append('a deep, substantial work')

    # 5. Popularity boost – the more times a book has been borrowed, the higher the score
    borrowed = (book.total_copies - book.available_copies)
    popularity_bonus = borrowed // 5  # every 5 borrows adds 1 point
    if popularity_bonus:
        score += popularity_bonus
        reasons.append('popular among other readers')

    # 6. Learned genre weight
    genre_weights = profile.genre_weights or {}
    if book.category and book.category.name in genre_weights:
        gw = max(WEIGHT_FLOOR, min(WEIGHT_CEIL, genre_weights[book.category.name]))
        if gw != 0:
            score += gw
            if gw >= 2:
                reasons.append(f"you've been enjoying {book.category.name} lately")

    # 7. Learned author weight
    author_weights = profile.author_weights or {}
    if book.author and book.author.name in author_weights:
        aw = max(WEIGHT_FLOOR, min(WEIGHT_CEIL, author_weights[book.author.name]))
        if aw != 0:
            score += aw
            if aw >= 2:
                reasons.append(f"you like {book.author.name}'s writing")

    return score, reasons


def recommend(profile: BaristaProfile, mood_tag: str) -> Tuple[Book, List[str]]:
    """Select a book for the given profile and mood.
    Returns the chosen ``Book`` instance and the list of textual reasons that
    contributed to the selection.
    The algorithm:
    1. Filter to books with available copies.
    2. Exclude books the user has already borrowed and recently declined.
    3. Score each remaining candidate using ``_score_book``.
    4. Take the top‑3 highest‑scoring books (or fewer if not enough candidates).
    5. Randomly pick one of those top‑3 to keep the experience varied.
    """
    candidates = _get_candidates(profile)
    if not candidates:
        return None, []

    # Score each candidate
    scored = []
    for book in candidates:
        score, reasons = _score_book(book, profile, mood_tag)
        scored.append((book, score, reasons))

    # Sort by score descending, then by popularity (borrow count) descending
    scored.sort(key=lambda x: (x[1], x[0].total_copies - x[0].available_copies), reverse=True)

    # Take the top‑3 (or fewer) and pick one at random for variety
    top = scored[:3]
    chosen_book, _, chosen_reasons = random.choice(top)
    return chosen_book, chosen_reasons


def get_swipe_deck(profile: BaristaProfile, count: int = 5) -> list[dict]:
    """Return *count* diverse candidate books for the swipe‑deck mode.

    Selection: fill from top genres (via learned weights), then pad with
    wildcards from genres the user hasn't interacted with.  Apprentices
    get more wildcards to promote exploration.
    """
    candidates = _get_candidates(profile)
    if not candidates:
        return []

    genre_weights = profile.genre_weights or {}
    is_apprentice = (profile.relationship_stage == 'apprentice')

    # Determine wildcard budget
    wildcard_count = 2 if is_apprentice else 1
    if count > 5:
        wildcard_count = 3 if is_apprentice else 2
    preference_count = max(1, count - wildcard_count)

    # Score all candidates
    scored = []
    for book in candidates:
        score, reasons = _score_book(book, profile, mood_tag=None)
        scored.append((book, score, reasons))
    scored.sort(key=lambda x: x[1], reverse=True)

    # Top genres the user has interacted with (positive weight)
    interacted_genres = {g for g, w in genre_weights.items() if w > 0}

    # Split into preference pool and wildcard pool
    pref_pool = [s for s in scored if s[0].category and s[0].category.name in interacted_genres]
    wild_pool = [s for s in scored if s[0].category and s[0].category.name not in interacted_genres]

    # If the user has no learned preferences yet, everything is a wildcard
    if not pref_pool:
        pref_pool = scored
        wild_pool = []

    # Select preference books — pick from diverse genres
    selected = []
    genres_used = set()
    for book, score, reasons in pref_pool:
        if len(selected) >= preference_count:
            break
        genre = book.category.name if book.category else None
        # Allow max 3 books per genre for variety
        genre_occurrences = sum(1 for b, _, _ in selected if b.category and b.category.name == genre)
        if genre_occurrences < 3:
            selected.append((book, score, reasons))
            if genre:
                genres_used.add(genre)

    # Select wildcards
    random.shuffle(wild_pool)
    wildcards = wild_pool[:wildcard_count]
    selected.extend(wildcards)

    # Shuffle the final deck so wildcards aren't always at the end
    random.shuffle(selected)

    return [
        {
            'book': book.to_dict(),
            'score': score,
            'reasons': reasons,
        }
        for book, score, reasons in selected[:count]
    ]


def get_spin_candidates(profile: BaristaProfile, count: int = 6) -> list:
    """Return *count* books for the spin‑wheel mode.

    Regulars: 4 from preferences + 2 wildcards.
    Apprentices: 3 from preferences + 3 wildcards.
    """
    candidates = _get_candidates(profile)
    if not candidates:
        return []

    genre_weights = profile.genre_weights or {}
    is_apprentice = (profile.relationship_stage == 'apprentice')
    wildcard_count = 3 if is_apprentice else 2
    preference_count = count - wildcard_count

    # Score all candidates
    scored = []
    for book in candidates:
        score, _ = _score_book(book, profile, mood_tag=None)
        scored.append((book, score))
    scored.sort(key=lambda x: x[1], reverse=True)

    interacted_genres = {g for g, w in genre_weights.items() if w > 0}
    pref_pool = [s for s in scored if s[0].category and s[0].category.name in interacted_genres]
    wild_pool = [s for s in scored if s[0].category and s[0].category.name not in interacted_genres]

    if not pref_pool:
        pref_pool = scored
        wild_pool = []

    selected_books = [book for book, _ in pref_pool[:preference_count]]

    random.shuffle(wild_pool)
    selected_books.extend([book for book, _ in wild_pool[:wildcard_count]])

    # Pad if we don't have enough
    if len(selected_books) < count:
        remaining = [book for book, _ in scored if book not in selected_books]
        selected_books.extend(remaining[:count - len(selected_books)])

    random.shuffle(selected_books)
    return selected_books[:count]
