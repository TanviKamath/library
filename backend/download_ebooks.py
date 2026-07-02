import os
import requests
from app import create_app, db
from app.models.book import Book

CLASSIC_GUTENBERG_MAP = {
    "Alice's Adventures in Wonderland": 11,
    "Frankenstein; or, The Modern Prometheus": 84,
    "Frankenstein; Or, The Modern Prometheus": 84,
    "The Wonderful Wizard of Oz": 55,
    "Dracula": 345,
    "The Time Machine": 35,
    "Flatland": 201,
    "The Invisible Man": 5230,
    "The War of the Worlds": 36,
    "A Princess of Mars": 62,
    "Pride and Prejudice": 1342,
    "The Picture of Dorian Gray": 174,
    "The Adventures of Sherlock Holmes": 1661,
    "Moby Dick": 2701,
    "Romeo and Juliet": 1513,
    "Great Expectations": 1400,
    "Jane Eyre": 1260,
    "Wuthering Heights": 768,
    "Sailing alone around the world": 6317
}

def main():
    app = create_app()
    with app.app_context():
        # 1. Update gutenberg_id for known classic titles if missing
        updated_count = 0
        books = Book.query.all()
        for b in books:
            title_clean = b.title.strip()
            if not b.gutenberg_id and title_clean in CLASSIC_GUTENBERG_MAP:
                b.gutenberg_id = CLASSIC_GUTENBERG_MAP[title_clean]
                updated_count += 1
        if updated_count > 0:
            db.session.commit()
            print(f"Assigned gutenberg_id to {updated_count} classic books.")
            
        ebook_books = Book.query.filter(Book.gutenberg_id.isnot(None)).all()
        print(f"Found {len(ebook_books)} books with gutenberg_id in database.")
        
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        output_dir = os.path.join(project_root, 'downloaded_ebooks')
        os.makedirs(output_dir, exist_ok=True)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        }
        
        success_count = 0
        skip_count = 0
        fail_count = 0
        
        for b in ebook_books:
            gid = b.gutenberg_id
            filepath = os.path.join(output_dir, f"{gid}.txt")
            
            if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
                print(f"[SKIP] Already downloaded: {b.title} (ID: {gid})")
                skip_count += 1
                continue
            
            urls = [
                f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt",
                f"https://www.gutenberg.org/files/{gid}/{gid}-0.txt",
                f"https://www.gutenberg.org/files/{gid}/{gid}.txt"
            ]
            
            downloaded = False
            for url in urls:
                try:
                    r = requests.get(url, headers=headers, timeout=10)
                    if r.status_code == 200 and len(r.text) > 500:
                        with open(filepath, 'w', encoding='utf-8', errors='replace') as f:
                            f.write(r.text)
                        downloaded = True
                        success_count += 1
                        print(f"[OK] Downloaded: {b.title} (ID: {gid})")
                        break
                except Exception as e:
                    continue
                    
            if not downloaded:
                fail_count += 1
                print(f"[FAIL] Could not download text for: {b.title} (ID: {gid})")
                
        print("\n--- EBook Download Summary ---")
        print(f"Successfully downloaded: {success_count}")
        print(f"Already existed (skipped): {skip_count}")
        print(f"Failed: {fail_count}")

if __name__ == '__main__':
    main()
