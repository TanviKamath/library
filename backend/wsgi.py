from app import create_app
from app.extensions import db
from app.models import User, Book, Author, Category, Transaction

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {'db': db, 'User': User, 'Book': Book, 'Author': Author, 'Category': Category, 'Transaction': Transaction}

if __name__ == '__main__':
    app.run(debug=True)
