import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { getProxiedImageUrl } from '../../utils/image';
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.get(`/books?ebook_only=true&page=${page}&limit=12`);
        setBooks(data.books || []);
        setPagination(data.pagination || { page: 1, pages: 1 });
      } catch {
        setBooks([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page]);

  if (loading) {
    return <div className={styles['empty-state']}><p>Loading e-books…</p></div>;
  }

  return (
    <div className={styles.ebooks}>
      <h1>E-Book Library</h1>
      <p>Read classic literature right in your browser, powered by Project Gutenberg.</p>

      {books.length === 0 ? (
        <div className={styles['empty-state']}>
          <h3>No e-books available</h3>
          <p>E-books will appear here when added to the catalog.</p>
        </div>
      ) : (
        <div className={styles['shelf-grid']}>
          {books.map(book => {
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

                <div className={styles['shelf-info']}>
                  <div className={styles['shelf-title']}>{book.title}</div>
                  <div className={styles['shelf-author']}>{book.author_name || 'Unknown Author'}</div>

                  {progress && (
                    <>
                      <div className={styles['progress-bar-wrap']}>
                        <div className={styles['progress-bar']} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={styles['progress-label']}>{pct}% read</div>
                      <button
                        className={styles['continue-btn']}
                        onClick={(e) => { e.stopPropagation(); navigate(`/app/ebooks/${book.id}/read`); }}
                      >
                        Continue Reading →
                      </button>
                    </>
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
            ← Previous
          </button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)' }}>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button className="btn btn-ghost btn-sm" disabled={!pagination.has_next} onClick={() => setPage(p => p + 1)}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
