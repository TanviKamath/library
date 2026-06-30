from flask import Flask
from .config import Config
from .extensions import db, migrate, jwt, cors, mail, scheduler
import os

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    from .extensions import db, migrate, jwt, cors, mail, scheduler, limiter, talisman
    
    # Initialize Flask extensions here
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {
        "origins": ["http://localhost:8080", "http://127.0.0.1:8080"],
        "supports_credentials": True
    }})
    mail.init_app(app)
    limiter.init_app(app)
    talisman.init_app(app, force_https=False)  # Allow HTTP for local dev
    
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

        if not scheduler.get_job('backup_database_job'):
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

    return app
