import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import styles from './MyBooks.module.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24));
}

export default function MyBooks() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [txns, res] = await Promise.all([
          api.get('/transactions/my'),
          api.get('/reservations/my'),
        ]);
        setTransactions(Array.isArray(txns) ? txns : []);
        setReservations(Array.isArray(res) ? res : []);
      } catch {
        // Fail gracefully
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const active = transactions.filter(t => t.status === 'active' || t.status === 'overdue' || t.status === 'renewal_requested');
  const history = transactions.filter(t => t.status === 'returned' || t.status === 'renewed');

  async function handleRenew(txnId) {
    setMsg(null);
    try {
      const result = await api.post('/transactions/renew/request', { transaction_id: txnId });
      setMsg({ type: 'success', text: result.message || 'Renewal request sent to admin for approval!' });
      // Reload
      const txns = await api.get('/transactions/my');
      setTransactions(Array.isArray(txns) ? txns : []);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function handleCancelReservation(resId) {
    setMsg(null);
    try {
      await api.post('/reservations/cancel', { reservation_id: resId });
      setMsg({ type: 'success', text: 'Reservation cancelled.' });
      const res = await api.get('/reservations/my');
      setReservations(Array.isArray(res) ? res : []);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  if (loading) {
    return <div className={styles['empty-state']}><p>Loading your books…</p></div>;
  }

  return (
    <div className={styles.mybooks}>
      <h1>My Books</h1>
      <p>Manage your borrowed books, renewals, and reservations.</p>

      {msg && (
        <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'active' ? styles.active : ''}`} onClick={() => setTab('active')}>
          Borrowed ({active.length})
        </button>
        <button className={`${styles.tab} ${tab === 'history' ? styles.active : ''}`} onClick={() => setTab('history')}>
          History ({history.length})
        </button>
        <button className={`${styles.tab} ${tab === 'reservations' ? styles.active : ''}`} onClick={() => setTab('reservations')}>
          Reservations ({reservations.length})
        </button>
      </div>

      {/* Borrowed Books */}
      {tab === 'active' && (
        active.length === 0 ? (
          <div className={styles['empty-state']}>
            <h3>No books borrowed right now</h3>
            <p>Explore our catalog and find your next read.</p>
            <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => navigate('/app/browse')}>
              Browse library
            </button>
          </div>
        ) : (
          <div className={styles['table-scroll']}>
          <table className={styles['book-table']}>
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Fine</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {active.map(t => {
                const days = daysUntil(t.due_date);
                let statusClass = styles['badge-active'];
                let statusText = 'Active';
                if (t.status === 'renewal_requested') {
                  statusClass = styles['badge-warning'];
                  statusText = 'Renewal Requested';
                } else if (t.status === 'overdue' || days < 0) {
                  statusClass = styles['badge-overdue'];
                  statusText = 'Overdue';
                } else if (days <= 3) {
                  statusClass = styles['badge-warning'];
                  statusText = `Due in ${days}d`;
                }

                return (
                  <tr key={t.id}>
                    <td className={styles['book-title-cell']} onClick={() => navigate(`/app/browse/${t.book_id}`)}>
                      {t.book_title}
                    </td>
                    <td>{formatDate(t.issued_at)}</td>
                    <td>{formatDate(t.due_date)}</td>
                    <td><span className={`${styles.badge} ${statusClass}`}>{statusText}</span></td>
                    <td>
                      {t.fine_amount > 0 && (
                        <span className={styles['fine-amount']}>₹{t.fine_amount}</span>
                      )}
                    </td>
                    <td>
                      {t.status === 'renewal_requested' ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-terracotta)', fontWeight: 600 }}>⏳ Pending Admin</span>
                      ) : t.type !== 'renew' && t.status === 'active' ? (
                        <button className={styles['action-btn']} onClick={() => handleRenew(t.id)}>
                          Request renewal
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )
      )}

      {/* History */}
      {tab === 'history' && (
        history.length === 0 ? (
          <div className={styles['empty-state']}>
            <h3>No borrowing history</h3>
            <p>Your returned books will appear here.</p>
          </div>
        ) : (
          <div className={styles['table-scroll']}>
          <table className={styles['book-table']}>
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued</th>
                <th>Returned</th>
                <th>Status</th>
                <th>Fine</th>
              </tr>
            </thead>
            <tbody>
              {history.map(t => (
                <tr key={t.id}>
                  <td className={styles['book-title-cell']} onClick={() => navigate(`/app/browse/${t.book_id}`)}>
                    {t.book_title}
                  </td>
                  <td>{formatDate(t.issued_at)}</td>
                  <td>{formatDate(t.returned_at)}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge-${t.status}`]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>
                    {t.fine_amount > 0 && (
                      <span className={styles['fine-amount']}>
                        ₹{t.fine_amount} {t.fine_paid ? '(Paid)' : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
      )}

      {/* Reservations */}
      {tab === 'reservations' && (
        reservations.length === 0 ? (
          <div className={styles['empty-state']}>
            <h3>No active reservations</h3>
            <p>When you join a waitlist for a book, it will appear here.</p>
          </div>
        ) : (
          <div className={styles['table-scroll']}>
          <table className={styles['book-table']}>
            <thead>
              <tr>
                <th>Book</th>
                <th>Status</th>
                <th>Queue Position</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id}>
                  <td className={styles['book-title-cell']} onClick={() => navigate(`/app/browse/${r.book_id}`)}>
                    {r.book_title}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge-${r.status}`]}`}>
                      {r.status === 'ready' ? 'Ready for pickup' : 'Waiting'}
                    </span>
                  </td>
                  <td>{r.queue_position === 0 ? '—' : `#${r.queue_position}`}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>
                    <button className={`${styles['action-btn']} ${styles.cancel}`} onClick={() => handleCancelReservation(r.id)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )
      )}
    </div>
  );
}
