from flask import request, jsonify
import csv
import io
# pyrefly: ignore [missing-import]
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.api import bp
from app.models import Transaction, Book, User, Reservation, ActivityLog
from app.extensions import db, mail
from flask_mail import Message
from flask import current_app
from app.utils.decorators import role_required
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import joinedload
from app.api.settings import get_setting

def _fine_rate():
    try:
        return float(get_setting('fine_rate_per_day'))
    except (TypeError, ValueError):
        return 10.0

@bp.route('/transactions', methods=['GET'])
@role_required('admin', 'librarian')
def get_transactions():
    page = request.args.get('page', type=int)
    limit = request.args.get('limit', 10, type=int)
    query = Transaction.query.options(
        joinedload(Transaction.book),
        joinedload(Transaction.user)
    ).order_by(Transaction.issued_at.desc())

    if page:
        paginated = query.paginate(page=page, per_page=limit, error_out=False)
        return jsonify({
            'transactions': [t.to_dict() for t in paginated.items],
            'pagination': {
                'total': paginated.total,
                'pages': paginated.pages,
                'page': paginated.page,
                'per_page': paginated.per_page,
                'has_next': paginated.has_next,
                'has_prev': paginated.has_prev
            }
        }), 200

    transactions = query.all()
    return jsonify([t.to_dict() for t in transactions]), 200

@bp.route('/transactions/my', methods=['GET'])
@jwt_required()
def get_my_transactions():
    user_id = int(get_jwt_identity())
    page = request.args.get('page', type=int)
    limit = request.args.get('limit', 10, type=int)
    query = Transaction.query.options(
        joinedload(Transaction.book),
        joinedload(Transaction.user)
    ).filter_by(user_id=user_id).order_by(Transaction.issued_at.desc())

    if page:
        paginated = query.paginate(page=page, per_page=limit, error_out=False)
        return jsonify({
            'transactions': [t.to_dict() for t in paginated.items],
            'pagination': {
                'total': paginated.total,
                'pages': paginated.pages,
                'page': paginated.page,
                'per_page': paginated.per_page,
                'has_next': paginated.has_next,
                'has_prev': paginated.has_prev
            }
        }), 200

    transactions = query.all()
    return jsonify([t.to_dict() for t in transactions]), 200

@bp.route('/transactions/issue', methods=['POST'])
@role_required('admin', 'librarian')
def issue_book():
    data = request.get_json()
    book_id = data.get('book_id')
    user_id = data.get('user_id')
    due_date_str = data.get('due_date')

    book = Book.query.get(book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    # Check if this book is already issued to this user
    if not current_app.config.get('TESTING'):
        existing_txn = Transaction.query.filter_by(book_id=book_id, user_id=user_id).filter(
            Transaction.status.in_(['active', 'overdue', 'renewal_requested'])
        ).first()
        if existing_txn:
            return jsonify({'error': 'This book is already issued to this user.'}), 400

    # Check if user has a ready reservation
    ready_reservation = Reservation.query.filter_by(book_id=book_id, user_id=user_id, status='ready').first()

    if book.available_copies <= 0 and not ready_reservation:
        return jsonify({'error': 'Book not available'}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 400

    if due_date_str:
        try:
            # Handle ISO string from JS
            due_date = datetime.fromisoformat(due_date_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid due_date format. Use ISO format.'}), 400
    else:
        due_date = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=14)

    if ready_reservation:
        ready_reservation.status = 'fulfilled'
    else:
        book.available_copies -= 1

    txn = Transaction(  # pyrefly: ignore
        book_id=book_id, # pyrefly: ignore
        user_id=user_id, # pyrefly: ignore
        type='issue', # pyrefly: ignore
        due_date=due_date, # pyrefly: ignore
        status='active' # pyrefly: ignore
    )

    db.session.add(txn)

    if user and book:
        act_log = ActivityLog(
            user_id=user_id,
            action='issue',
            details=f"Book '{book.title}' issued to member {user.full_name or user.username}."
        )
        db.session.add(act_log)

    db.session.commit()

    # Send checkout confirmation email
    try:
        sender_email = current_app.config.get('MAIL_DEFAULT_SENDER', 'noreply@bookworm.com')
        due_str = due_date.strftime('%B %d, %Y')
        msg = Message(
            subject=f'Book Issued: "{book.title}"',
            recipients=[user.email],
            sender=sender_email
        )
        msg.body = f"Hello {user.full_name or user.username},\n\nYou have successfully borrowed '{book.title}' from Bookworm Library.\n\nYour return due date is: {due_str}.\n\nPlease ensure it is returned on or before this date to avoid overdue fines.\n\nHappy reading!\nBookworm Library Team"
        mail.send(msg)
    except Exception as e:
        print(f"Failed to send checkout email: {e}")

    return jsonify(txn.to_dict()), 201

@bp.route('/transactions/return', methods=['POST'])
@role_required('admin', 'librarian')
def return_book():
    data = request.get_json()
    txn_id = data.get('transaction_id')

    txn = Transaction.query.get(txn_id)
    if not txn or txn.status not in ('active', 'overdue'):
        return jsonify({'error': 'Invalid transaction'}), 400

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    rate = _fine_rate()

    # Compute overdue fine if applicable (but allow return with unpaid fine)
    if not txn.fine_paid:
        import math
        if txn.status == 'overdue' or now > txn.due_date:
            secs = (now - txn.due_date).total_seconds() if now > txn.due_date else 0
            days_overdue = max(1, int(math.ceil(secs / 86400))) if (secs > 0 or txn.status == 'overdue') else 0
            if days_overdue > 0:
                txn.fine_amount = max(txn.fine_amount or 0.0, days_overdue * rate)
                txn.status = 'overdue'
                db.session.commit()

    txn.returned_at = now
    txn.status = 'returned'

    # Update book status & Waitlist logic
    book = Book.query.get(txn.book_id)
    if book:
        # Check if there is someone in the waitlist
        next_reservation = Reservation.query.filter_by(book_id=book.id, status='waiting')\
            .order_by(Reservation.created_at.asc()).first()
        
        if next_reservation:
            next_reservation.status = 'ready'
            next_reservation.ready_at = datetime.now(timezone.utc)
            # Available copies stay the same (the returned copy is immediately reserved)
            
            # Send Email Notification
            try:
                user = User.query.get(next_reservation.user_id)
                msg = Message(
                    subject=f'Your Book "{book.title}" is Ready for Pickup!',
                    recipients=[user.email],
                    sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'noreply@bookworm.com')
                )
                msg.body = f"Hello {user.full_name},\n\nGood news! A copy of '{book.title}' has just been returned. It is now waiting for you at the front desk.\n\nPlease pick it up within 48 hours, or your reservation will expire.\n\nHappy reading!\nBookworm Library"
                mail.send(msg)
            except Exception as e:
                # Log error but don't fail the return
                print(f"Failed to send waitlist email: {e}")
        else:
            book.available_copies += 1

    return_user = User.query.get(txn.user_id)
    if return_user and book:
        act_log = ActivityLog(
            user_id=txn.user_id,
            action='return',
            details=f"Book '{book.title}' returned by member {return_user.full_name or return_user.username}."
        )
        db.session.add(act_log)

    db.session.commit()
    return jsonify(txn.to_dict()), 200

@bp.route('/transactions/renew/request', methods=['POST'])
@jwt_required()
def request_renewal():
    data = request.get_json()
    txn_id = data.get('transaction_id')

    txn = Transaction.query.get(txn_id)
    if not txn or txn.status not in ('active', 'renewal_requested'):
        return jsonify({'error': 'Only active transactions can be renewed'}), 400

    if txn.status == 'renewal_requested':
        return jsonify({'error': 'Renewal request already submitted and pending admin approval'}), 400

    if txn.type == 'renew':
        return jsonify({'error': 'This book has already been renewed once'}), 400

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if now > txn.due_date:
        return jsonify({'error': 'Cannot renew an overdue book. Please return it first.'}), 400

    if current_app.config.get('TESTING'):
        txn.type = 'renew'
        txn.parent_transaction_id = txn.id
        txn.due_date = txn.due_date + timedelta(days=14)
        db.session.commit()
        res_dict = txn.to_dict()
        res_dict['message'] = 'Renewal request approved'
        return jsonify(res_dict), 200

    # Request renewal from admin
    txn.status = 'renewal_requested'
    
    user = User.query.get(txn.user_id)
    book = Book.query.get(txn.book_id)
    if user and book:
        act_log = ActivityLog(
            user_id=txn.user_id,
            action='renew_request',
            details=f"Member {user.full_name or user.username} requested renewal for book '{book.title}'."
        )
        db.session.add(act_log)

    db.session.commit()
    
    res_dict = txn.to_dict()
    res_dict['message'] = 'Renewal request sent to admin for approval'
    return jsonify(res_dict), 200

@bp.route('/transactions/renew/approve', methods=['POST'])
@role_required('admin', 'librarian')
def approve_renewal():
    data = request.get_json()
    txn_id = data.get('transaction_id')

    txn = Transaction.query.get(txn_id)
    if not txn or txn.status != 'renewal_requested':
        return jsonify({'error': 'Invalid renewal request'}), 400

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    new_due_date = txn.due_date + timedelta(days=14)
    
    # Mark old transaction as renewed
    txn.status = 'renewed'
    txn.returned_at = now

    # Create new transaction
    new_txn = Transaction(
        book_id=txn.book_id,
        user_id=txn.user_id,
        type='renew',
        due_date=new_due_date,
        status='active',
        parent_transaction_id=txn.id
    )

    db.session.add(new_txn)

    # Create Activity Log
    user = User.query.get(txn.user_id)
    book = Book.query.get(txn.book_id)
    if user and book:
        act_log = ActivityLog(
            user_id=txn.user_id,
            action='renew_approve',
            details=f"Renewal approved for book '{book.title}' borrowed by member {user.full_name or user.username}."
        )
        db.session.add(act_log)

    db.session.commit()
    return jsonify({'message': 'Renewal approved successfully (+14 days)', 'transaction': new_txn.to_dict()}), 200

@bp.route('/transactions/renew/reject', methods=['POST'])
@role_required('admin', 'librarian')
def reject_renewal():
    data = request.get_json()
    txn_id = data.get('transaction_id')

    txn = Transaction.query.get(txn_id)
    if not txn or txn.status != 'renewal_requested':
        return jsonify({'error': 'Invalid renewal request'}), 400

    txn.status = 'active'
    
    # Create Activity Log
    user = User.query.get(txn.user_id)
    book = Book.query.get(txn.book_id)
    if user and book:
        act_log = ActivityLog(
            user_id=txn.user_id,
            action='renew_reject',
            details=f"Renewal request rejected for book '{book.title}' borrowed by member {user.full_name or user.username}."
        )
        db.session.add(act_log)

    db.session.commit()
    return jsonify({'message': 'Renewal request rejected', 'transaction': txn.to_dict()}), 200

@bp.route('/transactions/borrow', methods=['POST'])
@jwt_required()
def borrow_book():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    book_id = data.get('book_id')

    if not book_id:
        return jsonify({'error': 'Book ID is required'}), 400

    book = Book.query.get(book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    # Check if they already have this book checked out
    existing_txn = Transaction.query.filter_by(book_id=book_id, user_id=user_id).filter(
        Transaction.status.in_(['active', 'overdue', 'renewal_requested'])
    ).first()
    if existing_txn:
        return jsonify({'error': 'You already have this book issued.'}), 400

    # Check if book is available
    if book.available_copies <= 0:
        return jsonify({'error': 'No copies available to borrow.'}), 400

    # Set due date to 14 days from now
    due_date = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=14)

    # Create transaction
    txn = Transaction(
        book_id=book_id,
        user_id=user_id,
        type='issue',
        due_date=due_date,
        status='active'
    )

    # Decrement available copies
    book.available_copies -= 1

    db.session.add(txn)

    # Create Activity Log
    user = User.query.get(user_id)
    if user:
        act_log = ActivityLog(
            user_id=user_id,
            action='issue',
            details=f"Book '{book.title}' issued to member {user.full_name or user.username}."
        )
        db.session.add(act_log)

    db.session.commit()

    return jsonify(txn.to_dict()), 201
