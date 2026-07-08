import { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Login.module.css';

export default function Auth({ initialMode = 'signup' }) {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/app/dashboard';

  const [mode, setMode] = useState(initialMode); // 'signup' | 'signin'
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isSignup = mode === 'signup';

  // If already logged in, skip the auth screen
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setPassword('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (isSignup && password.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        await register({ full_name: fullName, username, email, password });
      } else {
        await login(email, password);
      }
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err.message ||
          (isSignup
            ? 'Could not create your account. Please try again.'
            : 'Could not sign you in. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles['login-page']}>
      {/* Editorial Side */}
      <div className={styles['login-editorial']}>
        <img
          src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80"
          alt=""
          className={styles['login-editorial-img']}
        />
        <div className={styles['login-editorial-bg']} />
        <div className={styles['login-editorial-content']}>
          <div className={styles['login-editorial-accent']} />
          <h1>{isSignup ? 'Pull Up a Chair, Pour a Cup' : 'Where Stories Meet Their Readers'}</h1>
          <p>
            {isSignup
              ? 'Create your account to borrow books, track your reads, and let Mr. Finn brew up recommendations made just for you.'
              : 'Step into a world of curated volumes, warm espresso, and the quiet thrill of a page turning. Your next chapter awaits.'}
          </p>
        </div>
      </div>

      {/* Form Side */}
      <div className={styles['login-form-side']}>
        <div className={styles['login-form-container']}>
          <div className={styles['login-brand']}>
            <div className={styles['brand-header']}>
              <img src="/coffee-cup.png" alt="Brew & Borrow" className={styles['login-logo']} />
              <h2>Brew & Borrow</h2>
            </div>
            <p>{isSignup ? 'Create your library account' : 'Sign in to your library account'}</p>
          </div>

          <div className={styles['auth-toggle-top']}>
            {isSignup ? (
              <>
                Already have an account?{' '}
                <button type="button" className={styles['auth-switch']} onClick={() => switchMode('signin')}>
                  Log in
                </button>
              </>
            ) : (
              <>
                New here?{' '}
                <button type="button" className={styles['auth-switch']} onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </>
            )}
          </div>

          {error && <div className={styles['login-error']}>{error}</div>}

          <form className={styles['login-form']} onSubmit={handleSubmit}>
            {isSignup && (
              <>
                <div className="form-group">
                  <label htmlFor="auth-name" className="form-label">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    className="input"
                    placeholder="Ada Lovelace"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-username" className="form-label">
                    Username
                  </label>
                  <input
                    id="auth-username"
                    type="text"
                    className="input"
                    placeholder="ada"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={2}
                    autoComplete="username"
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="auth-email" className="form-label">
                Email
              </label>
              <input
                id="auth-email"
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus={!isSignup}
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-password" className="form-label">
                Password
              </label>
              <div className={styles['password-wrapper']}>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`input ${styles['password-input']}`}
                  placeholder={isSignup ? 'At least 4 characters' : 'Enter your password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isSignup ? 4 : undefined}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className={styles['password-toggle-btn']}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={`btn btn-primary btn-lg ${styles['login-submit']}`}
              disabled={loading}
            >
              {loading
                ? isSignup
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignup
                ? 'Create Account'
                : 'Sign In'}
            </button>
          </form>

          <div className={styles['login-footer']}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
