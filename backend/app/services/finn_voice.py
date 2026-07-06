'''Finn Composable Voice System.

Voice lines are built from three independently-selected fragments:
  greeting  →  observation  →  handoff

Each pool has 10 variants per relationship stage.  Observation fragments
are *data‑aware*: they reference the user's transaction history and
learned preferences when available, falling back to generic alternatives.

Fragment recency is tracked via ``profile.last_voice_fragments`` (list of
fragment keys, trimmed to the last 9 so we never repeat any fragment used
in the user's previous 3 interactions).
'''

import random
from datetime import datetime, timezone
from typing import List, Optional

from app.models.barista import BaristaProfile

# ── Fragment history depth ──────────────────────────────────────────────
# Each voice line uses 3 keys (greet + obs + handoff).  We keep 3
# interactions' worth = 9 keys, so the same fragment can't repeat for
# at least 3 consecutive recommendations.
HISTORY_DEPTH = 9


# ─────────────────────────────────────────────────────────────────────────
# GREETING FRAGMENTS  (10 per stage)
# ─────────────────────────────────────────────────────────────────────────
GREETINGS = {
    'apprentice': [
        ('g_a1',  'Welcome to the corner booth!'),
        ('g_a2',  'First time? Pull up a chair.'),
        ('g_a3',  "Here's a warm welcome from the stacks."),
        ('g_a4',  'Step right up — the shelves are yours.'),
        ('g_a5',  'Hello there! The reading nook is all set for you.'),
        ('g_a6',  'New face at the counter — I love that.'),
        ('g_a7',  "Glad you wandered in."),
        ('g_a8',  'A fresh chapter begins today!'),
        ('g_a9',  'Great to see you — let me brew something up.'),
        ('g_a10', "You've come to the right place."),
    ],
    'regular': [
        ('g_r1',  'Welcome back!'),
        ('g_r2',  'Ah, my favorite regular!'),
        ('g_r3',  'Right on time.'),
        ('g_r4',  "I've been saving this one for your visit."),
        ('g_r5',  'Your usual table is ready.'),
        ('g_r6',  'Another day, another perfect pick.'),
        ('g_r7',  'Back for more? I like your style.'),
        ('g_r8',  'Good to see you again — shall we?'),
        ('g_r9',  "I had a feeling you'd stop by today."),
        ('g_r10', "The counter's been lonely without you."),
    ],
}


# ─────────────────────────────────────────────────────────────────────────
# OBSERVATION FRAGMENTS — data‑aware with generic fallbacks  (10 each)
# ─────────────────────────────────────────────────────────────────────────
# Data‑aware observations are functions that return (key, text) or None.
# Generic observations are static (key, text) tuples.

def _obs_last_book_speed(profile: BaristaProfile) -> Optional[tuple]:
    """Reference how quickly the user returned their most recent book."""
    from app.models import Transaction
    last_tx = (
        Transaction.query
        .filter_by(user_id=profile.user_id, status='returned')
        .order_by(Transaction.returned_at.desc())
        .first()
    )
    if not last_tx or not last_tx.returned_at or not last_tx.issued_at:
        return None
    days = max(1, (last_tx.returned_at - last_tx.issued_at).days)
    title = last_tx.book.title if last_tx.book else 'that last one'
    if days <= 3:
        return ('obs_speed', f"You tore through '{title}' in just {days} day{'s' if days != 1 else ''} — impressive!")
    elif days <= 7:
        return ('obs_speed', f"'{title}' kept you busy for about a week — solid pace.")
    return None


def _obs_top_genre(profile: BaristaProfile) -> Optional[tuple]:
    """Mention the user's strongest genre preference."""
    gw = profile.genre_weights or {}
    if not gw:
        return None
    top_genre = max(gw, key=gw.get)
    if gw[top_genre] < 2:
        return None
    return ('obs_genre', f"Your taste for {top_genre} is really developing.")


def _obs_top_author(profile: BaristaProfile) -> Optional[tuple]:
    """Mention the user's strongest author preference."""
    aw = profile.author_weights or {}
    if not aw:
        return None
    top_author = max(aw, key=aw.get)
    if aw[top_author] < 2:
        return None
    return ('obs_author', f"You keep coming back to {top_author} — fan territory for sure.")


def _obs_streak(profile: BaristaProfile) -> Optional[tuple]:
    """Mention an active reading streak."""
    if profile.streak_count and profile.streak_count >= 3:
        return ('obs_streak', f"That's a {profile.streak_count}-visit streak — keep it going!")
    return None


def _obs_book_count(profile: BaristaProfile) -> Optional[tuple]:
    """Mention how many books the user has read."""
    from app.models import Transaction
    count = Transaction.query.filter_by(user_id=profile.user_id, status='returned').count()
    if count >= 10:
        return ('obs_count', f"You've finished {count} books with us — respect.")
    elif count >= 5:
        return ('obs_count', f"{count} books down — your shelf is growing nicely.")
    return None


# Data‑aware generators, tried in order; first non‑None wins.
_DATA_AWARE_OBS = [
    _obs_last_book_speed,
    _obs_top_genre,
    _obs_top_author,
    _obs_streak,
    _obs_book_count,
]

# Generic fallback observations
GENERIC_OBSERVATIONS = [
    ('obs_g1',  "I've been keeping an eye on the new arrivals for you."),
    ('obs_g2',  'The shelves have been reshuffled — fresh finds everywhere.'),
    ('obs_g3',  "There's a buzz about this one among our regulars."),
    ('obs_g4',  "I've had my nose in the catalog all morning."),
    ('obs_g5',  "Something caught my eye and I just had to set it aside."),
    ('obs_g6',  'The reading room has been lively today.'),
    ('obs_g7',  'A few new titles just rolled in — perfect timing.'),
    ('obs_g8',  "I've been curating something special."),
    ('obs_g9',  "Word around the stacks is this one's a gem."),
    ('obs_g10', 'Let me put my barista instincts to work.'),
]


# ─────────────────────────────────────────────────────────────────────────
# HANDOFF FRAGMENTS  (10 total)
# ─────────────────────────────────────────────────────────────────────────
HANDOFFS = [
    ('h1',  "Here's what I pulled for you today."),
    ('h2',  'Let me know what you think of this one.'),
    ('h3',  'I think this is going to be a perfect match.'),
    ('h4',  'Give this a look — I have a good feeling.'),
    ('h5',  "Hope this hits the spot."),
    ('h6',  "I'll be curious to hear your verdict."),
    ('h7',  "This one's been waiting for the right reader."),
    ('h8',  'Shall I pour you a cup while you browse?'),
    ('h9',  "Take your time — I'm not going anywhere."),
    ('h10', "Here's today's special, served fresh."),
]


# ─────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────

def _pick(pool: list[tuple], exclude_keys: set) -> tuple:
    """Pick a (key, text) tuple from *pool*, avoiding *exclude_keys*.
    Falls back to the full pool if everything has been recently used.
    """
    available = [item for item in pool if item[0] not in exclude_keys]
    if not available:
        available = pool
    return random.choice(available)


def generate_voice_line(
    profile: BaristaProfile,
    mood_tag: Optional[str] = None,
    last_fragments: Optional[List[str]] = None,
) -> str:
    """Build a 3‑part voice line: greeting → observation → handoff.

    *last_fragments* is the list of recently‑used fragment keys (stored in
    ``profile.last_voice_fragments``).  We avoid any key present in this
    list, then append our chosen keys and trim to ``HISTORY_DEPTH``.
    """
    if last_fragments is None:
        last_fragments = []
    exclude = set(last_fragments)

    stage = profile.relationship_stage if profile.relationship_stage in GREETINGS else 'apprentice'

    # 1. Greeting
    greet_key, greet_text = _pick(GREETINGS[stage], exclude)
    exclude.add(greet_key)

    # 2. Observation — try data‑aware first, fall back to generic
    obs_key, obs_text = None, None
    for gen_fn in _DATA_AWARE_OBS:
        result = gen_fn(profile)
        if result and result[0] not in exclude:
            obs_key, obs_text = result
            break
    if obs_key is None:
        obs_key, obs_text = _pick(GENERIC_OBSERVATIONS, exclude)
    exclude.add(obs_key)

    # 3. Handoff
    hand_key, hand_text = _pick(HANDOFFS, exclude)

    # Assemble
    line = f'{greet_text} {obs_text} {hand_text}'

    # Update fragment history
    chosen_keys = [greet_key, obs_key, hand_key]
    new_history = (list(last_fragments) + chosen_keys)[-HISTORY_DEPTH:]
    profile.last_voice_fragments = new_history

    return line
