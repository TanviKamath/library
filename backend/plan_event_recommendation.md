# Plan – Event‑Based Recommendations & Spotlight

## Goal
Create a feature that recommends books based on today’s calendar events (e.g., World Yoga Day, heavy rain in Mumbai) and integrates the result into the existing recommendation endpoint and the Spotlight feature.

## Chosen Data Source
- **Provider:** Google Calendar public holiday API (`EVENT_PROVIDER=google`).
- **Location:** Fixed to *Mumbai* (configurable via `EVENT_LOCATION` env var).
- **Weight:** `EVENT_WEIGHT=5` (numeric boost per matching keyword).

## Summary of Changes
| Area | Change | File(s) | Reason |
|------|--------|----------|--------|
| Data model | Add `event_cache` table for API result caching. | `backend/app/models/event_cache.py` (new) | Avoid repeated external calls and respect rate limits. |
| Service | New `event.py` service that fetches, normalises, caches events and exposes `get_today_events()`. | `backend/app/services/event.py` (new) | Centralises event logic, makes it reusable. |
| Recommendation API | Import the service, compute a set of event keywords, and add `EVENT_WEIGHT * matches` to each candidate’s score. | `backend/app/api/recommendations.py` (modify) | Boost books that match today’s event. |
| Spotlight service | Add helper `_pick_event_book` and adjust rotation to prefer an event‑matching book, falling back to random. | `backend/app/services/spotlight.py` (modify) | Spotlight shows event‑relevant books when possible. |
| Config | Environment variables: `EVENT_PROVIDER`, `GOOGLE_CALENDAR_API_KEY`, `EVENT_LOCATION`, `EVENT_WEIGHT`, `EVENT_CACHE_TTL_HOURS`. | `.env` (update) | Makes behaviour configurable without code changes. |
| Migration | Alembic migration to create `event_cache` table. | `backend/migrations/versions/<timestamp>_add_event_cache_table.py` (new) | Persist cache. |
| Tests | Add unit tests for the service, recommendation boost, and spotlight selection. | `backend/tests/test_event_service.py`, `backend/tests/test_recommendation_event_boost.py`, `backend/tests/test_spotlight_event_selection.py` | Verify correctness. |
| Docs | Update README / add `docs/events.md` explaining the feature and how to supply API keys. | `README.md`, `docs/events.md` | Documentation for future maintainers. |

## Implementation Details
1. **Configuration** – Load settings from environment with defaults (`EVENT_PROVIDER='google'`, `EVENT_LOCATION='Mumbai'`, `EVENT_WEIGHT=5`).
2. **Event Cache Model** – Simple table (`id`, `cached_at`, `day`, `provider`, `payload`). TTL default 6 hours, configurable.
3. **Fetching from Google** – Call `https://www.googleapis.com/calendar/v3/calendars/<calendar_id>/events` with `timeMin`/`timeMax` for today; use the public Indian holidays calendar ID (`en.indian#holiday@group.v.calendar.google.com`).
4. **Normalization** – Each event becomes `{name, date, location, keywords}` where `keywords` are lower‑cased words from the event name.
5. **Recommendation Boost** – After building `category_scores` & `author_scores`, compute the union of all event keywords. For each candidate book, split its title and description into words, intersect with the keyword set, and add `EVENT_WEIGHT * (number of matches)` to its score.
6. **Spotlight Rotation** – New helper `_pick_event_book` filters eligible books (have a cover image) by the same keyword logic and returns a random match; `rotate_spotlight_if_expired()` now prefers this book, fallback to the existing random picker.
7. **Caching** – On first request of the day, fetch from Google, store JSON in `event_cache`; subsequent calls within TTL read from DB.
8. **Testing** – Mock external HTTP calls, verify cache storage, ensure score adjustments happen, and that spotlight selects correctly when events exist.

## Open Questions & Confirmation Needed
- **API Key Provision** – You will add `GOOGLE_CALENDAR_API_KEY` to the environment later; the code will raise a clear error if it is missing.
- **Future Provider Switch** – The service is provider‑agnostic; swapping to Calendarific later only requires setting `EVENT_PROVIDER=calendarific` and providing the respective key.
- **Location Filtering** – Currently we ignore location from the provider and always use `EVENT_LOCATION` (Mumbai). If you later need stricter location matching, we can extend the service.

Please review this plan. Once approved, I will exit plan mode, and then proceed to implement the changes.
