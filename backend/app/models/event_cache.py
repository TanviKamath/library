from app.extensions import db
from datetime import datetime

class EventCache(db.Model):
    """Cache table for external event API responses.
    Stores raw JSON for a given UTC day and provider.
    """
    __tablename__ = 'event_cache'

    id = db.Column(db.Integer, primary_key=True)
    cached_at = db.Column(db.DateTime, nullable=False, default=db.func.now())
    day = db.Column(db.Date, nullable=False, unique=True)  # UTC day
    provider = db.Column(db.String(length=30), nullable=False)
    payload = db.Column(db.Text, nullable=False)  # raw JSON string
