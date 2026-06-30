import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps routes that require authentication.
 * Shows a loading state while checking session, then redirects to /login if not authenticated.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-cream)',
      }}>
        <div className="loading-pulse" style={{
          fontFamily: 'var(--font-serif)',
          fontSize: 'var(--fs-xl)',
          color: 'var(--color-charcoal-light)',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          Brewing your session…
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
