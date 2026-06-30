from flask import request, jsonify
import csv
import io
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.api import bp
from app.models import Reservation, Book, User, Transaction, ActivityLog
from app.extensions import db
from app.utils.decorators import role_required
from datetime import datetime, timezone
from sqlalchemy.orm import joinedload

@bp.route('/reservations/join', methods=['POST'])
@jwt_required()
def join_waitlist():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    book_id = data.get('book_id')

    if not book_id:
        return jsonify({'error': 'Book ID is required'}), 400

    book = Book.query.get(book_id)
    if not book:
        return jsonify({'error': 'Book not found'}), 404

    # Check if they already have this book checked out
    has_book = Transaction.query.filter_by(book_id=book_id, user_id=user_id).filter(
        Transaction.status.in_(['active', 'overdue', 'renewal_requested'])
    ).first()
    if has_book:
        return jsonify({'error': 'You already have this book issued.'}), 400

    # Check if already waiting or ready
    existing = Reservation.query.filter_by(book_id=book_id, user_id=user_id).filter(
        Reservation.status.in_(['waiting', 'ready'])
    ).first()
    
    if existing:
        return jsonify({'error': 'You already have a pending reservation or waitlist entry for this book.'}), 400

    if book.available_copies > 0:
        # Book is available, set reservation to ready and reserve the copy
        res = Reservation(
            book_id=book_id,
            user_id=user_id,
            status='ready',
            ready_at=datetime.now(timezone.utc)
        )
        book.available_copies -= 1
    else:
        # Book is checked out, join the waitlist queue
        res = Reservation(
            book_id=book_id,
            user_id=user_id,
            status='waiting'
        )

    db.session.add(res)

    # Create Activity Log
    user = User.query.get(user_id)
    if user:
        if res.status == 'ready':
            details = f"Member {user.full_name or user.username} reserved '{book.title}' (placed on hold, ready for pickup)."
        else:
            position = Reservation.query.filter_by(book_id=book_id, status='waiting').count() + 1
            details = f"Member {user.full_name or user.username} joined the waitlist for '{book.title}' (queue position #{position})."
            
        act_log = ActivityLog(
            user_id=user_id,
            action='reserve_join',
            details=details
        )
        db.session.add(act_log)

    db.session.commit()

    return jsonify(res.to_dict()), 201

@bp.route('/reservations/my', methods=['GET'])
@jwt_required()
def get_my_reservations():
    user_id = int(get_jwt_identity())
    page = request.args.get('page', type=int)
    limit = request.args.get('limit', 10, type=int)
    
    query = Reservation.query.options(
        joinedload(Reservation.book),
        joinedload(Reservation.user)
    ).filter_by(user_id=user_id).filter(
        Reservation.status.in_(['waiting', 'ready'])
    )

    if page:
        paginated = query.paginate(page=page, per_page=limit, error_out=False)
        results = []
        for res in paginated.items:
            data = res.to_dict()
            if res.status == 'waiting':
                position = Reservation.query.filter_by(book_id=res.book_id, status='waiting')\
                    .filter(Reservation.created_at <= res.created_at).count()
                data['queue_position'] = position
            else:
                data['queue_position'] = 0
            results.append(data)
        return jsonify({
            'reservations': results,
            'pagination': {
                'total': paginated.total,
                'pages': paginated.pages,
                'page': paginated.page,
                'per_page': paginated.per_page,
                'has_next': paginated.has_next,
                'has_prev': paginated.has_prev
            }
        }), 200

    my_reservations = query.all()
    results = []
    for res in my_reservations:
        data = res.to_dict()
        if res.status == 'waiting':
            position = Reservation.query.filter_by(book_id=res.book_id, status='waiting')\
                .filter(Reservation.created_at <= res.created_at).count()
            data['queue_position'] = position
        else:
            data['queue_position'] = 0 # Ready
        results.append(data)

    return jsonify(results), 200

@bp.route('/reservations/cancel', methods=['POST'])
@jwt_required()
def cancel_reservation():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    reservation_id = data.get('reservation_id')

    res = Reservation.query.get(reservation_id)
    if not res or res.user_id != user_id:
        return jsonify({'error': 'Reservation not found'}), 404

    if res.status not in ['waiting', 'ready']:
        return jsonify({'error': 'Can only cancel active reservations'}), 400

    was_ready = (res.status == 'ready')
    res.status = 'cancelled'

    # If it was ready, we need to pass the hold to the next person, or free the book
    book = Book.query.get(res.book_id)
    if was_ready:
        next_res = Reservation.query.filter_by(book_id=res.book_id, status='waiting')\
            .order_by(Reservation.created_at.asc()).first()
        
        if next_res:
            next_res.status = 'ready'
            next_res.ready_at = datetime.now(timezone.utc)
            
            # Create Activity Log for next reservation ready
            next_user = User.query.get(next_res.user_id)
            if next_user and book:
                next_log = ActivityLog(
                    user_id=next_res.user_id,
                    action='reserve_ready',
                    details=f"Reservation for '{book.title}' is now ready for pickup by member {next_user.full_name or next_user.username}."
                )
                db.session.add(next_log)
        else:
            # Free the book
            if book:
                book.available_copies += 1

    # Create Activity Log for cancellation
    user = User.query.get(user_id)
    if user and book:
        act_log = ActivityLog(
            user_id=user_id,
            action='reserve_cancel',
            details=f"Member {user.full_name or user.username} cancelled reservation for '{book.title}'."
        )
        db.session.add(act_log)

    db.session.commit()
    return jsonify({'message': 'Reservation cancelled successfully'}), 200

@bp.route('/reservations', methods=['GET'])
@role_required('admin', 'librarian')
def get_all_reservations():
    page = request.args.get('page', type=int)
    limit = request.args.get('limit', 10, type=int)

    query = Reservation.query.options(
        joinedload(Reservation.book),
        joinedload(Reservation.user)
    ).order_by(Reservation.created_at.desc())

    if page:
        paginated = query.paginate(page=page, per_page=limit, error_out=False)
        results = []
        for res in paginated.items:
            data = res.to_dict()
            if res.status == 'waiting':
                position = Reservation.query.filter_by(book_id=res.book_id, status='waiting')\
                    .filter(Reservation.created_at <= res.created_at).count()
                data['queue_position'] = position
            else:
                data['queue_position'] = 0
            results.append(data)
        return jsonify({
            'reservations': results,
            'pagination': {
                'total': paginated.total,
                'pages': paginated.pages,
                'page': paginated.page,
                'per_page': paginated.per_page,
                'has_next': paginated.has_next,
                'has_prev': paginated.has_prev
            }
        }), 200

    res_list = query.all()
    results = []
    for res in res_list:
        data = res.to_dict()
        if res.status == 'waiting':
            position = Reservation.query.filter_by(book_id=res.book_id, status='waiting')\
                .filter(Reservation.created_at <= res.created_at).count()
            data['queue_position'] = position
        else:
            data['queue_position'] = 0
        results.append(data)
        
    return jsonify(results), 200

@bp.route('/reservations/bulk', methods=['POST'])
@role_required('admin', 'librarian')
def bulk_upload_reservations():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if not file.filename.endswith('.csv'):
        return jsonify({'error': 'Only CSV files are allowed'}), 400

    try:
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
        csv_input = csv.DictReader(stream)
        added = 0
        for row in csv_input:
            row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            try:
                book_id = int(row.get('book_id', 0))
                user_id = int(row.get('user_id', 0))
            except ValueError:
                continue
                
            status = row.get('status', 'waiting')
            if not book_id or not user_id:
                continue
                
            book = Book.query.get(book_id)
            user = User.query.get(user_id)
            if not book or not user:
                continue
                
            existing = Reservation.query.filter_by(book_id=book_id, user_id=user_id).filter(
                Reservation.status.in_(['waiting', 'ready'])
            ).first()
            if existing:
                continue
                
            res = Reservation(
                book_id=book_id,
                user_id=user_id,
                status=status,
                ready_at=datetime.now(timezone.utc).replace(tzinfo=None) if status == 'ready' else None
            )
            db.session.add(res)
            added += 1
            
        verify_jwt_in_request()
        admin_id = int(get_jwt_identity())
        admin_user = User.query.get(admin_id)
        if admin_user and added > 0:
            act_log = ActivityLog(
                user_id=admin_id,
                action='bulk_import',
                details=f"Librarian {admin_user.full_name or admin_user.username} bulk imported {added} reservations via CSV."
            )
            db.session.add(act_log)

        db.session.commit()
        return jsonify({'message': f'Successfully imported {added} reservations'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
