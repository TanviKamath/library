import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'super-secret-key-please-change-in-prod'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, '..', 'app.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'max_overflow': 20,
        'pool_recycle': 1800,
        'pool_pre_ping': True
    }

    # JWT configuration — HttpOnly cookie mode
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or '0fc3749c1be440b5c3b3b43079d61683bc05a5e246a37b18c1cc207183340b7f'
    JWT_TOKEN_LOCATION = ['cookies']            # Read JWTs from cookies, not Authorization header
    JWT_COOKIE_SECURE = False                   # False for localhost dev (set True in production w/ HTTPS)
    JWT_COOKIE_CSRF_PROTECT = True              # Enable CSRF double-submit protection
    JWT_COOKIE_SAMESITE = 'Lax'                 # Prevent cross-site cookie sending
    JWT_ACCESS_CSRF_HEADER_NAME = 'X-CSRF-TOKEN'
    JWT_REFRESH_CSRF_HEADER_NAME = 'X-CSRF-TOKEN'
    JWT_ACCESS_TOKEN_EXPIRES = 900              # 15 minutes
    JWT_REFRESH_TOKEN_EXPIRES = 2592000         # 30 days

    # Mail configuration
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', 'noreply@bookworm.com')

    # APScheduler configuration
    SCHEDULER_API_ENABLED = True

    # Rate limiting configuration
    RATELIMIT_ENABLED = False
    RATELIMIT_DEFAULT = "1000000 per day; 100000 per hour"
