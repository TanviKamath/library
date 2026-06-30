import styles from './LoadingSpinner.module.css';

export function LoadingSpinner({ message = 'Brewing stories…', fullPage = false }) {
  return (
    <div className={`${styles['spinner-wrap']} ${fullPage ? styles['full-page'] : ''}`}>
      <div className={styles['cup-container']}>
        <div className={styles.steam}>
          <span className={styles['steam-1']} />
          <span className={styles['steam-2']} />
          <span className={styles['steam-3']} />
        </div>
        <div className={styles.cup}>
          <div className={styles.handle} />
        </div>
      </div>
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
}

export default LoadingSpinner;
