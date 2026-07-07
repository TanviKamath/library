from flask import Flask, send_from_directory, abort
from .config import Config
from .extensions import db, migrate, jwt, cors, mail, scheduler
import os

def create_app(config_class=Config):
    # In prod the Docker build drops the Vite output at backend/static (see Dockerfile).
    dist = os.environ.get('FRONTEND_DIST', os.path.join(os.path.dirname(__file__), '..', 'static'))
    # static_folder=None disables Flask's implicit /<path:filename> static route, which would
    # otherwise shadow the SPA catch-all below and 404 deep links instead of serving index.html.
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_class)

    from .extensions import db, migrate, jwt, cors, mail, scheduler, limiter, talisman, cache

    # Initialize Flask extensions here
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    # Same-origin in prod means CORS is unnecessary, but keep it env-driven for flexibility.
    origins = os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173,http://127.0.0.1:5173'
    ).split(',')
    cors.init_app(app, resources={r"/api/*": {
        "origins": origins,
        "supports_credentials": True
    }})
    mail.init_app(app)
    limiter.init_app(app)
    talisman.init_app(
        app,
        force_https=app.config['IS_PROD'],   # HTTPS only in prod; allow HTTP for local dev
        content_security_policy=None,        # default CSP blanks the React app — tighten later
    )
    cache.init_app(app)
    
    # Initialize APScheduler only if not testing
    if not app.config.get('TESTING'):
        scheduler.init_app(app)
        
        # Register scheduled jobs
        from app.tasks import check_overdue_books, check_expired_memberships, backup_database, check_expired_holds, rotate_spotlight
        
        # Flask runs create_app twice in reloader mode. The scheduler doesn't strictly mind, 
        # but replace_existing handles overlapping job IDs.
        if not scheduler.get_job('check_overdue_books_job'):
            scheduler.add_job(
                id='check_overdue_books_job',
                func=check_overdue_books,
                trigger='interval',
                minutes=1,  # Runs every minute. For prod: hours=24
                replace_existing=True
            )
            
        if not scheduler.get_job('check_expired_memberships_job'):
            scheduler.add_job(
                id='check_expired_memberships_job',
                func=check_expired_memberships,
                trigger='interval',
                minutes=1,  # Runs every minute. For prod: hours=24
                replace_existing=True
            )

        # The backup job writes to local disk, which is ephemeral on Render — skip it in
        # prod and rely on Render's managed Postgres backups instead.
        if not app.config.get('IS_PROD') and not scheduler.get_job('backup_database_job'):
            scheduler.add_job(
                id='backup_database_job',
                func=backup_database,
                trigger='interval',
                hours=24,  # Runs once a day
                replace_existing=True
            )

        if not scheduler.get_job('check_expired_holds_job'):
            scheduler.add_job(
                id='check_expired_holds_job',
                func=check_expired_holds,
                trigger='interval',
                minutes=1,  # Runs every minute for testing. For prod: hours=1
                replace_existing=True
            )

        if not scheduler.get_job('rotate_spotlight_job'):
            scheduler.add_job(
                id='rotate_spotlight_job',
                func=rotate_spotlight,
                trigger='interval',
                hours=1,
                replace_existing=True
            )
            
        # Start scheduler only if not already running
        if not scheduler.running:
            scheduler.start()

    # Register blueprints here
    from app.api import bp as api_bp
    app.register_blueprint(api_bp)

    @app.route('/api/health')
    def test_page():
        return {'status': 'ok'}

    # SPA fallback — registered AFTER the /api blueprints so it never shadows the API.
    # Serves the built React app and lets client-side (React Router) deep links resolve.
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        if path.startswith('api/'):
            abort(404)  # never swallow API 404s
        target = os.path.join(dist, path)
        if path and os.path.isfile(target):
            return send_from_directory(dist, path)     # real asset (JS/CSS/covers/…)
        return send_from_directory(dist, 'index.html')  # SPA fallback for client routes

    return app
