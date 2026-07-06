import { useState, useRef, useEffect } from 'react';
import styles from './CustomSelect.module.css';

export function CustomSelect({ value, onChange, options, icon, ariaLabel, alignRight = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [autoRight, setAutoRight] = useState(alignRight);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      if (rect.right > window.innerWidth - 16 || alignRight) {
        setAutoRight(true);
      } else {
        setAutoRight(alignRight);
      }
    } else if (!isOpen) {
      setAutoRight(alignRight);
    }
  }, [isOpen, alignRight]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        {selectedOption?.icon && <span className={styles.icon}>{selectedOption.icon}</span>}
        <span className={styles.label}>{selectedOption?.label || 'Select...'}</span>
        <svg 
          className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}
          width="12" 
          height="12" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2.5"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {isOpen && (
        <div ref={dropdownRef} className={`${styles.dropdown} ${autoRight ? styles.dropdownRight : ''}`}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.option} ${option.value === value ? styles.optionSelected : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.icon && <span className={styles.optionIcon}>{option.icon}</span>}
              <span className={styles.optionLabel}>{option.label}</span>
              {option.value === value && (
                <svg className={styles.checkmark} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
