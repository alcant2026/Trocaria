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
    ShieldAlert
} from 'lucide-react';

const DashboardTomador = () => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [meusEmprestimos, setMeusEmprestimos] = useState([]);
    const [activeView, setActiveView] = useState('home'); // 'home', 'solicitar', 'depositar', 'saque', 'score'
    const [verSaldo, setVerSaldo] = useState(true);

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
    const [mensagem, setMensagem] = useState('');
    const [kycDetails, setKycDetails] = useState('');

    const carregarDados = async () => {
        try {
            const dadosServer = await api.get('/auth/perfil');
            if (dadosServer) {
                setUsuario(dadosServer);
                localStorage.setItem('usuario', JSON.stringify(dadosServer));
            }
            const lista = await api.get('/emprestimos/meus-emprestimos');
            setMeusEmprestimos(lista);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    const handleSolicitar = async (e) => {
        e.preventDefault();
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

    const handleBaixarContrato = async (id) => {
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

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '1.5rem' }}>
                            <button type="submit" className="btn btn-primary" style={{ width: 'auto', minWidth: '220px', padding: '0.75rem 1.5rem' }}>Confirmar Pedido</button>
                            <button type="button" className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px' }} onClick={() => setActiveView('home')}>Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            {activeView === 'depositar' && (
                <div className="card">
                    <h2 className="mb-1">Adicionar Saldo</h2>
                    <p className="mb-1">Transfira via PIX para a chave abaixo e informe o valor:</p>
                    <div className="info-block mb-1 text-center">
                        <div className="info-label">Chave PIX (E-mail)</div>
                        <div className="info-value" style={{ fontSize: '1rem' }}>credpix@gmail.com</div>
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
                            <button className="btn btn-primary" onClick={() => window.location.hash = 'seguranca'}>Configurar 2FA Agora</button>
                            <button className="btn btn-secondary mt-1" onClick={() => setActiveView('home')}>Voltar</button>
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
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Envie fotos dos seus documentos e ganhe selo de confiança.</p>
                            <textarea
                                className="input-field mt-1"
                                style={{ width: '100%', maxWidth: '400px', marginBottom: '1rem' }}
                                placeholder="Link dos documentos ou confirmação de envio..."
                                value={kycDetails}
                                onChange={(e) => setKycDetails(e.target.value)}
                            />
                            <button className="btn btn-primary" style={{ width: 'auto', minWidth: '200px', padding: '0.75rem 1.5rem' }} onClick={handleSolicitarVerificacao}>Verificar (R$ 35,00)</button>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px' }} onClick={() => setActiveView('home')}>Voltar</button>
                    </div>
                </div>
            )}

            {/* Active Contracts Section */}
            <div className="mt-1">
                <div className="flex-between mb-1">
                    <h3>Meus Contratos</h3>
                    <LayoutDashboard size={18} color="var(--text-muted)" />
                </div>

                {meusEmprestimos.length === 0 ? (
                    <div className="card text-center" style={{ border: '2px dashed var(--border-color)', background: 'transparent' }}>
                        <p>Nenhum contrato ativo no momento.</p>
                    </div>
                ) : (
                    meusEmprestimos.map(emp => (
                        <div key={emp.id} className="card">
                            <div className="flex-between mb-1">
                                <div>
                                    <span className={`badge ${emp.status === 'aprovado' ? 'badge-success' : 'badge-warning'}`}>
                                        {emp.status.toUpperCase()}
                                    </span>
                                    <h3 className="mt-1">Empréstimo #{emp.id}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-muted" style={{ fontSize: '0.7rem' }}>VALOR MENSAL</p>
                                    <p style={{ fontWeight: 700, color: 'var(--success)' }}>R$ {emp.valor_parcela.toLocaleString('pt-BR')}</p>
                                </div>
                            </div>

                            {/* Countdown Timer */}
                            {emp.status === 'pendente' && (
                                <div style={{ background: 'rgba(255, 61, 0, 0.05)', padding: '8px', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255, 61, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={14} color="var(--danger)" />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>
                                        {(() => {
                                            const agora = new Date();
                                            const expira = emp.valor_arrecadado === 0
                                                ? new Date(emp.data_expiracao_4h + 'Z')
                                                : new Date(emp.data_expiracao_5d + 'Z');
                                            const diff = expira - agora;

                                            if (diff <= 0) return "Expirando...";

                                            const horas = Math.floor(diff / (1000 * 60 * 60));
                                            const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                                            if (horas > 24) {
                                                const dias = Math.floor(horas / 24);
                                                return `Expira em ${dias}d ${horas % 24}h`;
                                            }
                                            return `Expira em ${horas}h ${minutos}m`;
                                        })()}
                                    </span>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                        {emp.valor_arrecadado === 0 ? "(Regra 4h sem aporte)" : "(Regra 5 dias p/ meta)"}
                                    </span>
                                </div>
                            )}

                            <div className="mb-1">
                                <div className="flex-between" style={{ fontSize: '0.8rem', marginBottom: '5px' }}>
                                    <span className="text-muted">Progresso Arrecadação</span>
                                    <span>{Math.round((emp.valor_arrecadado / emp.valor) * 100)}%</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ width: `${(emp.valor_arrecadado / emp.valor) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                                </div>
                            </div>

                            <div className="info-block mb-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <div className="info-label">Parcelas</div>
                                    <div style={{ fontWeight: 600 }}>{emp.parcelas_pagas} / {emp.parcelas}</div>
                                </div>
                                <div className="text-right">
                                    <div className="info-label">Total Restante</div>
                                    <div style={{ fontWeight: 600 }}>R$ {emp.valor_total_restante.toLocaleString('pt-BR')}</div>
                                </div>
                            </div>

                            {emp.status === 'aprovado' && emp.parcelas_pagas < emp.parcelas && (
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1rem' }}>
                                    <button className="btn btn-primary" style={{ width: 'auto', minWidth: '140px' }} onClick={() => handlePagarParcela(emp.id, emp.valor_parcela)}>Pagar Parcela</button>
                                    <button className="btn btn-outline" style={{ width: 'auto', minWidth: '100px' }} onClick={() => handleQuitar(emp.id)}>Quitar</button>
                                </div>
                            )}

                            {(emp.status === 'aprovado' || emp.status === 'concluido') && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ width: 'auto', minWidth: '240px', padding: '0.6rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                        onClick={() => handleBaixarContrato(emp.id)}
                                    >
                                        <FileText size={18} /> Baixar Contrato de Mútuo
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
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
