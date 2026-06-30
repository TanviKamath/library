from flask import request, jsonify
import csv
import io
from app.api import bp
from app.models import Category, Book, ActivityLog, User
from app.extensions import db
from app.utils.decorators import role_required
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

@bp.route('/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return jsonify([c.to_dict() for c in categories]), 200

@bp.route('/categories', methods=['POST'])
@role_required('admin', 'librarian')
def create_category():
    data = request.get_json()

    if not data.get('name'):
        return jsonify({'error': 'Category name is required'}), 400

    if Category.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Category already exists'}), 409

    cat = Category(  # pyrefly: ignore
        name=data['name'], # pyrefly: ignore
        color=data.get('color', '#D7CBB8'), # pyrefly: ignore
        book_count=0 # pyrefly: ignore
    )
    db.session.add(cat)
    db.session.commit()

    return jsonify(cat.to_dict()), 201

@bp.route('/categories/<int:id>', methods=['PUT'])
@role_required('admin', 'librarian')
def update_category(id):
    cat = Category.query.get_or_404(id)
    data = request.get_json()

    if 'name' in data:
        # Check for duplicate name
        existing = Category.query.filter_by(name=data['name']).first()
        if existing and existing.id != id:
            return jsonify({'error': 'Category name already exists'}), 409
        cat.name = data['name']
    if 'color' in data:
        cat.color = data['color']

    db.session.commit()
    return jsonify(cat.to_dict()), 200

@bp.route('/categories/<int:id>', methods=['DELETE'])
@role_required('admin')
def delete_category(id):
    cat = Category.query.get_or_404(id)

    # Check if books use this category
    book_count = Book.query.filter_by(category_id=id).count()
    if book_count > 0:
        return jsonify({'error': f'Cannot delete category with {book_count} books assigned'}), 400

    db.session.delete(cat)
    db.session.commit()
    return jsonify({'message': 'Category deleted successfully'}), 200

@bp.route('/categories/bulk', methods=['POST'])
@role_required('admin', 'librarian')
def bulk_upload_categories():
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
            name = row.get('name')
            if not name:
                continue
            if Category.query.filter_by(name=name).first():
                continue
            cat = Category(
                name=name,
                color=row.get('color', '#D7CBB8'),
                book_count=0
            )
            db.session.add(cat)
            added += 1
            
        verify_jwt_in_request()
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if user and added > 0:
            act_log = ActivityLog(
                user_id=user_id,
                action='bulk_import',
                details=f"Librarian {user.full_name or user.username} bulk imported {added} categories via CSV."
            )
            db.session.add(act_log)

        db.session.commit()
        return jsonify({'message': f'Successfully imported {added} categories'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
