import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/client';
import { BookCard } from '../../components/BookCard';
import DomeGallery from '../../components/DomeGallery';
import { CustomSelect } from '../../components/CustomSelect';
import { getProxiedImageUrl } from '../../utils/image';
import styles from './Browse.module.css';

const FALLBACK_COVERS = [
  {
    src: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=774&auto=format&fit=crop',
    alt: 'The Secret History',
    title: 'The Secret History',
    author: 'Donna Tartt',
    description: 'A selective group of misfits at an elite New England college discover a unique way of thinking and living.',
    rating: 4.5
  },
  {
    src: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=774&auto=format&fit=crop',
    alt: 'Midnight Library',
    title: 'The Midnight Library',
    author: 'Matt Haig',
    description: 'Between life and death there is a library, and within that library, the shelves go on forever.',
    rating: 4.2
  },
  {
    src: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=774&auto=format&fit=crop',
    alt: 'Pride and Prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    description: 'The romantic clash between the opinionated Elizabeth Bennet and her proud suitor, Mr. Darcy.',
    rating: 4.8
  },
  {
    src: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=774&auto=format&fit=crop',
    alt: 'Dune',
    title: 'Dune',
    author: 'Frank Herbert',
    description: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, who would become the Messiah.',
    rating: 4.7
  },
  {
    src: 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?q=80&w=774&auto=format&fit=crop',
    alt: '1984',
    title: '1984',
    author: 'George Orwell',
    description: 'Winston Smith wrestles with oppression in Oceania, a place where the Party scrutinizes human actions.',
    rating: 4.6
  },
  {
    src: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?q=80&w=774&auto=format&fit=crop',
    alt: 'The Great Gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    description: 'The story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan.',
    rating: 4.4
  }
];

export default function Browse() {
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'sphere'

  // Load categories once
  useEffect(() => {
    api.get('/categories').then(setCategories).catch(() => {});
  }, []);

  // Load books
  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: viewMode === 'sphere' ? '60' : '21',
        sort,
      });
      if (search) params.set('search', search);
      if (category !== 'all') params.set('category', category);

      const data = await api.get(`/books?${params}`);
      setBooks(data.books || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, sort, viewMode]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  function handleLikeToggle(bookId, isLiked) {
    setBooks(prev => prev.map(b => b.id === bookId ? { ...b, is_liked: isLiked } : b));
  }

  const domeImages = useMemo(() => {
    const covers = books.map((b, i) => {
      const validUrl = b.cover_image_url
        ? getProxiedImageUrl(b.cover_image_url)
        : FALLBACK_COVERS[i % FALLBACK_COVERS.length].src;
      return {
        src: validUrl,
        alt: b.title || 'Book Cover',
        title: b.title || 'Classic Literature',
        author: b.author_name || 'Unknown Author',
        description: b.description || 'A timeless volume of classical literature, curated for your reading pleasure.',
        rating: b.rating || 4.5
      };
    });
    
    if (covers.length > 0) {
      return covers;
    }
    // If active search returned no results, show empty dome
    if (search && search.trim().length > 0) {
      return [];
    }
    return FALLBACK_COVERS;
  }, [books, search]);

  return (
    <div className={styles.browse}>
      <div className={styles['browse-header']}>
        <h1>Browse Books</h1>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles['search-wrap']}>
          <svg className={styles['search-icon']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles['search-input']}
            placeholder="Search by title, author, or keyword…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            id="browse-search"
          />
        </div>
        <CustomSelect
          value={sort}
          onChange={(val) => { setSort(val); setPage(1); }}
          ariaLabel="Sort books"
          options={[
            {
              value: 'newest',
              label: 'Newest First',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
              )
            },
            {
              value: 'a_to_z',
              label: 'Title (A → Z)',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="11" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="13" y2="18"/><polyline points="15 9 18 6 21 9"/><line x1="18" y1="6" x2="18" y2="18"/>
                </svg>
              )
            },
            {
              value: 'z_to_a',
              label: 'Title (Z → A)',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="11" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="13" y2="18"/><polyline points="15 15 18 18 21 15"/><line x1="18" y1="6" x2="18" y2="18"/>
                </svg>
              )
            },
            {
              value: 'rating',
              label: 'Highest Rated',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              )
            },
            {
              value: 'most_borrowed',
              label: 'Most Borrowed',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/>
                </svg>
              )
            }
          ]}
        />
        <CustomSelect
          value={viewMode}
          onChange={setViewMode}
          ariaLabel="View mode"
          alignRight={true}
          options={[
            {
              value: 'grid',
              label: 'Grid view',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"/>
                  <rect x="14" y="3" width="7" height="7"/>
                  <rect x="14" y="14" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/>
                </svg>
              )
            },
            {
              value: 'sphere',
              label: '3D sphere view',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              )
            }
          ]}
        />
      </div>

      {/* Category Pills */}
      <div className={styles['category-pills']}>
        <button
          className={`${styles['category-pill']} ${category === 'all' ? styles.active : ''}`}
          onClick={() => { setCategory('all'); setPage(1); }}
        >
          All
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            className={`${styles['category-pill']} ${category === c.name ? styles.active : ''}`}
            onClick={() => { setCategory(c.name); setPage(1); }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Results count */}
      {!loading && (
        <div className={styles['results-count']}>
          {pagination.total} book{pagination.total !== 1 ? 's' : ''} found {viewMode === 'sphere' ? 'in 3D Dome' : ''}
        </div>
      )}

      {/* Book Display */}
      {viewMode === 'sphere' ? (
        <div style={{ width: '100%', height: '650px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: '#fef3c7', position: 'relative', marginTop: '16px', border: '1px solid var(--color-border)', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <DomeGallery images={domeImages} grayscale={false} overlayBlurColor="#fef3c7" fit={0.5} />
        </div>
      ) : loading ? (
        <div className={styles['empty-state']}><p>Loading books…</p></div>
      ) : books.length === 0 ? (
        <div className={styles['empty-state']}>
          <h3>No books found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className={styles['book-grid']}>
          {books.map(book => (
            <BookCard key={book.id} book={book} onLikeToggle={handleLikeToggle} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {viewMode === 'grid' && pagination.pages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles['pagination-btn']}
            disabled={!pagination.has_prev}
            onClick={() => setPage(p => p - 1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Previous
          </button>
          <span className={styles['pagination-info']}>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            className={styles['pagination-btn']}
            disabled={!pagination.has_next}
            onClick={() => setPage(p => p + 1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
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
