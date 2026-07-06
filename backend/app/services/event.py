import os
import json
import datetime
from typing import List, Dict, Any
import requests

from app.extensions import db
from app.models.event_cache import EventCache

# ----------------------------------------------------------------------
# Configuration (environment variables, with sensible defaults)
# ----------------------------------------------------------------------
EVENT_PROVIDER = os.getenv("EVENT_PROVIDER", "google").lower()
GOOGLE_CALENDAR_KEY = os.getenv("GOOGLE_CALENDAR_API_KEY")
EVENT_LOCATION = os.getenv("EVENT_LOCATION", "Mumbai")
EVENT_WEIGHT = int(os.getenv("EVENT_WEIGHT", "5"))
# Cache TTL in hours – how long we keep the API response before refreshing
EVENT_CACHE_TTL_HOURS = int(os.getenv("EVENT_CACHE_TTL_HOURS", "6"))

# ----------------------------------------------------------------------
# Helper utilities
# ----------------------------------------------------------------------
def _now_utc() -> datetime.datetime:
    """Return timezone‑aware UTC now (without tzinfo for DB storage)."""
    return datetime.datetime.utcnow().replace(tzinfo=None)

def _load_cached_events() -> List[Dict[str, Any]] | None:
    """Return cached events for today if present and fresh, otherwise ``None``.
    The cache key is the UTC date (YYYY‑MM‑DD) and the provider name.
    """
    today = datetime.date.today()
    cache = (
        EventCache.query.filter_by(day=today, provider=EVENT_PROVIDER).first()
    )
    if not cache:
        return None
    age = _now_utc() - cache.cached_at
    if age > datetime.timedelta(hours=EVENT_CACHE_TTL_HOURS):
        # Stale – delete it so a fresh request will be made later.
        db.session.delete(cache)
        db.session.commit()
        return None
    return json.loads(cache.payload)

def _store_cache(events: List[Dict[str, Any]]) -> None:
    """Persist ``events`` (list of dicts) for today in the DB cache table."""
    today = datetime.date.today()
    cache = EventCache(
        day=today,
        provider=EVENT_PROVIDER,
        payload=json.dumps(events),
        cached_at=_now_utc(),
    )
    db.session.add(cache)
    db.session.commit()

# ----------------------------------------------------------------------
# Provider‑specific fetch implementations
# ----------------------------------------------------------------------
def _fetch_from_google() -> List[Dict[str, Any]]:
    """Fetch public Indian holidays from Google Calendar for the current day.
    Uses the public holiday calendar ID for India.
    Returns a list of dicts with keys: ``name``, ``date``, ``location``, ``keywords``.
    """
    if not GOOGLE_CALENDAR_KEY:
        raise RuntimeError(
            "GOOGLE_CALENDAR_API_KEY missing – set it in the environment."
        )
    # Google public holiday calendar for India (covers major Indian holidays).
    calendar_id = "en.indian#holiday@group.v.calendar.google.com"
    today = datetime.date.today()
    time_min = f"{today.isoformat()}T00:00:00Z"
    time_max = f"{(today + datetime.timedelta(days=1)).isoformat()}T00:00:00Z"
    url = (
        f"https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"
        f"?key={GOOGLE_CALENDAR_KEY}"
        f"&timeMin={time_min}"
        f"&timeMax={time_max}"
        f"&singleEvents=true"
    )
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    data = response.json()
    events: List[Dict[str, Any]] = []
    for item in data.get("items", []):
        name = item.get("summary", "")
        # Simple keyword extraction – split on whitespace, lower‑case.
        keywords = [kw.lower() for kw in name.split() if kw]
        events.append(
            {
                "name": name,
                "date": today.isoformat(),
                "location": EVENT_LOCATION,
                "keywords": keywords,
            }
        )
    return events

# ----------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------
def get_today_events() -> List[Dict[str, Any]]:
    """Return a list of today’s events (as normalized dicts).
    Uses a short‑lived DB cache to avoid hitting the external API on every request.
    """
    cached = _load_cached_events()
    if cached is not None:
        return cached
    if EVENT_PROVIDER == "google":
        events = _fetch_from_google()
    else:
        raise ValueError(f"Unsupported EVENT_PROVIDER: {EVENT_PROVIDER}")
    # Store the fresh payload for the remainder of the day.
    _store_cache(events)
    return events
