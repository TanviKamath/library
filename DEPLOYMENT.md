# Brew & Borrow — Deployment Implementation Plan (Render, single service)

Adapted from the Bibliotheca hosting doc, but tuned to **this** stack:
React 19 + Vite frontend, **Flask** (not FastAPI) backend with **cookie-based JWT + CSRF**,
currently on **SQLite**. We deploy as **one Render Web Service** where Flask serves both the
API and the built React app, backed by a managed **Render PostgreSQL** database.

## Target architecture

```
Browser
  │  (HTTPS, same origin)
  ▼
Render Web Service  ── Flask (gunicorn)
  ├─ /api/v1/*   → REST API
  └─ /*          → built React dist/ (SPA)
  │
  ▼
Render PostgreSQL
```

**Why single service:** the frontend sends `credentials: 'include'` with CSRF cookies
(`src/api/client.js`). Same-origin means the existing `SameSite=Lax` cookies and CSRF
flow work unchanged — no CORS, no `SameSite=None` juggling.

---

## Phase 0 — Prerequisites

- [ ] Render account + this repo pushed to GitHub (Render deploys from GitHub).
- [ ] Decide an admin email/password for seeding the production DB.
- [ ] Generate real secrets: `python -c "import secrets; print(secrets.token_hex(32))"` (one for `SECRET_KEY`, one for `JWT_SECRET_KEY`).

---

## Phase 1 — Code changes for production

These are the edits required before the app can run correctly on Render.
All are backwards-compatible with local dev.

### 1.1 Add the Postgres driver — `backend/requirements.txt`
SQLite works locally, but Render's disk is **ephemeral** (wiped on every deploy/restart),
so production must use Postgres. Add:
```
psycopg2-binary==2.9.9
```

### 1.2 Normalize the DB URL + production toggles — `backend/app/config.py`
Render's Postgres URL starts with `postgres://`, which SQLAlchemy no longer accepts;
it must be `postgresql://`. Also drive cookie security from the environment.
```python
import os
basedir = os.path.abspath(os.path.dirname(__file__))

def _database_url():
    url = os.environ.get('DATABASE_URL')
    if url and url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)   # Render/Heroku style
    return url or 'sqlite:///' + os.path.join(basedir, '..', 'app.db')

class Config:
    IS_PROD = os.environ.get('FLASK_ENV') == 'production'

    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key-please-change-in-prod'
    SQLALCHEMY_DATABASE_URI = _database_url()
    # ... existing engine options unchanged ...

    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or '0fc37...'  # keep dev fallback
    JWT_COOKIE_SECURE = IS_PROD          # HTTPS-only cookies in prod
    JWT_COOKIE_SAMESITE = 'Lax'          # same-origin → Lax is fine
    # ... rest unchanged ...
```
> ⚠️ In prod, the hardcoded `SECRET_KEY` / `JWT_SECRET_KEY` fallbacks **must** be overridden
> by Render env vars (Phase 3). Otherwise sessions are trivially forgeable.

### 1.3 Serve the built React app from Flask — `backend/app/__init__.py`
Point Flask's static folder at the Vite build output and add an SPA catch-all so
client-side routes (React Router) resolve to `index.html`.
```python
from flask import Flask, send_from_directory, abort

def create_app(config_class=Config):
    dist = os.environ.get('FRONTEND_DIST', os.path.join(os.path.dirname(__file__), '..', 'static'))
    app = Flask(__name__, static_folder=dist, static_url_path='')
    app.config.from_object(config_class)
    # ... existing extension init ...

    # SPA fallback — must be registered AFTER the /api blueprints
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        if path.startswith('api/'):
            abort(404)                       # never swallow API 404s
        target = os.path.join(app.static_folder, path)
        if path and os.path.exists(target):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')
    return app
```

### 1.4 CORS + Talisman for same-origin prod — `backend/app/__init__.py`
CORS is currently hardcoded to `localhost:8080`. Same-origin means CORS is unnecessary in
prod, but keep it env-driven for flexibility, and fix Talisman for HTTPS + React assets:
```python
origins = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')
cors.init_app(app, resources={r"/api/*": {"origins": origins, "supports_credentials": True}})

talisman.init_app(
    app,
    force_https=app.config['IS_PROD'],
    content_security_policy=None,   # start OFF — the default CSP blocks React/three.js/covers.
)                                   # Tighten later once the app loads cleanly.
```
> ⚠️ Talisman's **default CSP will blank-screen the React app** (blocks the bundle, inline
> styles, three.js, and external book-cover images). Ship with `content_security_policy=None`
> first, confirm the app works, then add a tailored policy as a follow-up.

### 1.5 Scheduler under Gunicorn
`APScheduler` starts inside `create_app`. With multiple Gunicorn workers, **every worker runs
the jobs** → duplicated overdue emails, duplicated backups. Two fixes:
- Run Gunicorn with **`--workers 1 --threads 8`** (chosen in Phase 2 start command), and
- The `backup_database` job writes to the local disk, which is ephemeral on Render — **disable
  that job in prod** (rely on Render's managed Postgres backups instead) or attach a Render Disk.

`Flask-Limiter` and `Flask-Caching` use in-memory storage — fine with a single worker; revisit
if you scale out (move to Redis).

---

## Phase 2 — Build container (`Dockerfile` in repo root)

A single service needs Node (build React) **and** Python (run Flask). A multi-stage Docker
build is the reliable way to get both. Set Render's runtime to **Docker**.
```dockerfile
# ---- Stage 1: build React ----
FROM node:20-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build            # → /app/dist

# ---- Stage 2: Flask runtime ----
FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ .
COPY --from=frontend /app/dist ./static     # Flask serves this (FRONTEND_DIST default)
ENV FLASK_ENV=production
CMD gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 120
```
> The build produces `dist/`, which is copied to `backend/static` — matching the
> `FRONTEND_DIST` default in step 1.3. `VITE_API_URL` is left empty, so `src/api/client.js`
> falls back to same-origin `/api/v1` automatically.

---

## Phase 3 — Provision on Render

### 3.1 PostgreSQL
- Render Dashboard → **New → PostgreSQL**. Note the **Internal Database URL**
  (used because the web service runs inside Render's network).

### 3.2 Web Service
- **New → Web Service** → connect this GitHub repo → Runtime: **Docker**.
- **Environment variables:**
  | Key | Value |
  |---|---|
  | `DATABASE_URL` | Internal Database URL from 3.1 |
  | `SECRET_KEY` | generated 32-byte hex |
  | `JWT_SECRET_KEY` | generated 32-byte hex |
  | `FLASK_ENV` | `production` |
  | `CORS_ORIGINS` | your Render URL (only needed if you later split services) |
  | `MAIL_USERNAME` / `MAIL_PASSWORD` / `MAIL_DEFAULT_SENDER` | if email is used |
  | `GOOGLE_CALENDAR_API_KEY` | real key (currently a placeholder in `.flaskenv`) |
- Deploy. First build compiles React + installs Python deps.

---

## Phase 4 — Initialize the database

The Postgres DB starts empty. Run migrations + seed once (Render **Shell** tab, or a
one-off Job):
```bash
flask db upgrade           # create schema from backend/migrations
python add_new_books.py    # seed catalogue
python seed_book_quotes.py
python backfill_page_counts.py
python backfill_publish_years.py
# create an admin user (adapt to your user model / a small script)
```
> **Migrating existing data (optional):** if you need the *current* rows from local `app.db`,
> SQLite→Postgres isn't a plain dump. Use `pgloader`, or a short Python script that reads via
> SQLAlchemy from SQLite and writes to Postgres. For a fresh launch, reseeding above is simpler.

---

## Phase 5 — Verify

- [ ] `https://<app>.onrender.com/` loads the React app (no blank screen → CSP OK).
- [ ] `https://<app>.onrender.com/api/v1/...` health/books endpoint returns JSON.
- [ ] **Login works** and the `access_token_cookie` + `csrf_access_token` cookies are set
      (DevTools → Application → Cookies), and a POST (e.g. borrow/review) succeeds → confirms
      the CSRF header path end-to-end.
- [ ] Refresh a deep route (e.g. `/browse/123`) → still loads (SPA fallback works).
- [ ] Deep-check no duplicate scheduler emails (single worker).

---

## Gotchas specific to this project (vs. the PDF)

1. **Cookie auth, not bearer tokens** — the entire reason we chose single-service. Splitting
   into two domains later means `SameSite=None; Secure` + credentialed CORS for the exact origin.
2. **Vite build step** — the PDF's static site had none; ours must `npm run build` and publish `dist/`.
3. **SQLite is ephemeral on Render** — Postgres is mandatory, plus the `postgres://` scheme fix.
4. **Talisman default CSP breaks React** — ship with CSP off, tighten later.
5. **APScheduler × Gunicorn workers** — pin to 1 worker; drop the filesystem backup job.
6. **Secrets have insecure hardcoded fallbacks** — override every one via Render env vars.

## Quick checklist
- [ ] `psycopg2-binary` added to requirements
- [ ] `config.py`: URL scheme fix + `FLASK_ENV`-driven secure cookies
- [ ] `__init__.py`: serve `dist/`, SPA fallback, env CORS, Talisman fix
- [ ] Scheduler pinned to 1 worker / backup job disabled
- [ ] `Dockerfile` (multi-stage) added
- [ ] Render Postgres created, env vars set
- [ ] `flask db upgrade` + seed run
- [ ] Login + a CSRF-protected POST verified in prod
