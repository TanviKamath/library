import styles from './OverdueStamp.module.css';

/**
 * OverdueStamp — red rubber-stamp SVG overlay.
 * Drop it inside any `position: relative` container.
 */
export default function OverdueStamp() {
  return (
    <div className={styles.stamp} aria-hidden="true">
      <svg
        viewBox="0 0 120 120"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
      >
        {/* Outer serrated ring */}
        <circle cx="60" cy="60" r="54" fill="none" stroke="#dc2626" strokeWidth="3.5"
          strokeDasharray="6 3.2" strokeLinecap="round" />
        {/* Inner ring */}
        <circle cx="60" cy="60" r="45" fill="none" stroke="#dc2626" strokeWidth="2" />
        {/* Stars top */}
        <text x="38" y="34" fontSize="10" fill="#dc2626" textAnchor="middle">★</text>
        <text x="60" y="28" fontSize="10" fill="#dc2626" textAnchor="middle">★</text>
        <text x="82" y="34" fontSize="10" fill="#dc2626" textAnchor="middle">★</text>
        {/* OVERDUE text */}
        <text
          x="60" y="67"
          fontSize="18"
          fontWeight="900"
          fontFamily="'Inter', sans-serif"
          fill="#dc2626"
          textAnchor="middle"
          letterSpacing="2"
          style={{ textTransform: 'uppercase' }}
        >
          OVERDUE
        </text>
        {/* Stars bottom */}
        <text x="38" y="92" fontSize="10" fill="#dc2626" textAnchor="middle">★</text>
        <text x="60" y="98" fontSize="10" fill="#dc2626" textAnchor="middle">★</text>
        <text x="82" y="92" fontSize="10" fill="#dc2626" textAnchor="middle">★</text>
      </svg>
    </div>
  );
}
