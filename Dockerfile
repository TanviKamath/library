# ---- Stage 1: build the React frontend ----
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
# Flask serves this dir (matches FRONTEND_DIST default in app/__init__.py)
COPY --from=frontend /app/dist ./static
ENV FLASK_ENV=production
ENV FLASK_APP=wsgi.py
# Apply any pending DB migrations on startup, then serve. This makes deploys
# self-contained — no manual `flask db upgrade` shell step needed. Safe with
# --workers 1 (single process, no migration race).
CMD flask db upgrade && gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 120
