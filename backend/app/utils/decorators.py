from functools import wraps
from flask import jsonify
# pyrefly: ignore [missing-import]
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models import User

def role_required(*roles):
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(int(user_id))
            if not user or user.role not in roles:
                return jsonify(msg="Insufficient permissions"), 403
            return fn(*args, **kwargs)
        return decorator
    return wrapper

def validate_json(schema):
    """
    Decorator to validate incoming JSON using a Marshmallow schema.
    If validation fails, returns a 400 response with the errors.
    """
    def wrapper(fn):
        @wraps(fn)
        def decorator(*args, **kwargs):
            from flask import request
            from marshmallow import ValidationError
            
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No input data provided'}), 400
                
            try:
                # Load and validate the data
                validated_data = schema().load(data)
                # Store the validated data in request.validated_data so the route can use it
                request.validated_data = validated_data
            except ValidationError as err:
                return jsonify({'error': 'Validation failed', 'messages': err.messages}), 400
                
            return fn(*args, **kwargs)
        return decorator
    return wrapper
