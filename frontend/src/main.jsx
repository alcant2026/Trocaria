import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Registra Service Worker para cache de assets (otimiza Render Free Tier)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('SW registrado'))
            .catch((err) => console.log('SW erro:', err));
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
