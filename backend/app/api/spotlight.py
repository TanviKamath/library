from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity

from app.api import bp
from app.services.spotlight import get_current_spotlight, set_admin_spotlight
from app.utils.decorators import role_required


@bp.route('/spotlight', methods=['GET'])
def get_spotlight():
    book, meta = get_current_spotlight()
    if not book:
        return jsonify({'book': None, 'meta': None}), 200

    return jsonify({
        'book': book.to_dict(),
        'meta': meta,
    }), 200


@bp.route('/spotlight', methods=['PUT'])
@role_required('admin')
def update_spotlight():
    data = request.get_json(silent=True) or {}
    book_id = data.get('book_id')
    if not book_id:
        return jsonify({'msg': 'book_id is required'}), 400

    admin_id = int(get_jwt_identity())
    book, meta = set_admin_spotlight(int(book_id), admin_id)
    if not book:
        return jsonify({'msg': 'Book not found'}), 404

    return jsonify({
        'book': book.to_dict(),
        'meta': meta,
    }), 200
