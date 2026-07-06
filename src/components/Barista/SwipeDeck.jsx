import React, { useState, useRef, useCallback } from 'react';
import { getProxiedImageUrl } from '../../utils/image';
import { api } from '../../api/client';
import styles from './SwipeDeck.module.css';

/**
 * Tinder-style swipe deck for book discovery.
 *
 * Props:
 *  - cards: array of { interaction_id, book, reasons }
 *  - onComplete: () => void — called when all cards are swiped
 */
export default function SwipeDeck({ cards = [], onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragState, setDragState] = useState({ x: 0, y: 0, dragging: false });
  const [flyOff, setFlyOff] = useState(null); // 'left' | 'right' | null
  const [imgStages, setImgStages] = useState({}); // bookId → 'proxy' | 'direct' | 'error'
  const startRef = useRef({ x: 0, y: 0 });
  const cardRef = useRef(null);

  const THRESHOLD = 100; // px to trigger swipe
  const total = cards.length;
  const remaining = total - currentIndex;

  /* ── Image fallback (same pattern as BookCard) ── */
  const getImgSrc = (book) => {
    const stage = imgStages[book.id] || 'proxy';
    if (!book.cover_image_url) return null;
    if (stage === 'proxy') return getProxiedImageUrl(book.cover_image_url);
    if (stage === 'direct') return book.cover_image_url;
    return null;
  };

  const handleImgError = (bookId, url) => {
    setImgStages(prev => {
      const current = prev[bookId] || 'proxy';
      if (current === 'proxy') return { ...prev, [bookId]: 'direct' };
      return { ...prev, [bookId]: 'error' };
    });
  };

  /* ── Swipe action ── */
  const doSwipe = useCallback(async (direction) => {
    if (currentIndex >= total) return;

    const card = cards[currentIndex];
    const reaction = direction === 'right' ? 'liked' : 'not_for_me';
    const response = direction === 'right' ? 'accepted' : 'declined';

    // Fly off animation
    setFlyOff(direction);

    // Fire API (don't block the animation)
    api.post('/barista/respond', {
      interaction_id: card.interaction_id,
      response,
      reaction,
    }).catch(err => console.error('Swipe respond failed:', err));

    // Wait for fly-off animation, then advance
    setTimeout(() => {
      setFlyOff(null);
      setDragState({ x: 0, y: 0, dragging: false });
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      if (nextIndex >= total) {
        onComplete?.();
      }
    }, 420);
  }, [currentIndex, total, cards, onComplete]);

  /* ── Pointer handlers ── */
  const onPointerDown = (e) => {
    if (flyOff) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDragState({ x: 0, y: 0, dragging: true });
  };

  const onPointerMove = (e) => {
    if (!dragState.dragging || flyOff) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    setDragState({ x: dx, y: dy, dragging: true });
  };

  const onPointerUp = () => {
    if (!dragState.dragging || flyOff) return;
    if (dragState.x > THRESHOLD) {
      doSwipe('right');
    } else if (dragState.x < -THRESHOLD) {
      doSwipe('left');
    } else {
      // Spring back
      setDragState({ x: 0, y: 0, dragging: false });
    }
  };

  /* ── No more cards ── */
  if (remaining <= 0) return null;

  /* ── Render the visible card stack (top 3) ── */
  const visibleCards = cards.slice(currentIndex, currentIndex + 3);

  // Drag feedback values for the top card
  const rotation = dragState.x * 0.08; // subtle rotation
  const likeOpacity = flyOff === 'right' ? 1 : Math.min(1, Math.max(0, dragState.x / THRESHOLD));
  const nopeOpacity = flyOff === 'left' ? 1 : Math.min(1, Math.max(0, -dragState.x / THRESHOLD));

  return (
    <div className={styles.deckContainer}>
      {/* Progress */}
      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(currentIndex / total) * 100}%` }}
          />
        </div>
        <span className={styles.progressText}>{currentIndex} / {total} swiped</span>
      </div>

      {/* Card stack */}
      <div className={styles.cardStack}>
        {visibleCards.map((item, i) => {
          const isTop = i === 0;
          const stackOffset = i * 6;
          const stackScale = 1 - i * 0.04;

          // Top card gets drag transforms & fly-off
          let cardStyle = {};
          let cardClass = styles.card;

          if (isTop) {
            if (flyOff === 'right') {
              cardClass = `${styles.card} ${styles.flyRight}`;
            } else if (flyOff === 'left') {
              cardClass = `${styles.card} ${styles.flyLeft}`;
            } else {
              cardStyle = {
                transform: `translate(${dragState.x}px, ${dragState.y * 0.3}px) rotate(${rotation}deg)`,
                transition: dragState.dragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                zIndex: 10,
              };
            }
          } else {
            cardStyle = {
              transform: `translateY(${stackOffset}px) scale(${stackScale})`,
              zIndex: 10 - i,
              pointerEvents: 'none',
            };
          }

          const book = item.book;
          const imgSrc = getImgSrc(book);
          const imgStage = imgStages[book.id] || 'proxy';

          return (
            <div
              key={item.interaction_id}
              ref={isTop ? cardRef : null}
              className={cardClass}
              style={cardStyle}
              onPointerDown={isTop ? onPointerDown : undefined}
              onPointerMove={isTop ? onPointerMove : undefined}
              onPointerUp={isTop ? onPointerUp : undefined}
            >
              {/* Like / Nope overlays */}
              {isTop && (
                <>
                  <div className={styles.overlayLike} style={{ opacity: likeOpacity }}>
                    <span>LIKE</span>
                  </div>
                  <div className={styles.overlayNope} style={{ opacity: nopeOpacity }}>
                    <span>NOPE</span>
                  </div>
                </>
              )}

              {/* Book cover */}
              <div className={styles.coverWrap}>
                {imgSrc && imgStage !== 'error' ? (
                  <img
                    src={imgSrc}
                    alt={book.title}
                    className={styles.coverImage}
                    draggable={false}
                    onError={() => handleImgError(book.id, book.cover_image_url)}
                  />
                ) : (
                  <div
                    className={styles.coverPlaceholder}
                    style={{ background: book.cover_color || '#8b6f47' }}
                  >
                    {book.title}
                  </div>
                )}
              </div>

              {/* Minimal info */}
              <div className={styles.cardInfo}>
                <h3 className={styles.cardTitle}>{book.title}</h3>
                <p className={styles.cardAuthor}>by {book.author_name || 'Unknown'}</p>
                {book.category_name && (
                  <span className={styles.genreBadge}>{book.category_name}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick action buttons */}
      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${styles.nopeBtn}`}
          onClick={() => doSwipe('left')}
          disabled={!!flyOff}
          aria-label="Nope"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <button
          className={`${styles.actionBtn} ${styles.likeBtn}`}
          onClick={() => doSwipe('right')}
          disabled={!!flyOff}
          aria-label="Like"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
