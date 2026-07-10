from flask import request, jsonify
from flask_jwt_extended import jwt_required
from app.api import bp
from app.models import Transaction, User, Book, ActivityLog
from app.extensions import db
from sqlalchemy.orm import joinedload
from datetime import datetime, timezone
from app.api.settings import get_setting

def _fine_rate():
    try:
        return float(get_setting('fine_rate_per_day'))
    except (TypeError, ValueError):
        return 10.0

@bp.route('/fines/pending', methods=['GET'])
@jwt_required()
def get_pending_fines():
    # Fetch all unpaid transactions
    transactions = Transaction.query.options(
        joinedload(Transaction.book),
        joinedload(Transaction.user)
    ).filter(Transaction.fine_paid == False).all()

    rate = _fine_rate()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    import math
    pending = []
    for txn in transactions:
        fine = txn.fine_amount or 0.0
        # Compute overdue fine if applicable
        if txn.status == 'overdue' or (txn.status == 'active' and now > txn.due_date):
            secs = (now - txn.due_date).total_seconds() if now > txn.due_date else 0
            days_overdue = max(1, int(math.ceil(secs / 86400))) if (secs > 0 or txn.status == 'overdue') else 0
            if days_overdue > 0:
                fine = max(fine, days_overdue * rate)
        # Include only if there is a pending fine
        if fine > 0:
            txn.fine_amount = fine
            pending.append(txn)
    return jsonify([t.to_dict() for t in pending]), 200

@bp.route('/fines/<int:id>/amount', methods=['PATCH'])
@jwt_required()
def update_fine_amount(id):
    data = request.get_json() if request.is_json else {}
    amount = data.get('fine_amount')
    if amount is None or float(amount) < 0:
        return jsonify({'error': 'Valid amount required'}), 400
    txn = Transaction.query.get_or_404(id)
    txn.fine_amount = float(amount)
    db.session.commit()
    return jsonify({'message': 'Updated', 'transaction': txn.to_dict()}), 200


@bp.route('/fines/<int:id>/pay', methods=['POST'])
@jwt_required()
def pay_fine(id):
    txn = Transaction.query.get_or_404(id)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    rate = _fine_rate()
    import math

    # Dynamically set fine amount if overdue
    if txn.status == 'overdue' or (txn.status == 'active' and now > txn.due_date):
        secs = (now - txn.due_date).total_seconds() if now > txn.due_date else 0
        days_overdue = max(1, int(math.ceil(secs / 86400))) if (secs > 0 or txn.status == 'overdue') else 0
        if days_overdue > 0:
            txn.fine_amount = max(txn.fine_amount or 0.0, days_overdue * rate)
            txn.status = 'overdue'

    if (txn.fine_amount or 0.0) > 0 and not txn.fine_paid:
        txn.fine_paid = True

        user = User.query.get(txn.user_id)
        book = Book.query.get(txn.book_id)
        if user and book:
            act_log = ActivityLog(
                user_id=txn.user_id,
                action='fine_pay',
                details=f"Collected fine of ₹{txn.fine_amount} from member {user.full_name} for book '{book.title}'."
            )
            db.session.add(act_log)

        db.session.commit()
        return jsonify({'message': 'Fine paid successfully', 'transaction': txn.to_dict()}), 200
    return jsonify({'error': 'No pending fine for this transaction'}), 400
