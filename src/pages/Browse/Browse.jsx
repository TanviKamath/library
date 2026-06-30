import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../api/client';
import { BookCard } from '../../components/BookCard';
import DomeGallery from '../../components/DomeGallery';
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
        limit: viewMode === 'sphere' ? '50' : '12',
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
      const validUrl = (b.cover_image_url && b.cover_image_url.startsWith('http'))
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
        <select
          className={styles['filter-select']}
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          id="browse-sort"
          aria-label="Sort books"
        >
          <option value="newest">Newest First</option>
          <option value="a_to_z">A → Z</option>
          <option value="z_to_a">Z → A</option>
          <option value="rating">Highest Rated</option>
          <option value="most_borrowed">Most Borrowed</option>
        </select>
        <button
          onClick={() => setViewMode(v => v === 'grid' ? 'sphere' : 'grid')}
          className={styles['filter-select']}
          style={{
            cursor: 'pointer',
            fontWeight: 'bold',
            background: viewMode === 'sphere' ? 'var(--color-terracotta)' : undefined,
            color: viewMode === 'sphere' ? '#fff' : undefined,
            border: viewMode === 'sphere' ? '1px solid var(--color-terracotta)' : undefined
          }}
        >
          {viewMode === 'grid' ? '3D Sphere View' : 'Grid View'}
        </button>
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
          >
            ← Previous
          </button>
          <span className={styles['pagination-info']}>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            className={styles['pagination-btn']}
            disabled={!pagination.has_next}
            onClick={() => setPage(p => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
