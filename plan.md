# Enhancement Plan for Mr. Finn (Barista Companion)

## Overview
We will make the Barista companion (currently "Finn") more attractive and interactive for new users. The key goals are:
1. Rename UI references from **Finn** to **Mr. Finn** for a consistent brand.
2. Expand the onboarding flow to collect:
   - **Skill level** (Beginner, Intermediate, Advanced)
   - **Reading count** (how many books the user has read)
   - **Pace preference** (already present)
   - **Preferred genres** (already present)
3. Use **buttons** for all onboarding questions (as per user preference).
4. Persist the new data in the backend DB and expose it via the Barista API.
5. Keep the existing conversational UI and typewriter effect, adding a few extra dialogue lines for a richer experience.

---

## Front‑end changes (src/components/Barista/BaristaCompanion.jsx)
| Change | Description |
|---|---|
| **Rename UI strings** | Update all visible references to "Finn" → "Mr. Finn" (aria‑label, alt text, speaker name, greeting messages). |
| **Add state** | `skillLevel`, `readingCount` (both `null` initially). |
| **Add new nodes** | `ONBOARD_SKILL_LEVEL` and `ONBOARD_READING_COUNT` in the `NODE` enum. |
| **New dialogue flow** | After `ONBOARD_GREETING`, show `ONBOARD_SKILL_LEVEL`, then `ONBOARD_READING_COUNT`, then existing `ONBOARD_PACE` and `ONBOARD_GENRE`. |
| **Button UI** | Render each choice as `<button className={styles.narrativeChoice}>…</button>` (same styling as existing choices). |
| **Collect responses** | Store selected values in component state. |
| **Submit onboarding** | When the user finishes the genre step, call `completeOnboarding` with an object that now includes `skill_level` and `reading_count` alongside the existing fields. |
| **Update API payload** | Extend the POST payload to `/barista/onboard` to include `skill_level` and `reading_count`. |
| **Speaker name** | Change `<div className={styles.speakerName}>Finn</div>` to `<div className={styles.speakerName}>Mr. Finn</div>`. |
| **Alt text** | Update `<img … alt="Finn" …>` → `<img … alt="Mr. Finn" …>`. |
| **ARIA label** | Change `aria-label="Talk to Finn"` → `aria-label="Talk to Mr. Finn"`. |

## Backend model changes (backend/app/models/barista.py)
1. Add new columns to `BaristaProfile`:
   ```python
   skill_level = db.Column(db.String(50), nullable=True)   # 'beginner' | 'intermediate' | 'advanced'
   reading_count = db.Column(db.Integer, nullable=True)  # number of books read
   ```
2. Extend `to_dict` to expose the new fields:
   ```python
   'skill_level': self.skill_level,
   'reading_count': self.reading_count,
   ```
3. Update any serialization points (e.g., profile returned by `/barista/profile`).

## Database migration
Create a new Alembic migration (e.g. `add_finn_extra_fields.py`) that:
- Adds `skill_level` (String) and `reading_count` (Integer) columns to `barista_profile`.
- Includes a downgrade that drops the two columns.

## API changes (backend/app/api/barista.py)
- In `barista_onboard` endpoint, read the new keys from `request.get_json()`:
  ```python
  skill_level = data.get('skill_level')
  reading_count = data.get('reading_count')
  profile.skill_level = skill_level
  profile.reading_count = reading_count
  ```
- Keep existing handling for `pace_preference` and `favorite_categories`.
- Return the updated profile dict (which now includes the new fields).

## UI text improvements (src/components/Barista/BaristaCompanion.jsx)
Replace existing greeting with a more personable tone, e.g.:
```js
"Welcome to Brew & Borrow! I'm Mr. Finn, your resident book barista. Shall we fine‑tune your reading palate?"
```
Add short explanatory lines for each new question, e.g.:
- Skill level: "Do you consider yourself a beginner, intermediate, or advanced reader?"
- Reading count: "How many books have you read so far?"
These appear as the `text` argument when calling `goTo` for the new nodes.

## Styling (src/components/Barista/BaristaCompanion.module.css)
No new styles are required – existing `.narrativeChoice` button class works for the added buttons.

## Testing plan
1. **Unit tests** for the new model fields (`tests/models/test_barista_profile.py`).
2. **API tests** for `/barista/onboard` to confirm the payload is stored and returned correctly.
3. **Component snapshot tests** (if the repo uses Jest/React Testing Library) to verify the new onboarding steps render correctly.
4. Manual smoke‑test: open the app, trigger the companion, go through onboarding, and verify the profile updates in the database.

---

## Implementation Roadmap
| Step | Owner | Description |
|---|---|---|
| 1️⃣ | Front‑end | Add new state, nodes, and UI strings; rename Finn → Mr. Finn. |
| 2️⃣ | Backend | Add columns, update `to_dict`, and adjust onboarding endpoint. |
| 3️⃣ | DB Migration | Write Alembic migration and run it. |
| 4️⃣ | Tests | Add/extend unit & API tests. |
| 5️⃣ | QA | Manual verification of the new flow. |

---

## Risks & Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Breaking DB schema | Existing deployments may fail if migration isn’t applied. | Provide a clear migration script and note that it must run before deploying the new code. |
| Front‑end state mismatch | New nodes could cause undefined state if user skips onboarding. | Disable the companion for existing users who have `has_completed_onboarding` true; only show new flow for fresh users. |
| Missed UI rename | Some hidden strings could still show "Finn". | Search the codebase for `Finn` after changes and update any remaining occurrences. |

---

## Approval
Please review the plan above. Once approved I will:
- Commit the frontend changes.
- Add the backend model fields and migration.
- Run the migrations and test suite.
- Deploy the updated Barista companion.

---

*Prepared by Claude Code – July 5 2026*