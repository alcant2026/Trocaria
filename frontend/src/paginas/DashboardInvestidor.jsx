import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

// Hook de countdown reutilizável
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

// Timer inline para cada card
const TimerCard = ({ expira4h, expira5d }) => {
    const t4h = useCountdown(expira4h);
    const t5d = useCountdown(expira5d);
    const expirado4h = !expira4h || new Date(expira4h + 'Z') <= new Date();
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '4px 10px', borderRadius: '8px', background: expirado4h ? 'rgba(255,61,0,0.08)' : 'rgba(255,145,0,0.08)', color: expirado4h ? 'var(--danger)' : 'var(--warning)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        ⚡ {t4h || '—'}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>Janela rápida (prioridade)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        🕐 {t5d || '—'}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>Prazo total do pedido</span>
                </div>
            </div>
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
    pagamento_parcela: 'Pagamento de Parcela',
};
const TIPOS_TAXA = new Set(['compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'saque', 'investimento', 'pagamento_parcela']);
const TIPOS_ENTRADA = new Set(['deposito', 'recebimento']);
const TIPOS_NEGATIVO = new Set(['saque', 'investimento', 'compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'pagamento_parcela']);
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
    AlertCircle,
    FileText,
    CheckCircle2,
    History
} from 'lucide-react';
import ModalPremium from '../componentes/ModalPremium';

import TermosUso from '../componentes/TermosUso';
import CaixaInvestidor from './CaixaInvestidor';

const DashboardInvestidor = () => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [carteira, setCarteira] = useState([]);
    const [activeView, setActiveView] = useState('home'); // 'home', 'mercado', 'carteira', 'depositar', 'resgatar'
    const [verSaldo, setVerSaldo] = useState(true);
    const [showTermos, setShowTermos] = useState(false);
    const [copiadoPix, setCopiadoPix] = useState(false);
    const [copiadoId, setCopiadoId] = useState(false);

    // Forms state
    const [valorNotificacao, setValorNotificacao] = useState('');
    const [valorSaque, setValorSaque] = useState('');
    const [valorInvestir, setValorInvestir] = useState({});
    const [aceiteRisco, setAceiteRisco] = useState({}); // Controle por ID de solicitação
    const [senhaSaque, setSenhaSaque] = useState('');
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [mensagem, setMensagem] = useState(null);

    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => {
                setMensagem(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);
    const [mostrarAlertaRejeicao, setMostrarAlertaRejeicaoState] = useState(
        () => localStorage.getItem('alerta_rejeicao_investidor') !== 'fechado'
    );

    const fecharAlertaRejeicao = () => {
        localStorage.setItem('alerta_rejeicao_investidor', 'fechado');
        setMostrarAlertaRejeicaoState(false);
    };
    const [historico, setHistorico] = useState([]);
    const [kycDetails, setKycDetails] = useState('');
    const [paginaHist, setPaginaHist] = useState(1);
    const [paginaCarteiraHome, setPaginaCarteiraHome] = useState(1);
    const [paginaOportunidades, setPaginaOportunidades] = useState(1);
    const ITENS_POR_PAGINA = 5;

    // Modal Premium State
    const [modalPremium, setModalPremium] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        confirmText: 'Confirmar'
    });
    const [loadingAction, setLoadingAction] = useState(false);

    const closeModal = () => setModalPremium(prev => ({ ...prev, isOpen: false }));
    const showModal = (config) => setModalPremium({ ...config, isOpen: true });

    // Modal state legado
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const copiarPix = () => {
        navigator.clipboard.writeText('91980177874');
        setCopiadoPix(true);
        setTimeout(() => setCopiadoPix(false), 2000);
    };

    const handleCopiarId = () => {
        navigator.clipboard.writeText(usuario.id);
        setCopiadoId(true);
        setTimeout(() => setCopiadoId(false), 2000);
    };

    const carregarSnapshot = async () => {
        try {
            const res = await api.get('/snapshot');
            if (res.perfil) {
                setUsuario(res.perfil);
                localStorage.setItem('usuario', JSON.stringify(res.perfil));
            }
            if (res.investidor) {
                setSolicitacoes(res.investidor.solicitacoes_disponiveis || []);
                setCarteira(res.investidor.carteira || []);
            }
            if (res.historico) {
                setHistorico(res.historico);
            }
        } catch (err) {
            console.error('Erro ao carregar snapshot:', err);
        }
    };

    // Smart Polling (60s) - Só roda se a aba estiver visível
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) {
                carregarSnapshot();
            }
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        carregarSnapshot();
    }, [activeView]);

    const handleInvestir = async (solicitacaoId) => {
        const valor = valorInvestir[solicitacaoId];
        const aceite = aceiteRisco[solicitacaoId];

        const v = parseFloat(valor);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Digite um valor de investimento maior que zero.', type: 'error' });
        if (!aceite) return showModal({ title: 'Aviso de Risco', message: 'Você deve aceitar os riscos do investimento para continuar.', type: 'warning' });

        try {
            await api.post(`/investidor/investir/${solicitacaoId}`, {
                valor: parseFloat(valor),
                aceite_risco: true
            });
            setMensagem('Investimento realizado com sucesso!');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleNotificarDeposito = async () => {
        const v = parseFloat(valorNotificacao);
        if (!v || v <= 0) {
            showModal({ title: 'Valor Inválido', message: 'Informe um valor de depósito maior que zero.', type: 'error' });
            return;
        }
        try {
            await api.post('/financeiro/notificar-deposito', { valor: v });
            setMensagem('Notificação enviada!');
            setValorNotificacao('');
            carregarSnapshot();
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
            setMensagem('Solicitação de resgate enviada com sucesso!');
            setValorSaque('');
            setSenhaSaque('');
            setCodigo2faSaque('');
            setActiveView('home');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleDesbloquear = (solicitacaoId) => {
        showModal({
            title: 'Desbloquear Perfil',
            message: 'Deseja desbloquear os dados completos deste perfil por R$ 15,00? \n\n⚠️ O desbloqueio permite sua análise detalhada, mas não garante o pagamento do empréstimo.',
            type: 'finance',
            onConfirm: async () => {
                closeModal();
                setLoadingAction(true);
                try {
                    const res = await api.post(`/emprestimos/desbloquear-dados/${solicitacaoId}`);
                    showModal({ title: 'Sucesso!', message: res.message, type: 'success' });
                    carregarSnapshot();
                } catch (err) {
                    showModal({ title: 'Erro', message: err.response?.data?.detail || 'Erro ao desbloquear.', type: 'error' });
                } finally {
                    setLoadingAction(false);
                }
            }
        });
    };


    const totalInvestido = carteira.reduce((acc, item) => acc + item.valor_investido, 0);

    return (
        <div className="investidor-dashboard">
            <header className="mb-1">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1>Painel Investidor</h1>
                    <div className="hide-on-mobile">
                        <div
                            onClick={handleCopiarId}
                            style={{
                                fontSize: '0.65rem',
                                background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.15), rgba(var(--success-rgb), 0.15))',
                                padding: '6px 14px',
                                borderRadius: '30px',
                                border: '1px solid rgba(var(--primary-rgb), 0.3)',
                                color: copiadoId ? 'var(--success)' : 'var(--text-main)',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                                transform: copiadoId ? 'scale(0.95)' : 'scale(1)'
                            }}
                        >
                            {copiadoId ? <Check size={14} /> : <Copy size={14} />}
                            <span style={{ letterSpacing: '1px' }}>ID: {usuario.id}</span>
                        </div>
                    </div>
                </div>
                <p className="text-muted">Gestão estratégica de capital e ativos P2P.</p>
            </header>

            {mensagem && (
                <div className={`alert ${mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'}`}>
                    <span>{mensagem}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Top Grid for PC: Balance and Action Quick Links */}
            <div className="grid-2">
                {/* Wallet Overview Card */}
                <div className="card card-actionable" onClick={() => setActiveView('home')}>
                    <div className="flex-between mb-1">
                        <div className="flex-between" style={{ gap: '10px' }}>
                            <Wallet size={20} color="var(--success)" />
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Ativos e Saldo</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" />
                    </div>

                    {(() => {
                        const totalRecebido = carteira.reduce((acc, item) => acc + (item.valor_recebido || 0), 0);
                        const historicoRecente = [...historico].slice(0, 15).reverse();
                        const maxVal = Math.max(...historicoRecente.map(i => Math.abs(i.valor || 0)), 1);
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                                    <div>
                                        <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>SALDO DISPONÍVEL</p>
                                        {verSaldo ? (
                                            <h2 style={{ fontSize: '2rem', color: 'var(--success)' }}>
                                                R$ {(usuario.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </h2>
                                        ) : (
                                            <div style={{ height: '32px', width: '150px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Total Investido: <strong style={{ color: 'var(--text-main)', fontSize: '0.85rem' }}>R$ {totalInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                            </p>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Já Recebido: <strong style={{ color: 'var(--success)', fontSize: '0.85rem' }}>R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    <button onClick={(e) => { e.stopPropagation(); setVerSaldo(!verSaldo); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '10px' }}>
                                        {verSaldo ? <Eye size={24} /> : <EyeOff size={24} />}
                                    </button>
                                </div>

                                {/* Enlarge Candlestick Chart Area (Agrupado por Dia) */}
                                {historico.length > 0 && (() => {
                                    const diasAgrupados = historico.reduce((acc, item) => {
                                        if (!item.data) return acc;
                                        const dia = new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                        const isNegativo = TIPOS_NEGATIVO.has(item.tipo);
                                        const valorReal = isNegativo ? -Math.abs(item.valor || 0) : Math.abs(item.valor || 0);
                                        if (!acc[dia]) acc[dia] = { dia, saldo: 0, operacoes: 0 };
                                        acc[dia].saldo += valorReal;
                                        acc[dia].operacoes += 1;
                                        return acc;
                                    }, {});
                                    const diasArray = Object.values(diasAgrupados).slice(0, 10).reverse();
                                    const maxValDia = Math.max(...diasArray.map(d => Math.abs(d.saldo)), 1);
                                    return (
                                        <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
                                            <div className="flex-between mb-1">
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fluxo Recente</span>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{diasArray.length} Dias</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '60px', gap: '6px' }}>
                                                {diasArray.map((d, idx) => {
                                                    const isGreen = d.saldo >= 0;
                                                    const height = Math.max(8, (Math.abs(d.saldo) / maxValDia) * 60);
                                                    return (
                                                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                            <div title={`${d.dia}\n${isGreen ? '+' : ''} R$ ${d.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} style={{ width: '100%', maxWidth: '12px', height: `${height}px`, background: isGreen ? 'var(--success)' : 'var(--danger)', borderRadius: '3px', opacity: 0.8 }}></div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })()}
                </div>

                <div className="hide-on-mobile">
                    {/* PC-only Widget: Resumo de Performance */}
                    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <h3 className="mb-1" style={{ fontSize: '1rem' }}>Performance da Carteira</h3>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '15px' }}>
                            <div className="info-block">
                                <div className="info-label">Rentabilidade Média</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                                    {totalInvestido > 0 ? (((carteira.reduce((a, i) => a + (i.pago_para_investidor || 0), 0) - totalInvestido) / totalInvestido) * 100).toFixed(1) : '0.0'}%
                                </div>
                            </div>
                            <div className="grid-2" style={{ gap: '10px' }}>
                                <div className="info-block">
                                    <div className="info-label">Ativos</div>
                                    <div style={{ fontWeight: 700 }}>{carteira.length} Contratos</div>
                                </div>
                                <div className="info-block">
                                    <div className="info-label">Recebível</div>
                                    <div style={{ fontWeight: 700 }}>R$ {carteira.reduce((a, i) => a + (i.valor_restante || 0), 0).toLocaleString('pt-BR')}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Mosaic / Grid */}
            <div className="action-grid">
                <div className="action-btn" onClick={() => setActiveView('mercado')}>
                    <TrendingUp size={28} color="var(--primary)" />
                    <span>Oportunidades</span>
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
                <div className="action-btn" onClick={() => setActiveView('carteira')}>
                    <Briefcase size={28} />
                    <span>Carteira</span>
                </div>
                <div className="action-btn" onClick={() => setActiveView('caixa')} style={{ border: '1px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                    <TrendingUp size={28} color="var(--primary)" />
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Caixa (Pool)</span>
                </div>
            </div>

            {activeView === 'home' && (
                <div className="home-content">
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
                                Veja o motivo detalhado no seu histórico abaixo.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {activeView === 'historico' && (
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
            )}

            {/* Market Opportunities Detail View */}

            {activeView === 'mercado' && (
                <div className="mt-1">
                    <div className="flex-between mb-1">
                        <h3>Oportunidades de Investimento</h3>
                        <button className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => setActiveView('home')}>Voltar</button>
                    </div>

                    {solicitacoes.length === 0 ? (
                        <div className="card text-center text-muted">Aguardando novos pedidos...</div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {solicitacoes.slice((paginaOportunidades - 1) * ITENS_POR_PAGINA, paginaOportunidades * ITENS_POR_PAGINA).map(sol => (
                                    <div key={sol.id} className="card">
                                        <div className="flex-between mb-1">
                                            <div>
                                                <div className="flex-between" style={{ gap: '8px' }}>
                                                    <h3 style={{ textTransform: 'capitalize' }}>{sol.nome || 'Dados Ocultos'}</h3>
                                                    {sol.verified && <CheckCircle2 size={16} color="var(--success)" title="Verificado" />}
                                                </div>
                                                <p className="text-muted" style={{ fontSize: '0.8rem' }}>Score Tomador: {sol.score}</p>
                                            </div>
                                            <div className="text-right">
                                                <p style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>
                                                    {sol.unlocked ? `${sol.taxa}%` : '●●●%'} <span style={{ fontSize: '0.7rem' }}>a.m</span>
                                                </p>
                                            </div>
                                        </div>
                                        {/* Temporizador */}
                                        <TimerCard expira4h={sol.expira_4h} expira5d={sol.expira_5d} />

                                        <div className="info-block mb-1">
                                            <div className="flex-between" style={{ marginBottom: '8px' }}>
                                                <span className="info-label">Meta</span>
                                                <span style={{ fontWeight: 600 }}>{sol.unlocked ? `R$ ${sol.valor.toLocaleString('pt-BR')}` : 'R$ ●●●'}</span>
                                            </div>
                                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                                                <div style={{ width: `${(sol.valor_arrecadado / sol.valor) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                                            </div>
                                            <div className="flex-between text-muted" style={{ fontSize: '0.7rem' }}>
                                                <span>Valor Necessário: {sol.unlocked ? `R$ ${(sol.valor - sol.valor_arrecadado).toLocaleString('pt-BR')}` : 'R$ ●●●'}</span>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div>Prazo: {sol.unlocked ? `${sol.parcelas}x` : '●●●x'}</div>
                                                    {sol.unlocked && (
                                                        <div style={{ color: 'var(--success)', fontWeight: 600 }}>Total: R$ {(sol.valor * (1 + (sol.taxa / 100) * sol.parcelas)).toLocaleString('pt-BR')}</div>
                                                    )}
                                                </div>
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
                                                        Estou ciente que este é um investimento de risco (P2P), aceito as <strong>regras de taxas de performance</strong> (10%) e os <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermos(true); }} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Termos de Uso</span>.
                                                    </label>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                    <div className="flex-between" style={{ gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', maxWidth: '280px', border: '1px solid var(--border-color)' }}>
                                                        <input
                                                            type="number"
                                                            className="input-field"
                                                            placeholder="Valor R$"
                                                            min="0.01"
                                                            step="0.01"
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
                                                    {valorInvestir[sol.id] > 0 && (
                                                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700 }}>
                                                                Você receberá: R$ {(
                                                                    parseFloat(valorInvestir[sol.id]) +
                                                                    (parseFloat(valorInvestir[sol.id]) * (sol.taxa / 100) * sol.parcelas * 0.90)
                                                                ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                                Lucro Líquido: <strong style={{ color: 'var(--success)' }}>R$ {(parseFloat(valorInvestir[sol.id]) * (sol.taxa / 100) * sol.parcelas * 0.90).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                                                <span style={{ fontSize: '0.6rem', marginLeft: '4px', opacity: 0.7 }}>(pós taxa 10%)</span>
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {solicitacoes.length > ITENS_POR_PAGINA && (
                                <div className="flex-between mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                    <button
                                        className="btn-outline"
                                        style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: paginaOportunidades === 1 ? 0.3 : 1, width: 'auto' }}
                                        disabled={paginaOportunidades === 1}
                                        onClick={() => setPaginaOportunidades(p => p - 1)}
                                    >
                                        Anterior
                                    </button>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Página {paginaOportunidades} de {Math.ceil(solicitacoes.length / ITENS_POR_PAGINA)}</span>
                                    <button
                                        className="btn-outline"
                                        style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: (paginaOportunidades * ITENS_POR_PAGINA) >= solicitacoes.length ? 0.3 : 1, width: 'auto' }}
                                        disabled={(paginaOportunidades * ITENS_POR_PAGINA) >= solicitacoes.length}
                                        onClick={() => setPaginaOportunidades(p => p + 1)}
                                    >
                                        Próxima
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}


            {activeView === 'carteira' && (
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
                                        <span className="text-muted" style={{ fontSize: '0.8rem' }}># {item.solicitacao_id}</span>
                                        {item.tomador_is_verified && <CheckCircle2 size={16} color="var(--success)" title="Verificado" />}
                                    </div>
                                    <div className={`badge ${item.status_emprestimo === 'concluido' ? 'badge-primary' : 'badge-success'}`}>
                                        {item.status_emprestimo === 'concluido' ? 'CONCLUÍDO' : 'RENTABILIZANDO'}
                                    </div>
                                </div>
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span className="text-muted">VALOR MENSAL:</span>
                                        <span style={{ fontWeight: 700 }}>R$ {item.valor_mensal.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                                <div className="grid-2" style={{ gap: '10px', marginTop: '10px' }}>
                                    <div className="info-block" style={{ margin: 0 }}>
                                        <div className="info-label">Aplicado</div>
                                        <div style={{ fontWeight: 600 }}>R$ {item.valor_investido.toLocaleString('pt-BR')}</div>
                                    </div>
                                    <div className="info-block" style={{ margin: 0 }}>
                                        <div className="info-label">Restante</div>
                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>R$ {item.valor_restante.toLocaleString('pt-BR')}</div>
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

            {activeView === 'caixa' && (
                <div className="mt-1">
                    <div className="flex-between mb-1">
                        <h3>Gestão do Caixa</h3>
                        <button className="btn btn-outline" style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.8rem' }} onClick={() => setActiveView('home')}>Voltar</button>
                    </div>
                    <CaixaInvestidor
                        usuario={usuario}
                        onUpdate={carregarSnapshot}
                        showModal={showModal}
                        closeModal={closeModal}
                    />
                </div>
            )}

            {/* Modal Premium Unificado */}
            <ModalPremium
                isOpen={modalPremium.isOpen}
                onClose={closeModal}
                title={modalPremium.title}
                message={modalPremium.message}
                type={modalPremium.type}
                onConfirm={modalPremium.onConfirm}
                confirmText={modalPremium.confirmText}
                loading={loadingAction}
            />
            {/* Modal de Termos de Uso */}
            {
                activeView === 'depositar' && (
                    <div className="card">
                        <h2 className="mb-1">Adicionar Saldo</h2>
                        <p className="mb-1">Transfira via PIX para a chave abaixo e informe o valor:</p>
                        <div className="info-block mb-1 text-center" style={{ position: 'relative' }}>
                            <div className="info-label">Chave PIX (E-mail)</div>
                            <div className="info-value" style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                91980177874
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText('91980177874');
                                        setCopiadoPix(true);
                                        setTimeout(() => setCopiadoPix(false), 2000);
                                    }}
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
                        <h2 className="mb-1">Solicitar Saque (Investidor)</h2>
                        {!usuario.two_factor_enabled ? (
                            <p className="text-danger">Ative o 2FA para realizar saques.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="Valor R$ 0,00"
                                    min="0.01"
                                    step="0.01"
                                    value={valorSaque}
                                    onChange={(e) => setValorSaque(e.target.value)}
                                />
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder="Senha de Acesso"
                                    value={senhaSaque}
                                    onChange={(e) => setSenhaSaque(e.target.value)}
                                />
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Código 2FA"
                                    value={codigo2faSaque}
                                    onChange={(e) => setCodigo2faSaque(e.target.value)}
                                />
                                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSolicitarSaque}>Confirmar Saque</button>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveView('home')}>Voltar</button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {showTermos && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ width: '90%', maxWidth: '500px' }}>
                        <TermosUso onConfirm={() => setShowTermos(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardInvestidor;
