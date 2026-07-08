import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import { BookCard } from '../../components/BookCard';
import Lanyard from '../../components/Lanyard/Lanyard';
import { Modal } from '../../components/Modal';
import OverdueStamp from '../../components/OverdueStamp/OverdueStamp';
import { getProxiedImageUrl } from '../../utils/image';
import styles from './Dashboard.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function daysUntil(iso) {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}


const heartOutline = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

export default function Dashboard() {
  const { user, isStaff } = useAuth();

  return (
    <div className={styles.dashboard}>
      <div className={styles.greeting}>
        <h1>Welcome back, {user?.full_name?.split(' ')[0] || user?.username}</h1>
        <p>{isStaff ? 'Here\'s what\'s happening in the library today.' : 'Here\'s your reading overview.'}</p>
      </div>
      {isStaff ? <StaffDashboard /> : <MemberDashboard />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MEMBER DASHBOARD
   ═══════════════════════════════════════════ */
function MemberDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [borrows, setBorrows] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPhoneLayout, setIsPhoneLayout] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  );

  useEffect(() => {
    const handleResize = () => setIsPhoneLayout(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayRecs = useMemo(() => {
    const sliced = recommendations.slice(0, 14);
    if (isPhoneLayout && sliced.length > 1 && sliced.length % 2 !== 0) {
      return sliced.slice(0, sliced.length - 1);
    }
    return sliced;
  }, [recommendations, isPhoneLayout]);

  useEffect(() => {
    async function load() {
      try {
        const [txns, recs] = await Promise.all([
          api.get('/transactions/my'),
          api.get('/books/recommendations').catch(() => ({ books: [] })),
        ]);
        setBorrows(Array.isArray(txns) ? txns : []);
        setRecommendations(recs.books || []);
      } catch {
        // Fail silently
      } finally {
        setLoading(false);
      }
    }
    load();

    async function refreshRecs() {
      try {
        const recs = await api.get('/books/recommendations').catch(() => ({ books: [] }));
        setRecommendations(recs.books || []);
      } catch {}
    }

    window.addEventListener('favourites-updated', refreshRecs);
    return () => window.removeEventListener('favourites-updated', refreshRecs);
  }, []);

  async function handleRecLike(e, book) {
    e.stopPropagation();
    if (!isAuthenticated) return;
    try {
      if (book.is_liked) {
        await api.delete(`/books/${book.id}/like`);
      } else {
        await api.post(`/books/${book.id}/like`);
      }
      setRecommendations(prev =>
        prev.map(b => (b.id === book.id ? { ...b, is_liked: !b.is_liked } : b))
      );
      window.dispatchEvent(new Event('favourites-updated'));
    } catch {}
  }

  const active = borrows.filter(t => t.status === 'active' || t.status === 'overdue');
  const overdueCount = active.filter(t => t.status === 'overdue' || daysUntil(t.due_date) < 0).length;

  if (loading) {
    return <div className={styles['empty-state']}><p>Loading your dashboard…</p></div>;
  }

  return (
    <>
      <SpotlightSection actionLabel="Borrow Spotlight Book" />

      {/* Currently Borrowed */}
      <div className={styles.section}>
        <div className={styles['section-header']}>
          <h2>Currently Borrowed</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/my-books')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            View All
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
        {active.length === 0 ? (
          <div className={styles['empty-state']}>
            <h3>No books checked out</h3>
            <p>Visit the catalog to find your next read.</p>
            <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/app/browse')}>
              Browse books
            </button>
          </div>
        ) : (
          <table className={styles['due-table']}>
            <thead>
              <tr>
                <th>Book</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {active.slice(0, 5).map(t => {
                const days = daysUntil(t.due_date);
                let statusClass = styles['badge-active'];
                let statusText = 'Active';
                if (t.status === 'overdue' || days < 0) {
                  statusClass = styles['badge-overdue'];
                  statusText = 'Overdue';
                } else if (days <= 3) {
                  statusClass = styles['badge-warning'];
                  statusText = `Due in ${days}d`;
                }
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.book_title}</td>
                    <td>{formatDate(t.due_date)}</td>
                    <td><span className={`${styles.badge} ${statusClass}`}>{statusText}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Your Favourites */}
      <FavouritesSection />

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className={styles.section}>
          <div className={styles['section-header']}>
            <h2>Recommended for You</h2>
          </div>
          <div className={styles['rec-grid']}>
            {displayRecs.map(book => (
              <div
                key={book.id}
                className={styles['rec-card']}
                onClick={() => navigate(`/app/browse/${book.id}`)}
              >
                <div className={styles['rec-cover-wrap']}>
                  {book.cover_image_url ? (
                    <img
                      src={getProxiedImageUrl(book.cover_image_url)}
                      alt={book.title}
                      className={styles['rec-cover']}
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className={styles['rec-cover-placeholder']}
                    style={{
                      background: book.cover_color || 'var(--color-cream-dark)',
                      display: book.cover_image_url ? 'none' : 'flex'
                    }}
                  >
                    {book.title}
                  </div>
                  {isAuthenticated && (
                    <button
                      className={`${styles['rec-like-btn']} ${book.is_liked ? styles.liked : ''}`}
                      onClick={(e) => handleRecLike(e, book)}
                      aria-label={book.is_liked ? 'Unlike book' : 'Like book'}
                    >
                      {heartOutline}
                    </button>
                  )}
                </div>
                <div className={styles['rec-info']}>
                  <div className={styles['rec-title']}>{book.title}</div>
                  <div className={styles['rec-author']}>{book.author_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   STAFF DASHBOARD (Admin / Librarian)
   ═══════════════════════════════════════════ */
function StaffDashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [s, a] = await Promise.all([
          api.get('/stats/dashboard'),
          api.get('/stats/analytics-overview'),
        ]);
        setStats(s);
        setAnalytics(a);
      } catch {
        // Fail silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className={styles['empty-state']}><p>Loading dashboard…</p></div>;
  }

  return (
    <>
      <SpotlightSection actionLabel="View spotlight details" />

      {/* Stats Cards */}
      {stats && (
        <div className={styles['stats-grid']}>
          <div className={styles['stat-card']} style={{ cursor: 'pointer' }} onClick={() => navigate('/app/admin?tab=books')} title="Go to Books">
            <div className={styles['stat-label']}>Total Books</div>
            <div className={styles['stat-value']}>{stats.totalBooks}</div>
          </div>
          <div className={styles['stat-card']} style={{ cursor: 'pointer' }} onClick={() => navigate('/app/admin?tab=members')} title="Go to Members">
            <div className={styles['stat-label']}>Total Members</div>
            <div className={styles['stat-value']}>{stats.totalMembers}</div>
          </div>
          <div className={styles['stat-card']} style={{ cursor: 'pointer' }} onClick={() => navigate('/app/admin?tab=transactions')} title="Go to Transactions">
            <div className={styles['stat-label']}>Issued Books</div>
            <div className={styles['stat-value']}>{stats.issuedBooks}</div>
          </div>
          <div className={styles['stat-card']} style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }} onClick={() => navigate('/app/admin?tab=transactions')} title="Go to Transactions">
            <div className={styles['stat-label']}>Overdue</div>
            <div className={styles['stat-value']}>{stats.overdueBooks}</div>
            {stats.overdueBooks > 0 && <OverdueStamp />}
          </div>
          <div className={`${styles['stat-card']} ${stats.dueToday > 0 ? styles.accent : ''}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/app/admin?tab=transactions')} title="Go to Transactions">
            <div className={styles['stat-label']}>Due Today</div>
            <div className={styles['stat-value']}>{stats.dueToday}</div>
          </div>
          <div className={styles['stat-card']} style={{ cursor: 'pointer' }} onClick={() => navigate('/app/admin?tab=books')} title="Go to Books">
            <div className={styles['stat-label']}>Added This Month</div>
            <div className={styles['stat-value']}>{stats.booksAddedThisMonth}</div>
          </div>
        </div>
      )}

      {/* Your Favourites */}
      {!isAdmin && <FavouritesSection />}

      {/* Category Issued % Pie Chart */}
      {analytics?.categoryCirculation && analytics.categoryCirculation.length > 0 && (
        <div className={styles.section} style={{ marginBottom: '24px' }}>
          <div className={styles['section-header']}>
            <h2>📊 Issued Books by Category (%)</h2>
          </div>
          <CategoryPieChart data={analytics.categoryCirculation} />
        </div>
      )}

      <div className={styles['two-col']}>
        {/* Popular Books */}
        {analytics?.popularBooks && (
          <div className={styles.section} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={styles['section-header']}>
              <h2>Popular Books</h2>
            </div>
            <table className={styles['due-table']} style={{ flex: 1 }}>
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>Rank</th>
                  <th>Book Title</th>
                  <th style={{ textAlign: 'right' }}>Borrows</th>
                </tr>
              </thead>
              <tbody>
                {analytics.popularBooks.slice(0, 5).map((b, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: i === 0 ? '#fef3c7' : i === 1 ? '#f1f5f9' : i === 2 ? '#ffedd5' : '#f8fafc',
                        color: i === 0 ? '#b45309' : i === 1 ? '#475569' : i === 2 ? '#c2410c' : '#64748b',
                        fontWeight: 700,
                        fontSize: '13px',
                        border: i === 0 ? '1px solid #fde68a' : i === 1 ? '1px solid #e2e8f0' : i === 2 ? '1px solid #fed7aa' : '1px solid #f1f5f9'
                      }}>
                        {i + 1}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-espresso, #2d2420)', fontSize: '13.5px' }}>{b.title}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ background: '#f1f5f9', color: '#334155', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                        {b.count} {b.count === 1 ? 'borrow' : 'borrows'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent Activity */}
        {analytics?.recentActivity && (
          <div className={styles.section} style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={styles['section-header']}>
              <h2>Recent Activity</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/app/admin')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                View All
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
            <table className={styles['due-table']} style={{ flex: 1 }}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Book</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recentActivity.slice(0, 5).map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600, color: 'var(--color-espresso, #2d2420)', fontSize: '13.5px' }}>{a.user_name}</td>
                    <td style={{ color: '#475569', fontSize: '13.5px', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.book_title}>{a.book_title}</td>
                    <td style={{ color: '#64748b', fontSize: '12.5px', whiteSpace: 'nowrap' }}>{formatDate(a.date)}</td>
                    <td>
                      <span className={`${styles.badge} ${a.status === 'active' ? styles['badge-active'] : a.status === 'returned' ? styles['badge-info'] : styles['badge-overdue']}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════
   SPOTLIGHT SECTION
   ═══════════════════════════════════════════ */
function SpotlightSection({ actionLabel }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [specialBook, setSpecialBook] = useState(null);
  const [spotlightMeta, setSpotlightMeta] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadSpotlight() {
    try {
      const data = await api.get('/spotlight');
      setSpecialBook(data?.book || null);
      setSpotlightMeta(data?.meta || null);
    } catch {
      setSpecialBook(null);
      setSpotlightMeta(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpotlight();
  }, []);

  if (loading || !specialBook) {
    return null;
  }

  return (
    <>
      <div className={styles['spotlight-grid']}>
        <div className={styles['spotlight-info']}>
          <span className={styles['spotlight-tag']}>
            {spotlightMeta?.is_admin_override ? '✨ Admin Spotlight Pick' : '✨ Spotlight / New Arrival'}
          </span>
          <h2 className={styles['spotlight-title']}>{specialBook.title}</h2>
          <p className={styles['spotlight-author']}>By {specialBook.author_name}</p>
          <p className={styles['spotlight-desc']}>
            {specialBook.description
              ? (specialBook.description.length > 180 ? specialBook.description.slice(0, 180) + '...' : specialBook.description)
              : 'Explore this fascinating new addition to our collection.'}
          </p>
          {specialBook.quote_text && (
            <blockquote className={styles['spotlight-quote']}>
              <p className={styles['spotlight-quote-text']}>“{specialBook.quote_text}”</p>
              <cite className={styles['spotlight-quote-cite']}>
                — from this book{specialBook.quote_source ? ` · ${specialBook.quote_source}` : ''}
              </cite>
            </blockquote>
          )}
          <div className={styles['spotlight-actions']}>
            <button className={styles['spotlight-btn']} onClick={() => navigate(`/app/browse/${specialBook.id}`)}>
              {actionLabel}
            </button>
            {isAdmin && (
              <button className={styles['spotlight-edit-btn']} onClick={() => setShowEditModal(true)}>
                Edit spotlight
              </button>
            )}
          </div>
        </div>
        <div className={styles['spotlight-canvas']}>
          <Lanyard
            position={[0, 0, 13]}
            gravity={[0, -40, 0]}
            frontImage={getProxiedImageUrl(specialBook.cover_image_url)}
            backImage={getProxiedImageUrl(specialBook.cover_image_url)}
            imageFit="cover"
          />
        </div>
      </div>

      {isAdmin && (
        <SpotlightEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          currentBookId={specialBook.id}
          onSaved={(book, meta) => {
            setSpecialBook(book);
            setSpotlightMeta(meta);
            setShowEditModal(false);
          }}
        />
      )}
    </>
  );
}

function SpotlightEditModal({ isOpen, onClose, currentBookId, onSaved }) {
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    async function loadBooks() {
      setLoading(true);
      try {
        const data = await api.get('/books?limit=100');
        setBooks(data?.books || []);
      } catch {
        setBooks([]);
      } finally {
        setLoading(false);
      }
    }
    loadBooks();
  }, [isOpen]);

  const filteredBooks = books.filter(book => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      book.title?.toLowerCase().includes(term) ||
      book.author_name?.toLowerCase().includes(term)
    );
  });

  async function handleSelect(bookId) {
    setSavingId(bookId);
    try {
      const data = await api.put('/spotlight', { book_id: bookId });
      onSaved(data.book, data.meta);
    } catch {
      // Ignore
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Spotlight Book">
      <p className={styles['spotlight-edit-note']}>
        Your selection will appear for all users. It rotates to a random book after 24 hours.
      </p>
      <input
        type="search"
        className={styles['spotlight-search']}
        placeholder="Search by title or author..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {loading ? (
        <p className={styles['spotlight-edit-empty']}>Loading books…</p>
      ) : filteredBooks.length === 0 ? (
        <p className={styles['spotlight-edit-empty']}>No books found.</p>
      ) : (
        <div className={styles['spotlight-book-list']}>
          {filteredBooks.map(book => (
            <button
              key={book.id}
              type="button"
              className={`${styles['spotlight-book-option']} ${book.id === currentBookId ? styles.selected : ''}`}
              disabled={savingId === book.id}
              onClick={() => handleSelect(book.id)}
            >
              <span className={styles['spotlight-book-title']}>{book.title}</span>
              <span className={styles['spotlight-book-author']}>{book.author_name || 'Unknown Author'}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ═══════════════════════════════════════════
   FAVOURITES SECTION
   ═══════════════════════════════════════════ */
function FavouritesSection() {
  const navigate = useNavigate();
  const [likes, setLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPhoneLayout, setIsPhoneLayout] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth <= 768
  );

  useEffect(() => {
    const handleResize = () => setIsPhoneLayout(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const displayLikes = useMemo(() => {
    if (isPhoneLayout && likes.length > 1 && likes.length % 2 !== 0) {
      return likes.slice(0, likes.length - 1);
    }
    return likes;
  }, [likes, isPhoneLayout]);

  useEffect(() => {
    async function loadLikes() {
      try {
        const data = await api.get('/users/me/likes?limit=50');
        setLikes(data?.books || []);
      } catch {
        setLikes([]);
      } finally {
        setLoading(false);
      }
    }
    loadLikes();

    window.addEventListener('favourites-updated', loadLikes);
    return () => window.removeEventListener('favourites-updated', loadLikes);
  }, []);

  function handleLikeToggle(bookId, isLiked) {
    if (!isLiked) {
      setLikes(prev => prev.filter(b => b.id !== bookId));
    }
    window.dispatchEvent(new Event('favourites-updated'));
  }

  return (
    <div className={styles.section}>
      <div className={styles['section-header']}>
        <h2>Your Favourites ❤️</h2>
        {likes.length > 0 && (
          <span className={styles.badge} style={{ background: 'var(--color-terracotta-bg, #fde8e8)', color: 'var(--color-terracotta)' }}>
            {likes.length} Saved
          </span>
        )}
      </div>
      {loading ? (
        <div className={styles['empty-state']} style={{ padding: 'var(--space-6) 0' }}>
          <p>Loading your favourite books…</p>
        </div>
      ) : likes.length === 0 ? (
        <div className={styles['empty-state']} style={{ padding: 'var(--space-8) var(--space-4)', background: 'var(--color-ivory)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-divider-strong)' }}>
          <h3 style={{ fontSize: 'var(--fs-md)', marginBottom: 'var(--space-2)' }}>No favourite books yet</h3>
          <p style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--space-4)' }}>Explore the catalog and tap the heart icon on books you love to save them here.</p>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/app/browse')}>
            Browse catalog
          </button>
        </div>
      ) : (
        <div
          className={styles['book-grid']}
          style={isPhoneLayout && displayLikes.length === 1 ? { gridTemplateColumns: '1fr', justifyItems: 'center' } : undefined}
        >
          {displayLikes.map(book => (
            <div key={book.id} style={isPhoneLayout && displayLikes.length === 1 ? { width: '100%', maxWidth: '280px' } : { width: '100%' }}>
              <BookCard book={book} onLikeToggle={handleLikeToggle} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   CATEGORY PIE / DONUT CHART HELPER
   ═══════════════════════════════════════════ */
function CategoryPieChart({ data }) {
  const total = data.reduce((acc, curr) => acc + curr.count, 0);
  if (total === 0) {
    return <div style={{ padding: '24px', textAlign: 'center', opacity: 0.7, fontWeight: 600 }}>No circulation activity recorded across categories yet.</div>;
  }

  const colors = [
    'var(--color-terracotta)',
    '#d97706',
    '#f59e0b',
    '#b45309',
    '#10b981',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899'
  ];

  let currentOffsetPct = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '40px', flexWrap: 'wrap', padding: '16px' }}>
      <div style={{ position: 'relative', width: '220px', height: '220px', flexShrink: 0 }}>
        <svg width="220" height="220" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
          {data.map((item, i) => {
            if (item.count === 0) return null;
            const pct = item.count / total;
            const strokeWidth = 26;
            const radius = 50 - strokeWidth / 2; // 37
            const circumference = 2 * Math.PI * radius;
            const dashArray = `${pct * circumference} ${circumference}`;
            const dashOffset = -(currentOffsetPct * circumference);
            currentOffsetPct += pct;

            return (
              <circle
                key={item.name}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={colors[i % colors.length]}
                strokeWidth={strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                style={{ transition: 'all 0.5s ease', cursor: 'pointer' }}
              >
                <title>{item.name}: {Math.round(pct * 100)}% ({item.count} loans)</title>
              </circle>
            );
          })}
        </svg>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-terracotta)', fontFamily: 'var(--font-serif)' }}>{total}</span>
          <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 600 }}>Total Issued</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '220px' }}>
        {data.map((item, i) => {
          const pct = Math.round((item.count / total) * 100);
          return (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-cream-light)', border: '1px solid var(--color-border)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: colors[i % colors.length] }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>{item.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 800, color: 'var(--color-terracotta)', fontSize: '1.1rem' }}>{pct}%</span>
                <span style={{ fontSize: '0.85rem', opacity: 0.6 }}>({item.count} loans)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
