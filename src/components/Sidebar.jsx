import { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

/* Simple SVG icons to avoid a dependency */
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
  menu: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  mystery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="10" r="8" />
      <path d="M12 2a3 3 0 0 0-3 3" />
      <path d="M6 18h12" />
      <path d="M8 18v3h8v-3" />
      <path d="M10 21h4" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
};

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function Sidebar({ collapsed, toggleCollapse, isHovered, setIsHovered }) {
  const { user, logout, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const hoverTimerRef = useRef(null);
  const isVisuallyCollapsed = collapsed && !isHovered;

  const handleMouseEnter = () => {
    if (!collapsed || !setIsHovered) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 100);
  };

  const handleMouseLeave = () => {
    if (!setIsHovered) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovered(false);
  };

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const linkClass = ({ isActive }) =>
    `${styles['sidebar-link']} ${isActive ? styles.active : ''}`;

  function NavItem({ to, icon, label }) {
    return (
      <NavLink to={to} className={linkClass} onClick={() => setOpen(false)}>
        <span className="sidebar-icon">{icon}</span>
        <span className={styles['link-text']}>{label}</span>
      </NavLink>
    );
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        className={styles['sidebar-toggle']}
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        <span className="sidebar-icon">{open ? icons.close : icons.menu}</span>
      </button>

      {/* Mobile overlay */}
      <div
        className={`${styles['sidebar-overlay']} ${open ? styles.open : ''}`}
        onClick={() => setOpen(false)}
      />

      <aside
        className={`${styles.sidebar} ${open ? styles.open : ''} ${isVisuallyCollapsed ? styles.collapsed : ''} ${collapsed && isHovered ? styles.hoverExpanded : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Brand */}
        <div className={styles['sidebar-brand']}>
          <div className={styles['brand-container']} onClick={() => navigate('/app/dashboard')} style={{ cursor: 'pointer' }}>
            <div className={styles['brand-icon']} title="Brew & Borrow">
              <img src="/coffee-cup.png" alt="Brew & Borrow Cafe Library" className={styles['brand-logo']} />
            </div>
            <div className={styles['brand-text']}>
              <h1>Brew & Borrow</h1>
              <span>Café Library</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles['sidebar-nav']}>
          <div className={styles['sidebar-section']}>
            <div className={styles['sidebar-section-label']}>Main</div>
            <NavItem to="/app/dashboard" icon={icons.dashboard} label="Dashboard" />
            <NavItem to="/app/browse" icon={icons.browse} label="Browse Books" />
            {!isAdmin && <NavItem to="/app/mystery-draw" icon={icons.mystery} label="Mystic Draw" />}
            {!isStaff && (
              <>
                <NavItem to="/app/my-books" icon={icons.myBooks} label="My Books" />
                <NavItem to="/app/ebooks" icon={icons.ebooks} label="E-Books" />
              </>
            )}
          </div>

          {/* Staff-only section */}
          {isStaff && (
            <div className={styles['sidebar-section']}>
              <div className={styles['sidebar-section-label']}>Management</div>
              <NavItem to="/app/admin" icon={icons.admin} label="Admin Panel" />
            </div>
          )}

        </nav>

        {/* Footer */}
        <div className={styles['sidebar-footer']}>
          <div
            className={styles['sidebar-user']}
            onClick={() => { navigate('/app/profile'); setOpen(false); }}
            style={{ cursor: 'pointer' }}
          >
            <div className={styles['sidebar-avatar']}>
              {getInitials(user?.full_name)}
            </div>
            <div className={styles['sidebar-user-info']}>
              <div className={styles['sidebar-user-name']}>{user?.full_name || user?.username}</div>
              <div className={styles['sidebar-user-role']}>{user?.role}</div>
            </div>
          </div>
          <button className={styles['sidebar-logout']} onClick={handleLogout}>
            <span className="sidebar-icon">{icons.logout}</span>
            <span className={styles['link-text']}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
