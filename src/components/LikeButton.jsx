import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import styles from './LikeButton.module.css';

const heartPath = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';

/**
 * Animated like/heart button with an Instagram-style response:
 *  - the heart itself "pops" (bounce scale) on every tap,
 *  - a big heart bursts over the cover when a book is newly liked.
 *
 * Self-contained: it renders (and hides) itself based on auth, performs the
 * like/unlike API call, then notifies the parent via `onLikeToggle(id, liked)`
 * so the parent can update its own list/state.
 *
 * Render this inside a `position: relative` container (the cover wrapper) so the
 * burst heart centres over the artwork.
 */
export function LikeButton({ book, onLikeToggle }) {
  const { isAuthenticated, isAdmin } = useAuth();
  const [pop, setPop] = useState(false);
  const [burst, setBurst] = useState(false);
  const busyRef = useRef(false);

  // Likes are a member feature — hide for guests and admins.
  if (!isAuthenticated || isAdmin) return null;

  async function handleLike(e) {
    e.stopPropagation();
    if (busyRef.current) return;
    const willLike = !book.is_liked;

    // Fire the animations immediately so the feedback feels instant.
    setPop(true);
    if (willLike) setBurst(true);

    busyRef.current = true;
    try {
      if (willLike) {
        await api.post(`/books/${book.id}/like`);
      } else {
        await api.delete(`/books/${book.id}/like`);
      }
      onLikeToggle?.(book.id, willLike);
    } catch {
      // Ignore — leave UI as-is on failure.
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <>
      <button
        className={`${styles['like-btn']} ${book.is_liked ? styles.liked : ''} ${pop ? styles.pop : ''}`}
        onClick={handleLike}
        onAnimationEnd={() => setPop(false)}
        aria-label={book.is_liked ? 'Unlike book' : 'Like book'}
      >
        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d={heartPath} />
        </svg>
      </button>
      {burst && (
        <span
          className={styles.burst}
          aria-hidden="true"
          onAnimationEnd={() => setBurst(false)}
        >
          <svg viewBox="0 0 24 24">
            <path d={heartPath} />
          </svg>
        </span>
      )}
    </>
  );
}
