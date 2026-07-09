from flask import jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, desc, or_
from collections import defaultdict
from app.api import bp
from app.models import Book, Transaction
from app.models.like import UserBookLike
from app.services.event import get_today_events, EVENT_WEIGHT
from app.utils.helpers import enrich_books_data

@bp.route('/books/recommendations', methods=['GET'])
@jwt_required()
def get_recommendations():
    current_user_id = get_jwt_identity()

    # 1. Gather User Data & Calculate Weighted Scores
    liked_books = UserBookLike.query.filter_by(user_id=current_user_id).all()
    past_transactions = Transaction.query.filter_by(user_id=current_user_id).all()
    
    liked_book_ids = [like.book_id for like in liked_books]
    issued_book_ids = [t.book_id for t in past_transactions]
    
    history_book_ids = list(set(liked_book_ids + issued_book_ids))
    
    # 2. Cold Start Fallback
    if not history_book_ids:
        popular_books = Book.query.order_by(
            desc(Book.total_copies - Book.available_copies), 
            desc(Book.rating)
        ).limit(10).all()
        return jsonify({'books': [b.to_dict() for b in popular_books]}), 200

    history_books = Book.query.filter(Book.id.in_(history_book_ids)).all()
    book_by_id = {b.id: b for b in history_books}
    
    category_scores = defaultdict(int)
    author_scores = defaultdict(int)

    # Apply Weights (Likes=3, Borrows=1)
    for book_id in liked_book_ids:
        if book_id in book_by_id:
            b = book_by_id[book_id]
            if b.category_id: category_scores[b.category_id] += 3
            if b.author_id: author_scores[b.author_id] += 3
            
    for book_id in issued_book_ids:
        if book_id in book_by_id:
            b = book_by_id[book_id]
            if b.category_id: category_scores[b.category_id] += 1
            if b.author_id: author_scores[b.author_id] += 1

    top_categories = [cat_id for cat_id, score in sorted(category_scores.items(), key=lambda item: item[1], reverse=True)[:3]]
    top_authors = [auth_id for auth_id, score in sorted(author_scores.items(), key=lambda item: item[1], reverse=True)[:3]]

    # 3. Collaborative Filtering (Item-Based Approximation)
    similar_user_likes = UserBookLike.query.filter(UserBookLike.book_id.in_(history_book_ids), UserBookLike.user_id != current_user_id).all()
    similar_user_txs = Transaction.query.filter(Transaction.book_id.in_(history_book_ids), Transaction.user_id != current_user_id).all()
    
    similar_user_ids = list(set([like.user_id for like in similar_user_likes] + [t.user_id for t in similar_user_txs]))
    
    collab_book_scores = defaultdict(int)
    if similar_user_ids:
        collab_likes = UserBookLike.query.filter(UserBookLike.user_id.in_(similar_user_ids)).all()
        for like in collab_likes:
            if like.book_id not in history_book_ids:
                collab_book_scores[like.book_id] += 3
                
        collab_txs = Transaction.query.filter(Transaction.user_id.in_(similar_user_ids)).all()
        for tx in collab_txs:
            if tx.book_id not in history_book_ids:
                collab_book_scores[tx.book_id] += 1

    # 4. Content-Based Candidate Generation
    content_candidates = []
    if top_categories or top_authors:
        filters = []
        if top_categories:
            filters.append(Book.category_id.in_(top_categories))
        if top_authors:
            filters.append(Book.author_id.in_(top_authors))
            
        content_candidates = Book.query.filter(
            or_(*filters),
            ~Book.id.in_(history_book_ids)
        ).all()

    # 5. Merge and Score
    final_scores = {}
    all_candidates_dict = {}

    for b in content_candidates:
        all_candidates_dict[b.id] = b
        score = 0
        if b.category_id in category_scores:
            score += category_scores[b.category_id]
        if b.author_id in author_scores:
            score += author_scores[b.author_id]
        final_scores[b.id] = score

    # ---- Event‑based boost -------------------------------------------------
    # Pull today’s events (Google Calendar) and boost books whose title or
    # description contains any of the event keywords.
    try:
        today_events = get_today_events()
        event_keywords = {kw for ev in today_events for kw in ev.get("keywords", [])}
        for b in content_candidates:
            title_words = set(b.title.lower().split())
            desc_words = set((b.description or "").lower().split())
            matches = event_keywords & (title_words | desc_words)
            if matches:
                final_scores[b.id] += EVENT_WEIGHT * len(matches)
    except Exception as e:
        # If the external service fails we don’t want to break recommendations.
        # Log the error (Flask's logger) and continue without the boost.
        from flask import current_app
        current_app.logger.error(f"Event boost failed: {e}")
    # ----------------------------------------------------------------------
        
    if collab_book_scores:
        # Fetch collab books not already in content_candidates
        new_collab_ids = [bid for bid in collab_book_scores.keys() if bid not in all_candidates_dict]
        if new_collab_ids:
            collab_books = Book.query.filter(Book.id.in_(new_collab_ids)).all()
            for b in collab_books:
                all_candidates_dict[b.id] = b
                final_scores[b.id] = 0
                
        for bid, c_score in collab_book_scores.items():
            if bid in final_scores:
                final_scores[bid] += c_score

    # Add rating to score to break ties
    for b_id, b in all_candidates_dict.items():
        rating = b.rating or 0
        final_scores[b_id] += float(rating)
        
    # Sort candidates by final score descending
    sorted_candidates = sorted(all_candidates_dict.values(), key=lambda b: final_scores[b.id], reverse=True)
    recommended_books = sorted_candidates[:16]

    # 6. Pad if necessary
    if len(recommended_books) < 16:
        needed = 16 - len(recommended_books)
        exclude_ids = history_book_ids + [b.id for b in recommended_books]
        
        pad_query = Book.query
        if exclude_ids:
            pad_query = pad_query.filter(~Book.id.in_(exclude_ids))
            
        pad_books = pad_query.order_by(
            desc(Book.total_copies - Book.available_copies), 
            desc(Book.rating)
        ).limit(needed).all()
        recommended_books.extend(pad_books)

    return jsonify({'books': enrich_books_data([b.to_dict() for b in recommended_books], current_user_id)}), 200

@bp.route('/books/<int:book_id>/similar', methods=['GET'])
def get_similar_books(book_id):
    book = Book.query.get_or_404(book_id)
    
    similar = Book.query.filter(
        or_(Book.category_id == book.category_id, Book.author_id == book.author_id),
        Book.id != book.id
    ).order_by(
        desc(Book.rating),
        desc(Book.total_copies - Book.available_copies)
    ).limit(10).all()
    
    current_user_id = None
    try:
        from flask_jwt_extended import verify_jwt_in_request
        verify_jwt_in_request(optional=True)
        current_user_id = get_jwt_identity()
    except Exception:
        pass

    return jsonify({'books': enrich_books_data([b.to_dict() for b in similar], current_user_id)}), 200
