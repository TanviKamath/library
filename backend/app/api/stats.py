from flask import jsonify
from flask_jwt_extended import jwt_required
from app.api import bp
from app.models import Book, User, Transaction, Category
from app.extensions import db
from app.utils.decorators import role_required
from datetime import datetime, timezone, timedelta
from sqlalchemy import func

@bp.route('/stats/dashboard', methods=['GET'])
@role_required('admin', 'librarian')
def get_dashboard_stats():
    total_books = Book.query.count()
    total_members = User.query.filter_by(role='member').count()
    issued_books = Transaction.query.filter(Transaction.status.in_(['active', 'overdue', 'renewal_requested'])).count()
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    overdue_books = Transaction.query.filter(
        Transaction.status.in_(['active', 'overdue', 'renewal_requested']),
        Transaction.due_date < now
    ).count()

    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    soon_end = today_start + timedelta(days=4)

    due_today = Transaction.query.filter(
        Transaction.status.in_(['active', 'renewal_requested']),
        Transaction.due_date >= today_start,
        Transaction.due_date < today_end
    ).count()

    due_soon = Transaction.query.filter(
        Transaction.status.in_(['active', 'renewal_requested']),
        Transaction.due_date >= today_end,
        Transaction.due_date < soon_end
    ).count()

    # Total fines collected (paid fines)
    total_fines_result = db.session.query(func.sum(Transaction.fine_amount)).filter(
        Transaction.fine_paid == True
    ).scalar()
    total_fines_collected = total_fines_result or 0

    # Books added this month
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    books_added_this_month = Book.query.filter(Book.created_at >= first_of_month).count()

    return jsonify({
        'totalBooks': total_books,
        'totalMembers': total_members,
        'issuedBooks': issued_books,
        'overdueBooks': overdue_books,
        'dueToday': due_today,
        'dueSoon': due_soon,
        'totalFinesCollected': total_fines_collected,
        'booksAddedThisMonth': books_added_this_month
    }), 200

@bp.route('/stats/popular-books', methods=['GET'])
@role_required('admin', 'librarian')
def get_popular_books():
    # Top 5 most borrowed books by transaction count
    results = db.session.query(
        Book.title,
        func.count(Transaction.id).label('borrow_count')
    ).join(Transaction, Transaction.book_id == Book.id)\
     .group_by(Book.id, Book.title)\
     .order_by(func.count(Transaction.id).desc())\
     .limit(5)\
     .all()

    popular = [{'title': title, 'borrow_count': count} for title, count in results]
    return jsonify(popular), 200

from sqlalchemy.orm import joinedload

@bp.route('/stats/analytics-overview', methods=['GET'])
@role_required('admin', 'librarian')
def get_analytics_overview():
    # 1. Popular Books (Top 5)
    pop_results = db.session.query(
        Book.title,
        func.count(Transaction.id).label('borrow_count')
    ).join(Transaction, Transaction.book_id == Book.id)\
     .group_by(Book.id, Book.title)\
     .order_by(func.count(Transaction.id).desc())\
     .limit(5).all()
    popular_books = [{'title': t, 'count': c} for t, c in pop_results]

    # 2. Recent Activity (Latest 6 transactions)
    recent_txns = Transaction.query.options(
        joinedload(Transaction.user),
        joinedload(Transaction.book)
    ).order_by(Transaction.issued_at.desc()).limit(6).all()
    recent_activity = []
    for t in recent_txns:
        recent_activity.append({
            'id': t.id,
            'user_name': t.user.full_name if t.user else 'Unknown Member',
            'book_title': t.book.title if t.book else 'Unknown Book',
            'status': t.status,
            'date': t.issued_at.isoformat() + 'Z' if t.issued_at else None
        })

    # 3. Category Circulation (Top 5 categories by borrow count)
    cat_results = db.session.query(
        Category.name,
        func.count(Transaction.id).label('loan_count')
    ).join(Book, Book.category_id == Category.id)\
     .join(Transaction, Transaction.book_id == Book.id)\
     .group_by(Category.id, Category.name)\
     .order_by(func.count(Transaction.id).desc())\
     .limit(5).all()
    category_circulation = [{'name': name, 'count': count} for name, count in cat_results]

    return jsonify({
        'popularBooks': popular_books,
        'recentActivity': recent_activity,
        'categoryCirculation': category_circulation
    }), 200
