import React from 'react';

const CircularArrow = () => (
  <svg viewBox="0 0 100 100" style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: 'middle', margin: '0 1px' }}>
    <path d="M 25 50 A 25 25 0 0 1 75 50" stroke="#FFCC00" strokeWidth="14" fill="none" strokeLinecap="round" />
    <polygon points="82,50 68,42 68,58" fill="#FFCC00" />
    <path d="M 75 50 A 25 25 0 0 1 25 50" stroke="#00E676" strokeWidth="14" fill="none" strokeLinecap="round" />
    <polygon points="18,50 32,42 32,58" fill="#00E676" />
  </svg>
);

const Logo = ({ size = 32, showText = true }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      <img 
        src="/logo_v2.png" 
        alt="TROCARIA Logo" 
        style={{ 
          width: 'auto', 
          height: size, 
          objectFit: 'contain' 
        }} 
      />
      {showText && (
        <span style={{ 
          fontSize: `${size * 0.7}px`, 
          fontWeight: 800, 
          color: 'var(--primary)', 
          letterSpacing: '-1px' 
        }}>
          TR<CircularArrow />CARIA
        </span>
      )}
    </div>
  );
};

export default Logo;
