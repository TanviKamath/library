import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import styles from './AdminPanel.module.css';
import AdminTable from '../../components/AdminTable/AdminTable';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ── Shared CSV Utilities ── */
function downloadCSV(filename, headers, rows) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => {
      const escaped = String(val ?? '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadTemplate(filename, headers, sampleRow) {
  downloadCSV(filename, headers, [sampleRow]);
}

function CustomBarDropdown({ value, onChange, options = [], showFunnel = true, placeholder = "Select...", fullWidth = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find(o => String(o.value) === String(value)) || (safeOptions.length > 0 && !placeholder ? safeOptions[0] : null);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', userSelect: 'none', width: fullWidth ? '100%' : 'auto' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: isOpen ? 'var(--color-parchment-bg, #fdfbfa)' : '#ffffff',
          border: '1px solid var(--color-parchment-border, #e5ded8)',
          borderRadius: 'var(--radius-md, 10px)',
          padding: fullWidth ? '8px 14px' : '6px 14px',
          boxShadow: isOpen ? '0 0 0 3px rgba(200, 109, 81, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
          cursor: 'pointer',
          minHeight: fullWidth ? '44px' : '38px',
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          {showFunnel && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" title="Sort / Filter Order" style={{ flexShrink: 0 }}>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          )}
          <span style={{ fontSize: '13.5px', fontWeight: selectedOption ? 600 : 400, color: selectedOption ? 'var(--color-espresso, #2d2420)' : 'var(--color-charcoal-light, #8c827a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'var(--color-charcoal-light, #8c827a)', flexShrink: 0, marginLeft: '4px' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: fullWidth ? 0 : 'auto',
            right: 0,
            marginTop: '6px',
            background: '#ffffff',
            border: '1px solid var(--color-divider, #e5ded8)',
            borderRadius: 'var(--radius-md, 12px)',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 1100,
            overflow: 'hidden',
            minWidth: fullWidth ? '100%' : '220px',
            maxHeight: '300px',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <div style={{ overflowY: 'auto', padding: '4px' }}>
            {safeOptions.map(o => {
              const isSelected = String(o.value) === String(value);
              return (
                <div
                  key={o.value}
                  onClick={() => {
                    onChange(o.value);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? 'var(--color-terracotta-bg, #fde8e8)' : 'transparent',
                    color: isSelected ? 'var(--color-terracotta, #c86d51)' : 'var(--color-espresso, #2d2420)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    transition: 'background 0.15s ease',
                    fontWeight: isSelected ? 600 : 500,
                    fontSize: '13.5px',
                    borderBottom: '1px solid rgba(0,0,0,0.03)'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = '#f5f0ec';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>{o.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CSVToolbar({ onExport, onImport, onTemplate, count, label, children, search, onSearchChange, searchPlaceholder = "Search...", sort, onSortChange, sortOptions }) {
  return (
    <>
      <div className={styles.toolbar} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 auto' }}>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)', fontWeight: 600 }}>
            {count} {label}
          </span>

          {onSearchChange && (
            <div style={{ display: 'flex', alignItems: 'center', background: '#ffffff', border: '1px solid var(--color-parchment-border)', borderRadius: 'var(--radius-md)', padding: '6px 14px', minHeight: '38px', minWidth: '220px', flex: '1 1 200px', maxWidth: '300px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
              <svg style={{ marginRight: '8px', flexShrink: 0 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--color-espresso)' }}
              />
              {search && (
                <button
                  onClick={() => onSearchChange('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#888', padding: '0 2px' }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {onSortChange && sortOptions && (
            <CustomBarDropdown
              value={sort}
              onChange={onSortChange}
              options={sortOptions}
              showFunnel={true}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {onTemplate && (
            <button className="btn btn-secondary btn-sm" onClick={onTemplate} title="Download CSV template">
              Get template
            </button>
          )}
          {onImport && (
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center' }} title="Upload CSV to import in bulk">
              Import CSV
              <input type="file" accept=".csv" onChange={onImport} style={{ display: 'none' }} />
            </label>
          )}
          {onExport && (
            <button className="btn btn-secondary btn-sm" onClick={onExport} title="Export data to CSV">
              Export CSV
            </button>
          )}
          {children}
        </div>
      </div>
    </>
  );
}

/* ── Reusable Confirmation Modal (replaces native confirm()) ── */
function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onClose }) {
  return (
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', color: 'var(--color-espresso)' }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', padding: '4px', borderRadius: 'var(--radius-sm)', lineHeight: 1, marginTop: '-2px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p style={{ margin: '0 0 var(--space-6)', fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)', lineHeight: 1.6 }}>{message}</p>
        <div className={styles['modal-actions']} style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            style={danger ? { background: '#dc2626', borderColor: '#dc2626', color: '#fff' } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'transactions';

  function setTab(t) {
    setSearchParams({ tab: t });
  }

  return (
    <div className={styles.admin}>
      <h1>Admin Panel</h1>
      <p>Manage library resources, members, and transactions.</p>

      <div className={styles.tabs}>
        {['transactions', 'books', 'members', 'categories', 'reservations', 'fines', 'logbook', ...(isAdmin ? ['settings'] : [])].map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.active : ''}`} onClick={() => setTab(t)}>
            {t === 'logbook' ? 'Log Book' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'books' && <BooksTab />}
      {tab === 'members' && <MembersTab isAdmin={isAdmin} />}
      {tab === 'categories' && <CategoriesTab isAdmin={isAdmin} />}
      {tab === 'reservations' && <ReservationsTab />}
      {tab === 'fines' && <FinesTab />}
      {tab === 'logbook' && <LogBookTab />}
      {tab === 'settings' && isAdmin && <SettingsTab />}
    </div>
  );
}

/* ═══════════════════════════════════════════
   TRANSACTIONS TAB — Issue / Return
   ═══════════════════════════════════════════ */
function TransactionsTab() {
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Issue form
  const [issueBookId, setIssueBookId] = useState('');
  const [issueUserId, setIssueUserId] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issuing, setIssuing] = useState(false);
  // Ref gate updates synchronously, so it blocks a same-tick double-fire
  // (e.g. touchend + click on mobile) that the async `issuing` state would miss.
  const issuingRef = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [txns, mems, bks] = await Promise.all([
        api.get('/transactions'),
        api.get('/members'),
        api.get('/books?limit=1000'),
      ]);
      setTransactions(Array.isArray(txns) ? txns : []);
      setMembers(Array.isArray(mems) ? mems : []);
      setBooks(bks.books || []);
    } catch { /* Fail gracefully */ }
    setLoading(false);
  }

  async function handleIssue(e) {
    e.preventDefault();
    // Guard against a double submit: the issue request is slow enough that a
    // second click lands while the first is still in flight and wrongly reports
    // "already issued". The ref blocks even a same-tick re-fire.
    if (issuingRef.current) return;
    issuingRef.current = true;
    setIssuing(true);
    setMsg(null);
    try {
      await api.post('/transactions/issue', { book_id: Number(issueBookId), user_id: Number(issueUserId) });
      setMsg({ type: 'success', text: 'Book issued successfully!' });
      setIssueBookId(''); setIssueUserId('');
      setShowIssueModal(false);
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      issuingRef.current = false;
      setIssuing(false);
    }
  }

  async function handleReturn(txnId) {
    setMsg(null);
    try {
      await api.post('/transactions/return', { transaction_id: txnId });
      setMsg({ type: 'success', text: 'Book returned successfully!' });
      loadData();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handlePayFine(txnId) {
    setMsg(null);
    try {
      await api.post(`/fines/${txnId}/pay`);
      setMsg({ type: 'success', text: 'Fine collected and recorded successfully!' });
      loadData();
    } catch (err) { setMsg({ type: 'error', text: err.message || 'Failed to record fine payment.' }); }
  }

  async function handleCollectAndReturn(txnId, fineAmount) {
    setMsg(null);
    try {
      await api.post(`/fines/${txnId}/pay`);
      await api.post('/transactions/return', { transaction_id: txnId });
      setMsg({ type: 'success', text: `Fine of ₹${fineAmount} collected and book returned successfully!` });
      loadData();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to complete collect & return operation.' });
    }
  }

  function getPendingFine(t) {
    if (t.fine_paid) return 0;
    if (t.fine_amount > 0) return t.fine_amount;
    const due = new Date(t.due_date);
    const now = new Date();
    if (t.status === 'overdue' || now > due) {
      const diffTime = now - due;
      const diffDays = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 1;
      return Math.max(1, diffDays) * 10;
    }
    return 0;
  }

  async function handleApproveRenewal(txnId) {
    setMsg(null);
    try {
      await api.post('/transactions/renew/approve', { transaction_id: txnId });
      setMsg({ type: 'success', text: 'Renewal approved (+14 days)!' });
      loadData();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handleRejectRenewal(txnId) {
    setMsg(null);
    try {
      await api.post('/transactions/renew/reject', { transaction_id: txnId });
      setMsg({ type: 'success', text: 'Renewal request rejected.' });
      loadData();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

  function filterAndSort(list) {
    let filtered = list;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t => 
        String(t.id).includes(q) ||
        (t.book_title && t.book_title.toLowerCase().includes(q)) ||
        (t.user_name && t.user_name.toLowerCase().includes(q))
      );
    }
    if (sort === 'overdue') {
      const now = new Date();
      filtered = filtered.filter(t => t.status === 'overdue' || getPendingFine(t) > 0 || new Date(t.due_date) < now);
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'az_book') return (a.book_title || '').localeCompare(b.book_title || '');
      if (sort === 'za_book') return (b.book_title || '').localeCompare(a.book_title || '');
      if (sort === 'az_member') return (a.user_name || '').localeCompare(b.user_name || '');
      if (sort === 'za_member') return (b.user_name || '').localeCompare(a.user_name || '');
      if (sort === 'oldest') return new Date(a.issued_at || 0) - new Date(b.issued_at || 0);
      if (sort === 'overdue') return new Date(a.due_date || 0) - new Date(b.due_date || 0);
      return new Date(b.issued_at || 0) - new Date(a.issued_at || 0); // newest
    });
  }


  const renewalRequests = filterAndSort(transactions.filter(t => t.status === 'renewal_requested'));
  const active = filterAndSort(transactions.filter(t => t.status === 'active' || t.status === 'overdue' || t.status === 'renewal_requested'));

  function handleExportCSV() {
    if (transactions.length === 0) return;
    const headers = ['id', 'book_title', 'user_name', 'type', 'status', 'issued_at', 'due_date', 'returned_at', 'fine_amount', 'fine_paid'];
    const rows = transactions.map(t => [
      t.id, t.book_title || '', t.user_name || '', t.type || '', t.status || '',
      t.issued_at || '', t.due_date || '', t.returned_at || '', t.fine_amount || 0, t.fine_paid ? 'Yes' : 'No'
    ]);
    downloadCSV('transactions_export.csv', headers, rows);
  }

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={transactions.length}
        label="transactions"
        onExport={handleExportCSV}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search book, member, ID..."
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'overdue', label: 'Overdue Only' },
          { value: 'az_book', label: 'Book Title (A–Z)' },
          { value: 'za_book', label: 'Book Title (Z–A)' },
          { value: 'az_member', label: 'Member Name (A–Z)' },
          { value: 'za_member', label: 'Member Name (Z–A)' },
        ]}
      >
        <button className="btn btn-primary btn-sm" onClick={() => setShowIssueModal(true)}>+ Issue book</button>
      </CSVToolbar>

      {/* Pending Renewal Requests */}
      {renewalRequests.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)', background: '#fef3c7', borderRadius: 'var(--radius-lg)', border: '2px solid #f59e0b', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Pending Renewal Requests ({renewalRequests.length})
          </h3>
          <AdminTable
            data={renewalRequests}
            empty="No renewal requests."
            columns={[
              { key: 'book_title', header: 'Book', render: t => <span style={{ fontWeight: 600, color: 'var(--color-espresso)' }}>{t.book_title}</span> },
              { key: 'user_name', header: 'Member' },
              { key: 'due_date', header: 'Original Due', render: t => formatDate(t.due_date) },
              { key: 'actions', header: 'Actions', render: t => (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleApproveRenewal(t.id)}>Accept (+14 days)</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleRejectRenewal(t.id)}>Reject</button>
                </div>
              )},
            ]}
          />
        </div>
      )}

      {/* Active Transactions Table */}
      <h3 style={{ marginBottom: 'var(--space-4)' }}>{sort === 'overdue' ? 'Overdue Transactions' : 'Active Transactions'} ({active.length})</h3>
      <AdminTable
          data={active}
          empty="No active transactions."
          columns={[
            { key: 'book_title', header: 'Book', render: t => <span style={{ fontWeight: 500 }}>{t.book_title}</span> },
            { key: 'user_name', header: 'Member' },
            { key: 'issued_at', header: 'Issued', render: t => formatDate(t.issued_at) },
            { key: 'due_date', header: 'Due', render: t => formatDate(t.due_date) },
            { key: 'status', header: 'Status', render: t => {
              const fine = getPendingFine(t);
              return (
                <span className={`${styles.badge} ${t.status === 'renewal_requested' ? styles['badge-warning'] : t.status === 'overdue' || fine > 0 ? styles['badge-inactive'] : styles['badge-active']}`}>
                  {t.status === 'renewal_requested' ? 'Renewal Req.' : (t.status === 'overdue' || fine > 0 ? 'Overdue' : 'Active')}
                </span>
              );
            }},
            { key: 'fine', header: 'Fine', align: 'center', render: t => {
              const fine = getPendingFine(t);
              return fine > 0
                ? <span style={{ fontWeight: 600, color: '#dc2626', fontSize: 'var(--fs-sm)' }}>₹{fine} (Pending)</span>
                : t.fine_paid && t.fine_amount > 0
                  ? <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Paid(₹{t.fine_amount})</span>
                  : <span style={{ color: 'var(--color-charcoal-light)' }}>—</span>;
            }},
            { key: 'actions', header: 'Actions', render: t => {
              const fine = getPendingFine(t);
              return fine > 0
                ? <button className={styles['action-btn']} onClick={() => handleCollectAndReturn(t.id, fine)} style={{ background: '#d97706', borderColor: '#b45309', color: '#ffffff', minWidth: '130px' }}>Collect ₹ & Return</button>
                : <button className={styles['action-btn']} onClick={() => handleReturn(t.id)}>Return</button>;
            }},
          ]}
        />

      {showIssueModal && (
        <IssueBookModal
          books={books}
          members={members}
          issueBookId={issueBookId}
          setIssueBookId={setIssueBookId}
          issueUserId={issueUserId}
          setIssueUserId={setIssueUserId}
          onSubmit={handleIssue}
          submitting={issuing}
          onClose={() => setShowIssueModal(false)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   BOOKS TAB — CRUD
   ═══════════════════════════════════════════ */
function BooksTab() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState(null);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('az_title');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { loadBooks(); }, []);

  async function loadBooks() {
    setLoading(true);
    try {
      const [bks, cats] = await Promise.all([
        api.get('/books?limit=1000'),
        api.get('/categories'),
      ]);
      setBooks(bks.books || []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch { /* */ }
    setLoading(false);
  }

  async function handleSave(data) {
    setMsg(null);
    try {
      if (editBook) {
        await api.put(`/books/${editBook.id}`, data);
        setMsg({ type: 'success', text: 'Book updated!' });
      } else {
        await api.post('/books', data);
        setMsg({ type: 'success', text: 'Book created!' });
      }
      setShowForm(false); setEditBook(null); loadBooks();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function performDeleteBook(id) {
    setConfirmDelete(null);
    try {
      await api.delete(`/books/${id}`);
      setMsg({ type: 'success', text: 'Book deleted.' });
      loadBooks();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  function handleExportCSV() {
    if (books.length === 0) return;
    const headers = ['title', 'author', 'category', 'isbn', 'description', 'total_copies'];
    const rows = books.map(b => [
      b.title || '', b.author_name || '', b.category_name || '',
      b.isbn || '', b.description || '', b.total_copies ?? 1
    ]);
    downloadCSV('books_export.csv', headers, rows);
  }

  function handleDownloadTemplate() {
    downloadTemplate('books_template.csv',
      ['title', 'author', 'category', 'isbn', 'description', 'total_copies'],
      ['The Great Gatsby', 'F. Scott Fitzgerald', 'Fiction', '9780743273565', 'A story about wealth, love, and the American Dream.', '3']
    );
  }

  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.upload('/books/bulk', formData);
      setMsg({ type: 'success', text: res.message || 'Successfully imported books!' });
      loadBooks();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to import CSV file.' });
    }
    e.target.value = '';
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

  function filterAndSortBooks() {
    let filtered = books;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(b =>
        String(b.id).includes(q) ||
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.author_name && b.author_name.toLowerCase().includes(q)) ||
        (b.category_name && b.category_name.toLowerCase().includes(q)) ||
        (b.isbn && b.isbn.toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'az_title') return (a.title || '').localeCompare(b.title || '');
      if (sort === 'za_title') return (b.title || '').localeCompare(a.title || '');
      if (sort === 'az_author') return (a.author_name || '').localeCompare(b.author_name || '');
      if (sort === 'za_author') return (b.author_name || '').localeCompare(a.author_name || '');
      if (sort === 'rating_high') return (b.rating || 0) - (a.rating || 0);
      if (sort === 'rating_low') return (a.rating || 0) - (b.rating || 0);
      return 0;
    });
  }

  const displayedBooks = filterAndSortBooks();

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={displayedBooks.length}
        label="books"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search book title, author, ISBN..."
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'az_title', label: 'Title (A-Z)' },
          { value: 'za_title', label: 'Title (Z-A)' },
          { value: 'az_author', label: 'Author (A-Z)' },
          { value: 'za_author', label: 'Author (Z-A)' },
          { value: 'rating_high', label: 'Highest Rating' },
          { value: 'rating_low', label: 'Lowest Rating' },
        ]}
      >
        <button className="btn btn-primary btn-sm" onClick={() => { setEditBook(null); setShowForm(true); }}>
          + Add book
        </button>
      </CSVToolbar>

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Book Catalog ({displayedBooks.length})</h3>
      <AdminTable
        data={displayedBooks}
        empty="No books found."
        columns={[
          { key: 'title', header: 'Title', render: b => <span style={{ fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{b.title}</span> },
          { key: 'author_name', header: 'Author' },
          { key: 'category_name', header: 'Category' },
          { key: 'copies', header: 'Copies', render: b => `${b.available_copies}/${b.total_copies}` },
          { key: 'rating', header: 'Rating', render: b => b.rating > 0 ? Number(b.rating).toFixed(1) : '—' },
          { key: 'actions', header: 'Actions', render: b => (
            <>
              <button className={styles['icon-btn']} onClick={() => { setEditBook(b); setShowForm(true); }} title="Edit book" aria-label="Edit book">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button className={`${styles['icon-btn']} ${styles['icon-btn-danger']}`} onClick={() => setConfirmDelete(b)} title="Delete book" aria-label="Delete book">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </>
          )},
        ]}
      />

      {showForm && (
        <BookFormModal
          book={editBook}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditBook(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete book?"
          message={`"${confirmDelete.title}" will be permanently removed from the catalog. This action cannot be undone.`}
          confirmLabel="Delete book"
          danger
          onConfirm={() => performDeleteBook(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

function BookFormModal({ book, categories, onSave, onClose }) {
  const [title, setTitle] = useState(book?.title || '');
  const [isbn, setIsbn] = useState(book?.isbn || '');
  const [authorName, setAuthorName] = useState(book?.author_name || '');
  const [categoryId, setCategoryId] = useState(book?.category_id || '');
  const [description, setDescription] = useState(book?.description || '');
  const [totalCopies, setTotalCopies] = useState(book?.total_copies || 1);
  const [coverUrl, setCoverUrl] = useState(book?.cover_image_url || '');
  const [quoteText, setQuoteText] = useState(book?.quote_text || '');
  const [quoteSource, setQuoteSource] = useState(book?.quote_source || '');
  const [quoteVerified, setQuoteVerified] = useState(book?.quote_verified || false);

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      title, isbn, author_name: authorName,
      category_id: Number(categoryId), description,
      total_copies: Number(totalCopies),
      cover_image_url: coverUrl || null,
      quote_text: quoteText.trim() || null,
      quote_source: quoteSource.trim() || null,
      quote_verified: quoteVerified,
    });
  }

  return (
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>{book ? 'Edit Book' : 'Add New Book'}</h2>
        <form className={styles['modal-form']} onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="book-title" className="form-label">Title</label>
            <input id="book-title" className="input" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="book-author" className="form-label">Author</label>
            <input id="book-author" className="input" value={authorName} onChange={e => setAuthorName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="book-isbn" className="form-label">ISBN</label>
            <input id="book-isbn" className="input" value={isbn} onChange={e => setIsbn(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="book-category" className="form-label">Category</label>
            <CustomBarDropdown
              value={categoryId}
              onChange={setCategoryId}
              options={categories.map(c => ({ value: c.id, label: c.name }))}
              showFunnel={false}
              placeholder="Select category…"
              fullWidth={true}
            />
          </div>
          <div className="form-group">
            <label htmlFor="book-copies" className="form-label">Total Copies</label>
            <input id="book-copies" type="number" className="input" value={totalCopies} onChange={e => setTotalCopies(e.target.value)} min={0} />
          </div>
          <div className="form-group">
            <label htmlFor="book-cover" className="form-label">Cover Image URL</label>
            <input id="book-cover" className="input" value={coverUrl} onChange={e => setCoverUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="form-group">
            <label htmlFor="book-desc" className="form-label">Description</label>
            <textarea id="book-desc" className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-group">
            <label htmlFor="book-quote" className="form-label">Spotlight Quote <span style={{ fontWeight: 400, opacity: 0.7 }}>(shown on the dashboard when this book is spotlighted)</span></label>
            <textarea id="book-quote" className="input" rows={2} maxLength={240} value={quoteText} onChange={e => setQuoteText(e.target.value)} placeholder="A short 1–2 sentence pull-quote from the book…" style={{ resize: 'vertical' }} />
            <small style={{ opacity: 0.6 }}>{quoteText.length}/240</small>
          </div>
          <div className="form-group">
            <label htmlFor="book-quote-source" className="form-label">Quote Source <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional, e.g. "Ch. 3")</span></label>
            <input id="book-quote-source" className="input" maxLength={80} value={quoteSource} onChange={e => setQuoteSource(e.target.value)} placeholder="Ch. 3" />
          </div>
          <div className="form-group">
            <label htmlFor="book-quote-verified" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input id="book-quote-verified" type="checkbox" checked={quoteVerified} onChange={e => setQuoteVerified(e.target.checked)} />
              <span>Quote verified — accurate and correctly attributed</span>
            </label>
          </div>
          <div className={styles['modal-actions']}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{book ? 'Save changes' : 'Create book'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MEMBERS TAB
   ═══════════════════════════════════════════ */
function MembersTab({ isAdmin }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('az_name');

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setLoading(true);
    try { const data = await api.get('/members'); setMembers(Array.isArray(data) ? data : []); }
    catch { /* */ }
    setLoading(false);
  }

  async function handleSave(data) {
    setMsg(null);
    try {
      if (editMember) {
        await api.put(`/members/${editMember.id}`, data);
        setMsg({ type: 'success', text: 'Member updated!' });
      } else {
        await api.post('/members', data);
        setMsg({ type: 'success', text: 'Member created!' });
      }
      setShowForm(false); setEditMember(null); loadMembers();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function performDeactivate(id) {
    setConfirmDeactivate(null);
    try { await api.delete(`/members/${id}`); setMsg({ type: 'success', text: 'Member deactivated.' }); loadMembers(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handleRenewMembership(id) {
    try { await api.post(`/members/${id}/renew`); setMsg({ type: 'success', text: 'Membership renewed!' }); loadMembers(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

  function handleExportCSV() {
    if (members.length === 0) return;
    const headers = ['full_name', 'email', 'role', 'membership_status', 'membership_expires_at'];
    const rows = members.map(m => [
      m.full_name || '', m.email || '', m.role || '',
      m.membership_status || '', m.membership_expires_at || ''
    ]);
    downloadCSV('members_export.csv', headers, rows);
  }

  function handleDownloadTemplate() {
    downloadTemplate('members_template.csv',
      ['full_name', 'email', 'password', 'role'],
      ['John Doe', 'jdoe@example.com', 'password123', 'member']
    );
  }

  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.upload('/members/bulk', formData);
      setMsg({ type: 'success', text: res.message || 'Successfully imported members!' });
      loadMembers();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to import CSV file.' });
    }
    e.target.value = '';
  }

  function filterAndSortMembers() {
    let filtered = members;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(m =>
        String(m.id).includes(q) ||
        (m.full_name && m.full_name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.role && m.role.toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'az_name') return (a.full_name || '').localeCompare(b.full_name || '');
      if (sort === 'za_name') return (b.full_name || '').localeCompare(a.full_name || '');
      return 0;
    });
  }

  const displayedMembers = filterAndSortMembers();

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={displayedMembers.length}
        label="members"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search member name, email..."
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'az_name', label: 'Name (A-Z)' },
          { value: 'za_name', label: 'Name (Z-A)' },
        ]}
      >
        <button className="btn btn-primary btn-sm" onClick={() => { setEditMember(null); setShowForm(true); }}>+ Add member</button>
      </CSVToolbar>

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Registered Members ({displayedMembers.length})</h3>
      <AdminTable
        data={displayedMembers}
        empty="No members found."
        columns={[
          { key: 'full_name', header: 'Name', render: m => <span style={{ fontWeight: 500 }}>{m.full_name}</span> },
          { key: 'email', header: 'Email' },
          { key: 'role', header: 'Role', render: m => <span className={`${styles.badge} ${styles[`badge-${m.role}`]}`}>{m.role}</span> },
          { key: 'membership_status', header: 'Status', render: m => <span className={`${styles.badge} ${m.membership_status === 'active' ? styles['badge-active'] : styles['badge-inactive']}`}>{m.membership_status}</span> },
          { key: 'membership_expires_at', header: 'Expires', render: m => formatDate(m.membership_expires_at) },
          { key: 'actions', header: 'Actions', render: m => (
            <>
              <button className={styles['icon-btn']} onClick={() => { setEditMember(m); setShowForm(true); }} title="Edit member" aria-label="Edit member">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button className={styles['icon-btn']} onClick={() => handleRenewMembership(m.id)} title="Renew membership" aria-label="Renew membership">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
              {isAdmin && (
                <button className={`${styles['icon-btn']} ${styles['icon-btn-danger']}`} onClick={() => setConfirmDeactivate(m)} title="Deactivate member" aria-label="Deactivate member">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                </button>
              )}
            </>
          )},
        ]}
      />

      {showForm && (
        <MemberFormModal
          member={editMember}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditMember(null); }}
        />
      )}

      {confirmDeactivate && (
        <ConfirmModal
          title="Deactivate member?"
          message={`${confirmDeactivate.full_name} will lose access to their account until reactivated. You can renew their membership later.`}
          confirmLabel="Deactivate"
          danger
          onConfirm={() => performDeactivate(confirmDeactivate.id)}
          onClose={() => setConfirmDeactivate(null)}
        />
      )}
    </>
  );
}

function MemberFormModal({ member, onSave, onClose }) {
  const isEdit = !!member;
  const [email, setEmail] = useState(member?.email || '');
  const [fullName, setFullName] = useState(member?.full_name || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(member?.role || 'member');
  const [status, setStatus] = useState(member?.membership_status || 'active');

  function handleSubmit(e) {
    e.preventDefault();
    if (isEdit) {
      onSave({ email, full_name: fullName, role, membership_status: status });
    } else {
      onSave({ email, full_name: fullName, password, role });
    }
  }

  const req = <span style={{ color: '#dc2626', marginLeft: '2px' }} aria-hidden="true">*</span>;

  return (
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--fs-xl)', color: 'var(--color-espresso)' }}>{isEdit ? 'Edit Member' : 'Add New Member'}</h2>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--color-charcoal-light)' }}>
              Fields marked <span style={{ color: '#dc2626' }}>*</span> are required
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-charcoal-light)', padding: '4px', borderRadius: 'var(--radius-sm)', lineHeight: 1, marginTop: '-2px' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--color-divider)', margin: 'var(--space-4) 0' }} />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Full Name */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="mem-name" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: 'var(--space-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-espresso)' }}>
              Full Name{req}
            </label>
            <input
              id="mem-name"
              className="input"
              placeholder="e.g. Jane Doe"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Email row */}
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="mem-email" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: 'var(--space-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-espresso)' }}>
              Email{req}
            </label>
            <input
              id="mem-email"
              type="email"
              className="input"
              placeholder="e.g. jane@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password / Status + Role row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {isEdit ? (
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="mem-status" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: 'var(--space-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-espresso)' }}>
                  Status{req}
                </label>
                <CustomBarDropdown
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' }
                  ]}
                  showFunnel={false}
                  fullWidth={true}
                />
              </div>
            ) : (
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="mem-pass" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: 'var(--space-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-espresso)' }}>
                  Password{req}
                </label>
                <input
                  id="mem-pass"
                  type="password"
                  className="input"
                  placeholder="Min. 4 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
            )}
            <div className="form-group" style={{ flex: '1 1 140px' }}>
              <label htmlFor="mem-role" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: 'var(--space-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-espresso)' }}>
                Role{req}
              </label>
              <CustomBarDropdown
                value={role}
                onChange={setRole}
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'librarian', label: 'Librarian' },
                  { value: 'admin', label: 'Admin' }
                ]}
                showFunnel={false}
                fullWidth={true}
              />
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--color-divider)', margin: 'var(--space-2) 0 0' }} />

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save changes' : 'Create member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SearchableDropdown({ label, options, value, onChange, placeholder, renderOption, searchPlaceholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];
  const selectedOption = safeOptions.find(o => o && o.id !== undefined && o.id !== null && String(o.id) === String(value || ''));

  const filteredOptions = safeOptions.filter(o => {
    if (!o) return false;
    if (!query || !query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      (o.title && String(o.title).toLowerCase().includes(q)) ||
      (o.author && String(o.author).toLowerCase().includes(q)) ||
      (o.full_name && String(o.full_name).toLowerCase().includes(q)) ||
      (o.email && String(o.email).toLowerCase().includes(q))
    );
  });

  return (
    <div className="form-group" ref={dropdownRef} style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
      <label className="form-label">{label}</label>
      
      <div
        className="input"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setQuery('');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: isOpen ? 'var(--color-parchment-bg, #fdfbfa)' : 'var(--color-white, #ffffff)',
          borderColor: isOpen ? 'var(--color-terracotta, #c86d51)' : 'var(--color-divider, #e5ded8)',
          boxShadow: isOpen ? '0 0 0 3px rgba(200, 109, 81, 0.15)' : 'none',
          userSelect: 'none',
          minHeight: '44px',
          padding: '8px 14px'
        }}
      >
        <span style={{ color: selectedOption ? 'var(--color-espresso, #2d2420)' : 'var(--color-charcoal-light, #8c827a)', fontWeight: selectedOption ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px', flex: 1 }}>
          {selectedOption ? (renderOption ? renderOption(selectedOption, true) : (selectedOption.title || selectedOption.full_name || 'Selected')) : placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {selectedOption && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              style={{ color: '#9ca3af', cursor: 'pointer', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', borderRadius: '50%', fontSize: '14px', transition: 'color 0.15s' }}
              title="Clear selection"
              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
              onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
            >
              ✕
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: 'var(--color-charcoal-light)' }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '6px',
            background: '#ffffff',
            border: '1px solid var(--color-divider, #e5ded8)',
            borderRadius: 'var(--radius-md, 10px)',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 1100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '260px',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-divider, #e5ded8)', background: '#faf8f5', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8c827a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder || "Search..."}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '13.5px',
                color: 'var(--color-espresso, #2d2420)'
              }}
            />
            {query && (
              <span onClick={() => setQuery('')} style={{ cursor: 'pointer', color: '#9ca3af', fontSize: '13px' }}>✕</span>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8c827a', fontSize: '13.5px' }}>
                No matches found.
              </div>
            ) : (
              filteredOptions.map(o => {
                const isSelected = String(o.id) === String(value);
                const isDisabled = o.available_copies !== undefined && o.available_copies <= 0;
                return (
                  <div
                    key={o.id}
                    onClick={() => {
                      if (isDisabled) return;
                      onChange(o.id);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      background: isSelected ? 'var(--color-terracotta-bg, #fde8e8)' : 'transparent',
                      color: isDisabled ? '#9ca3af' : isSelected ? 'var(--color-terracotta, #c86d51)' : 'var(--color-espresso, #2d2420)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      transition: 'background 0.15s ease',
                      opacity: isDisabled ? 0.6 : 1,
                      borderBottom: '1px solid rgba(0,0,0,0.03)'
                    }}
                    onMouseEnter={e => {
                      if (!isDisabled && !isSelected) e.currentTarget.style.background = '#f5f0ec';
                    }}
                    onMouseLeave={e => {
                      if (!isDisabled && !isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {renderOption ? renderOption(o, false) : (
                      <span>{o.title || o.full_name || 'Option'}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function IssueBookModal({ books, members, issueBookId, setIssueBookId, issueUserId, setIssueUserId, onSubmit, submitting = false, onClose }) {
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    if (!issueBookId) {
      setError('Please select a book to issue.');
      return;
    }
    if (!issueUserId) {
      setError('Please select a member.');
      return;
    }
    setError(null);
    onSubmit(e);
  }

  return (
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ overflow: 'visible', maxWidth: '560px' }}>
        <h2>Issue a Book</h2>
        {error && (
          <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '13.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #f87171' }}>
            <span>⚠️</span> <span>{error}</span>
          </div>
        )}
        <form className={styles['modal-form']} onSubmit={handleSubmit} style={{ overflow: 'visible' }}>
          <SearchableDropdown
            label="Book"
            placeholder="Select a book…"
            searchPlaceholder="Search by book title or author…"
            options={books}
            value={issueBookId}
            onChange={setIssueBookId}
            renderOption={(b, isSelectedTrigger) => !b ? null : isSelectedTrigger ? (
              <span>{b.title || 'Untitled Book'} <strong style={{ color: '#16a34a', fontWeight: 600 }}>({b.available_copies ?? 0} available)</strong></span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', width: '100%', gap: '8px' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title || 'Untitled Book'}</div>
                  {b.author && <div style={{ fontSize: '11.5px', color: '#8c827a' }}>by {b.author}</div>}
                </div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  flexShrink: 0,
                  background: (b.available_copies ?? 0) > 0 ? '#dcfce7' : '#fee2e2',
                  color: (b.available_copies ?? 0) > 0 ? '#166534' : '#991b1b'
                }}>
                  {(b.available_copies ?? 0) > 0 ? `${b.available_copies} available` : 'Out of stock'}
                </span>
              </div>
            )}
          />

          <SearchableDropdown
            label="Member"
            placeholder="Select a member…"
            searchPlaceholder="Search by member name or email…"
            options={members}
            value={issueUserId}
            onChange={setIssueUserId}
            renderOption={(m, isSelectedTrigger) => !m ? null : isSelectedTrigger ? (
              <span>{m.full_name || 'Member'}</span>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justify: 'space-between', width: '100%', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-terracotta, #c86d51)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                    {(m.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: '13.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name || 'Unnamed Member'}</div>
                    <div style={{ fontSize: '11.5px', color: '#8c827a' }}>{m.email || ''}</div>
                  </div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', padding: '2px 8px', borderRadius: '12px', background: '#f0fdf4', color: '#166534', flexShrink: 0 }}>
                  {m.role || 'member'}
                </span>
              </div>
            )}
          />

          <div className={styles['modal-actions']} style={{ marginTop: 'var(--space-2)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Issuing…' : 'Issue book'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryFormModal({ category, onSave, onClose }) {
  const isEdit = !!category;
  const [name, setName] = useState(category?.name || '');

  function handleSubmit(e) {
    e.preventDefault();
    onSave(name);
  }

  return (
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit Category' : 'Add New Category'}</h2>
        <form className={styles['modal-form']} onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="modal-cat-name" className="form-label">Category Name</label>
            <input id="modal-cat-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Science Fiction…" required autoFocus />
          </div>
          <div className={styles['modal-actions']}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEdit ? 'Save changes' : 'Add category'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CATEGORIES TAB
   ═══════════════════════════════════════════ */
function CategoriesTab({ isAdmin }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('az_name');
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { loadCats(); }, []);

  function handleExportCSV() {
    if (categories.length === 0) return;
    const headers = ['id', 'name', 'color', 'book_count'];
    const rows = categories.map(c => [c.id, c.name || '', c.color || '', c.book_count || 0]);
    downloadCSV('categories_export.csv', headers, rows);
  }

  function handleDownloadTemplate() {
    downloadTemplate('categories_template.csv', ['name', 'color'], ['Science Fiction', '#3B82F6']);
  }

  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.upload('/categories/bulk', formData);
      setMsg({ type: 'success', text: res.message || 'Successfully imported categories!' });
      loadCats();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to import CSV file.' });
    }
    e.target.value = '';
  }

  async function loadCats() {
    setLoading(true);
    try { const data = await api.get('/categories'); setCategories(Array.isArray(data) ? data : []); }
    catch { /* */ }
    setLoading(false);
  }

  async function handleSaveCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      if (editCategory) {
        await api.put(`/categories/${editCategory.id}`, { name: trimmed });
        setMsg({ type: 'success', text: 'Category updated!' });
      } else {
        await api.post('/categories', { name: trimmed });
        setMsg({ type: 'success', text: 'Category created!' });
      }
      setShowForm(false); setEditCategory(null); loadCats();
    } catch (err) { setMsg({ type: 'error', text: err.message || 'Failed to save category.' }); }
  }

  async function performDeleteCategory(id) {
    setConfirmDelete(null);
    try { await api.delete(`/categories/${id}`); setMsg({ type: 'success', text: 'Category deleted.' }); loadCats(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

  function filterAndSortCategories() {
    let filtered = categories;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(c =>
        String(c.id).includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'az_name') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'za_name') return (b.name || '').localeCompare(a.name || '');
      if (sort === 'books_high') return (b.book_count || 0) - (a.book_count || 0);
      if (sort === 'books_low') return (a.book_count || 0) - (b.book_count || 0);
      return 0;
    });
  }

  const displayedCategories = filterAndSortCategories();

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={displayedCategories.length}
        label="categories"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search category name..."
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'az_name', label: 'Name (A-Z)' },
          { value: 'za_name', label: 'Name (Z-A)' },
          { value: 'books_high', label: 'Most Books' },
          { value: 'books_low', label: 'Fewest Books' },
        ]}
      >
        <button className="btn btn-primary btn-sm" onClick={() => { setEditCategory(null); setShowForm(true); }}>+ Add category</button>
      </CSVToolbar>

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Book Categories ({displayedCategories.length})</h3>
      <AdminTable
        data={displayedCategories}
        empty="No categories found."
        columns={[
          { key: 'name', header: 'Name', render: c => <span style={{ fontWeight: 500 }}>{c.name}</span> },
          { key: 'book_count', header: 'Books', render: c => c.book_count || 0 },
          { key: 'actions', header: 'Actions', render: c => (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button className={styles['icon-btn']} onClick={() => { setEditCategory(c); setShowForm(true); }} title="Edit category" aria-label="Edit category">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              {isAdmin && (
                <button className={`${styles['icon-btn']} ${styles['icon-btn-danger']}`} onClick={() => setConfirmDelete(c)} title="Delete category" aria-label="Delete category">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              )}
            </div>
          )},
        ]}
      />

      {showForm && (
        <CategoryFormModal
          category={editCategory}
          onSave={handleSaveCategory}
          onClose={() => { setShowForm(false); setEditCategory(null); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete category?"
          message={`"${confirmDelete.name}" will be removed.${confirmDelete.book_count ? ` It currently has ${confirmDelete.book_count} book(s).` : ''} This action cannot be undone.`}
          confirmLabel="Delete category"
          danger
          onConfirm={() => performDeleteCategory(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   RESERVATIONS TAB
   ═══════════════════════════════════════════ */
function ReservationsTab() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [issuingId, setIssuingId] = useState(null);
  const issuingRef = useRef(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/reservations');
      setReservations(Array.isArray(data) ? data : []);
    } catch { /* */ }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleIssueBook(res) {
    // Guard against a double click while the (slow) issue request is in flight,
    // which would otherwise report "already issued" for the duplicate. The ref
    // blocks even a same-tick re-fire that the async state would miss.
    if (issuingRef.current) return;
    issuingRef.current = true;
    setIssuingId(res.id);
    setMsg(null);
    try {
      await api.post('/transactions/issue', {
        book_id: res.book_id,
        user_id: res.user_id
      });
      setMsg({ type: 'success', text: `Book "${res.book_title}" successfully issued to ${res.user_name}!` });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to issue book.' });
    } finally {
      issuingRef.current = false;
      setIssuingId(null);
    }
  }

  function handleExportCSV() {
    if (reservations.length === 0) return;
    const headers = ['id', 'book_id', 'book_title', 'user_id', 'user_name', 'status', 'queue_position', 'created_at', 'ready_at'];
    const rows = reservations.map(r => [
      r.id, r.book_id, r.book_title || '', r.user_id, r.user_name || '',
      r.status || '', r.queue_position || '', r.created_at || '', r.ready_at || ''
    ]);
    downloadCSV('reservations_export.csv', headers, rows);
  }

  function handleDownloadTemplate() {
    downloadTemplate('reservations_template.csv',
      ['book_id', 'user_id', 'status'],
      ['1', '3', 'waiting']
    );
  }

  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.upload('/reservations/bulk', formData);
      setMsg({ type: 'success', text: res.message || 'Successfully imported reservations!' });
      load();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to import CSV file.' });
    }
    e.target.value = '';
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

  function filterAndSortRes(list) {
    let filtered = list;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        String(r.id).includes(q) ||
        (r.book_title && r.book_title.toLowerCase().includes(q)) ||
        (r.user_name && r.user_name.toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'az_book') return (a.book_title || '').localeCompare(b.book_title || '');
      if (sort === 'za_book') return (b.book_title || '').localeCompare(a.book_title || '');
      if (sort === 'az_member') return (a.user_name || '').localeCompare(b.user_name || '');
      if (sort === 'za_member') return (b.user_name || '').localeCompare(a.user_name || '');
      if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }

  const activeReservations = filterAndSortRes(reservations.filter(r => r.status === 'waiting' || r.status === 'ready'));
  const pastReservations = filterAndSortRes(reservations.filter(r => r.status === 'fulfilled' || r.status === 'cancelled'));

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={reservations.length}
        label="reservations"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search book, member..."
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'az_book', label: 'Book Title (A-Z)' },
          { value: 'za_book', label: 'Book Title (Z-A)' },
          { value: 'az_member', label: 'Member Name (A-Z)' },
          { value: 'za_member', label: 'Member Name (Z-A)' },
        ]}
      />

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Active Waitlists ({activeReservations.length})</h3>
      <AdminTable
          data={activeReservations}
          empty="No active reservations."
          columns={[
            { key: 'book_title', header: 'Book', render: r => <span style={{ fontWeight: 500 }}>{r.book_title}</span> },
            { key: 'user_name', header: 'Member Name' },
            { key: 'created_at', header: 'Joined Waitlist', render: r => formatDate(r.created_at) },
            { key: 'queue_position', header: 'Queue Position', render: r => r.status === 'waiting'
              ? <span style={{ fontWeight: 600, color: 'var(--color-espresso)' }}>#{r.queue_position} in line</span>
              : <span style={{ color: '#16a34a', fontWeight: 600 }}>Ready for pickup</span>
            },
            { key: 'status', header: 'Status', render: r => (
              <span className={`${styles.badge} ${r.status === 'ready' ? styles['badge-active'] : styles['badge-waiting']}`}>{r.status}</span>
            )},
            { key: 'ready_at', header: 'Ready Since', render: r => r.ready_at ? formatDate(r.ready_at) : '—' },
            { key: 'actions', header: 'Actions', render: r => r.status === 'ready'
              ? <button className="btn btn-primary btn-sm" onClick={() => handleIssueBook(r)} disabled={issuingId !== null}>{issuingId === r.id ? 'Issuing…' : 'Issue book'}</button>
              : <span style={{ color: 'var(--color-charcoal-light)', fontStyle: 'italic', fontSize: '0.85rem' }}>Waiting</span>
            },
          ]}
        />

      {pastReservations.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-espresso-light)' }}>Reservation History</h3>
          <AdminTable
            data={pastReservations.slice(0, 20)}
            empty="No reservation history."
            columns={[
              { key: 'book_title', header: 'Book' },
              { key: 'user_name', header: 'Member Name' },
              { key: 'created_at', header: 'Joined Waitlist', render: r => formatDate(r.created_at) },
              { key: 'status', header: 'Status', render: r => (
                <span className={`${styles.badge} ${r.status === 'fulfilled' ? styles['badge-active'] : styles['badge-inactive']}`}>{r.status}</span>
              )},
            ]}
          />
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   FINES TAB
   ═══════════════════════════════════════════ */
function FinesTab() {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('highest');

  useEffect(() => {
    loadFines();
  }, []);

  async function loadFines() {
    setLoading(true);
    try {
      const data = await api.get('/fines/pending');
      setFines(Array.isArray(data) ? data : []);
    } catch { /* */ }
    setLoading(false);
  }

  async function handlePayFine(txnId) {
    setMsg(null);
    try {
      await api.post(`/fines/${txnId}/pay`);
      setMsg({ type: 'success', text: 'Fine marked as paid successfully!' });
      loadFines();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  async function handleSaveAmount(txnId) {
    const val = parseFloat(editAmount);
    if (isNaN(val) || val < 0) {
      setMsg({ type: 'error', text: 'Please enter a valid amount.' });
      return;
    }
    try {
      await api.patch(`/fines/${txnId}/amount`, { fine_amount: val });
      setMsg({ type: 'success', text: 'Fine amount updated.' });
      setEditingId(null);
      loadFines();
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

  function filterAndSortFines() {
    let filtered = fines;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(f =>
        String(f.id).includes(q) ||
        (f.book_title && f.book_title.toLowerCase().includes(q)) ||
        (f.user_name && f.user_name.toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'az_book') return (a.book_title || '').localeCompare(b.book_title || '');
      if (sort === 'za_book') return (b.book_title || '').localeCompare(a.book_title || '');
      if (sort === 'az_member') return (a.user_name || '').localeCompare(b.user_name || '');
      if (sort === 'za_member') return (b.user_name || '').localeCompare(a.user_name || '');
      if (sort === 'lowest') return (a.fine_amount || 0) - (b.fine_amount || 0);
      return (b.fine_amount || 0) - (a.fine_amount || 0); // highest
    });
  }

  const displayedFines = filterAndSortFines();

  function handleExportCSV() {
    if (fines.length === 0) return;
    const headers = ['txn_id', 'book_title', 'member_name', 'due_date', 'returned_at', 'fine_amount'];
    const rows = fines.map(f => [
      f.id, f.book_title || '', f.user_name || '',
      f.due_date || '', f.returned_at || '', f.fine_amount || 0
    ]);
    downloadCSV('fines_export.csv', headers, rows);
  }

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={displayedFines.length}
        label="pending fines"
        onExport={handleExportCSV}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search member, book..."
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'highest', label: 'Highest Fine' },
          { value: 'lowest', label: 'Lowest Fine' },
          { value: 'az_book', label: 'Book Title (A-Z)' },
          { value: 'za_book', label: 'Book Title (Z-A)' },
          { value: 'az_member', label: 'Member Name (A-Z)' },
          { value: 'za_member', label: 'Member Name (Z-A)' },
        ]}
      />

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Pending Fines ({displayedFines.length})</h3>
      {displayedFines.length === 0 ? (
        <div className={styles['empty-state']}><p>No pending fines found.</p></div>
      ) : (
        <table className={styles['data-table']}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Book</th>
              <th>Member Name</th>
              <th>Due Date</th>
              <th>Returned Date</th>
              <th>Fine Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedFines.map((f, i) => (
              <tr key={f.id}>
                <td style={{ color: 'var(--color-charcoal-light)', width: 40 }}>{i + 1}</td>
                <td style={{ fontWeight: 500 }}>{f.book_title}</td>
                <td>{f.user_name}</td>
                <td>{formatDate(f.due_date)}</td>
                <td>{formatDate(f.returned_at)}</td>
                <td>
                  {editingId === f.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className={styles['fine-input']}
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveAmount(f.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                    </div>
                  ) : (
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>₹{f.fine_amount}</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {editingId === f.id ? (
                      <>
                        <button
                          className={styles['icon-btn']}
                          onClick={() => handleSaveAmount(f.id)}
                          title="Save amount"
                          aria-label="Save fine amount"
                          style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                        <button
                          className={styles['icon-btn']}
                          onClick={() => setEditingId(null)}
                          title="Cancel"
                          aria-label="Cancel edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        className={styles['icon-btn']}
                        onClick={() => { setEditingId(f.id); setEditAmount(String(f.fine_amount)); }}
                        title="Edit fine amount"
                        aria-label="Edit fine amount"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => handlePayFine(f.id)}>
                      Mark as Paid
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   LOG BOOK TAB — Activity Log Timeline
   ═══════════════════════════════════════════ */
function LogBookTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');

  async function loadLogs(p) {
    setLoading(true);
    try {
      const data = await api.get(`/activity-logs?page=${p}&limit=20`);
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch { /* */ }
    setLoading(false);
  }

  useEffect(() => {
    loadLogs(page);
  }, [page]);

  function handleExportCSV() {
    if (logs.length === 0) return;
    const headers = ['id', 'user_name', 'action', 'details', 'created_at'];
    const rows = logs.map(l => [
      l.id,
      l.user_name || '',
      getActionLabel(l.action),
      l.details || '',
      formatDateTime(l.created_at)
    ]);
    downloadCSV('activity_log_export.csv', headers, rows);
  }

  function getActionLabel(action) {
    switch (action) {
      case 'issue': return 'ISS';
      case 'return': return 'RET';
      case 'renew_request': return 'RRQ';
      case 'renew_approve': return 'APR';
      case 'renew_reject': return 'REJ';
      case 'reserve_join': return 'RSV';
      case 'reserve_ready': return 'RDY';
      case 'reserve_cancel': return 'CAN';
      case 'fine_pay': return 'FIN';
      case 'bulk_import': return 'IMP';
      default: return 'LOG';
    }
  }

  function formatDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (loading && logs.length === 0) return <div className={styles['empty-state']}><p>Loading Activity Log…</p></div>;

  function filterAndSortLogs() {
    let filtered = logs;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l =>
        String(l.id).includes(q) ||
        (l.user_name && l.user_name.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.details && l.details.toLowerCase().includes(q))
      );
    }
    return [...filtered].sort((a, b) => {
      if (sort === 'az_user') return (a.user_name || '').localeCompare(b.user_name || '');
      if (sort === 'za_user') return (b.user_name || '').localeCompare(a.user_name || '');
      if (sort === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0); // newest
    });
  }

  const displayedLogs = filterAndSortLogs();

  return (
    <>
      <CSVToolbar
        count={displayedLogs.length}
        label="log entries (this page)"
        onExport={handleExportCSV}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search logs, user, details..."
        sort={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
          { value: 'az_user', label: 'User (A-Z)' },
          { value: 'za_user', label: 'User (Z-A)' },
        ]}
      />

      <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-espresso)' }}>System Audit Log ({displayedLogs.length})</h3>

      {displayedLogs.length === 0 ? (
        <div className={styles['empty-state']}><p>No activities recorded in the log book yet.</p></div>
      ) : (
        <table className={styles['data-table']}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {displayedLogs.map((log, i) => (
              <tr key={log.id}>
                <td style={{ color: 'var(--color-charcoal-light)', width: 40 }}>{(page - 1) * 20 + i + 1}</td>
                <td>{log.user_name}</td>
                <td><span className={styles.badge}>{getActionLabel(log.action)}</span></td>
                <td>{log.details}</td>
                <td>{formatDateTime(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div style={{ marginTop: 'var(--space-8)', display: 'flex', justifyContent: 'center', gap: '16px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Previous
          </button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   SETTINGS TAB — Library Configuration
   ═══════════════════════════════════════════ */
function SettingsTab() {
  const [fineRate, setFineRate] = useState('');
  const [savedRate, setSavedRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get('/settings');
        const rate = data.fine_rate_per_day ?? '10';
        setSavedRate(rate);
        setFineRate(rate);
      } catch { /* */ }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    const val = parseFloat(fineRate);
    if (isNaN(val) || val < 0) {
      setMsg({ type: 'error', text: 'Please enter a valid non-negative number.' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await api.put('/settings', { fine_rate_per_day: String(val) });
      setSavedRate(String(val));
      setMsg({ type: 'success', text: `Fine rate updated to ₹${val}/day.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to save settings.' });
    }
    setSaving(false);
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading settings…</p></div>;

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <div style={{ maxWidth: 520 }}>
        <h3 style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--fs-lg)' }}>Library Settings</h3>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)', marginBottom: 'var(--space-6)' }}>
          Configure global library parameters. Changes take effect immediately for all new calculations.
        </p>

        <div style={{ background: 'var(--color-ivory)', border: '1px solid var(--color-divider)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)' }}>
          <h4 style={{ fontSize: 'var(--fs-md)', marginBottom: 'var(--space-1)', color: 'var(--color-espresso)' }}>
            Fine Rate
          </h4>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)', marginBottom: 'var(--space-5)' }}>
            Currently: <strong style={{ color: 'var(--color-espresso)' }}>₹{savedRate} per day</strong> after the due date.
          </p>

          <form onSubmit={handleSave} style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)' }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label htmlFor="fine-rate" className="form-label" style={{ marginBottom: 'var(--space-2)', display: 'block' }}>
                Fine rate (₹ per overdue day)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-charcoal-light)' }}>₹</span>
                <input
                  id="fine-rate"
                  type="number"
                  min="0"
                  step="0.5"
                  className="input"
                  value={fineRate}
                  onChange={e => setFineRate(e.target.value)}
                  style={{ maxWidth: 120 }}
                  required
                />
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)' }}>/ day</span>
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || fineRate === savedRate}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
