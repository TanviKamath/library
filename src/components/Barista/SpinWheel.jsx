import React, { useState, useCallback } from 'react';
import { getProxiedImageUrl } from '../../utils/image';
import { api } from '../../api/client';
import styles from './SpinWheel.module.css';

/* Vibrant rainbow segment palette inspired by modern spin wheels */
const SEGMENT_COLORS = [
  '#FF4B4B', // Vibrant Red
  '#FF8F00', // Amber / Orange
  '#FFD600', // Bright Yellow
  '#00E676', // Vibrant Green
  '#00B0FF', // Sky Blue / Cyan
  '#651FFF', // Deep Purple / Violet
  '#FF1744', // Rose / Pink
  '#00E5FF', // Cyan
  '#76FF03', // Lime
  '#D500F9', // Magenta
  '#FF6D00', // Orange
  '#2979FF', // Royal Blue
];

const LIGHT_COUNT = 16;
const LIGHTS = Array.from({ length: LIGHT_COUNT });

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
 */
export default function SpinWheel({
  segments = [],
  winningIndex = 0,
  interactionId,
  voiceLine,
  onComplete,
  onAccept,
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

    // Calculate target: land on the winning segment.
    // The pointer is at top (0°). Segment i occupies from i*segmentAngle to (i+1)*segmentAngle.
    // We want the center of the winning segment to be at the top.
    const winningCenter = winningIndex * segmentAngle + segmentAngle / 2;
    // We spin clockwise, so we need (360 - winningCenter) to bring it to top, plus full spins.
    const fullSpins = 5 + Math.floor(Math.random() * 3); // 5-7 full rotations
    const target = fullSpins * 360 + (360 - winningCenter);

    setRotation(target);

    // After spin animation completes (4s), show result
    setTimeout(() => {
      setSpinning(false);
      setHasSpun(true);
      setShowResult(true);
    }, 4200);
  }, [spinning, hasSpun, winningIndex, segmentAngle]);

  /* ── Respond to winning book ── */
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
        <div className={styles.wheelFrame}>
          {/* Center Hub with upward pointer ("Spin" badge) — fixed, does not rotate with wheel */}
          <div
            className={`${styles.centerHub} ${spinning ? styles.centerHubSpinning : ''}`}
            onClick={doSpin}
            role="button"
            tabIndex={0}
            title="Click to Spin!"
          >
            <svg className={styles.hubSvg} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M50 6 L68 34 A 36 36 0 1 1 32 34 Z"
                fill="#1A1A1A"
                stroke="#FFFFFF"
                strokeWidth="7"
                strokeLinejoin="round"
              />
            </svg>
            <span className={styles.hubText}>{spinning ? '...' : 'Spin'}</span>
          </div>

          <div
            className={styles.wheel}
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
                : 'none',
            }}
          >
            {/* Colored pie using conic-gradient — rendered first so segment
               dividers and labels paint on top of it, not underneath */}
            <div
              className={styles.wheelPie}
              style={{
                background: `conic-gradient(${segments
                  .map((_, i) => {
                    const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
                    const start = (i / count) * 100;
                    const end = ((i + 1) / count) * 100;
                    return `${color} ${start}% ${end}%`;
                  })
                  .join(', ')})`,
              }}
            />

            {/* Inner translucent rim overlay */}
            <div className={styles.wheelRimOverlay} />

            {/* Segments */}
            {segments.map((book, i) => {
              const startAngle = i * segmentAngle;
              const isWinner = hasSpun && i === winningIndex;

              return (
                <div
                  key={book.id}
                  className={`${styles.segment} ${isWinner ? styles.winnerSegment : ''}`}
                  style={{
                    '--segment-color': SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                    '--start-angle': `${startAngle}deg`,
                    '--segment-angle': `${segmentAngle}deg`,
                    '--label-angle': `${startAngle + segmentAngle / 2}deg`,
                  }}
                >
                  {/* Label rotated to center of segment */}
                  <div className={styles.segmentLabel}>
                    <span className={styles.segmentTitle}>
                      {book.title?.length > 20 ? book.title.slice(0, 18) + '…' : book.title}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Glass gloss overlay — stays fixed while the wheel spins beneath it */}
          <div className={styles.wheelGloss} />
        </div>
      </div>

      {/* Spin button or result */}
      {!hasSpun ? (
        <button
          className={styles.spinButton}
          onClick={doSpin}
          disabled={spinning}
        >
          {spinning ? (
            <>
              <span className={styles.spinnerDot} />
              Spinning...
            </>
          ) : (
            '🎰  Spin the Wheel!'
          )}
        </button>
      ) : showResult ? (
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
              Spin again next time
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
