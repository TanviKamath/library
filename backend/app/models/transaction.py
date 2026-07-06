from app.extensions import db
from datetime import datetime, timezone

class Transaction(db.Model):
    __tablename__ = 'book_transaction'

    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=False, index=True)
    type = db.Column(db.String(20), nullable=False) # 'issue', 'return', 'renew'
    issued_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    due_date = db.Column(db.DateTime, nullable=False, index=True)
    returned_at = db.Column(db.DateTime)
    fine_amount = db.Column(db.Float, default=0.0)
    fine_paid = db.Column(db.Boolean, nullable=False, default=False, index=True)
    status = db.Column(db.String(20), nullable=False, default='active', index=True) # 'active', 'returned', 'overdue', 'renewed'
    parent_transaction_id = db.Column(db.Integer, db.ForeignKey('book_transaction.id'))

    book = db.relationship('Book', back_populates='transactions')
    user = db.relationship('User', back_populates='transactions')

    def to_dict(self):
        fine = self.fine_amount or 0.0
        if not self.fine_paid and self.due_date and self.status in ('active', 'overdue', 'renewal_requested'):
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            if self.status == 'overdue' or now > self.due_date:
                import math
                secs = (now - self.due_date).total_seconds() if now > self.due_date else 0
                days = max(1, int(math.ceil(secs / 86400))) if (secs > 0 or self.status == 'overdue') else 0
                if days > 0:
                    try:
                        from app.models.setting import Setting
                        s = Setting.query.filter_by(key='fine_rate_per_day').first()
                        rate = float(s.value) if s and s.value else 10.0
                    except Exception:
                        rate = 10.0
                    fine = max(fine, days * rate)

        return {
            'id': self.id,
            'book_id': self.book_id,
            'book_title': self.book.title if self.book else None,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'type': self.type,
            'issued_at': self.issued_at.isoformat() + 'Z' if self.issued_at else None,
            'due_date': self.due_date.isoformat() + 'Z' if self.due_date else None,
            'returned_at': self.returned_at.isoformat() + 'Z' if self.returned_at else None,
            'fine_amount': fine,
            'fine_paid': self.fine_paid,
            'status': self.status,
            'parent_transaction_id': self.parent_transaction_id
        }

    def __repr__(self):
        return f'<Transaction {self.id} for Book {self.book_id}>'
