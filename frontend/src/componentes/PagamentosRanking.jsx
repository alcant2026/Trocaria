import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, ChevronDown, ChevronUp, Eye, DollarSign, User, FileText } from 'lucide-react';
import api from '../api';

const PagamentosRanking = () => {
    const [pagamentos, setPagamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [conferindo, setConferindo] = useState(null);

    useEffect(() => { carregar(); }, []);

    const carregar = async () => {
        try {
            const res = await api.get('/marketplace/admin/ranking/historico');
            setPagamentos(res.pagamentos || []);
        } catch (e) {
            console.error('Erro ao carregar pagamentos:', e);
        }
        setLoading(false);
    };

    const conferir = async (id) => {
        setConferindo(id);
        try {
            await api.post(`/marketplace/admin/ranking/conferir/${id}`);
            carregar();
        } catch (e) {
            console.error('Erro ao conferir:', e);
        }
        setConferindo(null);
    };

    const formatarData = (dataStr) => {
        try {
            return new Date(dataStr).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } catch { return dataStr; }
    };

    return (
        <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,214,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={20} color="#FFD600" />
                </div>
                <div>
                    <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Pagamentos do Ranking</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                        Histórico de prêmios pagos aos top 20 toda semana
                    </p>
                </div>
                <button onClick={carregar} style={{ marginLeft: 'auto', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem' }}>
                    Atualizar
                </button>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Carregando...</p>
            ) : pagamentos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <Clock size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>Nenhum pagamento de ranking ainda. O primeiro será no próximo sábado às 18h.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pagamentos.map((p) => (
                        <div key={p.id} style={{
                            background: 'var(--card-bg)',
                            border: p.status === 'conferido' ? '1px solid rgba(37,211,102,0.2)' : '1px solid var(--border)',
                            borderRadius: '12px', overflow: 'hidden'
                        }}>
                            {/* Header */}
                            <div
                                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                                style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', gap: '12px' }}
                            >
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: p.status === 'conferido' ? 'rgba(37,211,102,0.1)' : 'rgba(255,214,0,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {p.status === 'conferido' ? <CheckCircle size={18} color="#25D366" /> : <DollarSign size={18} color="#FFD600" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatarData(p.data_reset_iso)}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {p.vencedores.length} vencedores · {p.total_pontos} pts ·{' '}
                                        {p.status === 'conferido' ? (
                                            <span style={{ color: '#25D366' }}>Conferido</span>
                                        ) : (
                                            <span style={{ color: '#FFD600' }}>Pendente revisão</span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--success)' }}>R$ {p.total_premio.toFixed(2)}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>total pago</div>
                                </div>
                                {expandedId === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>

                            {/* Expanded detail */}
                            {expandedId === p.id && (
                                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Nome</th>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>CPF</th>
                                                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>PIX</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Pontos</th>
                                                <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Prêmio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {p.vencedores.map((v, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                    <td style={{ padding: '6px 8px' }}>{v.posicao}</td>
                                                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{v.nome}</td>
                                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{v.cpf}</td>
                                                    <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.chave_pix}</td>
                                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{v.pontos}</td>
                                                    <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>R$ {v.premio.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ fontWeight: 700 }}>
                                                <td colSpan={4} style={{ padding: '8px', textAlign: 'right' }}>Total:</td>
                                                <td style={{ padding: '8px', textAlign: 'right' }}>{p.total_pontos}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', color: 'var(--success)' }}>R$ {p.total_premio.toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>

                                    {/* Conferir button */}
                                    {p.status !== 'conferido' && (
                                        <div style={{ marginTop: '12px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => conferir(p.id)}
                                                disabled={conferindo === p.id}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                    background: 'rgba(37,211,102,0.15)', color: '#25D366',
                                                    fontWeight: 600, fontSize: '0.8rem'
                                                }}
                                            >
                                                {conferindo === p.id ? 'Confirmando...' : <><CheckCircle size={14} /> Marcar como Conferido</>}
                                            </button>
                                        </div>
                                    )}
                                    {p.status === 'conferido' && (
                                        <div style={{ marginTop: '12px', textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            Conferido por admin {p.conferido_por} em {p.data_conferido ? formatarData(p.data_conferido) : '-'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PagamentosRanking;
