import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import styles from './AdminPanel.module.css';

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

function CSVToolbar({ onExport, onImport, onTemplate, count, label, children }) {
  return (
    <>
      <div className={styles.toolbar} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)', marginRight: 'auto' }}>
          {count} {label}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onTemplate && (
            <button className="btn btn-secondary btn-sm" onClick={onTemplate} title="Download CSV template">
              Get Template
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
        </div>
        {children}
      </div>
    </>
  );
}

export default function AdminPanel() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('transactions');

  return (
    <div className={styles.admin}>
      <h1>Admin Panel</h1>
      <p>Manage library resources, members, and transactions.</p>

      <div className={styles.tabs}>
        {['transactions', 'books', 'members', 'categories', 'reservations', 'fines', 'logbook'].map(t => (
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

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [txns, mems, bks] = await Promise.all([
        api.get('/transactions'),
        api.get('/members'),
        api.get('/books?limit=200'),
      ]);
      setTransactions(Array.isArray(txns) ? txns : []);
      setMembers(Array.isArray(mems) ? mems : []);
      setBooks(bks.books || []);
    } catch { /* Fail gracefully */ }
    setLoading(false);
  }

  async function handleIssue(e) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post('/transactions/issue', { book_id: Number(issueBookId), user_id: Number(issueUserId) });
      setMsg({ type: 'success', text: 'Book issued successfully!' });
      setIssueBookId(''); setIssueUserId('');
      loadData();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
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
    const due = new Date(t.due_date);
    const now = new Date();
    if (now > due) {
      const diffTime = now - due;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays * 10 : 0;
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

  const renewalRequests = transactions.filter(t => t.status === 'renewal_requested');
  const active = transactions.filter(t => t.status === 'active' || t.status === 'overdue' || t.status === 'renewal_requested');

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
      />

      {/* Pending Renewal Requests */}
      {renewalRequests.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)', background: '#fef3c7', borderRadius: 'var(--radius-lg)', border: '2px solid #f59e0b', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Pending Renewal Requests ({renewalRequests.length})
          </h3>
          <table className={styles['data-table']}>
            <thead><tr><th>ID</th><th>Book</th><th>Member</th><th>Original Due</th><th>Actions</th></tr></thead>
            <tbody>
              {renewalRequests.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-espresso)' }}>{t.book_title}</td>
                  <td>{t.user_name}</td>
                  <td>{formatDate(t.due_date)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleApproveRenewal(t.id)}>
                        Accept (+14 Days)
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleRejectRenewal(t.id)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Issue Form */}
      <div style={{ marginBottom: 'var(--space-8)', padding: 'var(--space-6)', background: 'var(--color-ivory)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-divider)' }}>
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Issue a Book</h3>
        <form onSubmit={handleIssue} className={styles['issue-row']}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="issue-book" className="form-label">Book</label>
            <select id="issue-book" className="input" value={issueBookId} onChange={e => setIssueBookId(e.target.value)} required>
              <option value="">Select a book…</option>
              {books.filter(b => b.available_copies > 0).map(b => (
                <option key={b.id} value={b.id}>{b.title} ({b.available_copies} available)</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="issue-member" className="form-label">Member</label>
            <select id="issue-member" className="input" value={issueUserId} onChange={e => setIssueUserId(e.target.value)} required>
              <option value="">Select a member…</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name} ({m.username})</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary">Issue</button>
        </form>
      </div>

      {/* Active Transactions Table */}
      <h3 style={{ marginBottom: 'var(--space-4)' }}>Active Transactions ({active.length})</h3>
      {active.length === 0 ? (
        <div className={styles['empty-state']}><p>No active transactions.</p></div>
      ) : (
        <table className={styles['data-table']}>
          <thead><tr><th>ID</th><th>Book</th><th>Member</th><th>Issued</th><th>Due</th><th>Status</th><th>Fine</th><th>Actions</th></tr></thead>
          <tbody>
            {active.map(t => {
              const fine = getPendingFine(t);
              return (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td style={{ fontWeight: 500 }}>{t.book_title}</td>
                  <td>{t.user_name}</td>
                  <td>{formatDate(t.issued_at)}</td>
                  <td>{formatDate(t.due_date)}</td>
                  <td>
                    <span className={`${styles.badge} ${t.status === 'renewal_requested' ? styles['badge-warning'] : t.status === 'overdue' || fine > 0 ? styles['badge-inactive'] : styles['badge-active']}`}>
                      {t.status === 'renewal_requested' ? 'Renewal Req.' : (t.status === 'overdue' || fine > 0 ? 'overdue' : t.status)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {fine > 0 ? (
                      <span style={{ fontWeight: 600, color: '#dc2626', fontSize: 'var(--fs-sm)' }}>₹{fine} (Pending)</span>
                    ) : t.fine_paid && t.fine_amount > 0 ? (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Paid(₹{t.fine_amount})</span>
                    ) : (
                      <span style={{ color: 'var(--color-charcoal-light)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {fine > 0 ? (
                      <button
                        className={styles['action-btn']}
                        onClick={() => handleCollectAndReturn(t.id, fine)}
                        style={{ background: '#d97706', borderColor: '#b45309', color: '#ffffff', minWidth: '130px' }}
                      >
                        Collect & Return
                      </button>
                    ) : (
                      <button
                        className={styles['action-btn']}
                        onClick={() => handleReturn(t.id)}
                      >
                        Return
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

  useEffect(() => { loadBooks(); }, []);

  async function loadBooks() {
    setLoading(true);
    try {
      const [bks, cats] = await Promise.all([
        api.get('/books?limit=200'),
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

  async function handleDelete(id) {
    if (!confirm('Delete this book?')) return;
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

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={books.length}
        label="books"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
      >
        <button className="btn btn-primary btn-sm" onClick={() => { setEditBook(null); setShowForm(true); }}>
          + Add Book
        </button>
      </CSVToolbar>

      <table className={styles['data-table']}>
        <thead><tr><th>Title</th><th>Author</th><th>Category</th><th>Copies</th><th>Rating</th><th>Actions</th></tr></thead>
        <tbody>
          {books.map(b => (
            <tr key={b.id}>
              <td style={{ fontWeight: 500, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</td>
              <td>{b.author_name}</td>
              <td>{b.category_name}</td>
              <td>{b.available_copies}/{b.total_copies}</td>
              <td>{b.rating > 0 ? Number(b.rating).toFixed(1) : '—'}</td>
              <td>
                <button className={styles['action-btn']} onClick={() => { setEditBook(b); setShowForm(true); }}>Edit</button>
                <button className={`${styles['action-btn']} ${styles.danger}`} onClick={() => handleDelete(b.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <BookFormModal
          book={editBook}
          categories={categories}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditBook(null); }}
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

  function handleSubmit(e) {
    e.preventDefault();
    onSave({
      title, isbn, author_name: authorName,
      category_id: Number(categoryId), description,
      total_copies: Number(totalCopies),
      cover_image_url: coverUrl || null,
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
            <select id="book-category" className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)} required>
              <option value="">Select…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
          <div className={styles['modal-actions']}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{book ? 'Save Changes' : 'Create Book'}</button>
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
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadMembers(); }, []);

  async function loadMembers() {
    setLoading(true);
    try { const data = await api.get('/members'); setMembers(Array.isArray(data) ? data : []); }
    catch { /* */ }
    setLoading(false);
  }

  async function handleCreate(data) {
    setMsg(null);
    try {
      await api.post('/members', data);
      setMsg({ type: 'success', text: 'Member created!' });
      setShowForm(false); loadMembers();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this member?')) return;
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
    const headers = ['username', 'email', 'full_name', 'role', 'membership_status', 'membership_expires_at'];
    const rows = members.map(m => [
      m.username || '', m.email || '', m.full_name || '', m.role || '',
      m.membership_status || '', m.membership_expires_at || ''
    ]);
    downloadCSV('members_export.csv', headers, rows);
  }

  function handleDownloadTemplate() {
    downloadTemplate('members_template.csv',
      ['username', 'email', 'full_name', 'password', 'role'],
      ['jdoe', 'jdoe@example.com', 'John Doe', 'password123', 'member']
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

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={members.length}
        label="members"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
      >
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Member</button>
      </CSVToolbar>

      <table className={styles['data-table']}>
        <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id}>
              <td style={{ fontWeight: 500 }}>{m.full_name}</td>
              <td>{m.username}</td>
              <td>{m.email}</td>
              <td><span className={`${styles.badge} ${styles[`badge-${m.role}`]}`}>{m.role}</span></td>
              <td><span className={`${styles.badge} ${m.membership_status === 'active' ? styles['badge-active'] : styles['badge-inactive']}`}>{m.membership_status}</span></td>
              <td>{formatDate(m.membership_expires_at)}</td>
              <td>
                <button className={styles['action-btn']} onClick={() => handleRenewMembership(m.id)}>Renew</button>
                {isAdmin && (
                  <button className={`${styles['action-btn']} ${styles.danger}`} onClick={() => handleDeactivate(m.id)}>Deactivate</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && <MemberFormModal onSave={handleCreate} onClose={() => setShowForm(false)} />}
    </>
  );
}

function MemberFormModal({ onSave, onClose }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('member');

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ username, email, full_name: fullName, password, role });
  }

  return (
    <div className={styles['modal-overlay']} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h2>Add New Member</h2>
        <form className={styles['modal-form']} onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mem-name" className="form-label">Full Name</label>
            <input id="mem-name" className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="mem-user" className="form-label">Username</label>
            <input id="mem-user" className="input" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="mem-email" className="form-label">Email</label>
            <input id="mem-email" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="mem-pass" className="form-label">Password</label>
            <input id="mem-pass" type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} required minLength={4} />
          </div>
          <div className="form-group">
            <label htmlFor="mem-role" className="form-label">Role</label>
            <select id="mem-role" className="input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="librarian">Librarian</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className={styles['modal-actions']}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Member</button>
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
  const [newName, setNewName] = useState('');

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

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await api.post('/categories', { name: newName.trim() });
      setMsg({ type: 'success', text: 'Category created!' });
      setNewName(''); loadCats();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this category?')) return;
    try { await api.delete(`/categories/${id}`); setMsg({ type: 'success', text: 'Category deleted.' }); loadCats(); }
    catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={categories.length}
        label="categories"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
      />

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-6)', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label htmlFor="new-cat" className="form-label">New Category</label>
          <input id="new-cat" className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Category name…" />
        </div>
        <button type="submit" className="btn btn-primary">Add</button>
      </form>

      <table className={styles['data-table']}>
        <thead><tr><th>ID</th><th>Name</th><th>Books</th><th>Actions</th></tr></thead>
        <tbody>
          {categories.map(c => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td style={{ fontWeight: 500 }}>{c.name}</td>
              <td>{c.book_count || 0}</td>
              <td>
                {isAdmin && (
                  <button className={`${styles['action-btn']} ${styles.danger}`} onClick={() => handleDelete(c.id)}>Delete</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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

  const activeReservations = reservations.filter(r => r.status === 'waiting' || r.status === 'ready');
  const pastReservations = reservations.filter(r => r.status === 'fulfilled' || r.status === 'cancelled');

  return (
    <>
      {msg && <div className={`${styles.msg} ${styles[`msg-${msg.type}`]}`}>{msg.text}</div>}

      <CSVToolbar
        count={reservations.length}
        label="reservations"
        onExport={handleExportCSV}
        onImport={handleImportCSV}
        onTemplate={handleDownloadTemplate}
      />

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Active Waitlists ({activeReservations.length})</h3>
      {activeReservations.length === 0 ? (
        <div className={styles['empty-state']}><p>No active reservations on the waitlist.</p></div>
      ) : (
        <table className={styles['data-table']}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Book</th>
              <th>Member Name</th>
              <th>Joined Waitlist</th>
              <th>Queue Position</th>
              <th>Status</th>
              <th>Ready Since</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeReservations.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td style={{ fontWeight: 500 }}>{r.book_title}</td>
                <td>{r.user_name}</td>
                <td>{formatDate(r.created_at)}</td>
                <td>
                  {r.status === 'waiting' ? (
                    <span style={{ fontWeight: 600, color: 'var(--color-espresso)' }}>
                      #{r.queue_position} in line
                    </span>
                  ) : (
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>Ready for pickup</span>
                  )}
                </td>
                <td>
                  <span className={`${styles.badge} ${r.status === 'ready' ? styles['badge-active'] : styles['badge-waiting']}`}>
                    {r.status}
                  </span>
                </td>
                <td>{r.ready_at ? formatDate(r.ready_at) : '—'}</td>
                <td>
                  {r.status === 'ready' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleIssueBook(r)}
                    >
                      Issue Book
                    </button>
                  ) : (
                    <span style={{ color: 'var(--color-charcoal-light)', fontStyle: 'italic', fontSize: '0.85rem' }}>Waiting</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pastReservations.length > 0 && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-espresso-light)' }}>Reservation History</h3>
          <table className={styles['data-table']}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Book</th>
                <th>Member Name</th>
                <th>Joined Waitlist</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pastReservations.slice(0, 20).map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.book_title}</td>
                  <td>{r.user_name}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>
                    <span className={`${styles.badge} ${r.status === 'fulfilled' ? styles['badge-active'] : styles['badge-inactive']}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

  if (loading) return <div className={styles['empty-state']}><p>Loading…</p></div>;

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
        count={fines.length}
        label="pending fines"
        onExport={handleExportCSV}
      />

      <h3 style={{ marginBottom: 'var(--space-4)' }}>Pending Fines ({fines.length})</h3>
      {fines.length === 0 ? (
        <div className={styles['empty-state']}><p>No pending fines.</p></div>
      ) : (
        <table className={styles['data-table']}>
          <thead>
            <tr>
              <th>Txn ID</th>
              <th>Book</th>
              <th>Member Name</th>
              <th>Due Date</th>
              <th>Returned Date</th>
              <th>Fine Amount</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {fines.map(f => (
              <tr key={f.id}>
                <td>{f.id}</td>
                <td style={{ fontWeight: 500 }}>{f.book_title}</td>
                <td>{f.user_name}</td>
                <td>{formatDate(f.due_date)}</td>
                <td>{formatDate(f.returned_at)}</td>
                <td style={{ color: '#dc2626', fontWeight: 600 }}>₹{f.fine_amount}</td>
                <td>
                  <button className="btn btn-primary btn-sm" onClick={() => handlePayFine(f.id)}>
                    Pay
                  </button>
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

  return (
    <>
      <CSVToolbar
        count={logs.length}
        label="log entries (this page)"
        onExport={handleExportCSV}
      />

      <h3 style={{ marginBottom: 'var(--space-4)', color: 'var(--color-espresso)' }}>System Audit Log</h3>

      {logs.length === 0 ? (
        <div className={styles['empty-state']}><p>No activities recorded in the log book yet.</p></div>
      ) : (
        <table className={styles['data-table']}>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{log.id}</td>
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
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-charcoal-light)', fontWeight: 600 }}>
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
