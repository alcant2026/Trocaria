import React, { useState, useEffect } from 'react';
import api, { BACKEND_URL } from '../api';
import { Gift, Clock, ArrowLeft, ShoppingBag, Award, Copy, Check } from 'lucide-react';

const ProdutosResgate = ({ usuario, onVoltar, onMensagem }) => {
    const [status, setStatus] = useState(null);
    const [produtos, setProdutos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resgatando, setResgatando] = useState(null);
    const [copiado, setCopiado] = useState(false);

    useEffect(() => {
        carregar();
    }, []);

    const carregar = async () => {
        setLoading(true);
        try {
            const data = await api.get('/pontos/produtos');
            setProdutos(data.produtos || []);
            setStatus(data);
        } catch (err) {
            if (err.message?.includes('403')) {
                setStatus({ acesso_negado: true, mensagem: 'Apenas usuários no Top 20 podem acessar esta seção.' });
            } else {
                setStatus({ erro: true, mensagem: err.message });
            }
        }
        setLoading(false);
    };

    const handleResgatar = async (produto) => {
        if (!confirm(`Deseja resgatar "${produto.nome}" por ${produto.pontos_minimos} pontos?`)) return;
        setResgatando(produto.id);
        try {
            const res = await api.post(`/pontos/produtos/${produto.id}/resgatar`);
            onMensagem?.(res.message);
            carregar();
        } catch (err) {
            onMensagem?.(err.message || 'Erro ao resgatar produto.');
        }
        setResgatando(null);
    };

    if (loading) {
        return (
            <div className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <button onClick={onVoltar} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Resgatar Produtos</h2>
                </div>
                {[1,2,3].map(i => <div key={i} className="skeleton-loading skeleton-card" style={{ height: '120px', marginBottom: '10px' }}></div>)}
            </div>
        );
    }

    if (status?.acesso_negado) {
        return (
            <div className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <button onClick={onVoltar} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Resgatar Produtos</h2>
                </div>
                <div className="card text-center" style={{ padding: '2rem' }}>
                    <Award size={48} style={{ color: 'var(--warning)', marginBottom: '1rem' }} />
                    <h3 style={{ marginBottom: '0.5rem' }}>Top 20 Apenas</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        O resgate de produtos é um benefício exclusivo para os 20 maiores acumuladores de pontos da semana.
                    </p>
                </div>
            </div>
        );
    }

    if (status?.janela_fechada) {
        return (
            <div className="animate-fade-in">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <button onClick={onVoltar} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Resgatar Produtos</h2>
                </div>
                <div className="card text-center" style={{ padding: '2rem' }}>
                    <Clock size={48} style={{ color: 'var(--warning)', marginBottom: '1rem' }} />
                    <h3 style={{ marginBottom: '0.5rem' }}>Janela Fechada</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{status.mensagem}</p>
                    {status.whatsapp && (
                        <div style={{ background: 'rgba(var(--success-rgb), 0.05)', padding: '1rem', borderRadius: '12px', marginTop: '1rem' }}>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Fale conosco no WhatsApp:</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <a href={`https://wa.me/55${status.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm" style={{ fontSize: '1rem', fontWeight: 700 }}>
                                    {status.whatsapp}
                                </a>
                                <button onClick={() => { navigator.clipboard.writeText(status.whatsapp); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '8px', borderRadius: '8px' }}>
                                    {copiado ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <button onClick={onVoltar} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
                    <ArrowLeft size={20} />
                </button>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Resgatar Produtos</h2>
            </div>

            <div className="card" style={{ marginBottom: '1rem', background: 'rgba(var(--success-rgb), 0.05)', border: '1px solid rgba(var(--success-rgb), 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Gift size={20} style={{ color: 'var(--success)' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Top 20 — Você está na posição #{status?.minha_posicao}</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    Escolha um produto abaixo para resgatar com seus pontos. Após o resgate, entraremos em contato.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {produtos.length === 0 ? (
                    <div className="card text-center" style={{ padding: '2rem' }}>
                        <ShoppingBag size={36} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nenhum produto disponível no momento.</p>
                    </div>
                ) : (
                    produtos.map(p => (
                        <div key={p.id} className="card" style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px' }}>
                            {p.foto_url ? (
                                <img src={`${BACKEND_URL}${p.foto_url}`} alt={p.nome} style={{ width: '72px', height: '72px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                            ) : (
                                <div style={{ width: '72px', height: '72px', borderRadius: '12px', background: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Gift size={28} style={{ color: 'var(--primary)' }} />
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <h3 style={{ fontSize: '0.9rem', margin: '0 0 4px' }}>{p.nome}</h3>
                                {p.descricao && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.descricao}</p>}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Clock size={12} style={{ color: 'var(--warning)' }} />
                                    <span style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 700 }}>{p.pontos_minimos} pts</span>
                                </div>
                            </div>
                            <button
                                className={`btn ${usuario.pontos_marketplace >= p.pontos_minimos ? 'btn-success' : 'btn-secondary'}`}
                                style={{ flexShrink: 0, fontSize: '0.75rem', padding: '8px 14px' }}
                                disabled={resgatando === p.id || usuario.pontos_marketplace < p.pontos_minimos}
                                onClick={() => handleResgatar(p)}
                            >
                                {resgatando === p.id ? <span className="spinner" /> : 'Resgatar'}
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProdutosResgate;
