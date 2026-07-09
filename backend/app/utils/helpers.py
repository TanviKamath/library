from app.models.like import UserBookLike
from app.models.reservation import Reservation
from app.models.transaction import Transaction

def enrich_books_data(books_data, current_user_id):
    if not current_user_id:
        for b_dict in books_data:
            b_dict['is_liked'] = False
            b_dict['is_reserved'] = False
            b_dict['is_issued'] = False
        return books_data
    
    user_likes = {like.book_id for like in UserBookLike.query.filter_by(user_id=current_user_id).all()}
    user_reservations = {r.book_id for r in Reservation.query.filter_by(user_id=current_user_id).filter(Reservation.status.in_(['waiting', 'ready'])).all()}
    user_issued = {t.book_id for t in Transaction.query.filter_by(user_id=current_user_id).filter(Transaction.status.in_(['active', 'overdue', 'renewal_requested'])).all()}
    
    for b_dict in books_data:
        b_id = b_dict['id']
        b_dict['is_liked'] = b_id in user_likes
        b_dict['is_reserved'] = b_id in user_reservations
        b_dict['is_issued'] = b_id in user_issued
    return books_data

def enrich_book_dict(b_dict, current_user_id):
    if not current_user_id:
        b_dict['is_liked'] = False
        b_dict['is_reserved'] = False
        b_dict['is_issued'] = False
        return b_dict
        
    b_id = b_dict['id']
    b_dict['is_liked'] = bool(UserBookLike.query.filter_by(user_id=current_user_id, book_id=b_id).first())
    b_dict['is_reserved'] = bool(Reservation.query.filter_by(user_id=current_user_id, book_id=b_id).filter(Reservation.status.in_(['waiting', 'ready'])).first())
    b_dict['is_issued'] = bool(Transaction.query.filter_by(user_id=current_user_id, book_id=b_id).filter(Transaction.status.in_(['active', 'overdue', 'renewal_requested'])).first())
    return b_dict
