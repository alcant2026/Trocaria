import React, { useState, useEffect } from 'react';
import { Trophy, Star, User, Medal, Clock, RefreshCw } from 'lucide-react';
import api from '../api';

const RankingSemanal = ({ usuario }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregar();
    }, []);

    const carregar = async () => {
        setLoading(true);
        try {
            const res = await api.get('/marketplace/ranking-semanal');
            setData(res);
        } catch (e) {
            console.error('Erro ranking:', e);
        }
        setLoading(false);
    };

    const getMedal = (pos) => {
        if (pos === 1) return <Medal size={16} color="#FFD700" fill="#FFD700" />;
        if (pos === 2) return <Medal size={16} color="#C0C0C0" fill="#C0C0C0" />;
        if (pos === 3) return <Medal size={16} color="#CD7F32" fill="#CD7F32" />;
        return <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.8rem' }}>{pos}</span>;
    };

    return (
        <div className="animate-fade-in" style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.05) 0%, rgba(0,0,0,0.3) 100%)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,214,0,0.15)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Trophy size={24} color="#FFD600" />
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#FFD600' }}>Campeonato Semanal</h3>
                </div>
                <button onClick={carregar} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <RefreshCw size={16} />
                </button>
            </div>

            {data && data.proximo_pagamento && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '15px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                    <Clock size={14} />
                    Proximo pagamento: {new Date(data.proximo_pagamento).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
            )}

            {data && data.minha_posicao && (
                <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '100px', padding: '12px', background: 'rgba(255,214,0,0.08)', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sua Posicao</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#FFD600' }}>#{data.minha_posicao}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: '100px', padding: '12px', background: 'rgba(var(--success-rgb), 0.05)', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Seus Pontos</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--success)' }}>{data.meus_pontos || 0}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: '100px', padding: '12px', background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Premio Estimado</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary)' }}>R$ {((data.meus_pontos || 0) / 1000).toFixed(2)}</div>
                    </div>
                </div>
            )}

            {loading ? (
                <p className="text-muted">Carregando ranking...</p>
            ) : data && data.ranking ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {data.ranking.map((item) => (
                        <div key={item.posicao} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px',
                            background: item.destaque ? 'rgba(255,214,0,0.1)' : 'rgba(0,0,0,0.15)',
                            borderRadius: '8px',
                            border: item.destaque ? '1px solid rgba(255,214,0,0.3)' : '1px solid transparent'
                        }}>
                            <div style={{ width: '24px', textAlign: 'center' }}>{getMedal(item.posicao)}</div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Star size={12} color="var(--primary)" />
                                <span style={{ fontWeight: item.destaque ? 800 : 600, fontSize: '0.8rem', color: item.destaque ? '#FFD600' : 'var(--text-main)' }}>
                                    {item.nome.split(' ')[0]}
                                </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>{item.pontos} pts</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px' }}>R$ {item.premio.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                    {data.top20_minimo > 0 && (
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
                            Minimo para top 20: {data.top20_minimo} pts
                        </p>
                    )}
                </div>
            ) : (
                <p className="text-muted" style={{ textAlign: 'center', padding: '20px 0' }}>
                    Nenhum ponto esta semana. Compartilhe seus links para participar!
                </p>
            )}

            <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Top 20 levam premio em dinheiro. Todo sabado as 18h o ranking e pago e resetado.
            </div>
        </div>
    );
};

export default RankingSemanal;
