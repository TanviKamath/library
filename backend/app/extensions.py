from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
# pyrefly: ignore [missing-import]
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail
from flask_apscheduler import APScheduler
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from flask_talisman import Talisman

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
mail = Mail()
scheduler = APScheduler()
limiter = Limiter(key_func=get_remote_address)
cache = Cache()
talisman = Talisman()
