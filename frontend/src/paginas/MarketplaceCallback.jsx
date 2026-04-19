import React, { useEffect, useState } from 'react';
import api from '../api';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';

const MarketplaceCallback = () => {
    const [status, setStatus] = useState('processando'); // processando, sucesso, erro
    const [mensagem, setMensagem] = useState('Finalizando conexão com Mercado Pago...');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');

        if (!code || !state) {
            setStatus('erro');
            setMensagem('Dados de autorização inválidos ou ausentes.');
            return;
        }

        const vincularConta = async () => {
            try {
                await api.get(`/marketplace/callback?code=${code}&state=${state}`);
                setStatus('sucesso');
                setMensagem('Sua conta Mercado Pago foi conectada com sucesso! Redirecionando...');
                
                // Limpa a URL para não processar de novo no refresh
                window.history.replaceState({}, document.title, "/");
                
                setTimeout(() => {
                    window.location.hash = 'marketplace';
                }, 3000);
            } catch (err) {
                setStatus('erro');
                setMensagem(err.response?.data?.detail || 'Erro ao vincular conta. Tente novamente.');
            }
        };

        vincularConta();
    }, []);

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100vh', 
            gap: '20px',
            background: 'var(--bg-main)',
            color: 'var(--text-main)',
            textAlign: 'center',
            padding: '20px'
        }}>
            {status === 'processando' && (
                <>
                    <RefreshCw className="animate-spin" size={48} color="var(--primary)" />
                    <h2 style={{ fontSize: '1.2rem' }}>{mensagem}</h2>
                </>
            )}
            {status === 'sucesso' && (
                <>
                    <CheckCircle size={48} color="var(--success)" />
                    <h2 style={{ fontSize: '1.2rem' }}>{mensagem}</h2>
                    <button className="btn btn-primary" onClick={() => window.location.href = '/#marketplace'}>Voltar para o App</button>
                </>
            )}
            {status === 'erro' && (
                <>
                    <XCircle size={48} color="var(--danger)" />
                    <h2 style={{ fontSize: '1.2rem' }}>{mensagem}</h2>
                    <button className="btn btn-secondary" onClick={() => window.location.href = '/#marketplace'}>Tentar Novamente</button>
                </>
            )}
        </div>
    );
};

export default MarketplaceCallback;
