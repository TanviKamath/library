import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import DomeGallery from '../../components/DomeGallery';
import { getProxiedImageUrl } from '../../utils/image';
import { useAuth } from '../../context/AuthContext';

const FALLBACK_COVERS = [
  { src: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=774&auto=format&fit=crop', alt: 'The Secret History' },
  { src: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=774&auto=format&fit=crop', alt: 'Midnight Library' },
  { src: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=774&auto=format&fit=crop', alt: 'Pride and Prejudice' },
  { src: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=774&auto=format&fit=crop', alt: 'Dune' },
  { src: 'https://images.unsplash.com/photo-1495640388908-05fa85288e61?q=80&w=774&auto=format&fit=crop', alt: '1984' },
  { src: 'https://images.unsplash.com/photo-1463320726281-696a485928c7?q=80&w=774&auto=format&fit=crop', alt: 'The Great Gatsby' },
  { src: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=774&auto=format&fit=crop', alt: 'To Kill a Mockingbird' },
  { src: 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?q=80&w=774&auto=format&fit=crop', alt: 'Brave New World' }
];

export default function BookDomeGallery() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [images, setImages] = useState(FALLBACK_COVERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooks() {
      try {
        const data = await api.get('/books?limit=100');
        const bookList = data.books || [];
        const covers = bookList.map((b, i) => {
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
          setImages(covers);
        }
      } catch (err) {
        console.warn('Could not fetch catalog for dome, using default aesthetics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBooks();
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#fef3c7', overflow: 'hidden' }}>
      {/* Floating Header */}
      <div className="dome-nav">
        <button className="dome-nav-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          <span className="dome-back-label">Back</span>
        </button>

        {isAuthenticated ? (
          <Link to="/app/dashboard" className="dome-nav-link">Dashboard</Link>
        ) : (
          <Link to="/register" className="dome-nav-link">Sign In / Sign Up</Link>
        )}
      </div>

      <div className="dome-titlebar">
        <h1 className="dome-title">3D Book Sphere</h1>
        <p className="dome-subtitle">
          Drag dome to rotate · Click cover to enlarge
        </p>
      </div>

      {/* 3D Dome Gallery */}
      <DomeGallery
        images={images}
        grayscale={false}
        overlayBlurColor="#fef3c7"
        fit={0.55}
      />
    </div>
  );
}
