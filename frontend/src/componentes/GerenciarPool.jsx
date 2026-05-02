import React from 'react';
import { ShieldAlert, PlusCircle, UserCheck } from 'lucide-react';

const GerenciarPool = ({
    usuario, valorPool, setValorPool,
    handleAportePool, handleResgatePool,
    isFirstLoad
}) => {
    return (
        <div className="card">
            <div className="flex-between mb-1">
                <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Grupo de Apoio Mútuo</h2>
            </div>

            <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                {isFirstLoad ? (
                    <div className="skeleton-loading" style={{ height: '100px' }}></div>
                ) : (
                    <>
                        <div className="flex-between mb-1">
                            <span className="text-muted" style={{ fontSize: '0.85rem' }}>Saldo disponível para apoiar:</span>
                            <span style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)' }}>
                                R$ {(usuario.saldo_grupo || usuario.saldo_pool || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Apoios Ativos</div>
                                <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1rem' }}>
                                    {usuario.apoios_ativos || 0}
                                </div>
                            </div>
                            <div style={{ background: 'rgba(var(--success-rgb), 0.05)', padding: '8px', borderRadius: '10px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Apoios Concluídos</div>
                                <div style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1rem' }}>
                                    {usuario.apoios_concluidos || 0}
                                </div>
                            </div>
                        </div>
                    </>
                )}
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
                    Quanto mais você apoia, maior seu score e reputação no grupo.
                </p>
            </div>

            <div className="input-group">
                <label>Valor para disponibilizar</label>
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
                            Verifique seus dados para participar do grupo.
                        </span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#ffc107' }}>
                        Vá em Perfil → Verificação
                    </span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '1.5rem' }}>
                <button
                    className="btn btn-primary"
                    disabled={!usuario.is_verified || !valorPool || parseFloat(valorPool) <= 0}
                    onClick={handleAportePool}
                >
                    <PlusCircle size={18} style={{ marginRight: '8px' }} />
                    Disponibilizar
                </button>
                <button
                    className="btn btn-outline"
                    style={{ color: 'var(--danger)', borderColor: 'rgba(255, 61, 0, 0.2)' }}
                    disabled={!valorPool || parseFloat(valorPool) <= 0}
                    onClick={handleResgatePool}
                >
                    <UserCheck size={18} style={{ marginRight: '8px' }} />
                    Retirar
                </button>
            </div>

            <p className="text-muted mt-1" style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                * Seu compromisso ajuda outros membros do grupo. Ambos ganham score e reputação.
            </p>
        </div>
    );
};

export default GerenciarPool;
