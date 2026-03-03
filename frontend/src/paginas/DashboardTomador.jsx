import React, { useState, useEffect } from 'react';
import api from '../api';
import {
    HandCoins,
    PlusCircle,
    ArrowUpCircle,
    ArrowDownCircle,
    ShieldCheck,
    LayoutDashboard,
    History,
    ChevronRight,
    TrendingUp,
    Eye,
    EyeOff,
    FileText,
    Clock,
    Wallet,
    ShieldAlert,
    Copy,
    Check,
    AlertCircle
} from 'lucide-react';

const DashboardTomador = () => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [meusEmprestimos, setMeusEmprestimos] = useState([]);
    const [activeView, setActiveView] = useState('home'); // 'home', 'solicitar', 'depositar', 'saque', 'score'
    const [verSaldo, setVerSaldo] = useState(true);
    const [copiadoPix, setCopiadoPix] = useState(false);

    // Modal state
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    // Forms state
    const [valorNotificacao, setValorNotificacao] = useState('');
    const [valorSaque, setValorSaque] = useState('');
    const [valor, setValor] = useState('');
    const [taxa, setTaxa] = useState('');
    const [parcelas, setParcelas] = useState(1);
    const [senhaSaque, setSenhaSaque] = useState('');
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [aceiteSolicitacao, setAceiteSolicitacao] = useState(false);
    const [mensagem, setMensagem] = useState('');
    const [kycDetails, setKycDetails] = useState('');
    const [mostrarAlertaRejeicao, setMostrarAlertaRejeicao] = useState(true);
    const [historico, setHistorico] = useState([]);
    const [paginaHist, setPaginaHist] = useState(1);
    const [paginaContratos, setPaginaContratos] = useState(1);
    const ITENS_POR_PAGINA = 5;

    const carregarDados = async () => {
        try {
            const dadosServer = await api.get('/auth/perfil');
            if (dadosServer) {
                setUsuario(dadosServer);
                localStorage.setItem('usuario', JSON.stringify(dadosServer));
            }
            const lista = await api.get('/emprestimos/meus-emprestimos');
            setMeusEmprestimos(lista);

            // Novo: Carregar histórico para ver motivos de rejeição
            const hist = await api.get('/financeiro/meu-historico');
            setHistorico(hist);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    const handleSolicitar = async (e) => {
        e.preventDefault();
        if (!aceiteSolicitacao) return alert('Você deve aceitar os termos de intermediação.');
        try {
            await api.post('/emprestimos/solicitar', {
                valor: parseFloat(valor),
                taxa_juros: parseFloat(taxa),
                parcelas
            });
            setMensagem('Solicitação enviada! Custo de R$ 4,00 descontado.');
            setActiveView('home');
            setValor(''); setTaxa(''); setParcelas(1);
            carregarDados();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handlePagarParcela = async (id, valorParcela) => {
        try {
            const res = await api.post(`/emprestimos/pagar-parcela/${id}`, { valor_pagamento: valorParcela });
            setMensagem(res.message);
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao pagar: ' + err.message);
        }
    };

    const handleQuitar = (emprestimoId) => {
        setModal({
            open: true,
            type: 'quitar',
            title: 'Quitar Empréstimo',
            message: 'Deseja quitar o valor integral do empréstimo agora? Esta ação liquidará todas as parcelas restantes.',
            action: () => confirmarQuitar(emprestimoId)
        });
    };

    const confirmarQuitar = async (emprestimoId) => {
        setModal({ ...modal, open: false });
        try {
            await api.post(`/emprestimos/quitar-total/${emprestimoId}`);
            setMensagem('Empréstimo quitado com sucesso!');
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao quitar: ' + err.message);
        }
    };

    const handleNotificarDeposito = async () => {
        try {
            await api.post('/financeiro/notificar-deposito', { valor: parseFloat(valorNotificacao) });
            setMensagem('Notificação enviada! O administrador creditará seu saldo em breve.');
            setValorNotificacao('');
            setActiveView('home');
        } catch (err) {
            setMensagem('Erro ao notificar: ' + err.message);
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
            setMensagem('Solicitação de saque enviada com sucesso!');
            setValorSaque('');
            setSenhaSaque('');
            setCodigo2faSaque('');
            setActiveView('home');
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao solicitar saque: ' + err.message);
        }
    };

    const handleComprarScore = () => {
        setModal({
            open: true,
            type: 'score',
            title: 'Aumentar Score',
            message: 'Deseja comprar +1.5 de Score por R$ 35,00?',
            action: confirmarCompraScore
        });
    };

    const confirmarCompraScore = async () => {
        setModal({ ...modal, open: false });
        try {
            const res = await api.post('/score/comprar');
            setMensagem(res.message);
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao comprar score: ' + err.message);
        }
    };

    const handleSolicitarVerificacao = () => {
        if (!kycDetails) return alert('Informe os detalhes do envio.');
        setModal({
            open: true,
            type: 'kyc',
            title: 'Solicitar Verificação',
            message: 'Taxa de análise humana: R$ 35,00. Deseja prosseguir?',
            action: confirmarSolicitarVerificacao
        });
    };

    const confirmarSolicitarVerificacao = async () => {
        setModal({ ...modal, open: false });
        try {
            const res = await api.post('/score/solicitar-verificacao', { detalhes: kycDetails });
            setMensagem(res.message);
            setKycDetails('');
            setActiveView('home');
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao solicitar verificação: ' + err.message);
        }
    };

    const copiarPix = () => {
        navigator.clipboard.writeText('credpix@gmail.com');
        setCopiadoPix(true);
        setTimeout(() => setCopiadoPix(false), 2000);
    };

    const carregarPendentes = async () => {
        try {
            const blob = await api.getBlob(`/emprestimos/contrato/pdf/${id}`);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `contrato_peer_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Erro ao baixar contrato: ' + err.message);
        }
    };

    // Render logic
    return (
        <div className="tomador-dashboard">
            <header className="mb-1">
                <h1>Olá, {usuario.nome.split(' ')[0]}</h1>
                <p className="text-muted">Seu dinheiro rendendo e crescendo.</p>
            </header>

            {mensagem && (
                <div className={`alert ${mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'}`}>
                    <span>{mensagem}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Main Balance Card - Nubank Style */}
            <div className="card card-actionable" onClick={() => setActiveView('home')}>
                <div className="flex-between mb-1" style={{ width: '100%' }}>
                    <div className="flex-between" style={{ gap: '10px' }}>
                        <HandCoins size={20} color="var(--primary)" />
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Conta</span>
                    </div>
                    <ChevronRight size={18} color="var(--text-muted)" />
                </div>

                <div className="flex-between">
                    <div>
                        {verSaldo ? (
                            <h2 style={{ fontSize: '1.75rem' }}>
                                R$ {(usuario.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </h2>
                        ) : (
                            <div style={{ height: '32px', width: '150px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                        )}
                        <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>
                            Score Financeiro: <span className="text-primary" style={{ fontWeight: 800 }}>{(usuario.score || 0).toFixed(1)}</span>
                        </p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setVerSaldo(!verSaldo); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        {verSaldo ? <Eye size={24} /> : <EyeOff size={24} />}
                    </button>
                </div>
            </div>

            {/* Action Mosaic / Grid */}
            <div className="action-grid">
                <div className="action-btn" onClick={() => setActiveView('solicitar')}>
                    <PlusCircle size={28} color="var(--primary)" />
                    <span>Solicitar</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('depositar')}>
                    <ArrowUpCircle size={28} />
                    <span>Depositar</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('saque')}>
                    <ArrowDownCircle size={28} />
                    <span>Sacar</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('score')}>
                    <ShieldCheck size={28} />
                    <span>Upgrade</span>
                </div>
            </div>

            {/* View Switcher Content */}
            {activeView === 'solicitar' && (
                <div className="card">
                    <h2 className="mb-1" style={{ color: 'var(--primary)' }}>Novo Empréstimo</h2>
                    <form onSubmit={handleSolicitar}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                            <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                                <label style={{ textAlign: 'center', display: 'block' }}>Quanto você precisa?</label>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <input
                                        type="number"
                                        className="input-field"
                                        placeholder="0,00"
                                        style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%' }}
                                        value={valor}
                                        onChange={(e) => setValor(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '280px' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label style={{ textAlign: 'center', display: 'block', fontSize: '0.8rem' }}>Taxa (% mês)</label>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="input-field"
                                            placeholder="Ex: 5"
                                            style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.75rem', textAlign: 'center', width: '100%', fontSize: '0.9rem' }}
                                            value={taxa}
                                            onChange={(e) => setTaxa(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label style={{ textAlign: 'center', display: 'block', fontSize: '0.8rem' }}>Prazo (meses)</label>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="Ex: 12"
                                            style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.75rem', textAlign: 'center', width: '100%', fontSize: '0.9rem' }}
                                            value={parcelas}
                                            onChange={(e) => setParcelas(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {valor && taxa && parcelas && (
                            <div className="info-block mb-1">
                                <div className="info-label">Parcela Estimada</div>
                                <div className="info-value text-primary">
                                    R$ {((parseFloat(valor) * (1 + (parseFloat(taxa) / 100 * parcelas))) / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                                <small className="text-muted">Total: R$ {(parseFloat(valor) * (1 + (parseFloat(taxa) / 100 * parcelas))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small>
                            </div>
                        )}

                        <div style={{ padding: '15px', background: 'rgba(0, 230, 118, 0.05)', borderRadius: '12px', border: '1px solid rgba(0, 230, 118, 0.1)', maxWidth: '400px', margin: '1.5rem auto' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                <input
                                    type="checkbox"
                                    id="aceite-solicitacao"
                                    checked={aceiteSolicitacao}
                                    onChange={(e) => setAceiteSolicitacao(e.target.checked)}
                                    style={{ marginTop: '4px' }}
                                />
                                <label htmlFor="aceite-solicitacao" style={{ fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                                    Estou ciente que esta é uma <strong>intermediação tecnológica</strong> e que estou firmando um contrato civil de mútuo com investidores particulares através da plataforma SaaS Peer.
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <button type="submit" className="btn btn-primary" style={{ width: 'auto', minWidth: '220px', padding: '0.75rem 1.5rem', opacity: aceiteSolicitacao ? 1 : 0.5 }} disabled={!aceiteSolicitacao}>Confirmar Pedido</button>
                            <button type="button" className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px' }} onClick={() => setActiveView('home')}>Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            {activeView === 'depositar' && (
                <div className="card">
                    <h2 className="mb-1">Adicionar Saldo</h2>
                    <p className="mb-1">Transfira via PIX para a chave abaixo e informe o valor:</p>
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
                        {copiadoPix && <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px' }}>Copiado!</p>}
                    </div>
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
                        <button className="btn btn-primary" style={{ width: 'auto', minWidth: '180px' }} onClick={handleNotificarDeposito}>Informar Depósito</button>
                        <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '120px' }} onClick={() => setActiveView('home')}>Voltar</button>
                    </div>
                </div>
            )}

            {activeView === 'saque' && (
                <div className="card">
                    <h2 className="mb-1">Solicitar Saque</h2>

                    {!usuario.two_factor_enabled ? (
                        <div className="text-center" style={{ padding: '1rem' }}>
                            <ShieldAlert size={48} color="var(--warning)" style={{ margin: '0 auto 1rem' }} />
                            <p className="mb-1" style={{ fontWeight: 600 }}>2FA Desativado</p>
                            <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Por segurança, o 2FA é obrigatório para todos os saques.</p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-primary" style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.85rem' }} onClick={() => window.location.hash = 'seguranca'}>Configurar 2FA Agora</button>
                                <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.6rem 1rem', fontSize: '0.85rem' }} onClick={() => setActiveView('home')}>Voltar</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="mb-1">O valor será enviado para sua chave PIX cadastrada: <br /><strong>{usuario.chave_pix}</strong></p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center', marginTop: '1.5rem' }}>
                                <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Valor do Saque</label>
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
                                <button className="btn btn-primary" style={{ width: 'auto', minWidth: '180px' }} onClick={handleSolicitarSaque}>Confirmar Saque</button>
                                <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '120px' }} onClick={() => setActiveView('home')}>Voltar</button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeView === 'score' && (
                <div className="card">
                    <h2 className="mb-1">Upgrade de Perfil</h2>
                    <div className="card-minimal mb-1" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>🚀 Turbo Score</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Adicione +1.5 pontos ao seu score instantaneamente.</p>
                        <button className="btn btn-outline" style={{ width: 'auto', minWidth: '200px', padding: '0.75rem 1.5rem' }} onClick={handleComprarScore}>Comprar por R$ 35,00</button>
                    </div>
                    {!usuario.is_verified && (
                        <div className="card-minimal" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>✅ Verificação de Conta</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Sua privacidade é prioridade: não armazenamos fotos de documentos locais. Seus dados estão protegidos sob a LGPD.</p>

                            {/* Novo: Exibir motivo de rejeição anterior se houver */}
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

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '1rem' }}>Como enviar: <br /> 1. Suba seus docs no Google Drive ou Imgur <br /> 2. Cole o link no campo abaixo <br /> 3. Ou descreva como nos enviou (ex: via WhatsApp).</p>
                            <textarea
                                className="input-field mt-1"
                                style={{ width: '100%', maxWidth: '400px', marginBottom: '1rem' }}
                                placeholder="Link do Google Drive/Imgur ou Informe o envio..."
                                value={kycDetails}
                                onChange={(e) => setKycDetails(e.target.value)}
                            />
                            <button className="btn btn-primary" style={{ width: 'auto', minWidth: '200px', padding: '0.75rem 1.5rem' }} onClick={handleSolicitarVerificacao}>Reenviar Docs (R$ 35,00)</button>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px' }} onClick={() => setActiveView('home')}>Voltar</button>
                    </div>
                </div>
            )}

            {activeView === 'home' && (
                <>
                    {/* Alerta de Rejeição Recente */}
                    {mostrarAlertaRejeicao && historico.some(h => h.status === 'falhou') && (
                        <div className="alert alert-danger mb-1" style={{ maxWidth: '100%', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', position: 'relative' }}>
                            <button
                                onClick={() => setMostrarAlertaRejeicao(false)}
                                style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}
                            >
                                ✕
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={20} />
                                <strong style={{ fontSize: '0.9rem' }}>Atenção: Você tem solicitações rejeitadas</strong>
                            </div>
                            <p style={{ margin: '8px 0 0 28px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                                Verifique o motivo no histórico abaixo ou no detalhe da atividade.
                            </p>
                        </div>
                    )}

                    <div className="grid-2">
                        {/* Seção de Últimas Atividades (Histórico) */}
                        <div className="card mt-1">
                            <div className="flex-between mb-1">
                                <h3>Últimas Atividades</h3>
                                <History size={18} color="var(--text-muted)" />
                            </div>
                            {historico.length === 0 ? (
                                <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>Nenhuma movimentação recente.</p>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {historico.slice((paginaHist - 1) * ITENS_POR_PAGINA, paginaHist * ITENS_POR_PAGINA).map(h => (
                                            <div key={h.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: `3px solid ${h.status === 'concluido' ? 'var(--success)' : h.status === 'falhou' ? 'var(--danger)' : 'var(--warning)'}` }}>
                                                <div className="flex-between">
                                                    <div>
                                                        <p style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase' }}>{h.tipo?.replace('_', ' ') || 'TRANSAÇÃO'}</p>
                                                        <p className="text-muted" style={{ fontSize: '0.7rem' }}>{h.data ? new Date(h.data).toLocaleString('pt-BR') : '-'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p style={{ fontWeight: 800, color: h.tipo === 'deposito' ? 'var(--success)' : 'var(--text-main)' }}>
                                                            {h.tipo === 'deposito' ? '+' : '-'} R$ {h.valor?.toLocaleString('pt-BR')}
                                                        </p>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: h.status === 'concluido' ? 'var(--success)' : h.status === 'falhou' ? 'var(--danger)' : 'var(--warning)' }}>
                                                            {h.status?.toUpperCase() || '-'}
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

                                    {historico.length > ITENS_POR_PAGINA && (
                                        <div className="flex-between mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                            <button
                                                className="btn-outline"
                                                style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: paginaHist === 1 ? 0.3 : 1, width: 'auto' }}
                                                disabled={paginaHist === 1}
                                                onClick={() => setPaginaHist(p => p - 1)}
                                            >
                                                Anterior
                                            </button>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Página {paginaHist} de {Math.ceil(historico.length / ITENS_POR_PAGINA)}</span>
                                            <button
                                                className="btn-outline"
                                                style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: (paginaHist * ITENS_POR_PAGINA) >= historico.length ? 0.3 : 1, width: 'auto' }}
                                                disabled={(paginaHist * ITENS_POR_PAGINA) >= historico.length}
                                                onClick={() => setPaginaHist(p => p + 1)}
                                            >
                                                Próxima
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Active Contracts Section */}
                        <div className="card mt-1">
                            <div className="flex-between mb-1">
                                <h3>Meus Contratos</h3>
                                <LayoutDashboard size={18} color="var(--text-muted)" />
                            </div>

                            {meusEmprestimos.length === 0 ? (
                                <div className="card text-center" style={{ border: '2px dashed var(--border-color)', background: 'transparent', margin: 0 }}>
                                    <p>Nenhum contrato ativo no momento.</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {meusEmprestimos.slice((paginaContratos - 1) * ITENS_POR_PAGINA, paginaContratos * ITENS_POR_PAGINA).map(emp => (
                                            <div key={emp.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                                <div className="flex-between mb-1">
                                                    <div>
                                                        <span className={`badge ${emp.status === 'aprovado' ? 'badge-success' : 'badge-warning'}`}>
                                                            {emp.status.toUpperCase()}
                                                        </span>
                                                        <h3 className="mt-1" style={{ fontSize: '0.9rem' }}>Empréstimo #{emp.id}</h3>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-muted" style={{ fontSize: '0.6rem' }}>VALOR MENSAL</p>
                                                        <p style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>R$ {emp.valor_parcela.toLocaleString('pt-BR')}</p>
                                                    </div>
                                                </div>

                                                {emp.status === 'pendente' && (
                                                    <div style={{ background: 'rgba(255, 61, 0, 0.05)', padding: '6px', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid rgba(255, 61, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Clock size={12} color="var(--danger)" />
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 600 }}>
                                                            Expira em {Math.floor((new Date(emp.data_expiracao_4h + 'Z') - new Date()) / (1000 * 60 * 60))}h
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="info-block mb-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '0.75rem' }}>
                                                    <div>
                                                        <div className="info-label" style={{ fontSize: '0.6rem' }}>Parcelas</div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{emp.parcelas_pagas} / {emp.parcelas}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="info-label" style={{ fontSize: '0.6rem' }}>Restante</div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>R$ {emp.valor_total_restante.toLocaleString('pt-BR')}</div>
                                                    </div>
                                                </div>

                                                {emp.status === 'aprovado' && emp.parcelas_pagas < emp.parcelas && (
                                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                                                        <button className="btn-primary" style={{ height: '32px', fontSize: '0.75rem', borderRadius: '8px' }} onClick={() => handlePagarParcela(emp.id, emp.valor_parcela)}>Pagar</button>
                                                        <button className="btn-outline" style={{ height: '32px', fontSize: '0.75rem', borderRadius: '8px' }} onClick={() => handleQuitar(emp.id)}>Quitar</button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {meusEmprestimos.length > ITENS_POR_PAGINA && (
                                        <div className="flex-between mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                            <button
                                                className="btn-outline"
                                                style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: paginaContratos === 1 ? 0.3 : 1, width: 'auto' }}
                                                disabled={paginaContratos === 1}
                                                onClick={() => setPaginaContratos(p => p - 1)}
                                            >
                                                Anterior
                                            </button>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Página {paginaContratos} de {Math.ceil(meusEmprestimos.length / ITENS_POR_PAGINA)}</span>
                                            <button
                                                className="btn-outline"
                                                style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: (paginaContratos * ITENS_POR_PAGINA) >= meusEmprestimos.length ? 0.3 : 1, width: 'auto' }}
                                                disabled={(paginaContratos * ITENS_POR_PAGINA) >= meusEmprestimos.length}
                                                onClick={() => setPaginaContratos(p => p + 1)}
                                            >
                                                Próxima
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
            {/* Modal de Confirmação */}
            {modal.open && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-icon">
                            {modal.type === 'score' ? <TrendingUp size={32} /> :
                                modal.type === 'quitar' ? <HandCoins size={32} /> :
                                    <ShieldCheck size={32} />}
                        </div>
                        <h2>{modal.title}</h2>
                        <p>{modal.message}</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2rem' }}>
                            <button className="btn btn-primary" onClick={modal.action}>Confirmar e Pagar</button>
                            <button className="btn btn-secondary" onClick={() => setModal({ ...modal, open: false })}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardTomador;
