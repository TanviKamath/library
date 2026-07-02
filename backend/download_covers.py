import os
import urllib.parse
import re
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from app import create_app, db
from app.models.book import Book

def sanitize_filename(filename):
    return re.sub(r'[\\/*?:"<>|]', "", filename).strip()

def download_single(item, output_dir, project_root):
    book_id, title, url = item
    url = url.strip()
    if not url:
        return "SKIP", book_id, title, "Empty URL"
    
    parsed_url = urllib.parse.urlsplit(url)
    ext = os.path.splitext(parsed_url.path)[1].lower()
    if ext not in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
        ext = '.jpg'
        
    safe_title = sanitize_filename(title)[:50]
    filename = f"{book_id}_{safe_title}{ext}"
    filepath = os.path.join(output_dir, filename)
    
    # If file already exists and has non-zero size, skip
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        return "SUCCESS", book_id, title, f"Already exists: {filename}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        if url.startswith('http://') or url.startswith('https://'):
            # For openlibrary or archive domains (often blocked/throttled by regional ISPs), use CDN proxy wsrv.nl
            target_url = url
            if 'openlibrary.org' in url or 'archive.org' in url:
                target_url = f"https://wsrv.nl/?url={urllib.parse.quote(url)}"
                
            try:
                r = requests.get(target_url, headers=headers, timeout=8)
                r.raise_for_status()
                with open(filepath, 'wb') as out_file:
                    out_file.write(r.content)
                return "SUCCESS", book_id, title, f"Downloaded {filename}"
            except Exception as direct_err:
                # Fallback to direct url if proxy failed, or vice-versa
                alt_url = url if target_url != url else f"https://wsrv.nl/?url={urllib.parse.quote(url)}"
                r = requests.get(alt_url, headers=headers, timeout=8)
                r.raise_for_status()
                with open(filepath, 'wb') as out_file:
                    out_file.write(r.content)
                return "SUCCESS", book_id, title, f"Downloaded {filename} (via fallback)"
        else:
            local_path = os.path.join(project_root, 'public', url.lstrip('/'))
            if not os.path.exists(local_path):
                local_path = os.path.join(os.path.dirname(__file__), 'static', url.lstrip('/'))
            
            if os.path.exists(local_path):
                with open(local_path, 'rb') as src_file, open(filepath, 'wb') as out_file:
                    out_file.write(src_file.read())
                return "SUCCESS", book_id, title, f"Copied {filename}"
            else:
                return "SKIP", book_id, title, f"Local file not found: {url}"
    except Exception as e:
        return "FAIL", book_id, title, str(e)

def main():
    app = create_app()
    with app.app_context():
        books = Book.query.filter(Book.cover_image_url.isnot(None)).all()
        items = [(b.id, b.title, b.cover_image_url) for b in books if b.cover_image_url]
        
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    output_dir = os.path.join(project_root, 'downloaded_covers')
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Starting multithreaded download of {len(items)} cover images into E:\\Frappe_Internship\\lms\\lms_3\\downloaded_covers...")
    
    success_count = 0
    skip_count = 0
    fail_count = 0
    
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(download_single, item, output_dir, project_root) for item in items]
        
        for idx, future in enumerate(as_completed(futures), 1):
            status, b_id, b_title, msg = future.result()
            if status == "SUCCESS":
                success_count += 1
            elif status == "SKIP":
                skip_count += 1
            else:
                fail_count += 1
            
            if idx % 25 == 0 or idx == len(items):
                print(f"Progress: {idx}/{len(items)} | Success: {success_count} | Failed: {fail_count} | Skipped: {skip_count}", flush=True)
                
    print("\n--- Final Download Summary ---")
    print(f"Total Books Checked: {len(items)}")
    print(f"Successfully Downloaded/Saved: {success_count}")
    print(f"Skipped: {skip_count}")
    print(f"Failed: {fail_count}")

if __name__ == '__main__':
    main()
