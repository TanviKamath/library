from app.extensions import db
from datetime import datetime, timezone

class ActivityLog(db.Model):
    __tablename__ = 'activity_log'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False) # 'issue', 'return', 'reserve_join', 'reserve_ready', 'reserve_fulfill', 'reserve_cancel', 'fine_pay', 'review_add', 'like_toggle'
    details = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    user = db.relationship('User', backref=db.backref('activity_logs', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else 'System',
            'action': self.action,
            'details': self.details,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None
        }

    def __repr__(self):
        return f'<ActivityLog {self.id} Action {self.action}>'
