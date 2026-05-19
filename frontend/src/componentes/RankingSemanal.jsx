import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Star, Medal, RefreshCw, TrendingUp } from 'lucide-react';
import api from '../api';

const RankingSemanal = ({ usuario, sidebar }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    useEffect(() => {
        carregar();
        intervalRef.current = setInterval(carregar, 30000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    const carregar = async () => {
        try {
            const res = await api.get('/resgate/hall-da-fama');
            if (res) setData(res);
        } catch (e) {
            console.error('Erro hall da fama:', e);
        }
        setLoading(false);
    };

    const getMedal = (pos) => {
        if (pos === 1) return <Medal size={12} color="#FFD700" fill="#FFD700" />;
        if (pos === 2) return <Medal size={12} color="#C0C0C0" fill="#C0C0C0" />;
        if (pos === 3) return <Medal size={12} color="#CD7F32" fill="#CD7F32" />;
        return <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem' }}>{pos}</span>;
    };

    const hall = data?.hall_da_fama || [];

    if (sidebar) {
        return (
            <div className="ranking-sidebar" style={{ width: '240px', flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,214,0,0.04) 0%, rgba(0,0,0,0.3) 100%)', borderRadius: '16px', border: '1px solid rgba(255,214,0,0.12)', padding: '12px', position: 'sticky', top: '10px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={16} color="#FFD600" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FFD600' }}>HALL DA FAMA</span>
                    </div>
                    <button onClick={carregar} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                        <RefreshCw size={12} />
                    </button>
                </div>

                <div style={{ marginBottom: '10px', padding: '8px', background: 'rgba(255,214,0,0.05)', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Pontos acumulados de todos os tempos</div>
                </div>

                {loading ? (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>Carregando...</p>
                ) : hall.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {hall.slice(0, 20).map((item) => (
                            <div key={item.posicao} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 8px',
                                background: item.posicao <= 3 ? 'rgba(255,214,0,0.08)' : 'transparent',
                                borderRadius: '6px',
                                border: item.posicao <= 3 ? '1px solid rgba(255,214,0,0.2)' : '1px solid transparent'
                            }}>
                                <div style={{ width: '20px', textAlign: 'center' }}>{getMedal(item.posicao)}</div>
                                <span style={{ flex: 1, fontWeight: item.posicao <= 3 ? 700 : 500, fontSize: '0.7rem', color: item.posicao <= 3 ? '#FFD600' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.nome?.split(' ')[0] || 'Anonimo'}
                                </span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)' }}>{item.pontos_acumulados?.toLocaleString('pt-BR')}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                        Nenhum ponto registrado ainda.
                    </p>
                )}

                <div style={{ marginTop: '6px', fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.7 }}>
                    Ranking de prestigio. Nao ha premio automatico.
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.05) 0%, rgba(0,0,0,0.3) 100%)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,214,0,0.15)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Trophy size={24} color="#FFD600" />
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#FFD600' }}>Hall da Fama</h3>
                </div>
                <button onClick={carregar} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <RefreshCw size={16} />
                </button>
            </div>

            <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(255,214,0,0.05)', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <Star size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Ranking de prestigio baseado em pontos acumulados de todos os tempos
                </div>
            </div>

            {loading ? (
                <p className="text-muted">Carregando...</p>
            ) : hall.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {hall.map((item) => (
                        <div key={item.posicao} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px',
                            background: item.posicao <= 3 ? 'rgba(255,214,0,0.1)' : 'rgba(0,0,0,0.15)',
                            borderRadius: '8px',
                            border: item.posicao <= 3 ? '1px solid rgba(255,214,0,0.3)' : '1px solid transparent'
                        }}>
                            <div style={{ width: '24px', textAlign: 'center' }}>{getMedal(item.posicao)}</div>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: item.posicao <= 3 ? 800 : 600, fontSize: '0.8rem', color: item.posicao <= 3 ? '#FFD600' : 'var(--text-main)' }}>
                                    {item.nome?.split(' ')[0] || 'Anonimo'}
                                </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)' }}>{item.pontos_acumulados?.toLocaleString('pt-BR')} pts</span>
                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px' }}>R$ {item.valor_acumulado?.toFixed(2)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-muted" style={{ textAlign: 'center', padding: '20px 0' }}>
                    Nenhum ponto registrado ainda. Use a plataforma para acumular!
                </p>
            )}

            <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Pontos nunca expiram. Resgate quando quiser (minimo R$ 20,00).
            </div>
        </div>
    );
};

export default RankingSemanal;
