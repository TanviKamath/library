import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Home.module.css';

// Total frames and sampling: use every 2nd frame for performance (~59 images instead of 118)
const TOTAL_FRAMES = 118;
const FRAME_STEP = 2;
const SAMPLED_COUNT = Math.ceil(TOTAL_FRAMES / FRAME_STEP);

function getFramePath(index) {
  // Frames are 1-indexed: ezgif-frame-001.webp to ezgif-frame-118.webp
  const frameNum = index * FRAME_STEP + 1;
  const clamped = Math.min(frameNum, TOTAL_FRAMES);
  return `/frames_webp/ezgif-frame-${String(clamped).padStart(3, '0')}.webp`;
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Preload sampled frames
    let loadedCount = 0;
    const images = [];

    for (let i = 0; i < SAMPLED_COUNT; i++) {
      const img = new Image();
      img.src = getFramePath(i);
      img.onload = () => {
        loadedCount++;
        if (loadedCount >= Math.min(5, SAMPLED_COUNT)) {
          // Show first frame early
          if (!loaded) {
            setLoaded(true);
            drawFrame(0);
          }
        }
      };
      images.push(img);
    }
    imagesRef.current = images;

    function drawFrame(index) {
      const img = images[index];
      if (!img || !img.complete) return;

      canvas.width = canvas.offsetWidth * (window.devicePixelRatio > 1 ? 2 : 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio > 1 ? 2 : 1);

      // Draw cover
      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width - img.width * scale) / 2;
      const y = (canvas.height - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
    }

    // ── Auto-play the animation once on load, so users see it without
    // scrolling. It advances frames over AUTOPLAY_MS, then hands control to
    // scroll. Any real scroll interrupts it immediately so we never fight the
    // user. Respects reduced-motion preferences.
    const AUTOPLAY_MS = 5000;
    const prefersReducedMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId = null;
    let autoStart = null;
    let autoPlaying = !prefersReducedMotion;

    function stopAutoplay() {
      autoPlaying = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function autoStep(ts) {
      if (!autoPlaying) return;
      if (autoStart == null) autoStart = ts;
      const progress = Math.min(1, (ts - autoStart) / AUTOPLAY_MS);
      const frameIndex = Math.min(Math.floor(progress * (SAMPLED_COUNT - 1)), SAMPLED_COUNT - 1);
      drawFrame(frameIndex);
      if (progress < 1) {
        rafId = requestAnimationFrame(autoStep);
      } else {
        autoPlaying = false;
      }
    }

    function onScroll() {
      const hero = document.getElementById('hero-section');
      if (!hero) return;

      const rect = hero.getBoundingClientRect();
      const scrolled = -rect.top;

      // A genuine scroll interrupts the intro auto-play and takes over.
      if (scrolled > 0) stopAutoplay();
      if (autoPlaying) return;

      const total = hero.offsetHeight - window.innerHeight;
      const progress = Math.max(0, Math.min(1, scrolled / total));
      const frameIndex = Math.min(Math.floor(progress * (SAMPLED_COUNT - 1)), SAMPLED_COUNT - 1);

      drawFrame(frameIndex);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // Kick off the intro once the first frames are ready.
    if (loaded && autoPlaying) {
      rafId = requestAnimationFrame(autoStep);
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      stopAutoplay();
      // Cleanup images
      imagesRef.current = [];
    };
  }, [loaded]);

  return (
    <div className={styles.home}>
      <section className={styles.hero} id="hero-section">
        <div className={styles['hero-canvas-wrap']}>
          {!loaded && (
            <div className={styles['hero-loading']}>
              <span>Preparing your experience…</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className={styles['hero-canvas']}
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.6s' }}
          />
          <div className={styles['hero-overlay']}>
            <div className={styles['hero-content']}>
              <div className={styles['hero-accent']} />
              <h1 className={styles['hero-title']}>
                Brew & Borrow
              </h1>
              <p className={styles['hero-subtitle']}>
                Where pages meet pour overs, and every shelf tells a story.
                Step into our café library, a sanctuary for the curious,
                the contemplative, and the caffeinated.
              </p>
              <div className={styles['hero-cta']}>
                {isAuthenticated ? (
                  <>
                    <Link to="/app/dashboard" className={styles['hero-btn-primary']} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      Dashboard
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </Link>
                    <Link to="/gallery" className={styles['hero-btn-secondary']}>
                      Enter the Sphere Library
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className={styles['hero-btn-primary']}>
                      Sign In / Sign Up
                    </Link>
                    <Link to="/gallery" className={styles['hero-btn-secondary']}>
                      Enter the Sphere Library
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
