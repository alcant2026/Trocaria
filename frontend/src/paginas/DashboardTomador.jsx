import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const useCountdown = (isoDate) => {
    const calcularRestante = useCallback(() => {
        if (!isoDate) return null;
        const diff = new Date(isoDate + 'Z') - new Date();
        if (diff <= 0) return '⏰ Expirado';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (h >= 24) {
            const d = Math.floor(h / 24);
            return `${d}d ${h % 24}h restantes`;
        }
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, [isoDate]);
    const [tempo, setTempo] = useState(calcularRestante);
    useEffect(() => {
        if (!isoDate) return;
        const id = setInterval(() => setTempo(calcularRestante()), 1000);
        return () => clearInterval(id);
    }, [isoDate, calcularRestante]);
    return tempo;
};

const ContractTimer = ({ expira4h, expira5d, arrecadado }) => {
    const dataAlvo = arrecadado > 0 ? expira5d : expira4h;
    const tempo = useCountdown(dataAlvo);
    const expirado = !dataAlvo || new Date(dataAlvo + 'Z') <= new Date();
    return (
        <div style={{ background: expirado ? 'rgba(255, 61, 0, 0.08)' : 'rgba(255, 145, 0, 0.08)', padding: '6px 12px', borderRadius: '8px', marginBottom: '0.75rem', border: '1px solid', borderColor: expirado ? 'rgba(255, 61, 0, 0.2)' : 'rgba(255, 145, 0, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={12} color={expirado ? 'var(--danger)' : 'var(--warning)'} />
            <span style={{ fontSize: '0.7rem', color: expirado ? 'var(--danger)' : 'var(--warning)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {expirado ? 'Expirado' : `Expira em: ${tempo || '—'}`}
            </span>
        </div>
    );
};

// Mapeamento global de tipos de transação
const TIPOS_LABEL = {
    deposito: 'Depósito',
    saque: 'Saque',
    investimento: 'Investimento',
    recebimento: 'Recebimento',
    compra_score: 'Compra de Score',
    desbloqueio_dados: 'Taxa de Verificação',
    taxa_saque: 'Taxa de Saque',
    taxa_intermediacao: 'Taxa de Intermediação',
    taxa_conveniencia: 'Taxa de Conveniência',
};

// Tipos que são saídas do tipo "taxa/pagamento"
const TIPOS_TAXA = new Set(['compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'saque', 'investimento']);
// Tipos que são entradas (positivos)
const TIPOS_ENTRADA = new Set(['deposito', 'recebimento']);
// Todos os tipos negativos (sem badge CONCLUIDO)
const TIPOS_NEGATIVO = new Set(['saque', 'investimento', 'compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia']);

const formatarTipo = (tipo, detalhes) => {
    if (tipo === 'desbloqueio_dados') {
        if (detalhes?.toLowerCase().includes('empr')) return 'Taxa de Solicitação';
        return 'Taxa de Verificação';
    }
    return TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';
};
const prefixoValor = (tipo) => TIPOS_ENTRADA.has(tipo) ? '+' : '-';
const corValor = (tipo) => TIPOS_TAXA.has(tipo) || tipo === 'saque' || tipo === 'investimento' ? 'var(--danger)' : TIPOS_ENTRADA.has(tipo) ? 'var(--success)' : 'var(--text-main)';

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
    CheckCircle2,
    AlertCircle,
    Gift,
    ArrowLeft,
    Users,
    UserPlus
} from 'lucide-react';

import TermosUso from '../componentes/TermosUso';

const DashboardTomador = () => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [meusEmprestimos, setMeusEmprestimos] = useState([]);
    const [activeView, setActiveView] = useState('home'); // 'home', 'solicitar', 'depositar', 'saque', 'score'
    const [verSaldo, setVerSaldo] = useState(true);
    const [aceiteTermos, setAceiteTermos] = useState(false);
    const [showTermos, setShowTermos] = useState(false);
    const [copiadoPix, setCopiadoPix] = useState(false);
    const [copiadoId, setCopiadoId] = useState(false);

    // Modal state
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    // Forms state
    const [valorNotificacao, setValorNotificacao] = useState('');
    const [valorSaque, setValorSaque] = useState('');
    const [valor, setValor] = useState('');
    const [taxa, setTaxa] = useState('');
    const [parcelas, setParcelas] = useState(1);
    const [idAmigo1, setIdAmigo1] = useState('');
    const [idAmigo2, setIdAmigo2] = useState('');
    const [senhaSaque, setSenhaSaque] = useState('');
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [aceiteSolicitacao, setAceiteSolicitacao] = useState(false);
    const [mensagem, setMensagem] = useState('');
    const [kycDetails, setKycDetails] = useState('');
    const [mostrarAlertaRejeicao, setMostrarAlertaRejeicaoState] = useState(
        () => localStorage.getItem('alerta_rejeicao_tomador') !== 'fechado'
    );
    const [valorAvulsoPorId, setValorAvulsoPorId] = useState({}); // { id: 'valor' }
    const [showAvulsoPorId, setShowAvulsoPorId] = useState({}); // { id: true/false }
    const [garantiasPendentes, setGarantiasPendentes] = useState([]);

    const fecharAlertaRejeicao = () => {
        localStorage.setItem('alerta_rejeicao_tomador', 'fechado');
        setMostrarAlertaRejeicaoState(false);
    };

    const handleCopiarId = () => {
        navigator.clipboard.writeText(usuario.id);
        setCopiadoId(true);
        setTimeout(() => setCopiadoId(false), 2000);
    };

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

            // Novo: Buscar garantias onde fui convidado
            const pendencias = await api.get('/emprestimos/garantias-pendentes');
            setGarantiasPendentes(pendencias);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
        }
    };

    useEffect(() => {
        carregarDados();
    }, [activeView]);

    const handleSolicitar = async (e) => {
        e.preventDefault();
        const v = parseFloat(valor);
        if (!v || v <= 0) {
            setMensagem('Erro: O valor solicitado deve ser maior que zero.');
            return;
        }
        if (!taxa || !parcelas) return;
        if (!aceiteTermos) {
            alert("Você deve aceitar os termos de uso e taxas da plataforma para continuar.");
            return;
        }

        try {
            const res = await api.post('/emprestimos/solicitar', {
                valor: parseFloat(valor),
                taxa_juros: parseFloat(taxa),
                parcelas: parseInt(parcelas),
                aceite_termos: true
            });
            setMensagem(res.message || 'Solicitação enviada!');
            setActiveView('home');
            setValor(''); setTaxa(''); setParcelas(1);
            setIdAmigo1(''); setIdAmigo2('');
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

    const handlePagamentoAvulso = async (id) => {
        const val = parseFloat(valorAvulsoPorId[id]);
        if (!val || val <= 0) return alert('Informe um valor válido.');

        try {
            const res = await api.post(`/emprestimos/pagamento-avulso/${id}`, { valor_pagamento: val });
            setMensagem(res.message);
            setValorAvulsoPorId(prev => ({ ...prev, [id]: '' }));
            setShowAvulsoPorId(prev => ({ ...prev, [id]: false }));
            carregarDados();
        } catch (err) {
            setMensagem('Erro no pagamento avulso: ' + err.message);
        }
    };

    const handleVincularGarantidores = async (solicitacaoId) => {
        const id1 = parseInt(idAmigo1);
        const id2 = parseInt(idAmigo2);
        if (!id1 || id1 <= 0 || !id2 || id2 <= 0) {
            alert("Os IDs dos amigos devem ser números positivos.");
            return;
        }
        try {
            const res = await api.post(`/emprestimos/vincular-garantidores/${solicitacaoId}`, {
                user_ids: [id1, id2]
            });
            setMensagem(res.message);
            setIdAmigo1('');
            setIdAmigo2('');
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao vincular amigos: ' + err.message);
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
        const v = parseFloat(valorNotificacao);
        if (!v || v <= 0) {
            alert('Informe um valor de depósito maior que zero.');
            return;
        }
        try {
            await api.post('/financeiro/notificar-deposito', { valor: v });
            setMensagem('Notificação enviada! O administrador creditará seu saldo em breve.');
            setValorNotificacao('');
            carregarDados();
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
        const v = parseFloat(valorSaque);
        if (!v || v <= 0) {
            setMensagem('Erro: O valor de saque deve ser maior que zero.');
            return;
        }
        try {
            await api.post('/financeiro/solicitar-saque', {
                valor: v,
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

    const handleAceitarGarantia = async (id) => {
        try {
            const res = await api.post(`/emprestimos/aceitar-garantia/${id}`);
            setMensagem(res.message);
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao aceitar garantia: ' + err.message);
        }
    };

    const handleRejeitarGarantia = async (id) => {
        if (!window.confirm("Se você recusar, o empréstimo do seu amigo será cancelado e os valores devolvidos aos investidores. Confirmar?")) return;
        try {
            const res = await api.post(`/emprestimos/rejeitar-garantia/${id}`);
            setMensagem(res.message);
            carregarDados();
        } catch (err) {
            setMensagem('Erro ao rejeitar garantia: ' + err.message);
        }
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
            const blob = await api.getBlob(`/ emprestimos / contrato / pdf / ${id} `);
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
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Olá, {usuario.nome.split(' ')[0]}
                    <div
                        onClick={handleCopiarId}
                        style={{
                            fontSize: '0.65rem',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color)',
                            color: copiadoId ? 'var(--success)' : 'var(--text-muted)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            marginLeft: '4px'
                        }}
                    >
                        {copiadoId ? <Check size={12} /> : <Copy size={12} />}
                        {usuario.id}
                    </div>
                    {usuario.is_verified ? (
                        <ShieldCheck size={24} color="var(--success)" title="Conta Verificada" />
                    ) : (
                        <ShieldAlert size={24} color="var(--warning)" title="Conta não verificada" />
                    )}
                </h1>
                <p className="text-muted">Seu dinheiro rendendo e crescendo.</p>
            </header>

            {mensagem && (
                <div className={`alert ${mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'} `}>
                    <span>{mensagem}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Nova Seção: Garantias Sociais Pendentes */}
            {garantiasPendentes.length > 0 && (
                <div className="card mb-1" style={{ border: '2px dashed var(--warning)', background: 'rgba(255, 145, 0, 0.03)' }}>
                    <h3 style={{ fontSize: '0.9rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Users size={18} /> Convites de Garantia
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {garantiasPendentes.map(p => (
                            <div key={p.solicitacao_id} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>{p.tomador} te convidou</p>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Valor: R$ {p.valor.toLocaleString('pt-BR')}</p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => handleAceitarGarantia(p.solicitacao_id)}
                                        className="btn btn-primary"
                                        style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--success)', borderColor: 'var(--success)' }}
                                    >
                                        Aceitar
                                    </button>
                                    <button
                                        onClick={() => handleRejeitarGarantia(p.solicitacao_id)}
                                        className="btn btn-outline"
                                        style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                    >
                                        Recusar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
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
                <div className="action-btn" onClick={() => setActiveView('historico')}>
                    <History size={28} />
                    <span>Histórico</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('contratos')}>
                    <LayoutDashboard size={28} />
                    <span>Contratos</span>
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
                                        min="0.01"
                                        step="0.01"
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
                                            min="0.1"
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
                                            min="1"
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

                        {/* Aviso de Política de Taxa */}
                        <div style={{ padding: '12px 16px', background: 'rgba(255, 145, 0, 0.07)', border: '1px solid rgba(255, 145, 0, 0.2)', borderRadius: '12px', maxWidth: '400px', margin: '0 auto 1rem' }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--warning)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Gift size={16} /> 1º pedido do mês: <strong>isento de taxa</strong>
                            </p>
                            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                A partir do 2º pedido no mês, é cobrada uma taxa de <strong>R$ 4,00</strong>.<br />
                                Atenção: se não houver investidores, a taxa <strong>não será devolvida</strong>.
                            </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', maxWidth: '400px', margin: '1rem auto' }}>
                            <input
                                type="checkbox"
                                id="check-termos"
                                style={{ marginTop: '4px' }}
                                checked={aceiteTermos}
                                onChange={(e) => setAceiteTermos(e.target.checked)}
                            />
                            <label htmlFor="check-termos" style={{ fontSize: '0.75rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                                Estou ciente das <span style={{ color: 'var(--warning)', fontWeight: 600 }}>taxas de intermediação</span> (R$ 4,00 a partir do 2º pedido/mês) e concordo com os <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermos(true); }} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Termos de Uso</span>.
                            </label>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '1.5rem' }}>
                            <button type="submit" className="btn btn-primary" style={{ width: 'auto', minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: aceiteTermos ? 1 : 0.4, cursor: aceiteTermos ? 'pointer' : 'not-allowed' }} disabled={!aceiteTermos}>
                                <Gift size={18} /> Criar Pedido de Empréstimo
                            </button>
                            <button type="button" className="btn btn-secondary" style={{ width: 'auto', minWidth: '120px' }} onClick={() => setActiveView('home')}>Voltar</button>
                        </div>
                    </form>
                </div >
            )}

            {/* Modal de Termos de Uso */}
            {
                showTermos && (
                    <div className="modal-overlay">
                        <div className="modal-card" style={{ width: '90%', maxWidth: '500px' }}>
                            <TermosUso onConfirm={() => setShowTermos(false)} />
                        </div>
                    </div>
                )
            }

            {
                activeView === 'depositar' && (
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
                                    min="0.01"
                                    step="0.01"
                                    onChange={(e) => setValorNotificacao(e.target.value)}
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '1.5rem' }}>
                            <button className="btn btn-primary" style={{ width: 'auto', minWidth: '180px' }} onClick={handleNotificarDeposito}>Informar Depósito</button>
                            <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '120px' }} onClick={() => setActiveView('home')}>Voltar</button>
                        </div>
                    </div>
                )
            }

            {
                activeView === 'saque' && (
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
                                            min="0.01"
                                            step="0.01"
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
                )
            }

            {
                activeView === 'score' && (
                    <div className="card">
                        <h2 className="mb-1">Upgrade de Perfil</h2>
                        <div className="card-minimal mb-1" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>🚀 Turbo Score</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Adicione +1.5 pontos ao seu score instantaneamente.</p>
                            <button className="btn btn-outline" style={{ width: 'auto', minWidth: '200px', padding: '0.75rem 1.5rem' }} onClick={handleComprarScore}>Comprar por R$ 35,00</button>
                        </div>
                        {!usuario.is_verified && (
                            <div className="card-minimal" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle2 color="var(--success)" /> Verificação de Conta</h3>
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
                )
            }

            {
                activeView === 'home' && (
                    <>
                        {/* Alerta de Rejeição Recente */}
                        {mostrarAlertaRejeicao && historico.some(h => h.status === 'falhou') && (
                            <div className="alert alert-danger mb-1" style={{ maxWidth: '100%', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', position: 'relative' }}>
                                <button
                                    onClick={fecharAlertaRejeicao}
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
                    </>
                )
            }

            {
                activeView === 'historico' && (
                    <div className="card">
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
                                        <div key={h.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: `3px solid ${h.status === 'falhou' ? 'var(--danger)' : h.status === 'pendente' ? 'var(--warning)' : (TIPOS_NEGATIVO.has(h.tipo) || h.tipo === 'saque' || h.tipo === 'investimento') ? 'var(--danger)' : 'var(--success)'}` }}>
                                            <div className="flex-between">
                                                <div>
                                                    <p style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase' }}>{formatarTipo(h.tipo, h.detalhes)}</p>
                                                    <p className="text-muted" style={{ fontSize: '0.7rem' }}>{h.data ? new Date(h.data).toLocaleString('pt-BR') : '-'}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p style={{ fontWeight: 800, color: corValor(h.tipo) }}>
                                                        {prefixoValor(h.tipo)} R$ {h.valor?.toLocaleString('pt-BR')}
                                                    </p>
                                                    {/* Badge de status apenas para entradas ou pendentes */}
                                                    {(!TIPOS_NEGATIVO.has(h.tipo) || h.status !== 'concluido') && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: h.status === 'concluido' ? 'var(--success)' : h.status === 'falhou' ? 'var(--danger)' : 'var(--warning)' }}>
                                                            {h.status?.toUpperCase() || '-'}
                                                        </span>
                                                    )}
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
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                            <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px' }} onClick={() => setActiveView('home')}>Voltar</button>
                        </div>
                    </div>
                )
            }

            {
                activeView === 'contratos' && (
                    <div className="card">
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
                                                    <span className={`badge ${emp.status === 'aprovado' ? 'badge-success' : 'badge-warning'} `}>
                                                        {emp.status.toUpperCase()}
                                                    </span>
                                                    <h3 className="mt-1" style={{ fontSize: '0.9rem' }}>Empréstimo #{emp.id}</h3>
                                                    <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                                                        Você recebe: <strong style={{ color: 'var(--text-main)' }}>R$ {emp.valor.toLocaleString('pt-BR')}</strong>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-muted" style={{ fontSize: '0.6rem' }}>VALOR MENSAL</p>
                                                    <p style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                                                        R$ {emp.valor_parcela.toLocaleString('pt-BR')}
                                                    </p>
                                                    {emp.status === 'aprovado' && emp.proximo_vencimento && (
                                                        <div className="text-muted" style={{ fontSize: '0.6rem', marginTop: '4px' }}>
                                                            Vencimento: <span style={{ fontWeight: 600 }}>{new Date(emp.proximo_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                        </div>
                                                    )}
                                                    {emp.status === 'aprovado' && emp.proximo_vencimento && new Date() > new Date(emp.proximo_vencimento) && (
                                                        <div style={{ color: 'var(--danger)', fontSize: '0.6rem', fontWeight: 600 }}>
                                                            + Juros de Mora
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {emp.status === 'aprovado' && emp.proximo_vencimento && new Date() > new Date(emp.proximo_vencimento) && (
                                                <div className="info-block mb-1" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem' }}>
                                                    <div className="flex-between">
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <TriangleAlert size={12} /> EM ATRASO
                                                        </span>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--danger)' }}>
                                                            {Math.floor((new Date() - new Date(emp.proximo_vencimento)) / (1000 * 60 * 60 * 24))} dias
                                                        </span>
                                                    </div>
                                                    <div className="flex-between mt-1" style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                                                        <span>Valor Total Devido:</span>
                                                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>
                                                            R$ {(emp.valor_parcela + (emp.valor_parcela * 0.02) + (emp.valor_parcela * 0.001 * Math.max(0, Math.floor((new Date() - new Date(emp.proximo_vencimento)) / (1000 * 60 * 60 * 24))))).toLocaleString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {emp.status === 'pendente' && (
                                                <>
                                                    <ContractTimer expira4h={emp.data_expiracao_4h} expira5d={emp.data_expiracao_5d} arrecadado={emp.valor_arrecadado} />
                                                    <div style={{ marginBottom: '1rem' }}>
                                                        <div className="flex-between mb-1" style={{ fontSize: '0.75rem' }}>
                                                            <span className="text-muted">Arrecadado</span>
                                                            <span style={{ fontWeight: 700 }}>R$ {emp.valor_arrecadado.toLocaleString('pt-BR')} / R$ {emp.valor.toLocaleString('pt-BR')}</span>
                                                        </div>
                                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                                                            <div style={{
                                                                width: `${Math.min(100, (emp.valor_arrecadado / emp.valor) * 100)}%`,
                                                                height: '100%',
                                                                background: 'var(--success)',
                                                                transition: 'width 1s ease-in-out'
                                                            }}></div>
                                                        </div>

                                                        {/* Status da Garantia Social ou Formulário de Vinculação */}
                                                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', marginTop: '10px' }}>
                                                            <p style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                Garantia Social (Assinaturas)
                                                            </p>

                                                            {emp.garantidores && emp.garantidores.length > 0 ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {emp.garantidores.map((g, idx) => (
                                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                                            <span style={{ color: 'var(--text-main)' }}>{g.nome}</span>
                                                                            <span style={{
                                                                                color: g.aceito ? 'var(--success)' : 'var(--warning)',
                                                                                fontWeight: 700,
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px'
                                                                            }}>
                                                                                {g.aceito ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                                                                                {g.aceito ? 'Assinado' : 'Pendente'}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                    {emp.garantidores.every(g => g.aceito) && emp.valor_arrecadado >= emp.valor && (
                                                                        <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(var(--success-rgb), 0.1)', borderRadius: '8px', border: '1px solid var(--success)', textAlign: 'center' }}>
                                                                            <p style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 700 }}>Liberação em processamento...</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : emp.valor_arrecadado >= emp.valor ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', marginTop: '10px' }}>
                                                                    <p style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                        <CheckCircle2 size={16} /> Meta atingida!
                                                                    </p>
                                                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                                        Indique 2 amigos (ID no perfil deles) para assinar como garantidores:
                                                                    </p>

                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            placeholder="ID Amigo 1"
                                                                            style={{ fontSize: '0.85rem', padding: '10px 12px', textAlign: 'center' }}
                                                                            value={idAmigo1}
                                                                            min="1"
                                                                            onChange={(e) => setIdAmigo1(e.target.value)}
                                                                        />
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            placeholder="ID Amigo 2"
                                                                            style={{ fontSize: '0.85rem', padding: '10px 12px', textAlign: 'center' }}
                                                                            value={idAmigo2}
                                                                            min="1"
                                                                            onChange={(e) => setIdAmigo2(e.target.value)}
                                                                        />
                                                                    </div>

                                                                    <button
                                                                        className="btn btn-primary"
                                                                        style={{
                                                                            marginTop: '10px',
                                                                            padding: '10px 24px',
                                                                            fontSize: '0.85rem',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: '8px',
                                                                            fontWeight: 700,
                                                                            width: 'auto',
                                                                            alignSelf: 'center'
                                                                        }}
                                                                        onClick={() => handleVincularGarantidores(emp.id)}
                                                                    >
                                                                        <UserPlus size={18} /> Vincular Amigos
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Os garantidores serão solicitados após atingir 100% da meta.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
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
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '0.5rem' }}>
                                                    <button
                                                        className="btn btn-primary"
                                                        style={{ padding: '0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                        onClick={() => handlePagarParcela(emp.id, emp.valor_parcela)}
                                                    >
                                                        <Wallet size={16} />
                                                        {emp.proximo_vencimento && new Date() > new Date(emp.proximo_vencimento) ? 'Pagar com Juros' : 'Pagar Parcela'}
                                                    </button>
                                                    <button
                                                        className="btn btn-outline"
                                                        style={{ padding: '0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                                        onClick={() => handleQuitar(emp.id)}
                                                    >
                                                        <HandCoins size={16} /> Quitar Tudo
                                                    </button>
                                                </div>
                                            )}

                                            {emp.status === 'aprovado' && emp.parcelas_pagas < emp.parcelas && (
                                                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    {!showAvulsoPorId[emp.id] ? (
                                                        <button
                                                            className="btn btn-outline"
                                                            style={{
                                                                width: 'fit-content',
                                                                padding: '0.45rem 1.2rem',
                                                                fontSize: '0.7rem',
                                                                borderStyle: 'dashed',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                background: 'rgba(var(--primary-rgb), 0.03)',
                                                                borderRadius: '20px'
                                                            }}
                                                            onClick={() => setShowAvulsoPorId(prev => ({ ...prev, [emp.id]: true }))}
                                                        >
                                                            <PlusCircle size={14} /> Pagar outro valor
                                                        </button>
                                                    ) : (
                                                        <div className="card-minimal" style={{
                                                            background: 'rgba(255,255,255,0.01)',
                                                            margin: 0,
                                                            padding: '16px',
                                                            border: '1px solid var(--border-color)',
                                                            width: '100%',
                                                            borderRadius: '16px',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                                                        }}>
                                                            <div className="flex-column" style={{ gap: '12px' }}>
                                                                <div style={{
                                                                    background: 'rgba(255,255,255,0.03)',
                                                                    padding: '2px',
                                                                    borderRadius: '12px',
                                                                    border: '1px solid var(--border-color)',
                                                                    display: 'flex',
                                                                    alignItems: 'center'
                                                                }}>
                                                                    <span style={{ paddingLeft: '12px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)' }}>R$</span>
                                                                    <input
                                                                        type="number"
                                                                        className="input-field"
                                                                        placeholder="0,00"
                                                                        style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.7rem 0.5rem', textAlign: 'left', width: '100%', fontSize: '1rem', fontWeight: 800, color: '#fff' }}
                                                                        value={valorAvulsoPorId[emp.id] || ''}
                                                                        min="0.01"
                                                                        step="0.01"
                                                                        onChange={(e) => setValorAvulsoPorId(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                                                    />
                                                                </div>

                                                                <div style={{ padding: '8px 12px', background: 'rgba(255, 145, 0, 0.05)', borderRadius: '10px', border: '1px solid rgba(255, 145, 0, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <AlertCircle size={14} color="var(--warning)" />
                                                                    <p style={{ fontSize: '0.7rem', color: 'var(--warning)', fontWeight: 600, margin: 0 }}>
                                                                        + Taxa de serviço: R$ 1,50
                                                                    </p>
                                                                </div>

                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                                                    <button
                                                                        className="btn btn-primary"
                                                                        style={{ width: '100%', padding: '0.7rem', fontSize: '0.85rem' }}
                                                                        onClick={() => handlePagamentoAvulso(emp.id)}
                                                                    >
                                                                        Confirmar Pagamento
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-secondary"
                                                                        style={{ width: '100%', padding: '0.6rem', fontSize: '0.75rem' }}
                                                                        onClick={() => setShowAvulsoPorId(prev => ({ ...prev, [emp.id]: false }))}
                                                                    >
                                                                        Cancelar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
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
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                            <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => setActiveView('home')}><ArrowLeft size={18} /> Voltar</button>
                        </div>
                    </div>
                )
            }
            {/* Modal de Confirmação */}
            {
                modal.open && (
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
                )
            }
        </div >
    );
};

export default DashboardTomador;
