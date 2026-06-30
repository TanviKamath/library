from flask import request, jsonify
from flask_jwt_extended import jwt_required
from app.api import bp
from app.models import Transaction, User, Book, ActivityLog
from app.extensions import db
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone

@bp.route('/fines/pending', methods=['GET'])
@jwt_required()
def get_pending_fines():
    # Fetch all unpaid transactions
    transactions = Transaction.query.options(
        joinedload(Transaction.book),
        joinedload(Transaction.user)
    ).filter(Transaction.fine_paid == False).all()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    pending = []
    for txn in transactions:
        fine = 0.0
        # Compute overdue fine if applicable
        if txn.status == 'overdue' or (txn.status == 'active' and now > txn.due_date):
            days_overdue = (now - txn.due_date).days
            if days_overdue > 0:
                fine = days_overdue * 10.0
        elif txn.fine_amount > 0:
            fine = txn.fine_amount
        # Include only if there is a pending fine
        if fine > 0:
            # Temporarily attach computed fine for serialization
            txn.fine_amount = fine
            pending.append(txn)
    return jsonify([t.to_dict() for t in pending]), 200

@bp.route('/fines/<int:id>/pay', methods=['POST'])
@jwt_required()
def pay_fine(id):
    txn = Transaction.query.get_or_404(id)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # Dynamically set fine amount if overdue
    if txn.status == 'overdue' or (txn.status == 'active' and now > txn.due_date):
        days_overdue = (now - txn.due_date).days
        if days_overdue > 0:
            txn.fine_amount = days_overdue * 10.0
            txn.status = 'overdue'
            
    if txn.fine_amount > 0 and not txn.fine_paid:
        txn.fine_paid = True
        
        # Create Activity Log
        user = User.query.get(txn.user_id)
        book = Book.query.get(txn.book_id)
        if user and book:
            act_log = ActivityLog(
                user_id=txn.user_id,
                action='fine_pay',
                details=f"Collected fine of ₹{txn.fine_amount} from member {user.full_name or user.username} for book '{book.title}'."
            )
            db.session.add(act_log)

        db.session.commit()
        return jsonify({'message': 'Fine paid successfully', 'transaction': txn.to_dict()}), 200
    return jsonify({'error': 'No pending fine for this transaction'}), 400
