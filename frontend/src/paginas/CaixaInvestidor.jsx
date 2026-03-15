import React, { useState } from 'react';
import { Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle, Calendar, Info, CheckCircle2, RefreshCw, AlertTriangle, X, Eye, EyeOff } from 'lucide-react';
import api from '../api';

const CaixaInvestidor = ({ usuario, onUpdate, showModal, closeModal }) => {
    const [etapa, setEtapa] = useState('inicial'); // inicial, aporte_valor, aporte_termos, aporte_senha, resgate_valor, resgate_senha
    const [valorAporte, setValorAporte] = useState('');
    const [valorResgate, setValorResgate] = useState('');
    const [senha, setSenha] = useState('');
    const [showSenha, setShowSenha] = useState(false);
    const [aceitouTermos, setAceitouTermos] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState(null);

    const hoje = new Date();
    const isDezembroResgate = hoje.getMonth() === 11 && hoje.getDate() >= 19 && hoje.getDate() <= 21;

    const resetar = () => {
        setEtapa('inicial');
        setValorAporte('');
        setValorResgate('');
        setSenha('');
        setAceitouTermos(false);
        setMensagem(null);
    };

    const handleAporteFinal = async () => {
        const v = parseFloat(valorAporte);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Digite um valor de aporte maior que zero.', type: 'error' });
        if (!senha) return showModal({ title: 'Senha Requerida', message: 'Digite sua senha para validar.', type: 'warning' });

        setLoading(true);
        try {
            await api.post('/financeiro/caixa/aporte', {
                valor: v,
                senha: senha,
                aceite_termos: aceitouTermos
            });
            setMensagem({ type: 'success', text: `R$ ${v.toLocaleString('pt-BR')} aportados com sucesso!` });
            setTimeout(resetar, 3000);
            onUpdate();
        } catch (err) {
            setMensagem({ type: 'error', text: err.message || 'Erro ao aportar.' });
        } finally {
            setLoading(false);
        }
    };

    const handleResgateFinal = async () => {
        const v = parseFloat(valorResgate);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Digite um valor de resgate válido.', type: 'error' });
        if (!senha) return showModal({ title: 'Senha Requerida', message: 'Digite sua senha.', type: 'warning' });

        setLoading(true);
        try {
            await api.post('/financeiro/caixa/resgate', {
                valor: v,
                senha: senha
            });
            setMensagem({ type: 'success', text: `R$ ${v.toLocaleString('pt-BR')} resgatados com sucesso!` });
            setTimeout(resetar, 3000);
            onUpdate();
        } catch (err) {
            setMensagem({ type: 'error', text: err.message || 'Erro ao resgatar.' });
        } finally {
            setLoading(false);
        }
    };

    // Renderiza a tela de sucesso final
    if (mensagem?.type === 'success') {
        return (
            <div className="animate-fade-in text-center py-2">
                <div style={{ background: 'rgba(0, 230, 118, 0.1)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <CheckCircle2 size={64} color="var(--success)" className="mb-1" />
                    <h2 className="text-success">Sucesso!</h2>
                    <p>{mensagem.text}</p>
                    <button className="btn btn-primary mt-1" onClick={resetar}>Voltar ao Início</button>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* CABEÇALHO SEMPRE VISÍVEL */}
            <div className="card mb-1" style={{ borderColor: 'var(--primary)', background: 'rgba(255, 214, 0, 0.02)' }}>
                <div className="flex-between mb-1">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={24} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Meu Caixa (Pool)</h2>
                    </div>
                    {etapa !== 'inicial' && (
                        <button className="btn btn-outline" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={resetar}>
                            Cancelar
                        </button>
                    )}
                </div>

                <div className="text-center py-1">
                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>SALDO NO FUNDO COLETIVO</p>
                    <h1 style={{ fontSize: '2.2rem', color: 'var(--text-main)', margin: '0.5rem 0' }}>
                        R$ {(usuario.saldo_caixa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h1>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
                        <RefreshCw size={14} className="animate-spin" />
                        Rendimento Automático (Pool)
                    </div>
                    {usuario.divida_total_pool > 0 && (
                        <div className="mt-1 p-1" style={{ background: 'rgba(255, 61, 0, 0.05)', borderRadius: '12px', border: '1px solid rgba(255, 61, 0, 0.1)', maxWidth: '300px', margin: '10px auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Bloqueado:</span>
                                <span>R$ {(usuario.divida_total_pool || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span style={{ color: 'var(--success)', fontWeight: 600 }}>Disponível:</span>
                                <span>R$ {(usuario.saldo_caixa_disponivel || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ERROR ALERT */}
            {mensagem?.type === 'error' && (
                <div className="alert alert-danger mb-1">
                    <AlertTriangle size={18} />
                    <span>{mensagem.text}</span>
                    <X size={18} style={{ cursor: 'pointer', marginLeft: 'auto' }} onClick={() => setMensagem(null)} />
                </div>
            )}

            {/* WIZARD CONTENT */}
            <div className="animate-slide-up">
                {etapa === 'inicial' && (
                    <div className="grid-2 mb-1" style={{ gap: '15px' }}>
                        <div className="card action-btn" onClick={() => setEtapa('aporte_valor')} style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                            <ArrowUpCircle size={32} color="var(--primary)" />
                            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Aportar</span>
                            <p className="text-muted" style={{ fontSize: '0.7rem' }}>Começar a render no Pool</p>
                        </div>
                        <div className="card action-btn" onClick={() => setEtapa('resgate_valor')} style={{ padding: '1.5rem', border: '1px solid var(--border-color)', opacity: isDezembroResgate ? 1 : 0.6 }}>
                            <ArrowDownCircle size={32} color="var(--warning)" />
                            <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>Resgatar</span>
                            <p className="text-muted" style={{ fontSize: '0.7rem' }}>{isDezembroResgate ? 'Disponível agora' : 'Apenas em Dezembro'}</p>
                        </div>
                    </div>
                )}

                {/* FLOW APORTE */}
                {etapa === 'aporte_valor' && (
                    <div className="card">
                        <h3 className="mb-1">Passo 1: Quanto deseja aportar?</h3>
                        <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>O valor será descontado do seu saldo disponível em carteira.</p>
                        <div className="input-group">
                            <label>Valor do Aporte</label>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="R$ 0,00"
                                value={valorAporte}
                                onChange={(e) => setValorAporte(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="grid-2" style={{ gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={resetar}>Voltar</button>
                            <button className="btn btn-primary" onClick={() => setEtapa('aporte_termos')} disabled={!valorAporte || valorAporte <= 0}>
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {etapa === 'aporte_termos' && (
                    <div className="card">
                        <h3 className="mb-1">Passo 2: Termos de Ciência</h3>
                        <div className="info-block mb-1" style={{ height: '140px', overflowY: 'auto', fontSize: '0.8rem', background: 'rgba(0,0,0,0.2)' }}>
                            <p><strong>1. Rastro Digital:</strong> Esta operação registra seu IP e dispositivo para segurança.</p>
                            <p><strong>2. Risco:</strong> O Pool realiza empréstimos P2P e possui risco de inadimplência.</p>
                            <p><strong>3. Liquidez:</strong> Aporte irretratável com resgate permitido apenas em Dezembro (19 a 21).</p>
                            <p><strong>4. Garantias:</strong> Dívidas na plataforma podem ser quitadas usando o saldo do Pool.</p>
                        </div>
                        <label className="flex items-center gap-2 mb-1 cursor-pointer">
                            <input type="checkbox" checked={aceitouTermos} onChange={(e) => setAceitouTermos(e.target.checked)} />
                            <span style={{ fontSize: '0.85rem' }}>Estou ciente e aceito os termos.</span>
                        </label>
                        <div className="grid-2" style={{ gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={() => setEtapa('aporte_valor')}>Voltar</button>
                            <button className="btn btn-primary" onClick={() => setEtapa('aporte_senha')} disabled={!aceitouTermos}>
                                Aceitar e Continuar
                            </button>
                        </div>
                    </div>
                )}

                {etapa === 'aporte_senha' && (
                    <div className="card">
                        <h3 className="mb-1">Passo 3: Confirmar Operação</h3>
                        <div className="info-block mb-1" style={{ textAlign: 'center', background: 'rgba(255,204,0,0.05)' }}>
                            <p style={{ fontSize: '0.8rem', margin: 0 }}>Você está aportando:</p>
                            <h2 style={{ color: 'var(--primary)', margin: '5px 0' }}>R$ {Number(valorAporte).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                        </div>
                        <div className="input-group">
                            <label>Sua Senha de Acesso</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showSenha ? "text" : "password"}
                                    className="input-field"
                                    placeholder="******"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    style={{ paddingRight: '45px' }}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSenha(!showSenha)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px'
                                    }}
                                >
                                    {showSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                        <button className="btn btn-primary w-full" onClick={handleAporteFinal} disabled={loading || !senha}>
                            {loading ? 'Processando...' : 'Confirmar e Finalizar'}
                        </button>
                    </div>
                )}

                {/* FLOW RESGATE */}
                {etapa === 'resgate_valor' && (
                    <div className="card">
                        {!isDezembroResgate ? (
                            <div className="text-center">
                                <Calendar size={48} color="var(--warning)" className="mb-1" />
                                <h3 className="mb-1">Resgate Indisponível</h3>
                                <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                                    Para garantir a liquidez dos empréstimos do Pool, os resgates ocorrem apenas entre **19/12 e 21/12**.
                                </p>
                                <button className="btn btn-primary mt-1" onClick={resetar}>Voltar</button>
                            </div>
                        ) : (
                            <>
                                <h3 className="mb-1">Quanto deseja resgatar?</h3>
                                <div className="input-group">
                                    <label>Valor do Resgate</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="R$ 0,00"
                                        value={valorResgate}
                                        onChange={(e) => setValorResgate(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="grid-2" style={{ gap: '10px' }}>
                                    <button className="btn btn-secondary" onClick={resetar}>Voltar</button>
                                    <button className="btn btn-primary" onClick={() => setEtapa('resgate_senha')} disabled={!valorResgate || valorResgate <= 0}>
                                        Continuar
                                    </button>
                                </div>
                                {usuario.divida_total_pool > 0 && (
                                    <div className="alert alert-warning mt-1" style={{ fontSize: '0.75rem', textAlign: 'left' }}>
                                        <AlertTriangle size={14} /> <strong>Atenção:</strong> Resgates acima do saldo disponível (R$ {usuario.saldo_caixa_disponivel?.toLocaleString('pt-BR')}) resultarão em liquidação automática da sua dívida ativa.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {etapa === 'resgate_senha' && (
                    <div className="card">
                        <h3 className="mb-1">Confirmar Resgate</h3>
                        <div className="info-block mb-1" style={{ textAlign: 'center', background: 'rgba(255,145,0,0.05)' }}>
                            <p style={{ fontSize: '0.8rem', margin: 0 }}>Valor a resgatar:</p>
                            <h2 style={{ color: 'var(--warning)', margin: '5px 0' }}>R$ {Number(valorResgate).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                        </div>
                        <div className="input-group">
                            <label>Sua Senha de Acesso</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showSenha ? "text" : "password"}
                                    className="input-field"
                                    placeholder="******"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    style={{ paddingRight: '45px' }}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSenha(!showSenha)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '4px'
                                    }}
                                >
                                    {showSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                        <button className="btn btn-primary w-full" onClick={handleResgateFinal} disabled={loading || !senha}>
                            {loading ? 'Processando...' : 'Confirmar Resgate'}
                        </button>
                    </div>
                )}

                {/* CRONOGRAMA SEMPRE VISÍVEL NO INÍCIO */}
                {etapa === 'inicial' && (
                    <div className="card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                            <Calendar size={18} color="var(--text-muted)" />
                            <h3 style={{ fontSize: '0.95rem' }}>Cronograma e Bônus</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="info-block" style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.02)', fontSize: '0.75rem' }}>
                                <strong>Bônus de Pontualidade:</strong> Cada parcela de empréstimo paga em dia por você gera um bônus extra no seu saldo do Caixa.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CaixaInvestidor;
