from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timezone

class User(db.Model):
    __tablename__ = 'app_user'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False, index=True)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), default='member', nullable=False) # 'admin', 'librarian', 'member'
    membership_status = db.Column(db.String(20), default='active', nullable=False) # 'active', 'inactive', 'suspended'
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    membership_expires_at = db.Column(db.DateTime, nullable=True)

    transactions = db.relationship('Transaction', back_populates='user', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'role': self.role,
            'membership_status': self.membership_status,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None,
            'membership_expires_at': self.membership_expires_at.isoformat() + 'Z' if self.membership_expires_at else None
        }

    def __repr__(self):
        return f'<User {self.username}>'
