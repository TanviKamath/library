from flask import jsonify, request
from flask_jwt_extended import jwt_required
from app.api import bp
from app.models import ActivityLog
from app.utils.decorators import role_required

@bp.route('/activity-logs', methods=['GET'])
@role_required('admin', 'librarian')
def get_activity_logs():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 50, type=int)
    
    paginated = ActivityLog.query.order_by(ActivityLog.created_at.desc()).paginate(
        page=page, per_page=limit, error_out=False
    )
    
    return jsonify({
        'logs': [log.to_dict() for log in paginated.items],
        'pagination': {
            'total': paginated.total,
            'pages': paginated.pages,
            'page': paginated.page,
            'per_page': paginated.per_page,
            'has_next': paginated.has_next,
            'has_prev': paginated.has_prev
        }
    }), 200
