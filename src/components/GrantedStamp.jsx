import React from 'react';

export function GrantedStamp({ date }) {
  const displayDate = date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div className="global-stamp-overlay">
      <div className="global-stamp-seal">
        <span className="global-stamp-text-top">BREW & BORROW</span>
        <span className="global-stamp-text-center">GRANTED</span>
        <span className="global-stamp-text-date">{displayDate}</span>
      </div>
    </div>
  );
}
