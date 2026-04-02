import React from 'react';

const LoadingScreen = ({ message = "Carregando Psy Pay..." }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #1a1a1a 0%, #0a0a0a 100%)',
      color: '#ffffff',
      fontFamily: "'Outfit', sans-serif",
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      {/* Container do Logo com Animação */}
      <div style={{
        position: 'relative',
        marginBottom: '2rem'
      }}>
        {/* Glow de Fundo */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '120px',
          height: '120px',
          background: 'rgba(0, 255, 0, 0.15)',
          borderRadius: '50%',
          filter: 'blur(30px)',
          animation: 'pulseGlow 2s infinite ease-in-out'
        }}></div>

        {/* Círculos de Progresso */}
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="2"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--primary, #00ff00)"
            strokeWidth="3"
            strokeDasharray="283"
            strokeDashoffset="70"
            strokeLinecap="round"
            style={{
              animation: 'rotateSpinner 1.5s linear infinite',
              transformOrigin: '50% 50%'
            }}
          />
        </svg>

        {/* Ícone Central */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '2rem'
        }}>
          🚀
        </div>
      </div>

      {/* Texto de Carregamento */}
      <h2 style={{
        fontSize: '1.2rem',
        fontWeight: '500',
        letterSpacing: '1px',
        margin: 0,
        background: 'linear-gradient(90deg, #fff, #00ff00, #fff)',
        backgroundSize: '200% auto',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: 'shimmerText 2s linear infinite'
      }}>
        {message}
      </h2>

      <p style={{
        marginTop: '0.8rem',
        fontSize: '0.8rem',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: '2px',
        textTransform: 'uppercase'
      }}>
        Iniciando Motores Financeiros
      </p>

      <style>
        {`
          @keyframes rotateSpinner {
            0% { transform: rotate(0deg); stroke-dashoffset: 280; }
            50% { stroke-dashoffset: 140; }
            100% { transform: rotate(360deg); stroke-dashoffset: 280; }
          }
          @keyframes pulseGlow {
            0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
            50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.8; }
          }
          @keyframes shimmerText {
            to { background-position: 200% center; }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingScreen;
