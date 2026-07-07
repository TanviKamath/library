from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api import bp
from app.models import Book, Review
from app.extensions import db

@bp.route('/books/<int:book_id>/reviews', methods=['GET'])
def get_book_reviews(book_id):
    reviews = Review.query.filter_by(book_id=book_id).order_by(Review.created_at.desc()).all()
    return jsonify({'reviews': [r.to_dict() for r in reviews]}), 200

@bp.route('/books/<int:book_id>/reviews', methods=['POST'])
@jwt_required()
def add_review(book_id):
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}

    rating = data.get('rating')
    comment = data.get('comment')

    if not rating or not isinstance(rating, int) or rating < 1 or rating > 5:
        return jsonify({'error': 'A valid rating between 1 and 5 is required'}), 400

    book = Book.query.get_or_404(book_id)

    # Check if user already reviewed, if so update it
    existing_review = Review.query.filter_by(user_id=current_user_id, book_id=book_id).first()
    if existing_review:
        existing_review.rating = rating
        existing_review.comment = comment
    else:
        new_review = Review(
            user_id=current_user_id,
            book_id=book_id,
            rating=rating,
            comment=comment
        )
        db.session.add(new_review)

    db.session.commit()

    # Recalculate average rating for the book
    all_reviews = Review.query.filter_by(book_id=book_id).all()
    if all_reviews:
        avg_rating = sum([r.rating for r in all_reviews]) / len(all_reviews)
        book.rating = round(avg_rating, 1)
        db.session.commit()

    # The user's rating is a taste signal — bump their preference version so the
    # affinity engine recomputes with it (busts the cached affinity).
    from app.models.barista import BaristaProfile
    profile = BaristaProfile.query.filter_by(user_id=current_user_id).first()
    if profile:
        profile.preference_version = (profile.preference_version or 0) + 1
        db.session.commit()
        from app.services.preference_engine import invalidate_user_affinity
        invalidate_user_affinity(current_user_id)

    return jsonify({'message': 'Review submitted successfully', 'book_rating': book.rating}), 200

@bp.route('/reviews/my', methods=['GET'])
@jwt_required()
def get_my_reviews():
    current_user_id = get_jwt_identity()
    reviews = Review.query.filter_by(user_id=current_user_id).order_by(Review.created_at.desc()).all()
    
    results = []
    for r in reviews:
        r_dict = r.to_dict()
        if r.book:
            r_dict['book_title'] = r.book.title
            r_dict['book_cover'] = r.book.cover_image_url
            r_dict['book_cover_color'] = r.book.cover_color
        results.append(r_dict)
        
    return jsonify({'reviews': results}), 200
