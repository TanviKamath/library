import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import styles from './EBookReader.module.css';

const PARAGRAPHS_PER_PAGE = 12;

function saveProgress(bookId, paragraph, total) {
  localStorage.setItem(`ebook-progress-${bookId}`, JSON.stringify({ paragraph, total, timestamp: Date.now() }));
}

function loadProgress(bookId) {
  try {
    return JSON.parse(localStorage.getItem(`ebook-progress-${bookId}`));
  } catch { return null; }
}

function detectChapters(paragraphs) {
  const detected = [];
  const chapterRegex = /^\s*(chapter|ch\.|part|section|book|capter)\b/i;
  const romanRegex = /^\s*[IVXLCDM]+\.?\s*$/i;
  
  for (let idx = 0; idx < paragraphs.length; idx++) {
    const p = paragraphs[idx].trim();
    if (p.length > 0 && p.length < 80) {
      const isChapter = chapterRegex.test(p);
      const isRoman = romanRegex.test(p);
      const isShortCaps = p.length > 3 && p === p.toUpperCase() && /^[A-Z0-9\s\-\.\,\:\;\!\?]+$/.test(p);
      
      if (isChapter || isRoman || isShortCaps) {
        if (detected.length === 0 || idx - detected[detected.length - 1].paragraphIndex > 5) {
          detected.push({
            title: p,
            paragraphIndex: idx,
            page: Math.floor(idx / PARAGRAPHS_PER_PAGE),
            wordCount: 0,
            readingTime: 0
          });
        }
      }
    }
  }

  for (let c = 0; c < detected.length; c++) {
    const start = detected[c].paragraphIndex;
    const end = (c + 1 < detected.length) ? detected[c + 1].paragraphIndex : paragraphs.length;
    let words = 0;
    for (let pIdx = start; pIdx < end; pIdx++) {
      words += paragraphs[pIdx].split(/\s+/).filter(Boolean).length;
    }
    detected[c].wordCount = words;
    detected[c].readingTime = Math.max(1, Math.round(words / 200));
  }

  if (detected.length === 0 && paragraphs.length > 0) {
    const totalPages = Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE);
    const interval = Math.max(5, Math.round(totalPages / 10));
    for (let page = 0; page < totalPages; page += interval) {
      const startIdx = page * PARAGRAPHS_PER_PAGE;
      const endIdx = Math.min((page + interval) * PARAGRAPHS_PER_PAGE, paragraphs.length);
      let words = 0;
      for (let pIdx = startIdx; pIdx < endIdx; pIdx++) {
        words += paragraphs[pIdx].split(/\s+/).filter(Boolean).length;
      }
      detected.push({
        title: `Section starting on Pg ${page + 1}`,
        paragraphIndex: startIdx,
        page: page,
        wordCount: words,
        readingTime: Math.max(1, Math.round(words / 200))
      });
    }
  }
  return detected;
}

export default function EBookReader() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bookInfo, setBookInfo] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fontSize, setFontSize] = useState(16);
  const [chapters, setChapters] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [showChaptersMenu, setShowChaptersMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [initialPage, setInitialPage] = useState(null);
  const progressStripRef = useRef(null);

  const totalPages = Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE);
  const startIdx = currentPage * PARAGRAPHS_PER_PAGE;
  const endIdx = startIdx + PARAGRAPHS_PER_PAGE;
  const currentParagraphs = paragraphs.slice(startIdx, endIdx);
  const progressPct = paragraphs.length > 0
    ? Math.round((Math.min(endIdx, paragraphs.length) / paragraphs.length) * 100)
    : 0;

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get(`/books/${id}/read`);
        setBookInfo({ title: data.title, author: data.author_name });
        const bookParagraphs = data.paragraphs || [];
        setParagraphs(bookParagraphs);
        
        // Detect chapters
        const detected = detectChapters(bookParagraphs);
        setChapters(detected);

        // Restore progress
        const saved = loadProgress(id);
        let restoredPage = 0;
        if (saved && saved.paragraph > 0) {
          restoredPage = Math.floor(saved.paragraph / PARAGRAPHS_PER_PAGE);
          restoredPage = Math.min(restoredPage, Math.ceil((data.paragraphs?.length || 1) / PARAGRAPHS_PER_PAGE) - 1);
        }
        setCurrentPage(restoredPage);
        setInitialPage(restoredPage);
      } catch (err) {
        setError(err.message || 'Failed to load e-book content.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // Click away listener for chapters TOC menu
  useEffect(() => {
    if (!showChaptersMenu) return;
    const handleClose = () => setShowChaptersMenu(false);
    document.addEventListener('click', handleClose);
    return () => document.removeEventListener('click', handleClose);
  }, [showChaptersMenu]);

  // Find current chapter
  const currentChapter = chapters.reduce((active, ch) => {
    if (ch.page <= currentPage) {
      return ch;
    }
    return active;
  }, null);

  const updateProgressFromEvent = useCallback((clientX) => {
    if (totalPages === 0 || !progressStripRef.current) return;
    const rect = progressStripRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(x / rect.width, 1));
    const targetPage = Math.max(0, Math.min(Math.floor(pct * totalPages), totalPages - 1));
    setCurrentPage(targetPage);
  }, [totalPages]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    updateProgressFromEvent(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (totalPages === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(x / rect.width, 1));
    const hoveredPage = Math.max(0, Math.min(Math.floor(pct * totalPages), totalPages - 1));
    
    const hoverChapter = chapters.reduce((active, ch) => {
      if (ch.page <= hoveredPage) {
        return ch;
      }
      return active;
    }, null);

    setHoverInfo({
      x,
      page: hoveredPage,
      chapterTitle: hoverChapter ? hoverChapter.title : 'Beginning',
      readingTime: hoverChapter ? hoverChapter.readingTime : 0
    });

    if (isDragging) {
      updateProgressFromEvent(e.clientX);
    }
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMoveWindow = (e) => {
      updateProgressFromEvent(e.clientX);
    };

    const handleMouseUpWindow = () => {
      setIsDragging(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('mousemove', handleMouseMoveWindow);
    window.addEventListener('mouseup', handleMouseUpWindow);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveWindow);
      window.removeEventListener('mouseup', handleMouseUpWindow);
    };
  }, [isDragging, updateProgressFromEvent]);

  // Save progress on page change
  useEffect(() => {
    if (paragraphs.length > 0) {
      saveProgress(id, endIdx, paragraphs.length);
    }
  }, [currentPage, id, endIdx, paragraphs.length]);

  const goNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(p => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, totalPages]);

  const goPrev = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(p => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev]);

  const handleWordClick = (e) => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return; // Skip if user is selecting/highlighting text
    }
    if (!selection) return;

    const range = document.caretRangeFromPoint
      ? document.caretRangeFromPoint(e.clientX, e.clientY)
      : null;

    if (!range) return;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;

    const text = node.textContent;
    let start = range.startOffset;
    let end = range.endOffset;

    // Expand to word boundaries
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }

    const word = text.slice(start, end).replace(/[^a-zA-Z]/g, '').trim();
    if (word && word.length > 1) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(word + ' meaning')}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles['loading-text']}>Fetching pages…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <h3>Unable to load e-book</h3>
        <p>{error}</p>
        <button className="btn btn-secondary" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/app/ebooks')}>
          Back to E-Books
        </button>
      </div>
    );
  }

  return (
    <div className={styles.reader}>
      {/* Header */}
      <div className={styles['reader-header']}>
        <button className={styles['reader-back']} onClick={() => navigate('/app/ebooks')}>
          ← Back
        </button>
        <div className={styles['reader-title']}>{bookInfo?.title}</div>
        
        <div className={styles['reader-actions']}>
          {/* Table of Contents Dropdown */}
          {chapters.length > 0 && (
            <div className={styles['toc-container']}>
              <button 
                className={styles['toc-btn']} 
                onClick={(e) => { e.stopPropagation(); setShowChaptersMenu(prev => !prev); }}
                aria-label="Table of Contents"
              >
                📖 Chapters
              </button>
              {showChaptersMenu && (
                <div className={styles['toc-menu']} onClick={(e) => e.stopPropagation()}>
                  <div className={styles['toc-header']}>Table of Contents</div>
                  <div className={styles['toc-list']}>
                    {chapters.map((ch, idx) => (
                      <button
                        key={idx}
                        className={`${styles['toc-item']} ${ch.page === currentPage ? styles['active-toc-item'] : ''}`}
                        onClick={() => {
                          setCurrentPage(ch.page);
                          setShowChaptersMenu(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <span className={styles['toc-item-title']}>{ch.title}</span>
                        <span className={styles['toc-item-meta']}>Pg {ch.page + 1} ({ch.readingTime}m)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className={styles['font-controls']}>
            <button
              className={styles['font-btn']}
              onClick={() => setFontSize(s => Math.max(13, s - 1))}
              aria-label="Decrease font size"
            >
              A−
            </button>
            <button
              className={styles['font-btn']}
              onClick={() => setFontSize(s => Math.min(22, s + 1))}
              aria-label="Increase font size"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      {bookInfo?.author && (
        <div className={styles['reader-author']} style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
          by {bookInfo.author}
        </div>
      )}

      {/* Progress */}
      <div 
        ref={progressStripRef}
        className={styles['progress-strip']}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        <div 
          className={styles['progress-fill']} 
          style={{ 
            width: `${progressPct}%`,
            transition: isDragging ? 'none' : undefined 
          }} 
        />
        
        {/* Progress Thumb / Roller (circular navigation dot) */}
        <div 
          className={styles['progress-thumb']} 
          style={{ 
            left: `${progressPct}%`,
            transition: isDragging ? 'none' : undefined 
          }} 
        />

        {/* Bookmark Marker (Where the user started reading this session) */}
        {initialPage !== null && (
          <div
            className={styles['bookmark-marker']}
            style={{ left: `${(initialPage / totalPages) * 100}%` }}
            title="Where you started reading today (Click to return)"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage(initialPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* Chapter Ticks */}
        {chapters.map((ch, idx) => (
          <div
            key={idx}
            className={styles['chapter-tick']}
            style={{ left: `${(ch.page / totalPages) * 100}%` }}
          />
        ))}

        {/* Hover Tooltip */}
        {hoverInfo && (
          <div 
            className={styles['progress-tooltip']}
            style={{ left: `${hoverInfo.x}px` }}
          >
            <span className={styles['tooltip-chapter']}>{hoverInfo.chapterTitle}</span>
            <span className={styles['tooltip-meta']}>
              Page {hoverInfo.page + 1} of {totalPages} {hoverInfo.readingTime > 0 && `· ~${hoverInfo.readingTime} min read`}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles['reader-content']} style={{ fontSize: `${fontSize}px` }}>
        {currentParagraphs.map((p, i) => (
          <p
            key={startIdx + i}
            onClick={handleWordClick}
            style={{ cursor: 'pointer' }}
          >
            {p}
          </p>
        ))}
      </div>

      {/* Controls */}
      <div className={styles['reader-controls']}>
        <button className={styles['page-btn']} onClick={goPrev} disabled={currentPage === 0}>
          ← Previous
        </button>
        <div className={styles['page-info']}>
          <div>Page {currentPage + 1} of {totalPages} · {progressPct}%</div>
          {currentChapter && (
            <div className={styles['footer-chapter-info']} title={currentChapter.title}>
              Active: {currentChapter.title} · ~{currentChapter.readingTime} min read
            </div>
          )}
          {initialPage !== null && currentPage !== initialPage && (
            <button 
              className={styles['return-start-btn']}
              onClick={() => {
                setCurrentPage(initialPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              📍 Return to Start (Pg {initialPage + 1})
            </button>
          )}
        </div>
        <button className={styles['page-btn']} onClick={goNext} disabled={currentPage >= totalPages - 1}>
          Next →
        </button>
      </div>
    </div>
  );
}
