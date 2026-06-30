import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { getProxiedImageUrl } from '../utils/image';
import styles from './BookCard.module.css';

const starIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const heartOutline = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

function getStatus(book) {
  if (book.available_copies > 0) return 'available';
  return 'unavailable';
}

function getStatusLabel(book) {
  if (book.available_copies > 0) return 'Available';
  return 'Checked Out';
}

export function BookCard({ book, onLikeToggle }) {
  const navigate = useNavigate();
  const { isAuthenticated, isStaff, isAdmin } = useAuth();
  const [imgError, setImgError] = useState(false);
  const status = getStatus(book);
  const showLikeButton = isAuthenticated && !isAdmin;

  async function handleLike(e) {
    e.stopPropagation();
    if (!isAuthenticated) return;
    try {
      if (book.is_liked) {
        await api.delete(`/books/${book.id}/like`);
      } else {
        await api.post(`/books/${book.id}/like`);
      }
      onLikeToggle?.(book.id, !book.is_liked);
    } catch {
      // Ignore
    }
  }

  return (
    <div className={styles['book-card']} onClick={() => navigate(`/app/browse/${book.id}`)}>
      <div className={styles['book-cover-wrap']}>
        {book.cover_image_url && !imgError ? (
          <img
            src={getProxiedImageUrl(book.cover_image_url)}
            alt={book.title}
            className={styles['book-cover']}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles['book-cover-placeholder']} style={{ background: book.cover_color || '#8b6f47' }}>
            {book.title}
          </div>
        )}

        <span className={`${styles['book-status-badge']} ${styles[`status-${status}`]}`}>
          {getStatusLabel(book)}
        </span>

        {showLikeButton && (
          <button
            className={`${styles['book-like-btn']} ${book.is_liked ? styles.liked : ''}`}
            onClick={handleLike}
            aria-label={book.is_liked ? 'Unlike book' : 'Like book'}
          >
            {heartOutline}
          </button>
        )}
      </div>

      <div className={styles['book-info']}>
        <div className={styles['book-title']}>{book.title}</div>
        <div className={styles['book-author']}>{book.author_name || 'Unknown Author'}</div>
        <div className={styles['book-meta']}>
          {book.rating > 0 && (
            <span className={styles['book-rating']}>
              {starIcon}
              {Number(book.rating).toFixed(1)}
            </span>
          )}
          {isStaff && (
            <span className={styles['book-copies']}>
              {book.available_copies}/{book.total_copies} copies
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
