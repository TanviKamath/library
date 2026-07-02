import csv
import io
import urllib.request
import urllib.parse
import json
import re
from flask import request, jsonify
# pyrefly: ignore [missing-import]
from flask_jwt_extended import jwt_required
from app.api import bp
from app.models import Book, Author, Category, ActivityLog, User
from app.extensions import db
from app.utils.decorators import role_required, validate_json
from app.schemas import BookSchema
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.models.like import UserBookLike
from sqlalchemy.orm import joinedload

@bp.route('/books', methods=['GET'])
def get_books():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('limit', 12, type=int)
    search = request.args.get('search', '')
    category = request.args.get('category', 'all')
    sort = request.args.get('sort', 'newest')

    query = Book.query.options(joinedload(Book.author), joinedload(Book.category))

    if search:
        search_term = f"%{search}%"
        query = query.outerjoin(Author).filter(
            db.or_(
                Book.title.ilike(search_term),
                Author.name.ilike(search_term),
                Book.description.ilike(search_term)
            )
        )
    
    ebook_only = request.args.get('ebook_only', 'false').lower() == 'true'
    if ebook_only:
        query = query.filter(Book.gutenberg_id.isnot(None))
    elif category and category != 'all':
        query = query.join(Category).filter(Category.name == category)

    if sort == 'rating':
        query = query.order_by(Book.rating.desc(), Book.id.desc())
    elif sort == 'most_borrowed':
        query = query.order_by((Book.total_copies - Book.available_copies).desc(), Book.id.desc())
    elif sort == 'least_copies':
        query = query.order_by(Book.total_copies.asc(), Book.id.desc())
    elif sort == 'a_to_z':
        query = query.order_by(Book.title.asc(), Book.id.desc())
    elif sort == 'z_to_a':
        query = query.order_by(Book.title.desc(), Book.id.desc())
    else:
        query = query.order_by(Book.id.desc())
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    current_user_id = None
    try:
        verify_jwt_in_request(optional=True)
        current_user_id = get_jwt_identity()
    except Exception:
        pass

    user_likes = []
    if current_user_id:
        user_likes = [like.book_id for like in UserBookLike.query.filter_by(user_id=current_user_id).all()]

    books_data = []
    for b in paginated.items:
        b_dict = b.to_dict()
        b_dict['is_liked'] = b.id in user_likes
        books_data.append(b_dict)

    return jsonify({
        'books': books_data,
        'pagination': {
            'total': paginated.total,
            'pages': paginated.pages,
            'page': paginated.page,
            'per_page': paginated.per_page,
            'has_next': paginated.has_next,
            'has_prev': paginated.has_prev
        }
    }), 200

@bp.route('/books/<int:id>', methods=['GET'])
def get_book(id):
    book = Book.query.get_or_404(id)
    b_dict = book.to_dict()
    
    current_user_id = None
    try:
        verify_jwt_in_request(optional=True)
        current_user_id = get_jwt_identity()
    except Exception:
        pass

    b_dict['is_liked'] = False
    if current_user_id:
        liked = UserBookLike.query.filter_by(user_id=current_user_id, book_id=id).first()
        if liked:
            b_dict['is_liked'] = True

    return jsonify(b_dict), 200

@bp.route('/books', methods=['POST'])
@role_required('admin', 'librarian')
@validate_json(BookSchema)
def create_book():
    data = request.validated_data

    # Find or create author by name
    author = None
    author_name = data.get('author_name')
    if author_name:
        author = Author.query.filter_by(name=author_name).first()
        if not author:
            author = Author(name=author_name)  # pyrefly: ignore
            db.session.add(author)
            db.session.flush()

    new_book = Book(  # pyrefly: ignore
        title=data.get('title'), # pyrefly: ignore
        isbn=data.get('isbn'), # pyrefly: ignore
        author_id=author.id if author else None, # pyrefly: ignore
        category_id=data.get('category_id'), # pyrefly: ignore
        description=data.get('description'), # pyrefly: ignore
        cover_color=data.get('cover_color', '#D7CBB8'), # pyrefly: ignore
        total_copies=data.get('total_copies', 1), # pyrefly: ignore
        available_copies=data.get('total_copies', 1), # pyrefly: ignore
        gutenberg_id=data.get('gutenberg_id'),
        cover_image_url=data.get('cover_image_url')
    )
    db.session.add(new_book)

    # Update category book count
    if new_book.category_id:
        cat = Category.query.get(new_book.category_id)
        if cat:
            cat.book_count = (cat.book_count or 0) + 1

    db.session.commit()

    return jsonify(new_book.to_dict()), 201

@bp.route('/books/bulk', methods=['POST'])
@role_required('admin', 'librarian')
def bulk_upload_books():
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
        
        books_added = 0
        for row in csv_input:
            # normalize keys to lowercase
            row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            
            title = row.get('title')
            if not title:
                continue # Skip rows without title
                
            author_name = row.get('author')
            category_name = row.get('category')
            isbn = row.get('isbn')
            description = row.get('description', '')
            try:
                total_copies = int(row.get('total_copies', 1))
            except ValueError:
                total_copies = 1

            # Author
            author = None
            if author_name:
                author = Author.query.filter_by(name=author_name).first()
                if not author:
                    author = Author(name=author_name)
                    db.session.add(author)
                    db.session.flush()

            # Category
            category = None
            if category_name:
                category = Category.query.filter_by(name=category_name).first()
                if not category:
                    category = Category(name=category_name, color='#D7CBB8', book_count=0)
                    db.session.add(category)
                    db.session.flush()

            new_book = Book(
                title=title,
                isbn=isbn,
                author_id=author.id if author else None,
                category_id=category.id if category else None,
                description=description,
                cover_color='#D7CBB8',
                total_copies=total_copies,
                available_copies=total_copies
            )
            db.session.add(new_book)
            
            if category:
                category.book_count = (category.book_count or 0) + 1
                
            books_added += 1

        # Create Activity Log
        verify_jwt_in_request()
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        if user and books_added > 0:
            act_log = ActivityLog(
                user_id=user_id,
                action='bulk_import',
                details=f"Librarian {user.full_name or user.username} bulk imported {books_added} books via CSV."
            )
            db.session.add(act_log)

        db.session.commit()
        return jsonify({'message': f'Successfully imported {books_added} books'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@bp.route('/books/<int:id>', methods=['PUT'])
@role_required('admin', 'librarian')
@validate_json(BookSchema)
def update_book(id):
    book = Book.query.get_or_404(id)
    data = request.validated_data

    if 'title' in data:
        book.title = data['title']
    if 'isbn' in data:
        book.isbn = data['isbn']
    if 'description' in data:
        book.description = data['description']
    if 'cover_color' in data:
        book.cover_color = data['cover_color']
    if 'category_id' in data:
        book.category_id = data['category_id']
    if 'total_copies' in data:
        diff = data['total_copies'] - book.total_copies
        book.total_copies = data['total_copies']
        book.available_copies = max(0, book.available_copies + diff)
    if 'rating' in data:
        book.rating = data['rating']
    if 'gutenberg_id' in data:
        book.gutenberg_id = data['gutenberg_id']
    if 'cover_image_url' in data:
        book.cover_image_url = data['cover_image_url']

    # Handle author name change
    if 'author_name' in data:
        author = Author.query.filter_by(name=data['author_name']).first()
        if not author:
            author = Author(name=data['author_name'])  # pyrefly: ignore
            db.session.add(author)
            db.session.flush()
        book.author_id = author.id

    db.session.commit()
    return jsonify(book.to_dict()), 200

@bp.route('/books/<int:id>', methods=['DELETE'])
@role_required('admin', 'librarian')
def delete_book(id):
    book = Book.query.get_or_404(id)

    # Check for active transactions
    from app.models import Transaction
    active = Transaction.query.filter_by(book_id=id, status='active').count()
    if active > 0:
        return jsonify({'error': 'Cannot delete book with active transactions'}), 400

    # Update category book count
    if book.category_id:
        cat = Category.query.get(book.category_id)
        if cat and cat.book_count:
            cat.book_count = max(0, cat.book_count - 1)

    db.session.delete(book)
    db.session.commit()
    return jsonify({'message': 'Book deleted successfully'}), 200

@bp.route('/books/gutenberg/search', methods=['GET'])
@role_required('admin', 'librarian')
def search_gutenberg_books():
    query = request.args.get('query', '').strip()
    page = request.args.get('page', 1, type=int)
    if not query:
        return jsonify({'results': [], 'count': 0}), 200

    try:
        url = f"https://gutendex.com/books/?search={urllib.parse.quote(query)}&page={page}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (CafeReader/1.0)'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            
        results = []
        for item in data.get('results', []):
            gid = item.get('id')
            title = item.get('title', 'Unknown Title')
            authors = item.get('authors', [])
            author_name = authors[0].get('name', 'Unknown Author') if authors else 'Unknown Author'
            if ',' in author_name:
                parts = [p.strip() for p in author_name.split(',', 1)]
                author_name = f"{parts[1]} {parts[0]}" if len(parts) == 2 else author_name
                
            formats = item.get('formats', {})
            cover_url = formats.get('image/jpeg', '')
            
            results.append({
                'gutenberg_id': gid,
                'title': title,
                'author_name': author_name,
                'cover_image_url': cover_url,
                'download_count': item.get('download_count', 0),
                'subjects': item.get('subjects', [])[:3]
            })
            
        return jsonify({
            'results': results,
            'count': data.get('count', 0),
            'next': data.get('next') is not None
        }), 200
    except Exception as e:
        return jsonify({'error': f"Failed to fetch from Gutendex: {str(e)}"}), 500

@bp.route('/books/<int:id>/read', methods=['GET'])
def read_book_content(id):
    import os
    import requests
    from flask import current_app

    book = Book.query.get_or_404(id)
    if not book.gutenberg_id:
        return jsonify({'error': 'This book does not have an e-book version available.'}), 400
        
    gid = book.gutenberg_id
    project_root = os.path.abspath(os.path.join(current_app.root_path, '..', '..'))
    ebooks_dir = os.path.join(project_root, 'downloaded_ebooks')
    os.makedirs(ebooks_dir, exist_ok=True)
    local_filepath = os.path.join(ebooks_dir, f"{gid}.txt")

    content = None
    # 1. Read from local disk first (fast & reliable)
    if os.path.exists(local_filepath):
        try:
            with open(local_filepath, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
        except Exception as e:
            current_app.logger.warning(f"Error reading local ebook file: {e}")

    # 2. If not found locally, fetch via requests with browser User-Agent and save locally
    if not content or len(content) < 500:
        urls = [
            f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt",
            f"https://www.gutenberg.org/files/{gid}/{gid}-0.txt",
            f"https://www.gutenberg.org/files/{gid}/{gid}.txt"
        ]
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
        for url in urls:
            try:
                r = requests.get(url, headers=headers, timeout=10)
                if r.status_code == 200 and len(r.text) > 500:
                    content = r.text
                    try:
                        with open(local_filepath, 'w', encoding='utf-8', errors='replace') as f:
                            f.write(content)
                    except Exception:
                        pass
                    break
            except Exception:
                continue
            
    if not content:
        return jsonify({'error': 'Could not retrieve e-book content from Project Gutenberg servers.'}), 502
        
    lines = content.split('\n')
    start_idx = 0
    end_idx = len(lines)
    
    for i, line in enumerate(lines[:300]):
        if "*** START OF THE PROJECT GUTENBERG EBOOK" in line.upper() or "***START OF THE PROJECT GUTENBERG" in line.upper():
            start_idx = i + 1
            break
            
    for i, line in enumerate(lines[start_idx:], start=start_idx):
        if "*** END OF THE PROJECT GUTENBERG EBOOK" in line.upper() or "***END OF THE PROJECT GUTENBERG" in line.upper():
            end_idx = i
            break
            
    clean_lines = lines[start_idx:end_idx]
    clean_text = '\n'.join(clean_lines).strip()

    def split_long_block(block, target_words=140):
        sentences = re.split(r'(?<=[.!?])\s+', block.strip())
        chunks = []
        current_chunk = []
        current_words = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            sentence_words = len(sentence.split())
            if current_chunk and current_words + sentence_words > target_words:
                chunks.append(' '.join(current_chunk).strip())
                current_chunk = [sentence]
                current_words = sentence_words
            else:
                current_chunk.append(sentence)
                current_words += sentence_words

        if current_chunk:
            chunks.append(' '.join(current_chunk).strip())

        return [chunk for chunk in chunks if chunk]

    raw_blocks = re.split(r'\n\s*\n+', clean_text)
    paragraphs = []

    for block in raw_blocks:
        normalized_block = re.sub(r'\s*\n\s*', ' ', block).strip()
        if not normalized_block:
            continue

        if len(normalized_block.split()) > 220:
            paragraphs.extend(split_long_block(normalized_block))
        else:
            paragraphs.append(normalized_block)

    if len(paragraphs) < 8:
        paragraphs = split_long_block(clean_text, target_words=120)
    
    return jsonify({
        'book_id': book.id,
        'title': book.title,
        'author_name': book.author.name if book.author else 'Unknown',
        'paragraphs': paragraphs[:2500]
    }), 200

@bp.route('/proxy-image', methods=['GET'])
def proxy_image():
    import os
    import requests
    import urllib.parse
    from flask import Response, redirect, send_from_directory, current_app
    from app.models.book import Book

    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # 1. Serve from local downloaded_covers folder if available
    try:
        project_root = os.path.abspath(os.path.join(current_app.root_path, '..', '..'))
        covers_dir = os.path.join(project_root, 'downloaded_covers')
        if os.path.exists(covers_dir):
            book = Book.query.filter_by(cover_image_url=url).first()
            if not book:
                filename_part = url.split('/')[-1]
                if filename_part:
                    book = Book.query.filter(Book.cover_image_url.like(f"%{filename_part}%")).first()
            if book:
                prefix = f"{book.id}_"
                for fname in os.listdir(covers_dir):
                    if fname.startswith(prefix):
                        return send_from_directory(covers_dir, fname, max_age=86400)
    except Exception as e:
        current_app.logger.warning(f"Local cover lookup failed: {e}")

    # 2. If not local, fetch via robust CDN proxy or requests
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    }
    try:
        target_url = url
        if 'openlibrary.org' in url or 'archive.org' in url:
            target_url = f"https://wsrv.nl/?url={urllib.parse.quote(url)}"
        r = requests.get(target_url, headers=headers, timeout=8)
        if r.status_code == 200:
            return Response(r.content, status=200, headers={
                'Content-Type': r.headers.get('Content-Type', 'image/jpeg'),
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=86400'
            })
    except Exception:
        pass

    # 3. Final fallback redirect to image proxy
    proxy_url = f"https://wsrv.nl/?url={urllib.parse.quote(url)}"
    return redirect(proxy_url, code=302)
