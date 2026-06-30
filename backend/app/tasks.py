import logging
import os
import shutil
from datetime import datetime, timezone, timedelta
from app.extensions import db, mail
from app.models import Transaction
from flask_mail import Message
from flask import current_app

logger = logging.getLogger(__name__)

def check_overdue_books():
    """
    Scheduled job to check for newly overdue books and email users.
    """
    from app.extensions import scheduler
    
    # We must explicitly create an app context for background threads
    with scheduler.app.app_context():
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        
        try:
            overdue_txs = Transaction.query.filter(
                Transaction.status == 'active',
                Transaction.due_date < now
            ).all()

            if not overdue_txs:
                logger.info("No newly overdue books found.")
                return

            for tx in overdue_txs:
                # Change status to overdue
                tx.status = 'overdue'
                
                # Prepare email
                sender = current_app.config.get('MAIL_DEFAULT_SENDER', 'noreply@bookworm.com')
                msg = Message(
                    subject='Book Overdue Notice - Sat LMS',
                    sender=sender,
                    recipients=[tx.user.email]
                )
                msg.body = f"Hello {tx.user.full_name},\n\nThis is a friendly reminder that your borrowed book '{tx.book.title}' was due on {tx.due_date.strftime('%Y-%m-%d')}. It is now marked as overdue.\n\nPlease return it to the library as soon as possible to avoid further fines.\n\nThank you,\nSat LMS Library"
                
                try:
                    mail.send(msg)
                    logger.info(f"Sent overdue email to {tx.user.email} for book {tx.book.title}")
                except Exception as e:
                    # If MAIL_SERVER is configured incorrectly, or credentials fail, we log it.
                    logger.error(f"Failed to send email to {tx.user.email}: {str(e)}")

            db.session.commit()
            logger.info(f"Successfully processed {len(overdue_txs)} overdue transactions.")
            
        except Exception as e:
            logger.error(f"Error in check_overdue_books job: {str(e)}")
            db.session.rollback()

def check_expired_memberships():
    from app.extensions import scheduler
    from app.models import User
    
    with scheduler.app.app_context():
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        try:
            expired_users = User.query.filter(
                User.membership_status == 'active',
                User.membership_expires_at != None,
                User.membership_expires_at < now
            ).all()

            if not expired_users:
                return

            for user in expired_users:
                user.membership_status = 'inactive'
                
            db.session.commit()
            logger.info(f"Successfully processed {len(expired_users)} expired memberships.")
        except Exception as e:
            logger.error(f"Error in check_expired_memberships job: {str(e)}")
            db.session.rollback()

def backup_database():
    """
    Scheduled job to create a backup of the SQLite database and prune old backups.
    """
    from app.extensions import scheduler
    
    with scheduler.app.app_context():
        try:
            # The database URI is typically like: sqlite:///E:\path\to\app.db
            db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
            if not db_uri.startswith('sqlite:///'):
                logger.error("Automated backup is only configured for SQLite.")
                return

            # Extract the actual file path from the URI
            db_path = db_uri.replace('sqlite:///', '')
            
            if not os.path.exists(db_path):
                logger.error(f"Database file not found at {db_path}")
                return
                
            # Create backups directory next to the database
            base_dir = os.path.dirname(db_path)
            backups_dir = os.path.join(base_dir, 'backups')
            os.makedirs(backups_dir, exist_ok=True)
            
            # Create the backup copy
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
            backup_filename = f"app_backup_{timestamp}.db"
            backup_path = os.path.join(backups_dir, backup_filename)
            
            shutil.copy2(db_path, backup_path)
            logger.info(f"Successfully created database backup: {backup_filename}")
            
            # Prune backups older than 7 days
            now = datetime.now(timezone.utc).replace(tzinfo=None)
            for filename in os.listdir(backups_dir):
                if filename.startswith('app_backup_') and filename.endswith('.db'):
                    file_path = os.path.join(backups_dir, filename)
                    file_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
                    
                    if now - file_modified > timedelta(days=7):
                        os.remove(file_path)
                        logger.info(f"Pruned old backup: {filename}")
                        
        except Exception as e:
            logger.error(f"Error in backup_database job: {str(e)}")

def check_expired_holds():
    """
    Scheduled job to check for waitlist holds that have expired (past 48 hours).
    Passes the hold to the next person or frees the book.
    """
    from app.extensions import scheduler
    from app.models import Reservation, Book, User
    
    with scheduler.app.app_context():
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expiry_threshold = now - timedelta(hours=48)
        
        try:
            expired_holds = Reservation.query.filter(
                Reservation.status == 'ready',
                Reservation.ready_at != None,
                Reservation.ready_at < expiry_threshold
            ).all()

            if not expired_holds:
                return

            for res in expired_holds:
                res.status = 'expired'
                
                # Check for next person in line
                next_res = Reservation.query.filter_by(book_id=res.book_id, status='waiting')\
                    .order_by(Reservation.created_at.asc()).first()
                
                if next_res:
                    next_res.status = 'ready'
                    next_res.ready_at = now
                    
                    try:
                        user = User.query.get(next_res.user_id)
                        book = Book.query.get(res.book_id)
                        msg = Message(
                            subject=f'Your Book "{book.title}" is Ready for Pickup!',
                            recipients=[user.email],
                            sender=current_app.config.get('MAIL_DEFAULT_SENDER', 'noreply@bookworm.com')
                        )
                        msg.body = f"Hello {user.full_name},\n\nGood news! A copy of '{book.title}' is now waiting for you at the front desk.\n\nPlease pick it up within 48 hours, or your reservation will expire.\n\nHappy reading!\nBookworm Library"
                        mail.send(msg)
                    except Exception as e:
                        logger.error(f"Failed to send waitlist email: {str(e)}")
                else:
                    # Free the book
                    book = Book.query.get(res.book_id)
                    if book:
                        book.available_copies += 1
                        
            db.session.commit()
            logger.info(f"Successfully processed {len(expired_holds)} expired holds.")
        except Exception as e:
            logger.error(f"Error in check_expired_holds job: {str(e)}")
            db.session.rollback()

def rotate_spotlight():
    """
    Scheduled job to rotate the spotlight book after its 24-hour window expires.
    """
    from app.extensions import scheduler
    from app.services.spotlight import rotate_spotlight_if_expired

    with scheduler.app.app_context():
        try:
            rotate_spotlight_if_expired()
            logger.info("Spotlight rotation check completed.")
        except Exception as e:
            logger.error(f"Error in rotate_spotlight job: {str(e)}")
            db.session.rollback()
