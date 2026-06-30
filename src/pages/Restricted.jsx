import { Link } from 'react-router-dom';

export default function Restricted() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      textAlign: 'center',
      padding: 'var(--space-8)',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: 'var(--radius-full)',
        background: 'var(--color-terracotta-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 'var(--space-6)',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h1 style={{
        fontFamily: 'var(--font-serif)',
        fontSize: 'var(--fs-2xl)',
        color: 'var(--color-espresso)',
        marginBottom: 'var(--space-3)',
      }}>
        Restricted Area
      </h1>
      <p style={{
        color: 'var(--color-charcoal-light)',
        fontSize: 'var(--fs-base)',
        maxWidth: 440,
        lineHeight: 'var(--lh-relaxed)',
        marginBottom: 'var(--space-6)',
      }}>
        This section of the library is reserved for staff members.
        If you believe you should have access, please contact your administrator.
      </p>
      <Link to="/app/dashboard" className="btn btn-secondary">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
