import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { BookCard } from '../../components/BookCard';
import { GrantedStamp } from '../../components/GrantedStamp';
import { getProxiedImageUrl } from '../../utils/image';
import styles from './BookDetail.module.css';

const starSvg = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isStaff } = useAuth();

  const [book, setBook] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [bookData, reviewsData, similarData] = await Promise.all([
          api.get(`/books/${id}`),
          api.get(`/books/${id}/reviews`),
          api.get(`/books/${id}/similar`),
        ]);
        setBook(bookData);
        setReviews(reviewsData.reviews || []);
        setSimilar(similarData.books || []);
      } catch {
        navigate('/app/browse');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate]);

  async function handleReserve() {
    setActionLoading(true);
    setActionMsg(null);
    try {
      await api.post('/reservations/join', { book_id: Number(id) });
      setActionMsg({ type: 'success', text: book.available_copies > 0 ? 'Book reserved successfully!' : 'You\'ve been added to the waitlist!' });
    } catch (err) {
      setActionMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (reviewRating < 1) return;
    setReviewSubmitting(true);
    try {
      await api.post(`/books/${id}/reviews`, { rating: reviewRating, comment: reviewComment });
      // Reload reviews
      const data = await api.get(`/books/${id}/reviews`);
      setReviews(data.reviews || []);
      const bookData = await api.get(`/books/${id}`);
      setBook(bookData);
      setReviewRating(0);
      setReviewComment('');
    } catch {
      // Ignore
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (loading) {
    return <div className={styles.loading}>Loading book details…</div>;
  }

  if (!book) return null;

  return (
    <div className={styles.detail}>
      <button className={styles['back-link']} onClick={() => navigate('/app/browse')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to Browse
      </button>

      <div className={styles['detail-top']}>
        {/* Cover */}
        <div style={{ position: 'relative' }} className={`${styles['cover-wrap']} ${actionMsg?.type === 'success' ? 'global-card-stamped' : ''}`}>
          {book.cover_image_url ? (
            <img
              src={getProxiedImageUrl(book.cover_image_url)}
              alt={book.title}
              className={styles['cover-img']}
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className={styles['cover-placeholder']}
            style={{
              background: book.cover_color || '#8b6f47',
              display: book.cover_image_url ? 'none' : 'flex'
            }}
          >
            {book.title}
          </div>
          {actionMsg?.type === 'success' && <GrantedStamp />}
        </div>

        {/* Info */}
        <div className={styles['detail-info']}>
          <h1>{book.title}</h1>
          <div className={styles['author-name']}>by {book.author_name || 'Unknown Author'}</div>

          <div className={styles['detail-meta']}>
            <div className={styles['meta-item']}>
              <span className={styles['meta-label']}>Category</span>
              <span className={styles['meta-value']}>{book.category_name || '—'}</span>
            </div>
            <div className={styles['meta-item']}>
              <span className={styles['meta-label']}>Rating</span>
              <span className={styles['meta-value']}>
                {book.rating > 0 ? `${Number(book.rating).toFixed(1)} / 5` : 'No ratings yet'}
              </span>
            </div>
            <div className={styles['meta-item']}>
              <span className={styles['meta-label']}>Available</span>
              <span className={styles['meta-value']}>
                {isStaff ? `${book.available_copies} of ${book.total_copies} copies` : (book.available_copies > 0 ? 'Yes' : 'No')}
              </span>
            </div>
            {book.isbn && (
              <div className={styles['meta-item']}>
                <span className={styles['meta-label']}>ISBN</span>
                <span className={styles['meta-value']}>{book.isbn}</span>
              </div>
            )}
            {book.gutenberg_id && (
              <div className={styles['meta-item']}>
                <span className={styles['meta-label']}>E-Book</span>
                <span className={styles['meta-value']} style={{ color: 'var(--color-success)' }}>Available</span>
              </div>
            )}
          </div>

          {book.description && (
            <div className={styles['detail-description']}>{book.description}</div>
          )}

          <div className={styles['detail-actions']}>
            {isAuthenticated && actionMsg?.type !== 'success' && (
              <button
                className="btn btn-secondary"
                onClick={handleReserve}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing…' : (book.available_copies > 0 ? 'Reserve Book' : 'Join Waitlist')}
              </button>
            )}
            {book.gutenberg_id && (
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/app/ebooks/${book.id}/read`)}
              >
                Read E-Book
              </button>
            )}
            {isStaff && book.available_copies > 0 && (
              <button className="btn btn-primary" onClick={() => navigate('/app/admin')}>
                Issue to Member
              </button>
            )}
          </div>

          {actionMsg && (
            <div className={`${styles['action-msg']} ${styles[actionMsg.type]}`}>
              {actionMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Reviews */}
      <div className={styles['reviews-section']}>
        <h2>Reviews ({reviews.length})</h2>

        {isAuthenticated && (
          <form className={styles['review-form']} onSubmit={handleSubmitReview}>
            <div>
              <label className="form-label">Your Rating</label>
              <div className={styles['rating-input']}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    className={`${styles['star-btn']} ${n <= reviewRating ? styles.filled : ''}`}
                    onClick={() => setReviewRating(n)}
                    aria-label={`Rate ${n} stars`}
                  >
                    {starSvg}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="review-comment" className="form-label">Comment (optional)</label>
              <textarea
                id="review-comment"
                className="input"
                rows={3}
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Share your thoughts about this book…"
                style={{ resize: 'vertical' }}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={reviewRating < 1 || reviewSubmitting}>
              {reviewSubmitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </form>
        )}

        <div className={styles['review-list']}>
          {reviews.length === 0 ? (
            <p style={{ color: 'var(--color-charcoal-light)', fontSize: 'var(--fs-sm)' }}>No reviews yet. Be the first!</p>
          ) : (
            reviews.map(r => (
              <div key={r.id} className={styles['review-item']}>
                <div className={styles['review-header']}>
                  <span className={styles['reviewer-name']}>{r.user_name}</span>
                  <span className={styles['review-date']}>{formatDate(r.created_at)}</span>
                </div>
                <div className={styles['review-stars']}>
                  {Array.from({ length: r.rating }, (_, i) => <span key={i}>{starSvg}</span>)}
                </div>
                {r.comment && <div className={styles['review-comment']}>{r.comment}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Similar Books */}
      {similar.length > 0 && (
        <div className={styles['similar-section']}>
          <h2>Similar Books</h2>
          <div className={styles['similar-grid']}>
            {similar.slice(0, 6).map(b => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
