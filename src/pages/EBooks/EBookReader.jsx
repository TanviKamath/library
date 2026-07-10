import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import styles from './EBookReader.module.css';

const PARAGRAPHS_PER_PAGE = 4;

function saveProgress(bookId, paragraph, total) {
  localStorage.setItem(`ebook-progress-${bookId}`, JSON.stringify({ paragraph, total, timestamp: Date.now() }));
}

function loadProgress(bookId) {
  try {
    return JSON.parse(localStorage.getItem(`ebook-progress-${bookId}`));
  } catch { return null; }
}

const FONT_SIZES = [13, 15, 17, 19, 21, 23];
const DEFAULT_FONT_SIZE = 23;
const FONT_PREF_KEY = 'ebook-font-size';

function saveFontPref(size) {
  localStorage.setItem(FONT_PREF_KEY, String(size));
}

function loadFontPref() {
  const raw = localStorage.getItem(FONT_PREF_KEY);
  const parsed = parseInt(raw, 10);
  return FONT_SIZES.includes(parsed) ? parsed : DEFAULT_FONT_SIZE;
}

function paginateIntoPages(paragraphs, containerWidth, containerHeight, fontSize, chapterParagraphIndexes = new Set()) {
  if (!paragraphs || paragraphs.length === 0) return [];
  const width = Math.max(280, containerWidth || (window.innerWidth - 180));
  const height = Math.max(400, containerHeight || (window.innerHeight - 200));

  const measureEl = document.createElement('div');
  measureEl.style.position = 'absolute';
  measureEl.style.left = '-9999px';
  measureEl.style.top = '-9999px';
  measureEl.style.width = `${width}px`;
  measureEl.style.fontSize = `${fontSize}px`;
  measureEl.style.lineHeight = '1.85';
  measureEl.style.fontFamily = 'var(--font-sans, sans-serif)';
  measureEl.style.padding = '0';
  measureEl.style.visibility = 'hidden';
  document.body.appendChild(measureEl);

  const maxHeight = Math.max(200, height);
  const pages = [];
  let currentPage = [];

  const checkFits = (items) => {
    measureEl.innerHTML = items
      .map(it => {
        const indent = it.isContinuation ? '0' : '1.5em';
        return `<p style="margin: 0 0 24px 0; text-indent: ${indent}; text-align: justify; hyphens: auto;">${it.text}</p>`;
      })
      .join('');
    return measureEl.scrollHeight <= maxHeight;
  };

  const findMaxWordsThatFit = (curPage, words, idx, isContinuation) => {
    let low = 1;
    let high = words.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const testText = words.slice(0, mid).join(' ');
      const testItem = { text: testText, originalIndex: idx, isContinuation };
      if (checkFits([...curPage, testItem])) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  };

  for (let idx = 0; idx < paragraphs.length; idx++) {
    const p = paragraphs[idx].trim();
    if (!p) continue;

    // Force a new page when a chapter heading is encountered
    if (chapterParagraphIndexes.has(idx) && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
    }

    const fullItem = { text: p, originalIndex: idx, isContinuation: false };

    if (checkFits([...currentPage, fullItem])) {
      currentPage.push(fullItem);
    } else {
      let words = p.split(/\s+/);
      let isContinuation = false;

      while (words.length > 0) {
        const fitCount = findMaxWordsThatFit(currentPage, words, idx, isContinuation);

        if (fitCount > 0) {
          const chunkText = words.slice(0, fitCount).join(' ');
          currentPage.push({
            text: chunkText,
            originalIndex: idx,
            isContinuation
          });
          words = words.slice(fitCount);
          isContinuation = true;
        }

        if (words.length > 0) {
          if (currentPage.length > 0) {
            pages.push(currentPage);
            currentPage = [];
          } else {
            // Even 1 word doesn't fit on an empty page (e.g., giant URL or tiny height)
            currentPage.push({
              text: words[0],
              originalIndex: idx,
              isContinuation
            });
            words = words.slice(1);
            isContinuation = true;
            pages.push(currentPage);
            currentPage = [];
          }
        }
      }
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  document.body.removeChild(measureEl);
  return pages;
}

function detectChapters(paragraphs) {
  const detected = [];
  
  // Enhanced regex patterns for chapter detection
  const chapterPatterns = [
    /^\s*(chapter|chapitre|kapitel|capitulo|ch\.|chap\.)[\s\.\-_]*(\d+|[IVXLCDM]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)/i,
    /^\s*(part|partie|teil|parte|book|livre|buch|libro)[\s\.\-_]*(\d+|[IVXLCDM]+|one|two|three|four|five)/i,
    /^\s*[IVXLCDM]+\.?\s*$/i, // Roman numerals alone
    /^\s*\d+\.?\s*$/, // Just numbers (1., 2., etc.)
    /^\s*prologue\s*$/i,
    /^\s*epilogue\s*$/i,
    /^\s*introduction\s*$/i,
    /^\s*preface\s*$/i,
    /^\s*foreword\s*$/i,
    /^\s*afterword\s*$/i,
  ];
  
  for (let idx = 0; idx < paragraphs.length; idx++) {
    const p = paragraphs[idx].trim();
    
    // Skip empty or very long paragraphs
    if (p.length === 0 || p.length > 120) continue;
    
    let isChapterHeading = false;
    
    // Check against all chapter patterns
    for (const pattern of chapterPatterns) {
      if (pattern.test(p)) {
        isChapterHeading = true;
        break;
      }
    }
    
    // Also detect short ALL CAPS text that could be chapter titles
    if (!isChapterHeading && p.length >= 3 && p.length <= 80) {
      const isAllCaps = p === p.toUpperCase() && /^[A-Z0-9\s\-\.\,\:\;\!\?\'\"\(\)]+$/.test(p);
      const hasLetters = /[A-Z]/.test(p);
      if (isAllCaps && hasLetters) {
        isChapterHeading = true;
      }
    }
    
    // Add chapter if detected and not too close to previous chapter
    if (isChapterHeading) {
      if (detected.length === 0 || idx - detected[detected.length - 1].paragraphIndex > 3) {
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

  // Calculate word count and reading time for each chapter
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

  // Fallback: if no chapters detected, create sections based on content
  if (detected.length === 0 && paragraphs.length > 0) {
    const totalPages = Math.ceil(paragraphs.length / PARAGRAPHS_PER_PAGE);
    const interval = Math.max(5, Math.round(totalPages / 10));
    let sectionNum = 1;
    for (let page = 0; page < totalPages; page += interval) {
      const startIdx = page * PARAGRAPHS_PER_PAGE;
      const endIdx = Math.min((page + interval) * PARAGRAPHS_PER_PAGE, paragraphs.length);
      let words = 0;
      for (let pIdx = startIdx; pIdx < endIdx; pIdx++) {
        words += paragraphs[pIdx].split(/\s+/).filter(Boolean).length;
      }
      
      // Create more descriptive section titles
      let sectionTitle = `Section ${sectionNum}`;
      
      // Try to get a preview from the first paragraph of this section
      if (paragraphs[startIdx]) {
        const preview = paragraphs[startIdx].trim().slice(0, 50);
        if (preview.length > 0) {
          sectionTitle = `Section ${sectionNum}: ${preview}${preview.length >= 50 ? '...' : ''}`;
        }
      }
      
      detected.push({
        title: sectionTitle,
        paragraphIndex: startIdx,
        page: page,
        wordCount: words,
        readingTime: Math.max(1, Math.round(words / 200))
      });
      sectionNum++;
    }
  }
  return detected;
}

function highlightText(text, query) {
  if (!query || !query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: '#fde68a', color: '#92400e', borderRadius: '2px', padding: '0 1px' }}>{part}</mark>
      : part
  );
}

export default function EBookReader() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bookInfo, setBookInfo] = useState(null);
  const [paragraphs, setParagraphs] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fontSize, setFontSize] = useState(loadFontPref);
  const [chapters, setChapters] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [showChaptersMenu, setShowChaptersMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // ── Search state ────────────────────────────────────────────────────────────
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]); // [{paragraphIndex, pageIndex}]
  const [searchCursor, setSearchCursor] = useState(0);   // current match index
  const searchInputRef = useRef(null);

  const savedParagraphIndexRef = useRef(null);
  const restoredOnceRef = useRef(false);
  const [bookmarkPage, setBookmarkPage] = useState(null);
  const progressStripRef = useRef(null);
  const contentAreaRef = useRef(null);
  const anchorParagraphRef = useRef(null);
  const chaptersRef = useRef([]);
  const [pages, setPages] = useState([]);

  // Keep chaptersRef current whenever chapters state updates
  useEffect(() => {
    chaptersRef.current = chapters;
  }, [chapters]);

  // Persist font size preference
  useEffect(() => {
    saveFontPref(fontSize);
  }, [fontSize]);

  // ── Pagination ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!paragraphs || paragraphs.length === 0) return;

    const updatePages = () => {
      const height = contentAreaRef.current?.clientHeight || (window.innerHeight - 200);
      const width = contentAreaRef.current
        ? contentAreaRef.current.clientWidth - 80
        : Math.min(window.innerWidth - 160, 820) - 80;

      // Read chapters from ref — always current, never a stale closure
      const chapterIndexes = new Set(chaptersRef.current.map(ch => ch.paragraphIndex));
      const computedPages = paginateIntoPages(paragraphs, width, height, fontSize, chapterIndexes);
      setPages(computedPages);

      // Resync chapter page numbers to actual paginated positions — use functional
      // updater so we never need `chapters` in the dep array for this part
      setChapters(prevChapters => {
        if (prevChapters.length === 0) return prevChapters;
        const updated = prevChapters.map(ch => {
          const pageIdx = computedPages.findIndex(pg =>
            pg.some(it => it.originalIndex === ch.paragraphIndex)
          );
          return pageIdx !== -1 ? { ...ch, page: pageIdx } : ch;
        });
        const changed = updated.some((ch, i) => ch.page !== prevChapters[i].page);
        return changed ? updated : prevChapters; // same reference = no re-render
      });

      // On first pagination after load: jump to the saved paragraph's real page
      if (!restoredOnceRef.current && savedParagraphIndexRef.current !== null) {
        const savedIdx = savedParagraphIndexRef.current;
        const realPage = computedPages.findIndex(pg =>
          pg.some(it => it.originalIndex === savedIdx)
        );
        if (realPage !== -1) {
          restoredOnceRef.current = true;
          anchorParagraphRef.current = savedIdx;
          setCurrentPage(realPage);
          setBookmarkPage(realPage);
        }
      } else if (anchorParagraphRef.current !== null) {
        // On subsequent re-paginations (font resize, window resize) keep position stable
        const foundIdx = computedPages.findIndex(pg =>
          pg.some(it => it.originalIndex === anchorParagraphRef.current)
        );
        if (foundIdx !== -1) setCurrentPage(foundIdx);
      }
    };

    updatePages();
    window.addEventListener('resize', updatePages);
    return () => window.removeEventListener('resize', updatePages);
  }, [paragraphs, fontSize]); // ← chapters intentionally excluded: resync uses functional updater

  // Keep anchorParagraphRef in sync with the first paragraph on current page
  // (used to re-anchor position after font/window resize)
  useEffect(() => {
    if (pages[currentPage] && pages[currentPage].length > 0) {
      // Only update anchor if we're not mid-restore (to avoid overwriting saved position)
      if (restoredOnceRef.current) {
        anchorParagraphRef.current = pages[currentPage][0].originalIndex;
      }
    }
  }, [currentPage, pages]);

  const totalPages = Math.max(1, pages.length);
  const currentParagraphs = pages[currentPage] || [];
  const progressPct = pages.length > 0
    ? Math.round(((currentPage + 1) / pages.length) * 100)
    : 0;

  // Scroll content area to top on every page turn
  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = 0;
    }
  }, [currentPage]);

  // ── Load book ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      // Reset restore state for this book
      restoredOnceRef.current = false;
      savedParagraphIndexRef.current = null;
      anchorParagraphRef.current = null;
      setBookmarkPage(null);

      try {
        const data = await api.get(`/books/${id}/read`);
        setBookInfo({ title: data.title, author: data.author_name });
        const bookParagraphs = data.paragraphs || [];
        setParagraphs(bookParagraphs);

        const detected = detectChapters(bookParagraphs);
        setChapters(detected);

        // Store saved paragraph index — actual page will be resolved after pagination
        const saved = loadProgress(id);
        if (saved && saved.paragraph >= 0) {
          savedParagraphIndexRef.current = saved.paragraph;
        }
        // Start at page 0; pagination effect will jump to real page once computed
        setCurrentPage(0);
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

  // ── Search: build match list whenever query or pages change ─────────────────
  useEffect(() => {
    if (!searchQuery.trim() || pages.length === 0) {
      setSearchMatches([]);
      setSearchCursor(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = [];
    pages.forEach((pg, pageIdx) => {
      pg.forEach(item => {
        if (item.text.toLowerCase().includes(q)) {
          matches.push({ paragraphIndex: item.originalIndex, pageIndex: pageIdx });
        }
      });
    });
    // Deduplicate by pageIndex (paragraph can span multiple chunks)
    const seen = new Set();
    const unique = matches.filter(m => {
      const key = `${m.pageIndex}-${m.paragraphIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setSearchMatches(unique);
    setSearchCursor(0);
    if (unique.length > 0) setCurrentPage(unique[0].pageIndex);
  }, [searchQuery, pages]);

  // Jump to match at cursor
  const jumpToMatch = useCallback((idx) => {
    if (searchMatches.length === 0) return;
    const m = searchMatches[idx];
    setCurrentPage(m.pageIndex);
    contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchMatches]);

  const searchNext = useCallback(() => {
    const next = (searchCursor + 1) % searchMatches.length;
    setSearchCursor(next);
    jumpToMatch(next);
  }, [searchCursor, searchMatches, jumpToMatch]);

  const searchPrev = useCallback(() => {
    const prev = (searchCursor - 1 + searchMatches.length) % searchMatches.length;
    setSearchCursor(prev);
    jumpToMatch(prev);
  }, [searchCursor, searchMatches, jumpToMatch]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchMatches([]);
    setSearchCursor(0);
  }, []);

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
      contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('mousemove', handleMouseMoveWindow);
    window.addEventListener('mouseup', handleMouseUpWindow);

    return () => {
      window.removeEventListener('mousemove', handleMouseMoveWindow);
      window.removeEventListener('mouseup', handleMouseUpWindow);
    };
  }, [isDragging, updateProgressFromEvent]);

  // Save progress when user turns page (save first paragraph index of the visible page)
  useEffect(() => {
    if (loading || pages.length === 0 || !pages[currentPage]) return;
    const items = pages[currentPage];
    if (items && items.length > 0) {
      saveProgress(id, items[0].originalIndex, paragraphs.length);
    }
  }, [loading, currentPage, pages, id, paragraphs.length]);

  const goNext = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(p => p + 1);
      contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage, totalPages]);

  const goPrev = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(p => p - 1);
      contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // ── Touch / swipe navigation (mobile) ───────────────────────────────────────
  const touchStartRef = useRef(null);

  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Only treat as a page turn when the gesture is clearly horizontal,
    // so it never fights vertical scrolling or a tap.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) goNext();   // swipe left → next page
      else goPrev();          // swipe right → previous page
    }
  }, [goNext, goPrev]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      // Ctrl+F / Cmd+F → open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(s => {
          if (!s) setTimeout(() => searchInputRef.current?.focus(), 50);
          return !s;
        });
        return;
      }
      // Escape: close search first, then exit focus mode
      if (e.key === 'Escape') {
        if (showSearch) { closeSearch(); return; }
        setFocusMode(false);
        return;
      }
      // Don't intercept arrow/space when search input is focused
      if (showSearch) return;
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, showSearch, closeSearch]);

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
  }  return (
    <div className={`${styles.reader} ${focusMode ? styles['focus-mode'] : ''}`}>
      {/* Sticky Top Section (Header + Progress Loader) */}
      <div className={`${styles['reader-top-section']} ${focusMode ? styles['chrome-top-hidden'] : ''}`}>
        <div className={styles['reader-header']}>
          <button className={styles['reader-back']} onClick={() => navigate('/app/ebooks')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            <span className={styles['back-label']}>Back</span>
          </button>

          {/* Title OR inline search bar */}
          {showSearch ? (
            <div className={styles['search-inline']}>
              <div className={styles['search-input-wrap']}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles['search-icon']}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  className={styles['search-input']}
                  placeholder="Search in book…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.shiftKey ? searchPrev() : searchNext(); }
                    if (e.key === 'Escape') closeSearch();
                  }}
                  autoComplete="off"
                />
                {searchQuery && (
                  <span className={styles['search-count']}>
                    {searchMatches.length === 0
                      ? 'No results'
                      : `${searchCursor + 1} / ${searchMatches.length}`}
                  </span>
                )}
              </div>
              <button className={styles['search-nav-btn']} onClick={searchPrev} disabled={searchMatches.length === 0} title="Previous match (Shift+Enter)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15"/>
                </svg>
              </button>
              <button className={styles['search-nav-btn']} onClick={searchNext} disabled={searchMatches.length === 0} title="Next match (Enter)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              <button className={styles['search-close-btn']} onClick={closeSearch} title="Close search (Esc)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className={styles['reader-title']}>
              {bookInfo?.title} {bookInfo?.author && <span className={styles['reader-author']}>by {bookInfo.author}</span>}
            </div>
          )}
          
          <div className={styles['reader-actions']}>
            {/* Search button */}
            <button
              className={`${styles['toc-btn']} ${showSearch ? styles['toc-btn-active'] : ''}`}
              onClick={(e) => { e.stopPropagation(); setShowSearch(s => { if (!s) setTimeout(() => searchInputRef.current?.focus(), 50); return !s; }); }}
              aria-label="Search in book"
              title="Search (Ctrl+F)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            {/* Table of Contents Dropdown */}
            {chapters.length > 0 && (
              <div className={styles['toc-container']}>
                <button 
                  className={styles['toc-btn']} 
                  onClick={(e) => { e.stopPropagation(); setShowChaptersMenu(prev => !prev); }}
                  aria-label="Table of Contents"
                >
                  Chapters
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
                            contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          <span className={styles['toc-item-title']}>{ch.title}</span>
                          <span className={styles['toc-item-meta']}>
                            Page {ch.page + 1} · {ch.readingTime} min read
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={styles['font-controls']} title="Adjust reading font size">
              <button
                className={styles['font-btn']}
                onClick={() => {
                  const idx = FONT_SIZES.indexOf(fontSize);
                  if (idx > 0) setFontSize(FONT_SIZES[idx - 1]);
                }}
                disabled={fontSize <= FONT_SIZES[0]}
                aria-label="Decrease font size"
                title="Smaller text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
                  <text x="2" y="18" fontSize="15" fontWeight="bold" fill="currentColor">A</text>
                  <line x1="14" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </button>
              <button
                className={styles['font-btn']}
                onClick={() => {
                  const idx = FONT_SIZES.indexOf(fontSize);
                  if (idx < FONT_SIZES.length - 1) setFontSize(FONT_SIZES[idx + 1]);
                }}
                disabled={fontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
                aria-label="Increase font size"
                title="Larger text"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round">
                  <text x="2" y="18" fontSize="15" fontWeight="bold" fill="currentColor">A</text>
                  <line x1="16" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="2.5" />
                  <line x1="12" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Progress Strip */}
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
          
          <div 
            className={styles['progress-thumb']} 
            style={{ 
              left: `${progressPct}%`,
              transition: isDragging ? 'none' : undefined 
            }} 
          />

          {bookmarkPage !== null && (
            <div
              className={styles['bookmark-marker']}
              style={{ left: `${(bookmarkPage / Math.max(1, totalPages)) * 100}%` }}
              title={`Last read position (Page ${bookmarkPage + 1}) — click to return`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPage(bookmarkPage);
                contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {chapters.map((ch, idx) => (
            <div
              key={idx}
              className={styles['chapter-tick']}
              style={{ left: `${(ch.page / totalPages) * 100}%` }}
            />
          ))}

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
      </div>

      {/* Main Full-Height Body with Left and Right Navigation Buttons */}
      <div
        className={styles['reader-body']}
        onClick={(e) => { if (e.target === e.currentTarget) setFocusMode(f => !f); }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Left zone — click to toggle focus mode, button navigates */}
        <div
          className={styles['side-zone']}
          onClick={() => setFocusMode(f => !f)}
          title={focusMode ? 'Exit focus mode (Esc)' : 'Enter focus mode'}
        >
          <button
            className={`${styles['side-nav-btn']} ${focusMode ? styles['side-nav-dim'] : ''}`}
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            disabled={currentPage === 0}
            aria-label="Previous Page"
            title="Previous Page"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>

        <div ref={contentAreaRef} className={styles['reader-content-area']} style={{ fontSize: `${fontSize}px` }}>
          {currentParagraphs.map((item, i) => {
            const pIdx = item.originalIndex;
            const isBookmarked = savedParagraphIndexRef.current === pIdx && !item.isContinuation;
            return (
              <div
                key={`${pIdx}-${i}`}
                data-paragraph-idx={pIdx}
                className={isBookmarked ? styles['last-read-highlight'] : ''}
                style={{ position: 'relative' }}
              >
                {isBookmarked && (
                  <div className={styles['last-read-badge']}>
                    Last Read Here
                  </div>
                )}
                <p
                  onClick={handleWordClick}
                  style={{
                    cursor: 'pointer',
                    textIndent: item.isContinuation ? '0' : undefined,
                    margin: isBookmarked ? '4px 0 var(--space-6) 0' : undefined
                  }}
                >
                  {showSearch && searchQuery ? highlightText(item.text, searchQuery) : item.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right zone — click to toggle focus mode, button navigates */}
        <div
          className={styles['side-zone']}
          onClick={() => setFocusMode(f => !f)}
          title={focusMode ? 'Exit focus mode (Esc)' : 'Enter focus mode'}
        >
          <button
            className={`${styles['side-nav-btn']} ${focusMode ? styles['side-nav-dim'] : ''}`}
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            disabled={currentPage >= totalPages - 1}
            aria-label="Next Page"
            title="Next Page (→)"
          >
            ›
          </button>
        </div>
      </div>

      {/* Focus mode exit hint */}
      {focusMode && (
        <div className={styles['focus-hint']} onClick={() => setFocusMode(false)}>
          Press Esc or click sides to exit focus mode
        </div>
      )}

      {/* Footer info */}
      <div className={`${styles['reader-footer']} ${focusMode ? styles['chrome-bottom-hidden'] : ''}`}>
        <div>Page {currentPage + 1} of {totalPages} · {progressPct}% Read</div>
        {currentChapter && (
          <div className={styles['footer-chapter-info']} title={currentChapter.title}>
            {currentChapter.title} · ~{currentChapter.readingTime} min
          </div>
        )}
        {bookmarkPage !== null && currentPage !== bookmarkPage && (
          <button
            className={styles['return-start-btn']}
            onClick={() => {
              setCurrentPage(bookmarkPage);
              contentAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Return to Bookmark (Pg {bookmarkPage + 1})
          </button>
        )}
      </div>
    </div>
  );
}
