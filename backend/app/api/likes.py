from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api import bp
from app.models import Book, User
from app.models.like import UserBookLike
from app.extensions import db

@bp.route('/books/<int:id>/like', methods=['POST'])
@jwt_required()
def like_book(id):
    current_user_id = get_jwt_identity()
    book = Book.query.get_or_404(id)

    # Check if already liked
    existing_like = UserBookLike.query.filter_by(user_id=current_user_id, book_id=id).first()
    if existing_like:
        return jsonify({'message': 'Book already liked'}), 200

    new_like = UserBookLike(user_id=current_user_id, book_id=id)
    db.session.add(new_like)
    db.session.commit()

    return jsonify({'message': 'Book liked successfully'}), 201

@bp.route('/books/<int:id>/like', methods=['DELETE'])
@jwt_required()
def unlike_book(id):
    current_user_id = get_jwt_identity()
    book = Book.query.get_or_404(id)

    like = UserBookLike.query.filter_by(user_id=current_user_id, book_id=id).first()
    if like:
        db.session.delete(like)
        db.session.commit()
        return jsonify({'message': 'Book unliked successfully'}), 200
    
    return jsonify({'message': 'Like not found'}), 404

@bp.route('/users/me/likes', methods=['GET'])
@jwt_required()
def get_my_likes():
    current_user_id = get_jwt_identity()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 12, type=int)

    likes_query = UserBookLike.query.filter_by(user_id=current_user_id).order_by(UserBookLike.created_at.desc())
    paginated = likes_query.paginate(page=page, per_page=per_page, error_out=False)

    books = [{**like.book.to_dict(), 'is_liked': True} for like in paginated.items]

    return jsonify({
        'books': books,
        'pagination': {
            'total': paginated.total,
            'pages': paginated.pages,
            'page': paginated.page,
            'per_page': paginated.per_page,
            'has_next': paginated.has_next,
            'has_prev': paginated.has_prev
        }
    }), 200
