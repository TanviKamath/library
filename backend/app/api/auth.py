from flask import request, jsonify
# pyrefly: ignore [missing-import]
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity,
    set_access_cookies, set_refresh_cookies, unset_jwt_cookies
)
from datetime import datetime, timezone, timedelta
from app.api import bp
from app.models import User
from app.extensions import db, limiter
from app.utils.decorators import validate_json
from app.schemas import LoginSchema, RegisterSchema

@bp.route('/auth/login', methods=['POST'])
@limiter.limit("1000 per minute")
@validate_json(LoginSchema)
def login():
    data = request.validated_data
    email = data.get('email')
    password = data.get('password')

    user = User.query.filter(db.func.lower(User.email) == (email or '').strip().lower()).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    # Return user info & access token in JSON body; tokens also go into HttpOnly cookies
    response = jsonify({'user': user.to_dict(), 'access_token': access_token})
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response, 200

@bp.route('/auth/register', methods=['POST'])
@limiter.limit("20 per hour")
@validate_json(RegisterSchema)
def register():
    """Public self-service signup. Creates a member and logs them straight in."""
    data = request.validated_data
    email = data['email'].strip().lower()

    # Reject duplicates (case-insensitive email match)
    if db.session.query(User.id).filter(db.func.lower(User.email) == email).first():
        return jsonify({'error': 'An account with this email already exists'}), 409

    new_user = User(  # pyrefly: ignore
        email=email,  # pyrefly: ignore
        full_name=data['full_name'].strip(),  # pyrefly: ignore
        role='member',  # pyrefly: ignore
        membership_expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=365)  # pyrefly: ignore
    )
    new_user.set_password(data['password'])
    db.session.add(new_user)
    db.session.commit()

    access_token = create_access_token(identity=str(new_user.id))
    refresh_token = create_refresh_token(identity=str(new_user.id))

    response = jsonify({'user': new_user.to_dict(), 'access_token': access_token})
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response, 201

@bp.route('/auth/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)

    response = jsonify({'message': 'Token refreshed'})
    set_access_cookies(response, access_token)
    return response, 200

@bp.route('/auth/logout', methods=['POST'])
def logout():
    """Clear all JWT cookies to end the session."""
    response = jsonify({'message': 'Logged out'})
    unset_jwt_cookies(response)
    return response, 200

@bp.route('/auth/me', methods=['GET'])
@jwt_required(optional=True)
def get_me():
    user_id = get_jwt_identity()
    if not user_id:
        return jsonify(None), 200
    user = User.query.get(int(user_id))
    if not user:
        return jsonify(None), 200
    return jsonify(user.to_dict()), 200

@bp.route('/auth/me', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    data = request.get_json()
    if 'full_name' in data:
        user.full_name = data['full_name']
    if 'email' in data:
        # Check if email is already taken by someone else (optimized ID-only select)
        existing_id = db.session.query(User.id).filter_by(email=data['email']).first()
        if existing_id and str(existing_id[0]) != str(user_id):
            return jsonify({'error': 'Email is already in use'}), 400
        user.email = data['email']
        
    db.session.commit()
    return jsonify({'message': 'Profile updated successfully', 'user': user.to_dict()}), 200

@bp.route('/auth/password', methods=['PUT'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404
        
    data = request.get_json()
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    
    if not current_password or not new_password:
        return jsonify({'error': 'Current password and new password are required'}), 400
        
    if not user.check_password(current_password):
        return jsonify({'error': 'Incorrect current password'}), 400
        
    user.set_password(new_password)
    db.session.commit()
    return jsonify({'message': 'Password changed successfully'}), 200
