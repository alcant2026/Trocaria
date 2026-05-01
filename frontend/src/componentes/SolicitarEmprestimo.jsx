import React from 'react';
import { ShieldAlert, PlusCircle, ArrowLeft } from 'lucide-react';

const SolicitarEmprestimo = ({
    passoSolicitar, setPassoSolicitar,
    usuario, aceiteTermos, setAceiteTermos,
    valor, setValor, parcelas, setParcelas,
    limiteInfo, loadingAction, handleSolicitar,
    setActiveView
}) => {
    return (
        <div className="card">
            <div className="flex-end mb-1">
                <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2].map(i => (
                        <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoSolicitar ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                    ))}
                </div>
            </div>

            {passoSolicitar === 1 && (
                <div className="animate-fade-in">
                    {!usuario.is_verified ? (
                        <div className="info-block mb-1" style={{ background: 'rgba(255, 61, 0, 0.08)', border: '1px solid rgba(255, 61, 0, 0.2)', padding: '15px', borderRadius: '16px', textAlign: 'center' }}>
                            <ShieldAlert size={32} color="var(--danger)" style={{ marginBottom: '10px' }} />
                            <h4 style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px' }}>
                                Acesso Restrito: KYC Obrigatório
                            </h4>
                            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', marginBottom: '15px' }}>
                                Para sua segurança e da cooperativa, a solicitação de crédito exige que sua conta esteja <strong>totalmente verificada</strong>.
                            </p>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '15px' }}>
                                        Vá em <strong>Configurações → Verificação</strong> para enviar seus documentos e liberar o crédito.
                                    </p>
                        </div>
                    ) : (
                        <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 5px 0' }}>Seu limite disponível agora:</p>
                            <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>R$ {limiteInfo.limite_disponivel.toLocaleString('pt-BR')}</p>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                        <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                            <label style={{ textAlign: 'center', display: 'block' }}>Valor do Apoio</label>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="0,00"
                                    min="0"
                                    style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.2rem', fontWeight: 800 }}
                                    value={valor}
                                    onChange={(e) => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) setValor(v); }}
                                />
                            </div>
                        </div>

                        <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                            <label style={{ textAlign: 'center', display: 'block', fontSize: '0.8rem' }}>Prazo para Devolução (Meses)</label>
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <select
                                    className="input-field"
                                    style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.75rem', textAlign: 'center', width: '100%', fontSize: '1rem', fontWeight: 700 }}
                                    value={parcelas}
                                    onChange={(e) => setParcelas(e.target.value)}
                                >
                                    <option value={1}>1 mês (Parcela Única)</option>
                                    <option value={2}>2 meses</option>
                                    <option value={3}>3 meses</option>
                                    <option value={6}>6 meses</option>
                                    <option value={12}>12 meses</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {valor && parseFloat(valor) > 0 && (
                        <div className="info-block mt-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)' }}>
                            <div className="flex-between">
                                <div className="info-label">Parcela Estimada</div>
                                <span className="badge badge-success">5% juros a.m.</span>
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                                R$ {(((parseFloat(valor) * (1 + (0.05 * parcelas))) + (limiteInfo.isento_taxa ? 0 : (parseFloat(valor) <= 50 ? 2 : 4))) / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <small className="text-muted">Total a devolver: R$ {((parseFloat(valor) * (1 + (0.05 * parcelas))) + (limiteInfo.isento_taxa ? 0 : (parseFloat(valor) <= 50 ? 2 : 4))).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', padding: '0.8rem' }}
                            disabled={!valor || parseFloat(valor) <= 0 || parseFloat(valor) > limiteInfo.limite_disponivel}
                            onClick={() => setPassoSolicitar(2)}
                        >
                            Continuar para Confirmação
                        </button>
                    </div>
                </div>
            )}

            {passoSolicitar === 2 && (
                <div className="animate-fade-in">
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textAlign: 'center' }}>Confirme sua Solicitação</h3>

                    <div className="info-block mb-1">
                        <div className="flex-between mb-1">
                            <span className="text-muted">Valor Solicitado:</span>
                            <span style={{ fontWeight: 700 }}>R$ {parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex-between mb-1">
                            <span className="text-muted">Juros de Apoio (5%):</span>
                            <span style={{ fontWeight: 700, color: 'var(--success)' }}>R$ {(parseFloat(valor) * 0.05 * parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex-between mb-1">
                            <span className="text-muted">Taxa de Operação:</span>
                            <span style={{ fontWeight: 700, color: limiteInfo.isento_taxa ? 'var(--success)' : 'var(--danger)' }}>
                                {limiteInfo.isento_taxa ? 'ISENTO (Score 500+ / Pool R$ 100+)' : (parseFloat(valor) <= 50 ? 'R$ 2,00' : 'R$ 4,00')}
                            </span>
                        </div>
                        {!limiteInfo.isento_taxa && (
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                                Dica: Atingindo Score 500 e Pool R$ 100 seu próximo apoio será **TAXA ZERO**.
                            </p>
                        )}
                        <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '5px' }}>
                            <span style={{ fontWeight: 600 }}>Parcela Mensal:</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                                R$ {(((parseFloat(valor) * (1 + (0.05 * parcelas))) + (limiteInfo.isento_taxa ? 0 : (parseFloat(valor) <= 50 ? 2 : 4))) / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex-between mt-1">
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>Total Devedor (CET):</span>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                R$ {((parseFloat(valor) * (1 + (0.05 * parcelas))) + (limiteInfo.isento_taxa ? 0 : (parseFloat(valor) <= 50 ? 2 : 4))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '1.5rem' }}>
                        <input
                            type="checkbox"
                            id="check-termos"
                            style={{ marginTop: '4px', transform: 'scale(1.2)' }}
                            checked={aceiteTermos}
                            onChange={(e) => setAceiteTermos(e.target.checked)}
                        />
                        <label htmlFor="check-termos" style={{ fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer', lineHeight: '1.4' }}>
                            Estou ciente que o valor será depositado instantaneamente e que o resgate do meu capital no Pool ficará retido como garantia até a quitação da dívida.
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className="btn btn-primary"
                            style={{ flex: 2 }}
                            disabled={!aceiteTermos || loadingAction}
                            onClick={handleSolicitar}
                        >
                            {loadingAction ? 'Processando...' : 'Confirmar e Receber'}
                        </button>
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSolicitar(1)}>Voltar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SolicitarEmprestimo;
