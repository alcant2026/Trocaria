import React from 'react';
import { LayoutDashboard, TrendingUp, FileText, Clock, Sparkles, CheckCircle2, Package, MapPin, Users, AlertCircle, Star, Zap, Rocket } from 'lucide-react';

const ContractTimer = ({ expira4h, expira5d, arrecadado }) => {
    const dataAlvo = arrecadado > 0 ? expira5d : expira4h;
    if (!dataAlvo) return null;
    const expirado = new Date(dataAlvo + 'Z') <= new Date();
    return (
        <div style={{ background: expirado ? 'rgba(255, 61, 0, 0.08)' : 'rgba(255, 145, 0, 0.08)', padding: '6px 12px', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid', borderColor: expirado ? 'rgba(255, 61, 0, 0.2)' : 'rgba(255, 145, 0, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={12} color={expirado ? 'var(--danger)' : 'var(--warning)'} />
            <span style={{ fontSize: '0.7rem', color: expirado ? 'var(--danger)' : 'var(--warning)', fontWeight: 700 }}>
                {expirado ? 'Expirado' : 'Em andamento'}
            </span>
        </div>
    );
};

const ContratosView = ({ meusEmprestimos, handlePagarParcela, handleQuitarTotalP2P, handlePagarAvulsoP2P, handleConfirmarPagtoRecebido, baixarContrato }) => {
    if (meusEmprestimos.length === 0) {
        return (
            <div className="card">
                <div className="flex-between mb-1">
                    <h3>Meus Contratos</h3>
                    <LayoutDashboard size={18} color="var(--text-muted)" />
                </div>
                <div className="card text-center" style={{ border: '2px dashed var(--border-color)', background: 'transparent', margin: 0 }}>
                    <p>Nenhum contrato encontrado.</p>
                </div>
            </div>
        );
    }

    const ativos = meusEmprestimos.filter(e => ['aprovado', 'pendente'].includes(e.status));
    const concluidos = meusEmprestimos.filter(e => ['concluido', 'rejeitado', 'falhou'].includes(e.status));

    return (
        <div className="card">
            <div className="flex-between mb-1">
                <h3>Meus Contratos</h3>
                <LayoutDashboard size={18} color="var(--text-muted)" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {ativos.length > 0 && (
                    <div>
                        <h4 style={{ fontSize: '0.75rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <TrendingUp size={14} /> Créditos Ativos
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {ativos.map(emp => (
                                <div key={emp.id} style={{ background: 'rgba(var(--primary-rgb), 0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(var(--primary-rgb), 0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                    <div className="flex-between mb-1">
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className={`badge ${emp.status === 'aprovado' ? 'badge-success' : 'badge-warning'}`}>
                                                    {emp.status.toUpperCase()}
                                                </span>
                                                {emp.status !== 'pendente' && (
                                                    <button onClick={() => baixarContrato(emp.id)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                        <FileText size={12} /> Contrato PDF
                                                    </button>
                                                )}
                                            </div>
                                            <h3 className="mt-1" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Apoio #{emp.id}</h3>
                                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                {emp.tipo === 'tomador' ? `Você recebe de: ${emp.contraparte_nome || 'Aguardando'}` : `Você enviou para: ${emp.contraparte_nome || 'Aguardando'}`}
                                                <br />
                                                Chave PIX: <strong style={{ color: 'var(--text-main)' }}>{emp.chave_pix_pagamento || '—'}</strong>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-muted" style={{ fontSize: '0.6rem' }}>VALOR MENSAL</p>
                                            <p style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1rem' }}>
                                                R$ {emp.valor_parcela?.toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>

                                    {emp.status === 'pendente' && (
                                        <>
                                            <ContractTimer expira4h={emp.data_expiracao_4h} expira5d={emp.data_expiracao_5d} arrecadado={emp.valor_arrecadado} />
                                            <div style={{ marginBottom: '1rem' }}>
                                                <div className="flex-between mb-1" style={{ fontSize: '0.75rem' }}>
                                                    <span className="text-muted">Arrecadado</span>
                                                    <span style={{ fontWeight: 700 }}>R$ {emp.valor_arrecadado?.toLocaleString('pt-BR')} / R$ {emp.valor?.toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min(100, (emp.valor_arrecadado / emp.valor) * 100)}%`,
                                                        height: '100%',
                                                        background: 'var(--primary)',
                                                        boxShadow: '0 0 10px var(--primary)',
                                                        transition: 'width 1s ease-in-out'
                                                    }}></div>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {emp.status === 'aprovado' && emp.parcelas_pagas < emp.parcelas && (
                                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {emp.tipo === 'tomador' ? (
                                                <>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                        <button className="btn btn-primary" style={{ padding: '10px', fontSize: '0.8rem' }} onClick={() => handlePagarParcela(emp.id, emp.valor_parcela, emp.chave_pix_pagamento)}>Pagar Parcela</button>
                                                        <button className="btn btn-outline" style={{ padding: '10px', fontSize: '0.8rem' }} onClick={() => handleQuitarTotalP2P(emp.id, emp.valor_total_restante, emp.chave_pix_pagamento)}>Quitar Tudo</button>
                                                    </div>
                                                    <button className="btn btn-sm" style={{ padding: '8px', fontSize: '0.75rem', color: '#FFD600', background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,214,0,0.3)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }} onClick={() => handlePagarAvulsoP2P(emp.id, emp.chave_pix_pagamento)}>Pagar outro valor</button>
                                                </>
                                            ) : (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Aguardando tomador enviar o pagamento...</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {concluidos.length > 0 && (
                    <div>
                        <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileText size={14} /> Concluídos
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {concluidos.map(emp => (
                                <div key={emp.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', opacity: 0.7 }}>
                                    <div className="flex-between">
                                        <div>
                                            <span className={`badge ${emp.status === 'concluido' ? 'badge-success' : 'badge-danger'}`}>
                                                {emp.status.toUpperCase()}
                                            </span>
                                            <h4 className="mt-0-5" style={{ fontSize: '0.85rem', margin: 0 }}>Apoio #{emp.id}</h4>
                                        </div>
                                        <div className="text-right">
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Pago</p>
                                            <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>R$ {emp.valor?.toLocaleString('pt-BR')}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContratosView;
