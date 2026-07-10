import React, { useState, useCallback } from 'react';
import { getProxiedImageUrl } from '../../utils/image';
import { api } from '../../api/client';
import styles from './SpinWheel.module.css';

/**
 * Animated spin-the-wheel for book discovery.
 *
 * Props:
 *  - segments: array of book objects (6 items)
 *  - winningIndex: int 0-5, the server-chosen winner
 *  - interactionId: int, the log ID for the winning book
 *  - voiceLine: string, Finn's voice line
 *  - onComplete: () => void — called when the user finishes
 *  - onAccept: (book) => void — called when user accepts the winning book
 *  - onSpinAgain: () => void — called when user wants a fresh wheel to spin again
 */
export default function SpinWheel({
  segments = [],
  winningIndex = 0,
  interactionId,
  voiceLine,
  onComplete,
  onAccept,
  onSpinAgain,
}) {
  const [spinning, setSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [imgStages, setImgStages] = useState({});

  const count = segments.length || 6;
  const segmentAngle = 360 / count;

  const handleImgError = (bookId) => {
    setImgStages(prev => {
      const current = prev[bookId] || 'proxy';
      if (current === 'proxy') return { ...prev, [bookId]: 'direct' };
      return { ...prev, [bookId]: 'error' };
    });
  };

  const getImgSrc = (book) => {
    const stage = imgStages[book.id] || 'proxy';
    if (!book.cover_image_url) return null;
    if (stage === 'proxy') return getProxiedImageUrl(book.cover_image_url);
    if (stage === 'direct') return book.cover_image_url;
    return null;
  };

  /* ── Spin logic ── */
  const doSpin = useCallback(() => {
    if (spinning || hasSpun) return;
    setSpinning(true);

    // The pointer starts pointing up (0°) and rotates clockwise to land ON the
    // winning segment. Segment i is centered at i*segmentAngle + segmentAngle/2
    // (clockwise from the top), so rotating the pointer by that angle aims it at
    // the winning book's spine.
    const winningCenter = winningIndex * segmentAngle + segmentAngle / 2;
    const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
    const target = fullSpins * 360 + winningCenter;

    setRotation(target);

    // After spin animation completes (4s), show result
    setTimeout(() => {
      setSpinning(false);
      setHasSpun(true);
      setShowResult(true);
    }, 4200);
  }, [spinning, hasSpun, winningIndex, segmentAngle]);

  /* ── Respond to winning book ──
   * accepted:  user takes the winning book.
   * declined:  soft dislike. If a re-spin handler is provided, fetch a fresh
   *            wheel so the user can spin again; otherwise just finish. */
  const handleRespond = async (accepted) => {
    try {
      await api.post('/barista/respond', {
        interaction_id: interactionId,
        response: accepted ? 'accepted' : 'declined',
        reaction: accepted ? 'liked' : 'not_for_me',
      });
    } catch (err) {
      console.error('Spin respond failed:', err);
    }
    if (accepted && segments[winningIndex]) {
      onAccept?.(segments[winningIndex]);
    } else if (onSpinAgain) {
      onSpinAgain();
    } else {
      onComplete?.();
    }
  };

  const winningBook = segments[winningIndex] || segments[0] || {
    id: 'fallback',
    title: 'A Handpicked Read',
    author_name: 'Featured Author',
    cover_color: '#8B5A2B',
    category_name: 'Recommended'
  };

  return (
    <div className={styles.wheelContainer}>
      {/* The wheel — collapses out of the way once the result is revealed */}
      <div className={`${styles.wheelStage} ${showResult ? styles.wheelStageCollapsed : ''}`}>
        <div
          className={styles.imageWheel}
          onClick={doSpin}
          role="button"
          tabIndex={0}
          title="Click to Spin!"
        >
          {/* Ornate wheel artwork (static — the pointer spins over it) */}
          <img
            src="/spin_wheel.png"
            alt="Spin the wheel"
            className={styles.wheelImg}
            draggable={false}
          />

          {/* Square overlay aligned to the drawn circle — holds the book
             titles and the spinning pointer. Tune --wc-* on .imageWheel if
             the artwork's circle sits differently. */}
          <div className={styles.wheelCircle}>
            {/* Book titles on horizontal plaques, one over each colored spine */}
            {segments.map((book, i) => {
              const angle = i * segmentAngle + segmentAngle / 2; // spine centre, clockwise from top
              const rad = (angle * Math.PI) / 180;
              const R = 34; // % radius to the plaque
              const x = 50 + R * Math.sin(rad);
              const y = 50 - R * Math.cos(rad);
              const isWinner = hasSpun && i === winningIndex;
              const title = book.title?.length > 15 ? book.title.slice(0, 14) + '…' : book.title;

              return (
                <div
                  key={book.id}
                  className={`${styles.wheelLabel} ${isWinner ? styles.wheelLabelWinner : ''}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <span className={styles.wheelLabelTitle}>{title}</span>
                  {book.author_name && (
                    <span className={styles.wheelLabelAuthor}>
                      {book.author_name.length > 18 ? book.author_name.slice(0, 17) + '…' : book.author_name}
                    </span>
                  )}
                </div>
              );
            })}

            {/* Spinning pointer — rotates to land on the winning spine */}
            <div
              className={styles.spinner}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                  : 'none',
              }}
            >
              <svg className={styles.hand} viewBox="0 0 40 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20 3 L35 55 L24 55 L24 197 L16 197 L16 55 L5 55 Z"
                  fill="#1A1208"
                  stroke="#F4E3C1"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* The hub itself is the button — glows/breathes to invite a click */}
            {!hasSpun && (
              <button
                type="button"
                className={styles.hubButton}
                onClick={(e) => { e.stopPropagation(); doSpin(); }}
                disabled={spinning}
                aria-label="Spin the wheel"
              >
                <span className={styles.hubText}>{spinning ? '•••' : 'SPIN'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Result (the wheel hub is the spin button now) */}
      {hasSpun && showResult ? (
        <div className={styles.resultArea}>
          <div className={styles.resultCard}>
            <span className={styles.resultRibbon}>Winner!</span>
            <div className={styles.resultCoverWrap}>
              {getImgSrc(winningBook) && (imgStages[winningBook.id] || 'proxy') !== 'error' ? (
                <img
                  src={getImgSrc(winningBook)}
                  alt={winningBook.title}
                  className={styles.resultCover}
                  onError={() => handleImgError(winningBook.id)}
                />
              ) : (
                <div
                  className={styles.resultCoverPlaceholder}
                  style={{ background: winningBook.cover_color || '#8b6f47' }}
                >
                  {winningBook.title}
                </div>
              )}
            </div>
            <div className={styles.resultInfo}>
              <h3 className={styles.resultTitle}>{winningBook.title}</h3>
              <p className={styles.resultAuthor}>by {winningBook.author_name || 'Unknown'}</p>
              {winningBook.category_name && (
                <span className={styles.resultGenre}>{winningBook.category_name}</span>
              )}
            </div>
          </div>

          <div className={styles.resultActions}>
            <button
              className={`${styles.resultBtn} ${styles.resultAccept}`}
              onClick={() => handleRespond(true)}
            >
              I'll take it!
            </button>
            <button
              className={`${styles.resultBtn} ${styles.resultDecline}`}
              onClick={() => handleRespond(false)}
            >
              🎰  Spin again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
