import React from 'react';

const Logo = ({ size = 32, showText = true }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', userSelect: 'none' }}>
      <img 
        src="/logo.png" 
        alt="PSY PAY Logo" 
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
          PSY PAY
        </span>
      )}
    </div>
  );
};

export default Logo;
