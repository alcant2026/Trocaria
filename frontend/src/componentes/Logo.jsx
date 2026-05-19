import React from 'react';

const YingYangO = () => (
  <svg viewBox="0 0 100 100" style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: 'middle', margin: '0 1px' }}>
    <circle cx="50" cy="50" r="50" fill="#FFCC00" />
    <path d="M50 0 A50 50 0 0 1 100 50 A50 50 0 0 1 50 100 Z" fill="#00E676" />
    <circle cx="50" cy="25" r="25" fill="#00E676" />
    <circle cx="50" cy="75" r="25" fill="#FFCC00" />
    <circle cx="50" cy="25" r="8" fill="#FFCC00" />
    <circle cx="50" cy="75" r="8" fill="#00E676" />
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
          TR<YingYangO />CARIA
        </span>
      )}
    </div>
  );
};

export default Logo;
