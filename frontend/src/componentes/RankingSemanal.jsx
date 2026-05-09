import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Star, Medal, Clock, RefreshCw, TrendingUp } from 'lucide-react';
import api from '../api';

const RankingSemanal = ({ usuario, sidebar }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef(null);

    useEffect(() => {
        carregar();
        intervalRef.current = setInterval(carregar, 10000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    const carregar = async () => {
        try {
            const res = await api.get('/marketplace/ranking-semanal');
            if (res) setData(res);
        } catch (e) {
            console.error('Erro ranking:', e);
        }
        setLoading(false);
    };

    const getMedal = (pos) => {
        if (pos === 1) return <Medal size={12} color="#FFD700" fill="#FFD700" />;
        if (pos === 2) return <Medal size={12} color="#C0C0C0" fill="#C0C0C0" />;
        if (pos === 3) return <Medal size={12} color="#CD7F32" fill="#CD7F32" />;
        return <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.7rem' }}>{pos}</span>;
    };

    if (sidebar) {
        return (
            <div className="ranking-sidebar" style={{ width: '240px', flexShrink: 0, background: 'linear-gradient(180deg, rgba(255,214,0,0.04) 0%, rgba(0,0,0,0.3) 100%)', borderRadius: '16px', border: '1px solid rgba(255,214,0,0.12)', padding: '12px', position: 'sticky', top: '10px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <TrendingUp size={16} color="#FFD600" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FFD600' }}>CAMPEONATO SEMANAL</span>
                    </div>
                    <button onClick={carregar} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}>
                        <RefreshCw size={12} />
                    </button>
                </div>

                {data && data.minha_posicao ? (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <div style={{ flex: 1, padding: '8px', background: 'rgba(255,214,0,0.08)', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sua Pos</div>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: data.minha_posicao <= 20 ? '#FFD600' : 'var(--text-muted)' }}>#{data.minha_posicao}</div>
                        </div>
                        <div style={{ flex: 1, padding: '8px', background: 'rgba(var(--success-rgb), 0.05)', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pontos</div>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--success)' }}>{data.meus_pontos || 0}</div>
                        </div>
                        <div style={{ flex: 1, padding: '8px', background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '8px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Premio</div>
                            <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--primary)' }}>R$ {((data.meus_pontos || 0) / 1000).toFixed(2)}</div>
                        </div>
                    </div>
                ) : null}
                {data && data.meus_pontos > 0 && !data.minha_posicao && (
                    <div style={{ padding: '8px', background: 'rgba(255,214,0,0.05)', borderRadius: '8px', textAlign: 'center', marginBottom: '10px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{data.meus_pontos} pts</span> · R$ {((data.meus_pontos || 0) / 1000).toFixed(2)} · Fora do Top 20
                    </div>
                )}

                {loading ? (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>Carregando...</p>
                ) : data && data.ranking ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {data.ranking.slice(0, 20).map((item) => (
                            <div key={item.posicao} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 8px',
                                background: item.destaque ? 'rgba(255,214,0,0.12)' : 'transparent',
                                borderRadius: '6px',
                                border: item.destaque ? '1px solid rgba(255,214,0,0.3)' : '1px solid transparent'
                            }}>
                                <div style={{ width: '20px', textAlign: 'center' }}>{getMedal(item.posicao)}</div>
                                <span style={{ flex: 1, fontWeight: item.destaque ? 800 : 500, fontSize: '0.7rem', color: item.destaque ? '#FFD600' : 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.nome.split(' ')[0]}
                                </span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)' }}>{item.pontos}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                        Nenhum ponto esta semana.
                    </p>
                )}

                {data && data.proximo_pagamento && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                        <Clock size={10} />
                        Proximo pagamento: {new Date(data.proximo_pagamento).toLocaleDateString('pt-BR')} as 18h
                    </div>
                )}

                <div style={{ marginTop: '6px', fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.7 }}>
                    Top 20 levam premio. Atualiza a cada 30s.
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: 'linear-gradient(135deg, rgba(255,214,0,0.05) 0%, rgba(0,0,0,0.3) 100%)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,214,0,0.15)', marginBottom: '1.5rem' }}>
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
