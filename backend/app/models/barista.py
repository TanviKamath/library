from app.extensions import db
from datetime import datetime, timezone

class BaristaProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), unique=True, nullable=False)

    # Core state
    relationship_stage = db.Column(db.String(50), default='apprentice') # 'apprentice' | 'regular'
    has_completed_onboarding = db.Column(db.Boolean, default=False)
    streak_count = db.Column(db.Integer, default=0)
    last_interaction_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Palate Calibration
    pace_preference = db.Column(db.String(50), default='unknown') # 'fast_read' | 'slow_burn' | 'mixed' | 'unknown'
    favorite_categories_cache = db.Column(db.JSON, nullable=True) # e.g. [1, 5, 8]
    skill_level = db.Column(db.String(50), nullable=True)   # 'beginner' | 'intermediate' | 'advanced'
    reading_count = db.Column(db.Integer, nullable=True)  # total books read

    # Preference‑learning fields (deterministic weights)
    genre_weights = db.Column(db.JSON, nullable=True, default=dict)   # {genre_name: weight}
    author_weights = db.Column(db.JSON, nullable=True, default=dict)  # {author_name: weight}
    # Incremented each time learning updates; used to bust the recommendation cache.
    preference_version = db.Column(db.Integer, default=0)
    # Store last three voice‑fragment keys to avoid repeats.
    last_voice_fragments = db.Column(db.JSON, nullable=True, default=list)

    def to_dict(self):
        return {
            'relationship_stage': self.relationship_stage,
            'has_completed_onboarding': self.has_completed_onboarding,
            'streak_count': self.streak_count,
            'pace_preference': self.pace_preference,
            'favorite_categories': self.favorite_categories_cache or [],
            'skill_level': self.skill_level,
            'reading_count': self.reading_count,
            'genre_weights': self.genre_weights or {},
            'author_weights': self.author_weights or {},
            'preference_version': self.preference_version,
            'last_voice_fragments': self.last_voice_fragments or []
        }

class BaristaInteractionLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=False)
    interaction_type = db.Column(db.String(50), nullable=False) # 'onboarding', 'recommendation', 'check_in'
    mood_tag = db.Column(db.String(50), nullable=True)
    book_recommended_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=True)
    user_response = db.Column(db.String(50), default='pending') # 'accepted', 'declined', 'ignored'
    # New optional feedback fields
    rating = db.Column(db.Integer, nullable=True)  # 1‑5
    reaction = db.Column(db.String(30), nullable=True)  # 'loved', 'liked', 'not_for_me', 'already_read'
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
