import React from 'react';
import { ShieldAlert, PlusCircle, ArrowDownCircle } from 'lucide-react';

const GerenciarPool = ({
    usuario, valorPool, setValorPool,
    handleAportePool, handleResgatePool,
    setSecaoAtiva, isFirstLoad
}) => {
    return (
        <div className="card">
            <div className="flex-between mb-1">
                <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Fundo Coletivo de Liquidez</h2>
            </div>

            <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {isFirstLoad ? (
                    <div className="skeleton-loading" style={{ height: '100px' }}></div>
                ) : (
                    <>
                        <div className="flex-between mb-1">
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>Saldo Total no Fundo:</span>
                            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)' }}>
                                R$ {(usuario.saldo_pool || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ background: 'rgba(var(--success-rgb), 0.05)', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rendimento</div>
                                <div style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1rem' }}>
                                    +{(usuario.rendimento_pool_pct || 0).toFixed(2)}%
                                </div>
                            </div>
                            <div style={{ background: 'rgba(var(--success-rgb), 0.05)', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Ganho</div>
                                <div style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1rem' }}>
                                    R$ {(usuario.rendimento_pool_abs || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </>
                )}
                <p style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '12px', textAlign: 'center' }}>
                    Rendimentos automáticos e pro-rata aplicados em tempo real sobre os juros de crédito.
                </p>
            </div>

            <div className="mt-2" style={{
                background: 'linear-gradient(90deg, rgba(var(--primary-rgb), 0.1) 0%, rgba(255,255,255,0.02) 100%)',
                padding: '15px',
                borderRadius: '16px',
                border: '1px solid rgba(var(--primary-rgb), 0.1)'
            }}>
                <div className="flex-between" style={{ marginBottom: '6px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Participação nos Lucros</span>
                    <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>SISTEMA ATIVO</span>
                </div>
                <div className="flex-between">
                    <div>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'rgba(255,255,255,0.5)' }}>Total Recebido</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--success)' }}>R$ {(usuario.total_dividendos_ganhos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', display: 'block', color: 'rgba(255,255,255,0.5)' }}>Índice de Engajamento</span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--primary)' }}>
                            {(((usuario.saldo_caixa || 0) * 0.5) + ((usuario.score || 0) * 0.3) + ((usuario.gasto_total_taxas || 0) * 0.2)).toFixed(1)} pts
                        </span>
                    </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                    <div style={{
                        height: '6px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div
                            className="animate-pulse"
                            style={{
                                width: `${Math.min(100, (((usuario.saldo_caixa || 0) * 0.5) + ((usuario.score || 0) * 0.3) + ((usuario.gasto_total_taxas || 0) * 0.2)) / 100 * 100)}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--primary) 0%, var(--success) 100%)',
                                boxShadow: '0 0 15px var(--primary)',
                                borderRadius: '10px',
                                transition: 'width 1s ease-in-out'
                            }}
                        ></div>
                    </div>
                    <div className="flex-between mt-0-5">
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>Status de Sócio</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--primary)' }}>NÍVEL {Math.floor((((usuario.saldo_caixa || 0) * 0.5) + ((usuario.score || 0) * 0.3) + ((usuario.gasto_total_taxas || 0) * 0.2)) / 100) + 1}</span>
                    </div>
                </div>
            </div>

            <div className="input-group">
                <label>Valor da Operação</label>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <input
                        type="number"
                        className="input-field"
                        placeholder="R$ 0,00"
                        min="0"
                        style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.3rem', fontWeight: 800 }}
                        value={valorPool}
                        onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) setValorPool(v); }}
                    />
                </div>
            </div>

            {!usuario.is_verified && (
                <div style={{
                    background: 'rgba(255, 193, 7, 0.05)',
                    border: '1px solid rgba(255, 193, 7, 0.2)',
                    borderRadius: '12px',
                    padding: '12px',
                    marginTop: '1.5rem',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center'
                }}>
                    <ShieldAlert size={20} color="#ffc107" />
                    <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, display: 'block', color: '#ffc107', textTransform: 'uppercase' }}>Conta não Verificada</span>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,193,7,0.8)', lineHeight: '1.2', display: 'block' }}>
                            Envie seus documentos para liberar aportes e aumentar seu lucro.
                        </span>
                    </div>
                    <button
                        className="btn btn-sm"
                        style={{ background: '#ffc107', color: '#000', padding: '6px 12px', fontSize: '0.65rem', fontWeight: 900 }}
                        onClick={() => setSecaoAtiva('perfil')}
                    >
                        VERIFICAR
                    </button>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '1.5rem' }}>
                <button
                    className="btn btn-primary"
                    disabled={!usuario.is_verified || !valorPool || parseFloat(valorPool) <= 0 || parseFloat(valorPool) > usuario.saldo}
                    onClick={handleAportePool}
                >
                    <PlusCircle size={18} style={{ marginRight: '8px' }} />
                    Aportar
                </button>
                <button
                    className="btn btn-outline"
                    style={{ color: 'var(--danger)', borderColor: 'rgba(255, 61, 0, 0.2)' }}
                    disabled={!valorPool || parseFloat(valorPool) <= 0 || parseFloat(valorPool) > usuario.saldo_pool}
                    onClick={handleResgatePool}
                >
                    <ArrowDownCircle size={18} style={{ marginRight: '8px' }} />
                    Resgatar
                </button>
            </div>

            <p className="text-muted mt-1" style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                * O aporte no Fundo Coletivo é a base do seu limite de crédito. Seus pontos aumentam conforme sua liquidez no sistema.
            </p>
        </div>
    );
};

export default GerenciarPool;
