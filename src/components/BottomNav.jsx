import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './BottomNav.module.css';

/* Icon set (kept in sync with the desktop Sidebar) */
const icons = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  browse: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  myBooks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  ebooks: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  mystery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="8" /><path d="M12 2a3 3 0 0 0-3 3" /><path d="M6 18h12" /><path d="M8 18v3h8v-3" /><path d="M10 21h4" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * App-style bottom navigation bar shown on phones/tablets (≤1024px).
 * Shows up to 4 primary destinations plus a "More" sheet that holds any
 * overflow links, the Profile shortcut, and Sign Out.
 */
export function BottomNav() {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // Same visibility rules as the desktop sidebar, ordered so the most-used
  // destinations land in the bar and the rest fall into "More".
  const allItems = [
    { to: '/app/dashboard', icon: icons.dashboard, label: 'Dashboard' },
    { to: '/app/browse', icon: icons.browse, label: 'Browse' },
    ...(!isStaff
      ? [
          { to: '/app/my-books', icon: icons.myBooks, label: 'My Books' },
          { to: '/app/ebooks', icon: icons.ebooks, label: 'E-Books' },
        ]
      : []),
    ...(isStaff ? [{ to: '/app/admin', icon: icons.admin, label: 'Admin' }] : []),
    ...(!isAdmin ? [{ to: '/app/mystery-draw', icon: icons.mystery, label: 'Draw' }] : []),
  ];

  const barItems = allItems.slice(0, 4);
  const overflowItems = allItems.slice(4);

  const moreItems = [
    ...overflowItems,
    { to: '/app/profile', icon: icons.profile, label: 'Profile' },
  ];

  async function handleLogout() {
    setMoreOpen(false);
    await logout();
    navigate('/login');
  }

  const tabClass = ({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`;
  const sheetLinkClass = ({ isActive }) =>
    `${styles.sheetLink} ${isActive ? styles.active : ''}`;

  return (
    <>
      <nav className={styles.bottomNav} aria-label="Primary">
        {barItems.map(item => (
          <NavLink key={item.to} to={item.to} className={tabClass}>
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`${styles.tab} ${moreOpen ? styles.active : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          aria-label="More options"
          aria-expanded={moreOpen}
        >
          <span className={styles.icon}>{moreOpen ? icons.close : icons.more}</span>
          <span className={styles.label}>More</span>
        </button>
      </nav>

      {moreOpen && (
        <>
          <div className={styles.sheetOverlay} onClick={() => setMoreOpen(false)} />
          <div className={styles.sheet} role="dialog" aria-label="More navigation">
            <div className={styles.sheetHandle} />

            <button
              type="button"
              className={styles.sheetUser}
              onClick={() => { navigate('/app/profile'); setMoreOpen(false); }}
            >
              <div className={styles.sheetAvatar}>{getInitials(user?.full_name)}</div>
              <div className={styles.sheetUserInfo}>
                <div className={styles.sheetName}>{user?.full_name}</div>
                <div className={styles.sheetRole}>{user?.role}</div>
              </div>
            </button>

            <div className={styles.sheetLinks}>
              {moreItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={sheetLinkClass}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className={styles.sheetLinkIcon}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
              <button type="button" className={styles.sheetLogout} onClick={handleLogout}>
                <span className={styles.sheetLinkIcon}>{icons.logout}</span>
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
