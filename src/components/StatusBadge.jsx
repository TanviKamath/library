import styles from './StatusBadge.module.css';

export function StatusBadge({ status, label }) {
  const norm = (status || '').toLowerCase();
  let badgeClass = styles.default;

  if (['active', 'available', 'ready', 'success'].includes(norm)) {
    badgeClass = styles.success;
  } else if (['overdue', 'unavailable', 'error', 'inactive'].includes(norm)) {
    badgeClass = styles.error;
  } else if (['warning', 'due soon', 'reserved'].includes(norm)) {
    badgeClass = styles.warning;
  } else if (['returned', 'waiting', 'info', 'renewed'].includes(norm)) {
    badgeClass = styles.info;
  }

  return (
    <span className={`${styles.badge} ${badgeClass}`}>
      {label || status}
    </span>
  );
}

export default StatusBadge;
