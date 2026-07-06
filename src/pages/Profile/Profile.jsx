import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import styles from './Profile.module.css';
import OverdueStamp from '../../components/OverdueStamp/OverdueStamp';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [pwMode, setPwMode] = useState(false);
  const [msg, setMsg] = useState(null);

  // Stats
  const [borrows, setBorrows] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const txns = await api.get('/transactions/my');
        setBorrows(Array.isArray(txns) ? txns : []);
      } catch (err) {
        console.error('Failed to load user stats:', err);
      } finally {
        setLoadingStats(false);
      }
    }
    loadStats();
  }, []);

  const active = borrows.filter(t => t.status === 'active' || t.status === 'overdue' || t.status === 'renewal_requested');
  const overdueCount = active.filter(t => t.status === 'overdue' || daysUntil(t.due_date) < 0).length;

  // Edit fields
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Password fields
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');

  async function handleSaveProfile(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.put('/auth/me', { full_name: fullName, email });
      await refreshUser();
      setEditMode(false);
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.put('/auth/password', { current_password: currentPw, new_password: newPw });
      setPwMode(false);
      setCurrentPw('');
      setNewPw('');
      setMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <div className={styles.profile}>
      {/* Header */}
      <div className={styles['profile-header']}>
        <div className={styles['profile-avatar']}>
          {getInitials(user?.full_name)}
        </div>
        <div className={styles['profile-header-info']}>
          <h1>{user?.full_name || user?.username}</h1>
          <div className={styles['profile-header-meta']}>
            <span className={styles['role-badge']}>{user?.role}</span>
            {user?.role !== 'admin' && user?.role !== 'librarian' && (
              <span className={styles['member-since']}>Since {formatDate(user?.created_at)}</span>
            )}
          </div>
        </div>
      </div>

      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      {/* Quick Stats Grid */}
      {!loadingStats && user?.role !== 'admin' && user?.role !== 'librarian' && (
        <div className={styles['stats-grid']}>
          <div className={styles['stat-card']}>
            <div className={styles['stat-label']}>Currently Borrowed</div>
            <div className={styles['stat-value']}>{active.length}</div>
          </div>
          <div className={styles['stat-card']} style={{ position: 'relative', overflow: 'hidden' }}>
            <div className={styles['stat-label']}>Overdue</div>
            <div className={styles['stat-value']}>{overdueCount}</div>
            {overdueCount > 0 && <OverdueStamp />}
          </div>
          <div className={styles['stat-card']}>
            <div className={styles['stat-label']}>Total Borrowed</div>
            <div className={styles['stat-value']}>{borrows.length}</div>
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className={styles.section}>
        <h2>Account Information</h2>
        {editMode ? (
          <form className={styles['edit-form']} onSubmit={handleSaveProfile}>
            <div className="form-group">
              <label htmlFor="edit-name" className="form-label">Full Name</label>
              <input id="edit-name" className="input" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-email" className="form-label">Email</label>
              <input id="edit-email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className={styles['edit-form-actions']}>
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditMode(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <div className={styles['info-grid']}>
              <div className={styles['info-item']}>
                <span className={styles['info-label']}>Full Name</span>
                <span className={styles['info-value']}>{user?.full_name || '—'}</span>
              </div>
              <div className={styles['info-item']}>
                <span className={styles['info-label']}>Username</span>
                <span className={styles['info-value']}>{user?.username}</span>
              </div>
              <div className={styles['info-item']}>
                <span className={styles['info-label']}>Email</span>
                <span className={styles['info-value']}>{user?.email}</span>
              </div>
              <div className={styles['info-item']}>
                <span className={styles['info-label']}>Role</span>
                <span className={styles['info-value']} style={{ textTransform: 'capitalize' }}>{user?.role}</span>
              </div>
              {user?.role !== 'admin' && user?.role !== 'librarian' && (
                <>
                  <div className={styles['info-item']}>
                    <span className={styles['info-label']}>Membership Status</span>
                    <span className={styles['info-value']} style={{ textTransform: 'capitalize' }}>{user?.membership_status}</span>
                  </div>
                  <div className={styles['info-item']}>
                    <span className={styles['info-label']}>Membership Expires</span>
                    <span className={styles['info-value']}>{formatDate(user?.membership_expires_at)}</span>
                  </div>
                </>
              )}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={() => setEditMode(true)}>
              Edit Profile
            </button>
          </>
        )}
      </div>

      {/* Change Password */}
      <div className={styles.section}>
        <h2>Security</h2>
        {pwMode ? (
          <form className={styles['edit-form']} onSubmit={handleChangePassword}>
            <div className="form-group">
              <label htmlFor="current-pw" className="form-label">Current Password</label>
              <input id="current-pw" type="password" className="input" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="new-pw" className="form-label">New Password</label>
              <input id="new-pw" type="password" className="input" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={4} />
            </div>
            <div className={styles['edit-form-actions']}>
              <button type="submit" className="btn btn-primary btn-sm">Change Password</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPwMode(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={() => setPwMode(true)}>
            Change Password
          </button>
        )}
      </div>
    </div>
  );
}
