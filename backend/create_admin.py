"""
create_admin.py — create (or promote) an admin user.

Reads credentials from env vars, or positional args:

    ADMIN_USERNAME=admin ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongPass!' python create_admin.py
    # or
    python create_admin.py <username> <email> <password>

Idempotent: if a user with that email/username already exists, it is
promoted to admin and its password reset to the given value.
"""
import os
import sys
from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()


def main():
    if len(sys.argv) == 4:
        username, email, password = sys.argv[1], sys.argv[2], sys.argv[3]
    else:
        username = os.environ.get('ADMIN_USERNAME', 'admin')
        email = os.environ.get('ADMIN_EMAIL')
        password = os.environ.get('ADMIN_PASSWORD')

    if not email or not password:
        print("ERROR: provide email and password via positional args or "
              "ADMIN_EMAIL / ADMIN_PASSWORD env vars.")
        sys.exit(1)

    with app.app_context():
        user = User.query.filter((User.email == email) | (User.username == username)).first()
        if user:
            user.username = username
            user.email = email
            user.role = 'admin'
            user.membership_status = 'active'
            user.set_password(password)
            action = 'Promoted existing user to admin'
        else:
            user = User(username=username, email=email, role='admin', membership_status='active')
            user.set_password(password)
            db.session.add(user)
            action = 'Created new admin user'
        db.session.commit()
        print(f"{action}: username={username!r} email={email!r} role='admin'")


if __name__ == '__main__':
    main()
