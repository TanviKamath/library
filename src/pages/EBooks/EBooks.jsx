import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getProxiedImageUrl } from '../../utils/image';
import { LikeButton } from '../../components/LikeButton';
import styles from './EBooks.module.css';

function getReadingProgress(bookId) {
  try {
    const data = JSON.parse(localStorage.getItem(`ebook-progress-${bookId}`));
    return data || null;
  } catch { return null; }
}

export default function EBooks() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchInputRef = useRef(null);
  const [isPhoneLayout, setIsPhoneLayout] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  );

  useEffect(() => {
    const handleResize = () => {
      setIsPhoneLayout(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayBooks = useMemo(() => {
    if (isPhoneLayout && books.length > 1 && books.length % 2 !== 0) {
      return books.slice(0, books.length - 1);
    }
    return books;
  }, [books, isPhoneLayout]);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const searchParam = debouncedQuery ? `&search=${encodeURIComponent(debouncedQuery)}` : '';
        const data = await api.get(`/books?ebook_only=true&page=${page}&limit=14${searchParam}`);
        setBooks(data.books || []);
        setPagination(data.pagination || { page: 1, pages: 1 });
      } catch {
        setBooks([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, debouncedQuery]);

  function handleClearSearch() {
    setSearchQuery('');
    searchInputRef.current?.focus();
  }

  function handleLikeToggle(bookId, isLiked) {
    setBooks(prev => prev.map(b => (b.id === bookId ? { ...b, is_liked: isLiked } : b)));
    window.dispatchEvent(new Event('favourites-updated'));
  }

  return (
    <div className={styles.ebooks}>
      <h1>E-Book Library</h1>
      <p>Read classic literature right in your browser, powered by Project Gutenberg.</p>

      <div className={styles['search-bar']}>
        <svg className={styles['search-icon']} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          className={styles['search-input']}
          placeholder="Search by title or author…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className={styles['search-clear']}
            onClick={handleClearSearch}
            aria-label="Clear search"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles['empty-state']}><p>Loading e-books…</p></div>
      ) : books.length === 0 ? (
        <div className={styles['empty-state']}>
          {debouncedQuery ? (
            <>
              <h3>No results found</h3>
              <p>No e-books match "<strong>{debouncedQuery}</strong>". Try a different search term.</p>
            </>
          ) : (
            <>
              <h3>No e-books available</h3>
              <p>E-books will appear here when added to the catalog.</p>
            </>
          )}
        </div>
      ) : (
        <div
          className={styles['shelf-grid']}
          style={isPhoneLayout && displayBooks.length === 1 ? { gridTemplateColumns: '1fr', justifyItems: 'center' } : undefined}
        >
          {displayBooks.map(book => {
            const progress = getReadingProgress(book.id);
            const pct = progress ? Math.round((progress.paragraph / progress.total) * 100) : 0;

            return (
              <div
                key={book.id}
                className={styles['shelf-card']}
                onClick={() => navigate(`/app/ebooks/${book.id}/read`)}
              >
                {book.cover_image_url ? (
                  <img
                    src={getProxiedImageUrl(book.cover_image_url)}
                    alt={book.title}
                    className={styles['shelf-cover']}
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className={styles['shelf-cover-placeholder']}
                  style={{
                    background: book.cover_color || '#4a6fa5',
                    display: book.cover_image_url ? 'none' : 'flex'
                  }}
                >
                  {book.title}
                </div>
                <span className={styles['ebook-badge']}>E-Book</span>
                <LikeButton book={book} onLikeToggle={handleLikeToggle} />

                <div className={styles['shelf-info']}>
                  <div className={styles['shelf-title']}>{book.title}</div>
                  <div className={styles['shelf-author']}>{book.author_name || 'Unknown Author'}</div>

                  {progress ? (
                    <>
                      <div className={styles['progress-bar-wrap']}>
                        <div className={styles['progress-bar']} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={styles['progress-label']}>{pct}% read</div>
                      <button
                        className={styles['continue-btn']}
                        onClick={(e) => { e.stopPropagation(); navigate(`/app/ebooks/${book.id}/read`); }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                        </svg>
                        Continue Reading
                      </button>
                    </>
                  ) : (
                    <button
                      className={styles['read-btn']}
                      onClick={(e) => { e.stopPropagation(); navigate(`/app/ebooks/${book.id}/read`); }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                      </svg>
                      Read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Previous
          </button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)' }}>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={!pagination.has_next} onClick={() => setPage(p => p + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
