import React, { useState, useEffect } from 'react';
import api from '../api';
import {
    Wallet,
    TrendingUp,
    PlusCircle,
    ArrowUpCircle,
    ArrowDownCircle,
    Lock,
    Unlock,
    Briefcase,
    ChevronRight,
    Eye,
    EyeOff,
    Search,
    ArrowRight,
    ShieldAlert,
    Copy,
    Check,
    History,
    AlertCircle
} from 'lucide-react';

const DashboardInvestidor = () => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [carteira, setCarteira] = useState([]);
    const [activeView, setActiveView] = useState('home'); // 'home', 'mercado', 'carteira', 'depositar', 'resgatar'
    const [verSaldo, setVerSaldo] = useState(true);
    const [copiadoPix, setCopiadoPix] = useState(false);

    // Forms state
    const [valorNotificacao, setValorNotificacao] = useState('');
    const [valorSaque, setValorSaque] = useState('');
    const [valorInvestir, setValorInvestir] = useState({});
    const [aceiteRisco, setAceiteRisco] = useState({}); // Controle por ID de solicitação
    const [senhaSaque, setSenhaSaque] = useState('');
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [historico, setHistorico] = useState([]);
    const [kycDetails, setKycDetails] = useState('');

    // Modal state
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const copiarPix = () => {
        navigator.clipboard.writeText('credpix@gmail.com');
        setCopiadoPix(true);
        setTimeout(() => setCopiadoPix(false), 2000);
    };

    const carregarDados = async () => {
        try {
            const perfil = await api.get('/auth/perfil');
            setUsuario(perfil);
            const lista = await api.get('/emprestimos/listar');
            setSolicitacoes(lista);
            const minhaCarteira = await api.get('/investidor/carteira');
            setCarteira(minhaCarteira);

            // Carregar histórico
            const hist = await api.get('/financeiro/meu-historico');
            setHistorico(hist);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    const handleInvestir = async (solicitacaoId) => {
        const valor = valorInvestir[solicitacaoId];
        const aceite = aceiteRisco[solicitacaoId];

        if (!valor || parseFloat(valor) <= 0) return alert('Digite um valor válido.');
        if (!aceite) return alert('Você deve aceitar os riscos do investimento para continuar.');

        try {
            await api.post(`/investidor/investir/${solicitacaoId}`, {
                valor: parseFloat(valor),
                aceite_risco: true
            });
            setMensagem('Investimento realizado com sucesso!');
            carregarDados();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleNotificarDeposito = async () => {
        try {
            await api.post('/financeiro/notificar-deposito', { valor: parseFloat(valorNotificacao) });
            setMensagem('Notificação enviada!');
            setValorNotificacao('');
            setActiveView('home');
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleSolicitarSaque = async () => {
        if (!senhaSaque || !codigo2faSaque) {
            setMensagem('Erro: Senha e Código 2FA são obrigatórios.');
            return;
        }
        try {
            await api.post('/financeiro/solicitar-saque', {
                valor: parseFloat(valorSaque),
                chave_pix: usuario.chave_pix,
                senha: senhaSaque,
                codigo_2fa: codigo2faSaque
            });
            setMensagem('Solicitação de resgate enviada com sucesso!');
            setValorSaque('');
            setSenhaSaque('');
            setCodigo2faSaque('');
            setActiveView('home');
            carregarDados();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleDesbloquear = (solicitacaoId) => {
        setModal({
            open: true,
            type: 'desbloquear',
            data: { id: solicitacaoId }
        });
    };

    const confirmarDesbloqueio = async () => {
        const id = modal.data.id;
        setModal({ ...modal, open: false });
        try {
            const res = await api.post(`/emprestimos/desbloquear-dados/${id}`);
            setMensagem(res.message);
            carregarDados();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const totalInvestido = carteira.reduce((acc, item) => acc + item.valor_investido, 0);

    return (
        <div className="investidor-dashboard">
            <header className="mb-1">
                <h1>Painel Investidor</h1>
                <p className="text-muted">Multiplique seu capital com segurança.</p>
            </header>

            {mensagem && (
                <div className={`alert ${mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'}`}>
                    <span>{mensagem}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Wallet Overview Card */}
            <div className="card card-actionable" onClick={() => setActiveView('home')}>
                <div className="flex-between mb-1">
                    <div className="flex-between" style={{ gap: '10px' }}>
                        <Wallet size={20} color="var(--success)" />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Minha Carteira</span>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" />
                </div>

                <div className="flex-between">
                    <div>
                        <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>SALDO DISPONÍVEL</p>
                        {verSaldo ? (
                            <h2 style={{ fontSize: '1.75rem', color: 'var(--success)' }}>
                                R$ {(usuario.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h2>
                        ) : (
                            <div style={{ height: '32px', width: '150px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                        )}
                        <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>
                            Total Investido: <span style={{ fontWeight: 700 }}>R$ {totalInvestido.toLocaleString('pt-BR')}</span>
                        </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setVerSaldo(!verSaldo); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {verSaldo ? <Eye size={24} /> : <EyeOff size={24} />}
                    </button>
                </div>
            </div>

            {/* Action Mosaic */}
            <div className="action-grid">
                <div className="action-btn" onClick={() => setActiveView('mercado')}>
                    <Search size={28} color="var(--primary)" />
                    <span>Explorar</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('depositar')}>
                    <ArrowUpCircle size={28} />
                    <span>Depositar</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('resgatar')}>
                    <ArrowDownCircle size={28} />
                    <span>Resgatar</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('carteira')}>
                    <Briefcase size={28} />
                    <span>Ativos</span>
                </div>
            </div>

            {activeView === 'home' && (
                <div className="card mt-1">
                    <div className="flex-between mb-1">
                        <h3>Últimas Atividades</h3>
                        <History size={18} color="var(--text-muted)" />
                    </div>
                    {historico.length === 0 ? (
                        <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>Nenhuma movimentação recente.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {historico.map(h => (
                                <div key={h.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: `3px solid ${h.status === 'concluido' ? 'var(--success)' : h.status === 'falhou' ? 'var(--danger)' : 'var(--warning)'}` }}>
                                    <div className="flex-between">
                                        <div>
                                            <p style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase' }}>{h.tipo.replace('_', ' ')}</p>
                                            <p className="text-muted" style={{ fontSize: '0.7rem' }}>{new Date(h.data).toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p style={{ fontWeight: 800, color: h.tipo === 'deposito' ? 'var(--success)' : 'var(--text-main)' }}>
                                                {h.tipo === 'deposito' ? '+' : '-'} R$ {h.valor.toLocaleString('pt-BR')}
                                            </p>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: h.status === 'concluido' ? 'var(--success)' : h.status === 'falhou' ? 'var(--danger)' : 'var(--warning)' }}>
                                                {h.status.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    {h.status === 'falhou' && h.detalhes && (
                                        <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255, 61, 0, 0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255, 61, 0, 0.1)' }}>
                                            <AlertCircle size={14} color="var(--danger)" />
                                            <p style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>{h.detalhes}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Views */}
            {activeView === 'depositar' && (
                <div className="card">
                    <h2>Adicionar Fundos</h2>
                    <p className="text-muted mb-1">Transfira via PIX para a chave abaixo e informe o valor:</p>
                    <div className="info-block mb-1 text-center" style={{ position: 'relative' }}>
                        <div className="info-label">Chave PIX (E-mail)</div>
                        <div className="info-value" style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            credpix@gmail.com
                            <button
                                onClick={copiarPix}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: copiadoPix ? 'var(--success)' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'var(--transition)'
                                }}
                                title="Copiar chave PIX"
                            >
                                {copiadoPix ? <Check size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                        {copiadoPix && <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px', textAlign: 'center' }}>Copiado!</p>}
                    </div>

                    {!usuario.is_verified && (
                        <div className="card-minimal mt-1" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>✅ Verificação de Conta</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Sua privacidade é prioridade sob a LGPD.</p>

                            {/* Motivo de rejeição no Investidor */}
                            {(() => {
                                const kycRejeitado = historico.find(h => h.tipo === 'desbloqueio_dados' && h.status === 'falhou');
                                if (kycRejeitado) {
                                    return (
                                        <div style={{ background: 'rgba(255, 61, 0, 0.1)', border: '1px solid rgba(255, 61, 0, 0.2)', padding: '12px', borderRadius: '12px', marginBottom: '1.5rem', width: '100%', maxWidth: '400px' }}>
                                            <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                <AlertCircle size={16} /> ÚLTIMA TENTATIVA REJEITADA
                                            </p>
                                            <p style={{ color: '#fff', fontSize: '0.85rem', marginTop: '6px', fontStyle: 'italic' }}>"{kycRejeitado.detalhes}"</p>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem' }}>Cole o link dos documentos ou descreva o envio:</p>
                            <textarea
                                className="input-field mt-1"
                                style={{ width: '100%', maxWidth: '400px', marginBottom: '1rem' }}
                                placeholder="Link do Google Drive/Imgur ou Informe o envio..."
                                value={kycDetails}
                                onChange={(e) => setKycDetails(e.target.value)}
                            />
                            <button className="btn btn-primary" style={{ width: 'auto', minWidth: '200px', padding: '0.75rem 1.5rem' }} onClick={async () => {
                                if (!kycDetails) return alert('Informe os detalhes.');
                                try {
                                    await api.post('/score/solicitar-verificacao', { detalhes: kycDetails });
                                    setMensagem('Solicitação enviada!');
                                    setKycDetails('');
                                    carregarDados();
                                } catch (err) {
                                    setMensagem('Erro: ' + err.message);
                                }
                            }}>Reenviar Docs (R$ 35,00)</button>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', maxWidth: '280px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="Valor do Depósito R$"
                                style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%' }}
                                value={valorNotificacao}
                                onChange={(e) => setValorNotificacao(e.target.value)}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '1.5rem' }}>
                        <button className="btn btn-primary" style={{ width: 'auto', minWidth: '200px' }} onClick={handleNotificarDeposito}>Confirmar Depósito</button>
                        <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '120px' }} onClick={() => setActiveView('home')}>Voltar</button>
                    </div>
                </div>
            )}

            {activeView === 'resgatar' && (
                <div className="card">
                    <h2>Resgatar Saldo</h2>

                    {!usuario.two_factor_enabled ? (
                        <div className="text-center" style={{ padding: '1rem' }}>
                            <div style={{ color: 'var(--warning)', marginBottom: '1rem' }}>🛡️</div>
                            <p className="mb-1" style={{ fontWeight: 600 }}>2FA Desativado</p>
                            <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Por segurança, o 2FA é obrigatório para todos os resgates.</p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-primary" style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.85rem' }} onClick={() => window.location.hash = 'seguranca'}>Configurar 2FA Agora</button>
                                <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.85rem' }} onClick={() => setActiveView('home')}>Voltar</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-muted mb-1">O valor cairá na sua chave cadastrada: <strong>{usuario.chave_pix}</strong></p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', marginTop: '1.5rem' }}>
                                <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valor do Resgate</label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="R$ 0,00"
                                        value={valorSaque}
                                        onChange={(e) => setValorSaque(e.target.value)}
                                        style={{ textAlign: 'center' }}
                                    />
                                </div>

                                <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sua Senha de Acesso</label>
                                    <input
                                        type="password"
                                        className="input-field"
                                        placeholder="••••••••"
                                        value={senhaSaque}
                                        onChange={(e) => setSenhaSaque(e.target.value)}
                                        style={{ textAlign: 'center' }}
                                    />
                                </div>

                                <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Código 2FA (Authenticator)</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        placeholder="000 000"
                                        maxLength={6}
                                        value={codigo2faSaque}
                                        onChange={(e) => setCodigo2faSaque(e.target.value)}
                                        style={{ textAlign: 'center', letterSpacing: '2px' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '2rem' }}>
                                <button className="btn btn-primary" style={{ width: 'auto', minWidth: '200px' }} onClick={handleSolicitarSaque}>Confirmar Resgate</button>
                                <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '120px' }} onClick={() => setActiveView('home')}>Voltar</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Market / Opportunities */}
            {(activeView === 'home' || activeView === 'mercado') && (
                <div className="mt-1">
                    <div className="flex-between mb-1">
                        <h3>Oportunidades</h3>
                        <TrendingUp size={18} color="var(--primary)" />
                    </div>

                    {solicitacoes.length === 0 ? (
                        <div className="card text-center text-muted">Aguardando novos pedidos...</div>
                    ) : (
                        solicitacoes.map(sol => (
                            <div key={sol.id} className="card">
                                <div className="flex-between mb-1">
                                    <div>
                                        <div className="flex-between" style={{ gap: '8px' }}>
                                            <h3 style={{ textTransform: 'capitalize' }}>{sol.nome || 'Dados Ocultos'}</h3>
                                            {sol.verified && <span title="Verificado" style={{ color: 'var(--success)' }}>✅</span>}
                                        </div>
                                        <p className="text-muted" style={{ fontSize: '0.8rem' }}>Score Tomador: {sol.score}</p>
                                    </div>
                                    <div className="text-right">
                                        <p style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>{sol.taxa}% <span style={{ fontSize: '0.7rem' }}>a.m</span></p>
                                    </div>
                                </div>

                                <div className="info-block mb-1">
                                    <div className="flex-between" style={{ marginBottom: '8px' }}>
                                        <span className="info-label">Meta</span>
                                        <span style={{ fontWeight: 600 }}>R$ {sol.valor.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                                        <div style={{ width: `${(sol.valor_arrecadado / sol.valor) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                                    </div>
                                    <div className="flex-between text-muted" style={{ fontSize: '0.7rem' }}>
                                        <span>Faltam R$ {(sol.valor - sol.valor_arrecadado).toLocaleString('pt-BR')}</span>
                                        <span>Prazo: {sol.parcelas}x</span>
                                    </div>
                                </div>

                                {!sol.unlocked ? (
                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ borderStyle: 'dashed', width: 'auto', minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            onClick={() => handleDesbloquear(sol.id)}
                                        >
                                            <Lock size={16} /> Desbloquear Perfil (R$ 15)
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(255, 61, 0, 0.05)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 61, 0, 0.1)' }}>
                                            <input
                                                type="checkbox"
                                                id={`risco-${sol.id}`}
                                                style={{ marginTop: '4px' }}
                                                onChange={(e) => setAceiteRisco({ ...aceiteRisco, [sol.id]: e.target.checked })}
                                            />
                                            <label htmlFor={`risco-${sol.id}`} style={{ fontSize: '0.7rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                                                Estou ciente que este é um investimento de risco (P2P) e a plataforma Peer não garante o pagamento em caso de inadimplência do tomador.
                                            </label>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                                            <div className="flex-between" style={{ gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', maxWidth: '280px' }}>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    placeholder="Valor R$"
                                                    style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.75rem' }}
                                                    onChange={(e) => setValorInvestir({ ...valorInvestir, [sol.id]: e.target.value })}
                                                />
                                                <button
                                                    className="btn btn-primary"
                                                    style={{
                                                        width: '48px',
                                                        height: '48px',
                                                        borderRadius: '12px',
                                                        padding: 0,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        opacity: aceiteRisco[sol.id] ? 1 : 0.3,
                                                        cursor: aceiteRisco[sol.id] ? 'pointer' : 'not-allowed'
                                                    }}
                                                    onClick={() => handleInvestir(sol.id)}
                                                    disabled={!aceiteRisco[sol.id]}
                                                >
                                                    <ArrowRight size={22} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Wallet Detail View */}
            {(activeView === 'carteira') && (
                <div className="mt-1">
                    <div className="flex-between mb-1">
                        <h3>Minha Carteira</h3>
                        <button className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => setActiveView('home')}>Fechar</button>
                    </div>
                    {carteira.length === 0 ? (
                        <div className="card text-center text-muted">Você ainda não investiu em ativos.</div>
                    ) : (
                        carteira.map(item => (
                            <div key={item.id} className="card">
                                <div className="flex-between mb-1">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ fontSize: '1rem', textTransform: 'capitalize' }}>{item.tomador_nome}</h3>
                                        {item.tomador_is_verified && <span title="Verificado" style={{ color: 'var(--success)', fontSize: '0.9rem' }}>✅</span>}
                                    </div>
                                    <div className="badge badge-success">RENTABILIZANDO</div>
                                </div>
                                <div className="grid-2" style={{ gap: '10px' }}>
                                    <div className="info-block">
                                        <div className="info-label">Aplicado</div>
                                        <div style={{ fontWeight: 600 }}>R$ {item.valor_investido.toLocaleString('pt-BR')}</div>
                                    </div>
                                    <div className="info-block">
                                        <div className="info-label">Retorno Total</div>
                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>R$ {item.valor_esperado.toLocaleString('pt-BR')}</div>
                                    </div>
                                </div>
                                <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.8rem' }}>
                                    <span>Recebido: R$ {item.valor_recebido.toLocaleString('pt-BR')}</span>
                                    <span>Prazo: {item.parcelas_pagas}/{item.total_parcelas}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
            {/* Modal de Confirmação */}
            {modal.open && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-icon">
                            <Lock size={32} />
                        </div>
                        <h2>Confirmar Pagamento</h2>
                        <p>Deseja desbloquear os dados completos deste perfil por <strong>R$ 15,00</strong>?</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '-0.5rem' }}>O valor será debitado do seu saldo.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2rem' }}>
                            <button className="btn btn-primary" onClick={confirmarDesbloqueio}>Confirmar e Pagar</button>
                            <button className="btn btn-secondary" onClick={() => setModal({ ...modal, open: false })}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardInvestidor;
