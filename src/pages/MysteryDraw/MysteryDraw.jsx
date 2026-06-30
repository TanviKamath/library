import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import CircularGallery from '../../components/CircularGallery/CircularGallery';
import { getProxiedImageUrl } from '../../utils/image';
import styles from './MysteryDraw.module.css';

export default function MysteryDraw() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [bookPool, setBookPool] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutStatus, setCheckoutStatus] = useState(null);

  const loadBookPool = async () => {
    try {
      let recs = [];
      try {
        const recsRes = await api.get('/books/recommendations');
        recs = (recsRes.books || []).filter(b => b.cover_image_url);
      } catch (e) {
        console.error('Failed to fetch recommendations:', e);
      }

      let general = [];
      try {
        const generalRes = await api.get('/books?limit=80');
        general = (generalRes.books || []).filter(b => b.cover_image_url);
      } catch (e) {
        console.error('Failed to fetch general books:', e);
      }

      const seenIds = new Set();
      const combined = [];
      
      recs.forEach(b => {
        if (!seenIds.has(b.id)) {
          seenIds.add(b.id);
          combined.push(b);
        }
      });

      general.forEach(b => {
        if (!seenIds.has(b.id)) {
          seenIds.add(b.id);
          combined.push(b);
        }
      });

      setBookPool(combined);
      return combined;
    } catch (err) {
      console.error('Failed to load candidate pool:', err);
      return [];
    }
  };

  const loadMysteryDeck = async (forceRefresh = false) => {
    setLoading(true);
    setSelectedBook(null);
    setIsFlipped(false);
    setCheckoutStatus(null);
    try {
      let activePool = bookPool;
      if (activePool.length === 0 || forceRefresh) {
        activePool = await loadBookPool();
      }
      
      if (activePool.length > 0) {
        const shuffled = [...activePool].sort(() => 0.5 - Math.random()).slice(0, 10);
        setBooks(shuffled);
      }
    } catch (err) {
      console.error('Failed to shuffle mystery deck:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMysteryDeck(true);
  }, []);

  const handleSelectCard = (index) => {
    const book = books[index % books.length];
    setSelectedBook(book);
    setIsFlipped(false);
    setCheckoutStatus(null);
    // Trigger 3D flip after modal transition
    setTimeout(() => {
      setIsFlipped(true);
    }, 400);
  };

  const handleBorrow = async () => {
    if (!selectedBook) return;
    setCheckoutStatus('loading');
    try {
      await api.post('/reservations/join', { book_id: selectedBook.id });
      setCheckoutStatus('success');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to reserve book.';
      setCheckoutStatus({ error: msg });
    }
  };

  // Convert cards to CircularGallery items showing card back image
  const galleryItems = books.map((_, idx) => ({
    image: '/mystic_card_back.png',
    text: `Card ${idx + 1}`
  }));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Blind Date with a Book</h1>
        <p className={styles.desc}>
          Can't decide what to read next? Let fate choose. Drag the card carousel below, click on any face-down card, and
          reveal your mystery book recommendation!
        </p>
        <button 
          className={styles.mainReshuffleBtn} 
          onClick={() => loadMysteryDeck(false)}
          disabled={loading}
        >
          Reshuffle Deck
        </button>
      </header>

      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p>Shuffling the mystic deck...</p>
        </div>
      ) : (
        <div className={styles.galleryWrapper}>
          <div className={styles.centerFrame} />
          <CircularGallery
            items={galleryItems}
            bend={2.5}
            textColor="var(--color-charcoal-light)"
            borderRadius={0.06}
            scrollSpeed={2.5}
            scrollEase={0.06}
            onSelectCard={handleSelectCard}
          />
          <div className={styles.hint}>
            <span>✦ Drag to spin the cards. Click a card to flip and reveal ✦</span>
          </div>
        </div>
      )}

      {selectedBook && (
        <div className={styles.overlay} onClick={() => setSelectedBook(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setSelectedBook(null)}>×</button>
            
            <div className={styles.modalContent}>
              {/* 3D Card Flip Container */}
              <div className={`${styles.card3d} ${isFlipped ? styles.flipped : ''} ${checkoutStatus === 'success' ? styles.stamped : ''}`}>
                <div className={styles.cardInner}>
                  {/* Card Back */}
                  <div className={styles.cardBack}>
                    <img src="/mystic_card_back.png" alt="Mystic Card Back" />
                  </div>
                  {/* Card Front (Actual Cover) */}
                  <div className={styles.cardFront}>
                    <img src={getProxiedImageUrl(selectedBook.cover_image_url)} alt={selectedBook.title} />
                    {checkoutStatus === 'success' && (
                      <div className={styles.stampOverlay}>
                        <div className={styles.stampSeal}>
                          <span className={styles.stampTextTop}>BREW & BORROW</span>
                          <span className={styles.stampTextCenter}>GRANTED</span>
                          <span className={styles.stampTextDate}>
                            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Book Details (fade-in alongside the flip) */}
              <div className={`${styles.bookDetails} ${isFlipped ? styles.visible : ''}`}>
                <span className={styles.destinyTag}>✨ Your Drawn Book</span>
                <h2 className={styles.bookTitle}>{selectedBook.title}</h2>
                <h3 className={styles.bookAuthor}>By {selectedBook.author_name}</h3>
                
                {selectedBook.rating && (
                  <div className={styles.rating}>
                    {'★'.repeat(Math.round(selectedBook.rating))}
                    {'☆'.repeat(5 - Math.round(selectedBook.rating))}
                    <span className={styles.ratingVal}>({selectedBook.rating.toFixed(1)})</span>
                  </div>
                )}

                <p className={styles.bookDesc}>
                  {selectedBook.description || 'No description available for this mystic selection. Let curiosity be your guide.'}
                </p>

                {checkoutStatus === 'success' ? (
                  <div className={styles.successBlock}>
                    <p className={styles.successText}>
                      This book has been successfully added to your reservations queue.
                    </p>
                    <button className={styles.actionBtn} onClick={() => navigate('/app/dashboard')}>
                      Go to Dashboard
                    </button>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    <button 
                      className={`${styles.actionBtn} ${styles.primaryBtn}`} 
                      onClick={handleBorrow}
                      disabled={checkoutStatus === 'loading'}
                    >
                      {checkoutStatus === 'loading' ? 'Reserving...' : 'Reserve this Book'}
                    </button>
                    <button 
                      className={`${styles.actionBtn} ${styles.secondaryBtn}`} 
                      onClick={() => {
                        setSelectedBook(null);
                        loadMysteryDeck();
                      }}
                    >
                      Reshuffle & Draw Again
                    </button>
                  </div>
                )}

                {checkoutStatus && checkoutStatus.error && (
                  <p className={styles.errorText}>{checkoutStatus.error}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
