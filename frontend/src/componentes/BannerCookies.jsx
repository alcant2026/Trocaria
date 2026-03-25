import React, { useState, useEffect } from 'react';
import { Cookie, X, ExternalLink } from 'lucide-react';
import api from '../api';

const BannerCookies = ({ usuario, onUpdate }) => {
    const [visivel, setVisivel] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Mostra o banner se o usuário não aceitou e não tem o aceite salvo localmente
        const aceiteLocal = localStorage.getItem('psy pay_cookies_accepted');
        if (!aceiteLocal && (!usuario || !usuario.aceite_cookies)) {
            const timer = setTimeout(() => setVisivel(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [usuario]);

    const handleAceitar = async () => {
        setLoading(true);
        try {
            if (usuario) {
                await api.post('/auth/aceitar-cookies');
                if (onUpdate) onUpdate();
            }
            localStorage.setItem('psy pay_cookies_accepted', 'true');
            setVisivel(false);
        } catch (err) {
            console.error("Erro ao salvar aceite de cookies:", err);
            // Salva pelo menos localmente se o servidor falhar
            localStorage.setItem('psy pay_cookies_accepted', 'true');
            setVisivel(false);
        } finally {
            setLoading(false);
        }
    };

    if (!visivel) return null;

    return (
        <div className="animate-slide-up" style={{
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'var(--card-bg)',
            border: '2px solid var(--primary)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.2rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            maxWidth: '500px',
            marginLeft: 'auto'
        }}>
            <div className="flex items-start gap-3">
                <div style={{ background: 'rgba(255,214,0,0.1)', padding: '10px', borderRadius: '12px' }}>
                    <Cookie size={24} color="var(--primary)" />
                </div>
                <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem' }}>Controle de Privacidade</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                        Utilizamos cookies para melhorar sua experiência e garantir a segurança das transações. 
                        Ao continuar, você concorda com nossa <a href="/privacidade" style={{ color: 'var(--primary)', fontWeight: 600 }}>Política de Privacidade</a>.
                    </p>
                </div>
                <button 
                    onClick={() => setVisivel(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                    <X size={20} />
                </button>
            </div>
            
            <div className="flex justify-end gap-2 mt-1">
                <button 
                    className="btn btn-primary" 
                    style={{ fontSize: '0.8rem', padding: '0.6rem 1.2rem' }}
                    onClick={handleAceitar}
                    disabled={loading}
                >
                    {loading ? 'Salvando...' : 'Aceitar e Continuar'}
                </button>
            </div>
        </div>
    );
};

export default BannerCookies;
