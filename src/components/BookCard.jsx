import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { getProxiedImageUrl } from '../utils/image';
import { GrantedStamp } from './GrantedStamp';
import { LikeButton } from './LikeButton';
import styles from './BookCard.module.css';

const starIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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
  const { isAuthenticated, isStaff } = useAuth();
  // imgSrc stages: 'proxy' → 'direct' → 'error'
  const [imgStage, setImgStage] = useState('proxy');
  const status = getStatus(book);
  const [reserved, setReserved] = useState(() => Boolean(book.is_reserved || book.is_issued));
  const [reserving, setReserving] = useState(false);
  const isAlreadyReservedOrIssued = reserved || book.is_reserved || book.is_issued;

  function getImgSrc() {
    if (!book.cover_image_url) return null;
    if (imgStage === 'proxy') return getProxiedImageUrl(book.cover_image_url);
    if (imgStage === 'direct') return book.cover_image_url;
    return null;
  }

  function handleImgError() {
    if (imgStage === 'proxy') {
      setImgStage('direct'); // retry with direct URL
    } else {
      setImgStage('error'); // give up, show placeholder
    }
  }

  async function handleReserve(e) {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setReserving(true);
    try {
      await api.post('/reservations/join', { book_id: book.id });
      setReserved(true);
    } catch (err) {
      alert(err.message || 'Could not reserve book');
    } finally {
      setReserving(false);
    }
  }

  return (
    <div className={styles['book-card']} onClick={() => navigate(`/app/browse/${book.id}`)}>
      <div style={{ position: 'relative' }} className={`${styles['book-cover-wrap']} ${reserved ? 'global-card-stamped' : ''}`}>
        {book.cover_image_url && imgStage !== 'error' ? (
          <img
            src={getImgSrc()}
            alt={book.title}
            className={styles['book-cover']}
            loading="lazy"
            onError={handleImgError}
          />
        ) : (
          <div className={styles['book-cover-placeholder']} style={{ background: book.cover_color || '#8b6f47' }}>
            {book.title}
          </div>
        )}

        <span className={`${styles['book-status-badge']} ${styles[`status-${status}`]}`}>
          {getStatusLabel(book)}
        </span>

        <LikeButton book={book} onLikeToggle={onLikeToggle} />
        {isAlreadyReservedOrIssued && <GrantedStamp />}
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
        {isAuthenticated && !isStaff && (
          isAlreadyReservedOrIssued ? (
            <div
              style={{
                width: '100%',
                marginTop: '10px',
                fontSize: '0.78rem',
                borderRadius: '16px',
                padding: '7px 12px',
                background: '#1f5138',
                color: '#ffffff',
                fontWeight: 600,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                border: '1px solid #143725',
                boxShadow: '0 2px 5px rgba(31, 81, 56, 0.2)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {book.is_issued ? 'Already Issued' : 'Already Reserved'}
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              style={{ width: '100%', marginTop: '10px', fontSize: '0.75rem', borderRadius: '16px', padding: '6px' }}
              onClick={handleReserve}
              disabled={reserving}
            >
              {reserving ? 'Processing…' : (book.available_copies > 0 ? 'Reserve Book' : 'Join Waitlist')}
            </button>
          )
        )}
      </div>
    </div>
  );
}
