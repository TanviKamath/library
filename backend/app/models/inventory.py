from app.extensions import db
from datetime import datetime, timezone

class InventoryLog(db.Model):
    __tablename__ = 'inventory_log'

    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    qty_change = db.Column(db.Integer, nullable=False) # + purchase, - lost/damaged/withdrawn
    type = db.Column(db.String(20), nullable=False) # 'purchase', 'lost', 'damaged', 'withdrawn'
    performed_by = db.Column(db.Integer, db.ForeignKey('app_user.id'), nullable=False)
    related_transaction_id = db.Column(db.Integer, db.ForeignKey('book_transaction.id'))
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    book = db.relationship('Book', backref='inventory_logs')
    user = db.relationship('User', backref='inventory_logs')
    transaction = db.relationship('Transaction', backref='inventory_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'book_id': self.book_id,
            'qty_change': self.qty_change,
            'type': self.type,
            'performed_by': self.performed_by,
            'related_transaction_id': self.related_transaction_id,
            'created_at': self.created_at.isoformat() + 'Z' if self.created_at else None
        }

    def __repr__(self):
        return f'<InventoryLog {self.id} Book {self.book_id} Change {self.qty_change}>'
