import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import DomeGallery from '../../components/DomeGallery';
import { getProxiedImageUrl } from '../../utils/image';

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
  const [images, setImages] = useState(FALLBACK_COVERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBooks() {
      try {
        const data = await api.get('/books?limit=100');
        const bookList = data.books || [];
        const covers = bookList.map((b, i) => {
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
      <div style={{ position: 'absolute', top: 24, left: 24, zIndex: 50, display: 'flex', gap: '12px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(69, 26, 3, 0.1)',
            color: '#451a03',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(69, 26, 3, 0.2)',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem',
            transition: 'all 0.2s'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <Link
          to="/app/browse"
          style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-terracotta)',
            color: '#fff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          Catalog Grid View
        </Link>
      </div>

      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 50, color: '#451a03', textAlign: 'right' }}>
        <h1 style={{ fontSize: '1.8rem', fontFamily: 'var(--font-serif)', margin: '0 0 4px 0', fontWeight: 800, color: '#451a03' }}>
          3D Book Sphere
        </h1>
        <p style={{ fontSize: '0.9rem', fontWeight: 600, opacity: 0.85, margin: 0 }}>
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
