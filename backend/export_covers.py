import sys
import os
from app import create_app, db
from app.models.book import Book

app = create_app()
with app.app_context():
    books = Book.query.all()
    with open('covers_list.txt', 'w', encoding='utf-8') as f:
        for b in books:
            if b.cover_image_url:
                f.write(f"{b.id}\t{b.title}\t{b.cover_image_url}\n")
print("Saved covers list.")
