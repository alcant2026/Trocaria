import React from 'react';

const LoadingScreen = ({ message = "Inicializando Psy Pay..." }) => {
  return (
    <div className="splash-container">
      <div className="splash-logo"></div>
      <div className="splash-text">
        {message}
      </div>
      <div className="splash-sub">
        Conexão Segura
      </div>
    </div>
  );
};

export default LoadingScreen;
