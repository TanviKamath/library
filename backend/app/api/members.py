from flask import request, jsonify
import csv
import io
# pyrefly: ignore [missing-import]
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.api import bp
from app.models import User, ActivityLog
from app.extensions import db
from app.utils.decorators import role_required, validate_json
from app.schemas import MemberSchema
from datetime import datetime, timezone, timedelta

@bp.route('/members', methods=['GET'])
@role_required('admin', 'librarian')
def get_members():
    page = request.args.get('page', type=int)
    limit = request.args.get('limit', 10, type=int)
    query = User.query.filter_by(role='member').order_by(User.id.desc())

    if page:
        paginated = query.paginate(page=page, per_page=limit, error_out=False)
        return jsonify({
            'members': [m.to_dict() for m in paginated.items],
            'pagination': {
                'total': paginated.total,
                'pages': paginated.pages,
                'page': paginated.page,
                'per_page': paginated.per_page,
                'has_next': paginated.has_next,
                'has_prev': paginated.has_prev
            }
        }), 200

    members = query.all()
    return jsonify([m.to_dict() for m in members]), 200

@bp.route('/members/<int:id>', methods=['GET'])
@role_required('admin', 'librarian')
def get_member(id):
    member = User.query.get_or_404(id)
    return jsonify(member.to_dict()), 200

@bp.route('/members', methods=['POST'])
@role_required('admin', 'librarian')
@validate_json(MemberSchema)
def create_member():
    data = request.validated_data

    # Validate required fields
    if not data.get('full_name') or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Name, email, and password are required'}), 400

    # Check for duplicates (optimized ID-only select)
    if db.session.query(User.id).filter_by(email=data['email']).first():
        return jsonify({'error': 'A user with this email already exists'}), 409

    new_user = User(  # pyrefly: ignore
        email=data['email'], # pyrefly: ignore
        full_name=data.get('full_name', ''), # pyrefly: ignore
        role=data.get('role', 'member'), # pyrefly: ignore
        membership_expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=365) # pyrefly: ignore
    )
    new_user.set_password(data['password'])

    db.session.add(new_user)
    db.session.commit()

    return jsonify(new_user.to_dict()), 201

@bp.route('/members/<int:id>', methods=['PUT'])
@role_required('admin', 'librarian')
def update_member(id):
    member = User.query.get_or_404(id)
    data = request.get_json()

    if 'full_name' in data:
        member.full_name = data['full_name']
    if 'email' in data:
        # Check for duplicate (optimized ID-only select)
        existing_id = db.session.query(User.id).filter_by(email=data['email']).first()
        if existing_id and existing_id[0] != id:
            return jsonify({'error': 'A user with this email already exists'}), 409
        member.email = data['email']
    if 'role' in data:
        member.role = data['role']
    if 'membership_status' in data:
        member.membership_status = data['membership_status']

    db.session.commit()
    return jsonify(member.to_dict()), 200

@bp.route('/members/<int:id>', methods=['DELETE'])
@role_required('admin')
def delete_member(id):
    member = User.query.get_or_404(id)

    # Don't actually delete — deactivate
    member.membership_status = 'inactive'
    db.session.commit()

    return jsonify({'message': 'Member deactivated successfully'}), 200

@bp.route('/members/<int:id>/renew', methods=['POST'])
@role_required('admin', 'librarian')
def renew_member(id):
    member = User.query.get_or_404(id)
    
    # If already expired or active, add 365 days from today (or from current expiry if it's in the future)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    if not member.membership_expires_at or member.membership_expires_at < now:
        member.membership_expires_at = now + timedelta(days=365)
    else:
        member.membership_expires_at = member.membership_expires_at + timedelta(days=365)
        
    member.membership_status = 'active'
    db.session.commit()
    
    return jsonify(member.to_dict()), 200

@bp.route('/members/bulk', methods=['POST'])
@role_required('admin', 'librarian')
def bulk_upload_members():
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
            email = row.get('email')
            password = row.get('password', 'password123')
            full_name = row.get('full_name', '')
            role = row.get('role', 'member')

            if not full_name or not email:
                continue
            if User.query.filter_by(email=email).first():
                continue

            new_user = User(
                email=email,
                full_name=full_name,
                role=role,
                membership_expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=365)
            )
            new_user.set_password(password)
            db.session.add(new_user)
            added += 1
            
        verify_jwt_in_request()
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if user and added > 0:
            act_log = ActivityLog(
                user_id=user_id,
                action='bulk_import',
                details=f"Librarian {user.full_name} bulk imported {added} members via CSV."
            )
            db.session.add(act_log)

        db.session.commit()
        return jsonify({'message': f'Successfully imported {added} members'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
