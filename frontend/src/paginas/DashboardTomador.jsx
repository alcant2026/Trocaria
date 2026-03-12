import React, { useState, useEffect, useCallback } from 'react';
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
    CheckCircle2,
    AlertCircle,
    Users,
    UserPlus,
    X,
    Gift,
    ArrowLeft,
    ShoppingBag,
    ChevronLeft,
    ExternalLink,
    Home,
    CreditCard,
    Coins,
    Gem,
    XCircle,
    Timer,
    CheckCircle,
    Bell,
    RefreshCw,
    ArrowDown,
    Store,
    Package,
    Zap,
    Rocket,
    MapPin,
    Lock
} from 'lucide-react';
import ModalPremium from '../componentes/ModalPremium';
import TermosUso from '../componentes/TermosUso';
import CaixaParceiro from './CaixaParceiro';
import LojaAfiliados from '../componentes/LojaAfiliados';

const useCountdown = (isoDate) => {
    const calcularRestante = useCallback(() => {
        if (!isoDate) return null;
        const diff = new Date(isoDate + 'Z') - new Date();
        if (diff <= 0) return 'Expirado';
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
    pagamento_parcela: 'Pagamento de Parcela',
    taxa_postagem: 'Taxa de Postagem',
    comissao_parceiro: 'Comissão Recebida',
};

// Tipos que são saídas do tipo "taxa/pagamento"
const TIPOS_TAXA = new Set(['compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'saque', 'investimento', 'pagamento_parcela']);
// Tipos que são entradas (positivos)
const TIPOS_ENTRADA = new Set(['deposito', 'recebimento', 'comissao_parceiro']);
// Todos os tipos negativos (sem badge CONCLUIDO)
const TIPOS_NEGATIVO = new Set(['saque', 'investimento', 'compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'pagamento_parcela', 'taxa_postagem']);

const formatarTipo = (tipo, detalhes) => {
    if (tipo === 'desbloqueio_dados') {
        if (detalhes?.toLowerCase().includes('empr')) return 'Taxa de Solicitação';
        return 'Taxa de Verificação';
    }
    return TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';
};
const prefixoValor = (tipo) => TIPOS_ENTRADA.has(tipo) ? '+' : '-';
const corValor = (tipo) => TIPOS_TAXA.has(tipo) || tipo === 'saque' || tipo === 'investimento' ? 'var(--danger)' : TIPOS_ENTRADA.has(tipo) ? 'var(--success)' : 'var(--text-main)';


const DashboardTomador = ({ initialView = 'home' }) => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [meusEmprestimos, setMeusEmprestimos] = useState([]);
    const [activeView, setActiveView] = useState(initialView); // 'home', 'solicitar', 'depositar', 'saque', 'score', 'loja'
    const [verSaldo, setVerSaldo] = useState(true);
    const [aceiteTermos, setAceiteTermos] = useState(false);
    const [showTermos, setShowTermos] = useState(false);
    const [copiadoPix, setCopiadoPix] = useState(false);
    const [copiadoId, setCopiadoId] = useState(false);

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

    // Modal state legado (quitar, score, kyc) - vou manter por enquanto mas adaptar para o Premium
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    // Forms state
    const [valorNotificacao, setValorNotificacao] = useState('');
    const [metodoDeposito, setMetodoDeposito] = useState('pix');
    const [parceiroIdDeposito, setParceiroIdDeposito] = useState('');
    const [parceiros, setParceiros] = useState([]);

    const [valorSaque, setValorSaque] = useState('');
    const [metodoSaque, setMetodoSaque] = useState('pix');
    const [parceiroIdSaque, setParceiroIdSaque] = useState('');

    const [valor, setValor] = useState('');
    const [taxa, setTaxa] = useState('');
    const [parcelas, setParcelas] = useState(1);
    const [idAmigo1, setIdAmigo1] = useState('');
    const [idAmigo2, setIdAmigo2] = useState('');
    const [senhaSaque, setSenhaSaque] = useState('');
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [aceiteSolicitacao, setAceiteSolicitacao] = useState(false);
    const [passoDeposito, setPassoDeposito] = useState(1);
    const [passoSaque, setPassoSaque] = useState(1);
    const [passoSolicitar, setPassoSolicitar] = useState(1);
    const [passoUpgrade, setPassoUpgrade] = useState(1);
    const [tipoUpgrade, setTipoUpgrade] = useState(null); // 'score' ou 'verificacao'
    const [tipoGarantia, setTipoGarantia] = useState('social'); // 'social', 'fisica', 'hibrida' ou 'nenhuma'
    const [garantiaDescricao, setGarantiaDescricao] = useState('');
    const [parceiroIdGarantia, setParceiroIdGarantia] = useState('');
    const [mensagem, setMensagem] = useState(null);

    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => {
                setMensagem(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);

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

    const carregarSnapshot = async () => {
        try {
            const res = await api.get('/snapshot');
            if (res.perfil) {
                setUsuario(res.perfil);
                localStorage.setItem('usuario', JSON.stringify(res.perfil));
            }
            if (res.tomador) {
                setMeusEmprestimos(res.tomador.meus_emprestimos || []);
                setGarantiasPendentes(res.tomador.garantias_pendentes || []);
            }
            if (res.historico) {
                setHistorico(res.historico);
            }
            
            // Carregar parceiros
            const resParceiros = await api.get('/financeiro/admin/parceiros');
            setParceiros(resParceiros || []);
        } catch (err) {
            console.error('Erro ao carregar snapshot:', err);
        }
    };

    // Smart Polling (30s) + Visibility Update
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) carregarSnapshot();
        }, 30000);

        const handleVisibility = () => {
            if (!document.hidden) carregarSnapshot();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    useEffect(() => {
        carregarSnapshot();
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
            showModal({ title: 'Termos de Uso', message: 'Você deve aceitar os termos de uso e taxas da plataforma para continuar.', type: 'warning' });
            return;
        }

        try {
            const res = await api.post('/emprestimos/solicitar', {
                valor: parseFloat(valor),
                taxa_juros: parseFloat(taxa),
                parcelas: parseInt(parcelas),
                aceite_termos: true,
                tipo_garantia: tipoGarantia,
                garantia_descricao: (tipoGarantia === 'fisica' || tipoGarantia === 'hibrida') ? garantiaDescricao : null,
                parceiro_id: (tipoGarantia === 'fisica' || tipoGarantia === 'hibrida') ? parseInt(parceiroIdGarantia) : null,
                garantidores_ids: (tipoGarantia === 'social' || tipoGarantia === 'hibrida') ? [idAmigo1, idAmigo2] : []
            });
            setMensagem(res.message || 'Solicitação enviada!');
            setActiveView('home');
            setValor(''); setTaxa(''); setParcelas(1);
            setIdAmigo1(''); setIdAmigo2('');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handlePagarParcela = async (id, valorParcela) => {
        try {
            const res = await api.post(`/emprestimos/pagar-parcela/${id}`, { valor_pagamento: valorParcela });
            setMensagem(res.message);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro ao pagar: ' + err.message);
        }
    };

    const handlePagamentoAvulso = async (id) => {
        const val = parseFloat(valorAvulsoPorId[id]);
        if (!val || val <= 0) return showModal({ title: 'Valor Inválido', message: 'Informe um valor válido para o pagamento mensal.', type: 'error' });

        try {
            const res = await api.post(`/emprestimos/pagamento-avulso/${id}`, { valor_pagamento: val });
            setMensagem(res.message);
            setValorAvulsoPorId(prev => ({ ...prev, [id]: '' }));
            setShowAvulsoPorId(prev => ({ ...prev, [id]: false }));
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro no pagamento avulso: ' + err.message);
        }
    };

    const handleVincularGarantidores = async (solicitacaoId) => {
        const id1 = parseInt(idAmigo1);
        const id2 = parseInt(idAmigo2);
        if (!id1 || id1 <= 0 || !id2 || id2 <= 0) {
            showModal({ title: 'IDs Inválidos', message: 'Os IDs dos amigos devem ser números positivos.', type: 'error' });
            return;
        }
        try {
            const res = await api.post(`/emprestimos/vincular-garantidores/${solicitacaoId}`, {
                user_ids: [id1, id2]
            });
            setMensagem(res.message);
            setIdAmigo1('');
            setIdAmigo2('');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro ao vincular amigos: ' + err.message);
        }
    };

    const handleQuitar = (emprestimoId) => {
        showModal({
            title: 'Liquidar Crédito',
            message: 'Deseja quitar o valor integral do empréstimo agora? \nEsta ação liquidará todas as parcelas restantes.',
            type: 'finance',
            onConfirm: async () => {
                closeModal();
                setLoadingAction(true);
                try {
                    await api.post(`/emprestimos/quitar-total/${emprestimoId}`);
                    showModal({ title: 'Sucesso!', message: 'Crédito liquidado com sucesso!', type: 'success' });
                    carregarSnapshot();
                } catch (err) {
                    setMensagem('Erro ao quitar: ' + err.message);
                } finally {
                    setLoadingAction(false);
                }
            }
        });
    };


    const handleNotificarDeposito = async () => {
        const v = parseFloat(valorNotificacao);
        if (!v || v <= 0) {
            showModal({ title: 'Valor Inválido', message: 'Informe um valor de depósito maior que zero.', type: 'error' });
            return;
        }
        if (metodoDeposito === 'especie' && !parceiroIdDeposito) {
            showModal({ title: 'Parceiro Obrigatório', message: 'Selecione o estabelecimento para o depósito.', type: 'warning' });
            return;
        }
        try {
            await api.post('/financeiro/notificar-deposito', { 
                valor: v,
                metodo: metodoDeposito,
                parceiro_id: metodoDeposito === 'especie' ? parseInt(parceiroIdDeposito) : null
            });
            setMensagem('Notificação enviada!');
            setValorNotificacao('');
            setParceiroIdDeposito('');
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
        if (metodoSaque === 'especie' && !parceiroIdSaque) {
            setMensagem('Erro: Selecione o parceiro para o saque.');
            return;
        }
        try {
            await api.post('/financeiro/solicitar-saque', {
                valor: v || 0,
                metodo: metodoSaque || 'pix',
                parceiro_id: metodoSaque === 'especie' ? (parseInt(parceiroIdSaque) || null) : null,
                chave_pix: metodoSaque === 'pix' ? (usuario.chave_pix || "") : "",
                senha: senhaSaque || "",
                codigo_2fa: codigo2faSaque || ""
            });
            setMensagem('Solicitação de saque enviada com sucesso!');
            setValorSaque('');
            setSenhaSaque('');
            setCodigo2faSaque('');
            setParceiroIdSaque('');
            setActiveView('home');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleComprarScore = () => {
        showModal({
            title: 'Aumentar Score',
            message: 'Deseja comprar +1.5 de Score por R$ 35,00?',
            type: 'pool',
            onConfirm: async () => {
                closeModal();
                setLoadingAction(true);
                try {
                    const res = await api.post('/score/comprar');
                    showModal({ title: 'Score Atualizado', message: res.message, type: 'success' });
                    carregarSnapshot();
                } catch (err) {
                    setMensagem('Erro ao comprar score: ' + err.message);
                } finally {
                    setLoadingAction(false);
                }
            }
        });
    };

    const handleAceitarGarantia = async (id) => {
        try {
            const res = await api.post(`/emprestimos/aceitar-garantia/${id}`);
            setMensagem(res.message);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro ao aceitar garantia: ' + err.message);
        }
    };

    const handleRejeitarGarantia = async (id) => {
        showModal({
            title: 'Rejeitar Garantia',
            message: 'Se você recusar, o empréstimo do seu amigo será cancelado e os valores devolvidos aos investidores. \n\nConfirmar rejeição?',
            type: 'warning',
            onConfirm: async () => {
                closeModal();
                setLoadingAction(true);
                try {
                    const res = await api.post(`/emprestimos/rejeitar-garantia/${id}`);
                    setMensagem(res.message);
                    carregarSnapshot();
                } catch (err) {
                    setMensagem('Erro ao rejeitar garantia: ' + err.message);
                } finally {
                    setLoadingAction(false);
                }
            }
        });
    };


    const handleSolicitarVerificacao = () => {
        if (!kycDetails) return showModal({ title: 'Campo Obrigatório', message: 'Informe os detalhes do envio para prosseguir.', type: 'warning' });
        showModal({
            title: 'Solicitar Verificação',
            message: 'Taxa de análise humana: R$ 35,00. \nDeseja prosseguir com a solicitação?',
            type: 'info',
            onConfirm: async () => {
                closeModal();
                setLoadingAction(true);
                try {
                    const res = await api.post('/score/solicitar-verificacao', { detalhes: kycDetails });
                    showModal({ title: 'Solicitação Enviada', message: res.message, type: 'success' });
                    setKycDetails('');
                    setActiveView('home');
                    carregarSnapshot();
                } catch (err) {
                    setMensagem('Erro ao solicitar verificação: ' + err.message);
                } finally {
                    setLoadingAction(false);
                }
            }
        });
    };


    const copiarPix = () => {
        navigator.clipboard.writeText('91980177874');
        setCopiadoPix(true);
        setTimeout(() => setCopiadoPix(false), 2000);
    };

    const baixarContrato = async (id) => {
        try {
            const blob = await api.getBlob(`/emprestimos/contrato/pdf/${id}`);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `contrato_peer_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Erro ao baixar contrato:', err);
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
                <div className={`alert ${typeof mensagem === 'string' && mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'} `}>
                    <span>{typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem)}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Top Grid for PC: Balance and Pending Actions */}
            <div className="grid-2">
                <div>
                    {/* Alertas de Garantia */}
                    {garantiasPendentes.length > 0 && (
                        <div className="card animate-slide-up" style={{ borderColor: 'var(--primary)', background: 'rgba(255,204,0,0.02)' }}>
                            <div className="flex-between mb-1">
                                <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Bell size={18} className="text-primary" />
                                    Pedindo sua Garantia
                                </h3>
                                <span className="badge badge-warning">{garantiasPendentes.length}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {garantiasPendentes.map(p => (
                                    <div key={p.solicitacao_id} className="info-block flex-between" style={{ padding: '10px', background: 'rgba(255,255,255,0.03)' }}>
                                        <div>
                                            <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{p.tomador} te convidou</p>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>R$ {p.valor.toLocaleString('pt-BR')}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => handleAceitarGarantia(p.solicitacao_id)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--success)' }}>Aceitar</button>
                                            <button onClick={() => handleRejeitarGarantia(p.solicitacao_id)} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--danger)' }}>Recusar</button>
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
                                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Minha Conta</span>
                            </div>
                            <ChevronRight size={18} color="var(--text-muted)" />
                        </div>

                        <div className="flex-between">
                            <div>
                                {verSaldo ? (
                                    <h2 style={{ fontSize: '2.25rem' }}>
                                        R$ {(usuario.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </h2>
                                ) : (
                                    <div style={{ height: '40px', width: '180px', background: 'rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                                )}
                                <p style={{ fontSize: '0.85rem', marginTop: '12px' }}>
                                    Score Financeiro: <span className="text-primary" style={{ fontWeight: 800 }}>{(usuario.score || 0).toFixed(1)}</span>
                                </p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setVerSaldo(!verSaldo); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '10px' }}>
                                {verSaldo ? <Eye size={24} /> : <EyeOff size={24} />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="hide-on-mobile">
                    {/* PC-only Widget: Resumo Financeiro ou Info */}
                    <div className="card" style={{ height: '100%' }}>
                        <h3 className="mb-1" style={{ fontSize: '1rem' }}>Resumo de Atividade</h3>
                        <div className="grid-2" style={{ gap: '10px' }}>
                            <div className="info-block">
                                <div className="info-label">Dívida Total</div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>R$ {(usuario.divida_total || 0).toLocaleString('pt-BR')}</div>
                            </div>
                            <div className="info-block">
                                <div className="info-label">Garantias</div>
                                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{usuario.total_garantias || 0} Ativas</div>
                            </div>
                        </div>
                        <div className="mt-1 p-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '12px', fontSize: '0.8rem' }}>
                            <p style={{ margin: 0 }}>Lembre-se: manter seu Score acima de 600 libera taxas de juros reduzidas em até 2%.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Mosaic / Grid - Header for Active View */}
            {activeView !== 'home' && (
                <div className="flex-between mb-1 animate-fade-in" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                            onClick={() => { setActiveView('home'); setPassoSolicitar(1); setPassoDeposito(1); setPassoSaque(1); setPassoUpgrade(1); }}
                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2 style={{ fontSize: '1.1rem', margin: 0, textTransform: 'capitalize' }}>
                            {activeView === 'caixa_parceiro' ? 'Meu Caixa' : activeView === 'score' ? 'Upgrade' : activeView}
                        </h2>
                    </div>
                </div>
            )}

            {/* Action Mosaic / Grid - Only visible in 'home' view */}
            {activeView === 'home' && (
                <div className="action-grid animate-fade-in">
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
                    <div className="action-btn" onClick={() => setActiveView('loja')}>
                        <ShoppingBag size={28} color="var(--primary)" />
                        <span>Loja</span>
                    </div>
                    {usuario.is_parceiro && (
                        <div className="action-btn" onClick={() => setActiveView('caixa_parceiro')} style={{ borderColor: 'var(--warning)', background: 'rgba(255, 145, 0, 0.05)' }}>
                            <Store size={28} color="var(--warning)" />
                            <span style={{ color: 'var(--warning)', fontWeight: 700 }}>Meu Caixa</span>
                        </div>
                    )}
                </div>
            )}

            {/* View Switcher Content */}
            {activeView === 'solicitar' && (
                <div className="card">
                    <div className="flex-between mb-1">
                        <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Novo Pedido de Crédito</h2>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoSolicitar ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                            ))}
                        </div>
                    </div>

                    {/* PASSO 1: SIMULAÇÃO */}
                    {passoSolicitar === 1 && (
                        <div className="animate-fade-in">
                            <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Simule o valor e as condições do seu pedido de apoio.</p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                                <div className="input-group" style={{ width: '100%', maxWidth: '280px' }}>
                                    <label style={{ textAlign: 'center', display: 'block' }}>Quanto você precisa?</label>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="0,00"
                                            style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.2rem', fontWeight: 800 }}
                                            value={valor}
                                            onChange={(e) => setValor(e.target.value)}
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
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {valor && taxa && parcelas && (
                                <div className="info-block mt-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)' }}>
                                    <div className="info-label">Parcela Estimada</div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                                        R$ {((parseFloat(valor) * (1 + (parseFloat(taxa) / 100 * parcelas))) / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <small className="text-muted">Total a devolver: R$ {(parseFloat(valor) * (1 + (parseFloat(taxa) / 100 * parcelas))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ flex: 2 }} 
                                    disabled={!valor || !taxa || !parcelas || parseFloat(valor) <= 0}
                                    onClick={() => setPassoSolicitar(2)}
                                >
                                    Continuar
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setActiveView('home'); setPassoSolicitar(1); }}>Voltar</button>
                            </div>
                        </div>
                    )}

                    {/* PASSO 2: ESCOLHA DA GARANTIA */}
                    {passoSolicitar === 2 && (
                        <div className="animate-fade-in">
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textAlign: 'center' }}>Tipo de Garantia</h3>
                            <p className="text-muted mb-1" style={{ fontSize: '0.8rem', textAlign: 'center' }}>Como você deseja garantir o pagamento do seu apoio?</p>
                            
                            <div className="grid-2" style={{ gap: '10px', marginBottom: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                    <div 
                                        className={`card-selecionavel ${tipoGarantia === 'social' ? 'active' : ''}`}
                                        onClick={() => setTipoGarantia('social')}
                                        style={{ padding: '12px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid', borderColor: tipoGarantia === 'social' ? 'var(--primary)' : 'rgba(255,255,255,0.1)', background: tipoGarantia === 'social' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent', borderRadius: '16px' }}
                                    >
                                        <Users size={20} color={tipoGarantia === 'social' ? 'var(--primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 8px' }} />
                                        <div style={{ fontWeight: 600, fontSize: '0.75rem' }}>Social</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>2 Amigos</div>
                                    </div>
                                    <div 
                                        className={`card-selecionavel ${tipoGarantia === 'fisica' ? 'active' : ''}`}
                                        onClick={() => setTipoGarantia('fisica')}
                                        style={{ padding: '12px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid', borderColor: tipoGarantia === 'fisica' ? 'var(--primary)' : 'rgba(255,255,255,0.1)', background: tipoGarantia === 'fisica' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent', borderRadius: '16px' }}
                                    >
                                        <Package size={20} color={tipoGarantia === 'fisica' ? 'var(--primary)' : 'var(--text-muted)'} style={{ margin: '0 auto 8px' }} />
                                        <div style={{ fontWeight: 600, fontSize: '0.75rem' }}>Física</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>Item Valor</div>
                                    </div>
                                    <div 
                                        className={`card-selecionavel ${tipoGarantia === 'hibrida' ? 'active' : ''}`}
                                        onClick={() => setTipoGarantia('hibrida')}
                                        style={{ padding: '12px 8px', textAlign: 'center', cursor: 'pointer', border: '1px solid', borderColor: tipoGarantia === 'hibrida' ? 'var(--success)' : 'rgba(255,255,255,0.1)', background: tipoGarantia === 'hibrida' ? 'rgba(0, 230, 118, 0.1)' : 'transparent', borderRadius: '16px' }}
                                    >
                                        <Zap size={20} color={tipoGarantia === 'hibrida' ? 'var(--success)' : 'var(--text-muted)'} style={{ margin: '0 auto 8px' }} />
                                        <div style={{ fontWeight: 700, fontSize: '0.75rem', color: tipoGarantia === 'hibrida' ? 'var(--success)' : 'inherit' }}>Jato ✨</div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>Social + Fís.</div>
                                    </div>
                                </div>
                            </div>

                            <div 
                                className={`card-selecionavel ${tipoGarantia === 'nenhuma' ? 'active' : ''}`}
                                onClick={() => setTipoGarantia('nenhuma')}
                                style={{ 
                                    padding: '12px', 
                                    textAlign: 'center', 
                                    cursor: 'pointer', 
                                    border: '1px solid', 
                                    borderColor: tipoGarantia === 'nenhuma' ? 'var(--danger)' : 'rgba(255,255,255,0.05)', 
                                    background: tipoGarantia === 'nenhuma' ? 'rgba(255, 61, 0, 0.05)' : 'rgba(255,255,255,0.02)', 
                                    borderRadius: '16px',
                                    marginBottom: '1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px'
                                }}
                            >
                                <ShieldAlert size={20} color={tipoGarantia === 'nenhuma' ? 'var(--danger)' : 'var(--text-muted)'} />
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: tipoGarantia === 'nenhuma' ? 'var(--danger)' : 'inherit' }}>Sem Garantia Coletiva</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Aprovação mais difícil e maior rigor na análise.</div>
                                </div>
                            </div>

                            <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {(tipoGarantia === 'social' || tipoGarantia === 'hibrida') && (
                                    <div className="input-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div className="input-group">
                                            <label>ID Amigo 1</label>
                                            <input type="number" className="input-field" placeholder="0000" value={idAmigo1} onChange={(e) => setIdAmigo1(e.target.value)} />
                                        </div>
                                        <div className="input-group">
                                            <label>ID Amigo 2</label>
                                            <input type="number" className="input-field" placeholder="0000" value={idAmigo2} onChange={(e) => setIdAmigo2(e.target.value)} />
                                        </div>
                                    </div>
                                )}

                                {(tipoGarantia === 'fisica' || tipoGarantia === 'hibrida') && (
                                    <>
                                        <div className="input-group">
                                            <label>Descrição do Item</label>
                                            <input 
                                                type="text" 
                                                className="input-field" 
                                                placeholder="Ex: iPhone 13 Pro Max" 
                                                value={garantiaDescricao}
                                                onChange={(e) => setGarantiaDescricao(e.target.value)}
                                            />
                                        </div>
                                        <div className="input-group">
                                            <label>Parceiro para Entrega</label>
                                            <select 
                                                className="input-field"
                                                value={parceiroIdGarantia}
                                                onChange={(e) => setParceiroIdGarantia(e.target.value)}
                                            >
                                                <option value="">Selecione um parceiro...</option>
                                                {parceiros.map(p => (
                                                    <option key={p.id} value={p.id}>{p.nome}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ flex: 2 }} 
                                    disabled={
                                        (tipoGarantia === 'social' && (!idAmigo1 || !idAmigo2)) ||
                                        (tipoGarantia === 'fisica' && (!garantiaDescricao || !parceiroIdGarantia)) ||
                                        (tipoGarantia === 'hibrida' && (!idAmigo1 || !idAmigo2 || !garantiaDescricao || !parceiroIdGarantia)) ||
                                        (tipoGarantia === 'nenhuma' && false) // Sempre habilitado para 'nenhuma'
                                    }
                                    onClick={() => setPassoSolicitar(3)}
                                >
                                    Continuar
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSolicitar(1)}>Voltar</button>
                            </div>
                        </div>
                    )}

                    {/* PASSO 3: TERMOS E TAXAS */}
                    {passoSolicitar === 3 && (
                        <div className="animate-fade-in">
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textAlign: 'center' }}>Termos e Compromissos</h3>
                            
                            {/* Aviso de Política de Taxa */}
                            <div style={{ padding: '16px', background: 'rgba(255, 145, 0, 0.07)', border: '1px solid rgba(255, 145, 0, 0.2)', borderRadius: '16px', marginBottom: '1.5rem' }}>
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Gift size={20} /> Taxa de Intermediação
                                </p>
                                <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                    • 1º pedido do mês: <strong>ISENTO</strong> <br />
                                    • A partir do 2º: <strong>R$ 4,00</strong> (taxa de processamento). <br />
                                    <span style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>Atenção: A taxa de R$ 4,00 não é devolvida caso não haja investidores.</span>
                                </p>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <input
                                    type="checkbox"
                                    id="check-termos"
                                    style={{ marginTop: '4px', transform: 'scale(1.2)' }}
                                    checked={aceiteTermos}
                                    onChange={(e) => setAceiteTermos(e.target.checked)}
                                />
                                <label htmlFor="check-termos" style={{ fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer', lineHeight: '1.4' }}>
                                    Estou ciente da política de taxas e concordo com os <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTermos(true); }} style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Termos de Uso</span> da plataforma Peer.
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ flex: 2 }} 
                                    disabled={!aceiteTermos}
                                    onClick={() => setPassoSolicitar(4)}
                                >
                                    Revisar Pedido
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSolicitar(2)}>Voltar</button>
                            </div>
                        </div>
                    )}

                    {/* PASSO 4: REVISÃO FINAL */}
                    {passoSolicitar === 4 && (
                        <div className="animate-fade-in">
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textAlign: 'center' }}>Resumo da Solicitação</h3>
                            
                            <div className="info-block mb-1">
                                <div className="flex-between mb-1">
                                    <span className="text-muted">Valor Desejado:</span>
                                    <span style={{ fontWeight: 700 }}>R$ {parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex-between mb-1">
                                    <span className="text-muted">Taxa Oferecida:</span>
                                    <span style={{ fontWeight: 700 }}>{taxa}% ao mês</span>
                                </div>
                                <div className="flex-between mb-1">
                                    <span className="text-muted">Prazo:</span>
                                    <span style={{ fontWeight: 700 }}>{parcelas} meses</span>
                                </div>
                                <div className="flex-between mb-1">
                                    <span className="text-muted">Garantia:</span>
                                    <span style={{ fontWeight: 700, color: tipoGarantia === 'hibrida' ? 'var(--success)' : tipoGarantia === 'nenhuma' ? 'var(--danger)' : 'var(--primary)' }}>
                                        {tipoGarantia === 'hibrida' ? 'Híbrida (Jato ✨)' : tipoGarantia === 'fisica' ? 'Física (Item)' : tipoGarantia === 'nenhuma' ? 'Nenhuma (Risco Alto)' : 'Social (Amigos)'}
                                    </span>
                                </div>
                                {(tipoGarantia === 'social' || tipoGarantia === 'hibrida') && (
                                    <div className="text-muted mb-1" style={{ fontSize: '0.75rem', padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        Garantidores: ID {idAmigo1} e ID {idAmigo2}
                                    </div>
                                )}
                                {(tipoGarantia === 'fisica' || tipoGarantia === 'hibrida') && (
                                    <div className="text-muted mb-1" style={{ fontSize: '0.75rem', padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        Item: {garantiaDescricao} <br />
                                        Local: {parceiros.find(p => p.id == parceiroIdGarantia)?.nome}
                                    </div>
                                )}
                                <div className="flex-between" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px', marginTop: '5px' }}>
                                    <span style={{ fontWeight: 600 }}>Parcela Mensal:</span>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>
                                        R$ {((parseFloat(valor) * (1 + (parseFloat(taxa) / 100 * parcelas))) / parcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <p className="text-muted text-center" style={{ fontSize: '0.75rem', padding: '0 10px' }}>
                                Ao clicar em confirmar, seu pedido será publicado no mural de oportunidades para análise da comunidade.
                            </p>

                            <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ flex: 2 }} 
                                    onClick={handleSolicitar}
                                >
                                    {loadingAction ? 'Enviando...' : 'Confirmar e Publicar'}
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSolicitar(3)}>Voltar</button>
                            </div>
                        </div>
                    )}
                </div >
            )}
            {activeView === 'loja' && (
                <div className="card">
                    <LojaAfiliados onMensagem={setMensagem} />
                </div>
            )}
            {activeView === 'caixa_parceiro' && (
                <CaixaParceiro onBack={() => setActiveView('home')} setMensagem={setMensagem} usuario={usuario} onUpdate={carregarSnapshot} />
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
                        <div className="flex-between mb-1">
                            <h2 style={{ fontSize: '1.2rem' }}>Adicionar Saldo</h2>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoDeposito ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                                ))}
                            </div>
                        </div>

                        {/* PASSO 1: VALOR E MÉTODO */}
                        {passoDeposito === 1 && (
                            <div className="animate-fade-in">
                                <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Quanto deseja adicionar e como prefere pagar?</p>
                                
                                <div className="input-group mb-1">
                                    <label>Escolha o Método</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            className={`btn ${metodoDeposito === 'pix' ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ flex: 1, padding: '0.6rem' }}
                                            onClick={() => setMetodoDeposito('pix')}
                                        >
                                            Via PIX
                                        </button>
                                        <button
                                            className={`btn ${metodoDeposito === 'especie' ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ flex: 1, padding: '0.6rem' }}
                                            onClick={() => setMetodoDeposito('especie')}
                                        >
                                            Em Espécie
                                        </button>
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Valor do Depósito</label>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="R$ 0,00"
                                            style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.2rem', fontWeight: 800 }}
                                            value={valorNotificacao}
                                            onChange={(e) => setValorNotificacao(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: '100%' }} 
                                        onClick={() => {
                                            if (parseFloat(valorNotificacao) > 0) setPassoDeposito(2);
                                            else showModal({ title: 'Valor Inválido', message: 'Informe um valor maior que zero.', type: 'error' });
                                        }}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 2: INSTRUÇÕES */}
                        {passoDeposito === 2 && (
                            <div className="animate-fade-in">
                                {metodoDeposito === 'pix' ? (
                                    <>
                                        <p className="mb-1">Tudo pronto! Agora realize a transferência PIX:</p>
                                        <div className="info-block mb-1 text-center" style={{ position: 'relative', background: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                                            <div className="info-label">Chave PIX (E-mail)</div>
                                            <div className="info-value" style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                91980177874
                                                <button
                                                    onClick={copiarPix}
                                                    style={{ background: 'none', border: 'none', color: copiadoPix ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    {copiadoPix ? <Check size={18} /> : <Copy size={18} />}
                                                </button>
                                            </div>
                                            {copiadoPix && <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px' }}>Copiado para o clipboard!</p>}
                                        </div>
                                        <div className="info-block mb-1">
                                            <div className="info-label">Valor a pagar</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>R$ {parseFloat(valorNotificacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="input-group">
                                        <label>Escolha o Estabelecimento Parceiro</label>
                                        <select
                                            className="input-field"
                                            value={parceiroIdDeposito}
                                            onChange={(e) => setParceiroIdDeposito(e.target.value)}
                                            style={{ marginBottom: '1rem' }}
                                        >
                                            <option value="">Selecione um local...</option>
                                            {parceiros.map(p => (
                                                <option key={p.id} value={p.id}>{p.nome} - {p.endereco}</option>
                                            ))}
                                        </select>
                                        <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center' }}>Vá até o local escolhido para realizar o depósito em espécie com o atendente.</p>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ flex: 2 }} 
                                        disabled={metodoDeposito === 'especie' && !parceiroIdDeposito}
                                        onClick={() => setPassoDeposito(3)}
                                    >
                                        Já realizei o Pagamento
                                    </button>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoDeposito(1)}>Voltar</button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 3: CONFIRMAÇÃO FINAL */}
                        {passoDeposito === 3 && (
                            <div className="animate-fade-in text-center" style={{ padding: '1rem 0' }}>
                                <div style={{ background: 'rgba(var(--success-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                    <CheckCircle2 size={40} color="var(--success)" />
                                </div>
                                <h3 className="mb-1">Quase lá!</h3>
                                <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>
                                    Estamos verificando seu depósito de <strong>R$ {parseFloat(valorNotificacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                                </p>
                                <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>
                                    O saldo aparecerá na sua conta assim que o pagamento for confirmado.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
                                    <button className="btn btn-primary" onClick={handleNotificarDeposito}>Confirmar Notificação</button>
                                    <button className="btn btn-secondary" onClick={() => setPassoDeposito(2)}>Revisar Dados</button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {
                activeView === 'saque' && (
                    <div className="card">
                        <div className="flex-between mb-1">
                            <h2 style={{ fontSize: '1.2rem' }}>Solicitar Saque</h2>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoSaque ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                                ))}
                            </div>
                        </div>

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
                                {/* PASSO 1: VALOR E MÉTODO */}
                                {passoSaque === 1 && (
                                    <div className="animate-fade-in">
                                        <div className="input-group mb-1">
                                            <label>Forma de Recebimento</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button
                                                    className={`btn ${metodoSaque === 'pix' ? 'btn-primary' : 'btn-outline'}`}
                                                    style={{ flex: 1, padding: '0.6rem' }}
                                                    onClick={() => setMetodoSaque('pix')}
                                                >
                                                    Via PIX
                                                </button>
                                                <button
                                                    className={`btn ${metodoSaque === 'especie' ? 'btn-primary' : 'btn-outline'}`}
                                                    style={{ flex: 1, padding: '0.6rem' }}
                                                    onClick={() => setMetodoSaque('especie')}
                                                >
                                                    Em Espécie
                                                </button>
                                            </div>
                                        </div>

                                        <div className="input-group">
                                            <label>Quanto deseja sacar?</label>
                                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    placeholder="R$ 0,00"
                                                    style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.2rem', fontWeight: 800 }}
                                                    value={valorSaque}
                                                    onChange={(e) => setValorSaque(e.target.value)}
                                                />
                                            </div>
                                            {parseFloat(valorSaque) > usuario.saldo && (
                                                <p className="text-danger mt-1" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                                                    ⚠️ Saldo insuficiente (Disponível: R$ {usuario.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                                </p>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ flex: 2 }} 
                                                disabled={!valorSaque || parseFloat(valorSaque) <= 0 || parseFloat(valorSaque) > usuario.saldo}
                                                onClick={() => setPassoSaque(2)}
                                            >
                                                Continuar
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setActiveView('home'); setPassoSaque(1); }}>Voltar</button>
                                        </div>
                                    </div>
                                )}

                                {/* PASSO 2: REVISÃO E TAXAS */}
                                {passoSaque === 2 && (
                                    <div className="animate-fade-in">
                                        <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                            <div className="flex-between mb-1">
                                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Valor Solicitado:</span>
                                                <span style={{ fontWeight: 700 }}>R$ {parseFloat(valorSaque).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex-between mb-1">
                                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Taxa de Saque:</span>
                                                <span style={{ fontWeight: 700, color: usuario.saldo_caixa >= 100 ? 'var(--success)' : 'var(--danger)' }}>
                                                    {usuario.saldo_caixa >= 100 ? 'R$ 0,00 (ISENTO)' : 'R$ 5,00'}
                                                </span>
                                            </div>
                                            <div className="flex-between" style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                                                <span>Valor Líquido:</span>
                                                <span>
                                                    R$ {Math.max(0, parseFloat(valorSaque) - (usuario.saldo_caixa >= 100 ? 0 : 5)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {metodoSaque === 'pix' ? (
                                            <p className="text-muted mb-1" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                                                O valor será enviado para sua chave PIX: <br /><strong>{usuario.chave_pix}</strong>
                                            </p>
                                        ) : (
                                            <div className="input-group mb-1">
                                                <label>Selecione o Parceiro para Retirada</label>
                                                <select
                                                    className="input-field"
                                                    value={parceiroIdSaque}
                                                    onChange={(e) => setParceiroIdSaque(e.target.value)}
                                                >
                                                    <option value="">Selecione um local...</option>
                                                    {parceiros.map(p => (
                                                        <option key={p.id} value={p.id}>{p.nome} - {p.endereco}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ flex: 2 }} 
                                                disabled={metodoSaque === 'especie' && !parceiroIdSaque}
                                                onClick={() => setPassoSaque(3)}
                                            >
                                                Prosseguir para Segurança
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSaque(1)}>Voltar</button>
                                        </div>
                                    </div>
                                )}

                                {/* PASSO 3: SEGURANÇA */}
                                {passoSaque === 3 && (
                                    <div className="animate-fade-in">
                                        <div className="text-center mb-1">
                                            <Lock size={32} color="var(--primary)" style={{ marginBottom: '10px' }} />
                                            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Para sua segurança, confirme sua senha e o código 2FA.</p>
                                        </div>

                                        <div className="input-group mb-1">
                                            <label>Sua Senha</label>
                                            <input
                                                type="password"
                                                className="input-field"
                                                placeholder="Sua senha de acesso"
                                                value={senhaSaque}
                                                onChange={(e) => setSenhaSaque(e.target.value)}
                                            />
                                        </div>

                                        <div className="input-group mb-1">
                                            <label>Código 2FA</label>
                                            <input
                                                type="text"
                                                className="input-field"
                                                placeholder="000000"
                                                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontWeight: 700 }}
                                                value={codigo2faSaque}
                                                onChange={(e) => setCodigo2faSaque(e.target.value)}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ flex: 2 }} 
                                                onClick={handleSolicitarSaque}
                                                disabled={!senhaSaque || !codigo2faSaque}
                                            >
                                                Confirmar Saque
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSaque(2)}>Voltar</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )
            }

            {
                activeView === 'score' && (
                    <div className="card">
                        <div className="flex-between mb-1">
                            <h2 style={{ fontSize: '1.2rem' }}>Upgrade de Perfil</h2>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoUpgrade ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                                ))}
                            </div>
                        </div>

                        {/* PASSO 1: SELEÇÃO DO UPGRADE */}
                        {passoUpgrade === 1 && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Escolha como deseja melhorar seu perfil de tomador hoje.</p>
                                
                                <div 
                                    className="card-minimal clickable" 
                                    style={{ 
                                        background: tipoUpgrade === 'score' ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.03)', 
                                        padding: '1.2rem', 
                                        borderRadius: '16px', 
                                        border: tipoUpgrade === 'score' ? '1px solid var(--primary)' : '1px solid transparent',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => setTipoUpgrade('score')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '10px', borderRadius: '12px' }}>
                                            <RefreshCw size={24} color="var(--primary)" />
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <h3 style={{ fontSize: '1rem', marginBottom: '2px' }}>Turbo Score</h3>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+1.5 pontos imediatos no seu score.</p>
                                        </div>
                                        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                            <span style={{ fontWeight: 800, color: 'var(--success)' }}>R$ 35,00</span>
                                        </div>
                                    </div>
                                </div>

                                {!usuario.is_verified && (
                                    <div 
                                        className="card-minimal clickable" 
                                        style={{ 
                                            background: tipoUpgrade === 'verificacao' ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(255,255,255,0.03)', 
                                            padding: '1.2rem', 
                                            borderRadius: '16px', 
                                            border: tipoUpgrade === 'verificacao' ? '1px solid var(--primary)' : '1px solid transparent',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => setTipoUpgrade('verificacao')}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ background: 'rgba(var(--success-rgb), 0.1)', padding: '10px', borderRadius: '12px' }}>
                                                <ShieldCheck size={24} color="var(--success)" />
                                            </div>
                                            <div style={{ textAlign: 'left' }}>
                                                <h3 style={{ fontSize: '1rem', marginBottom: '2px' }}>Verificação de Conta</h3>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Selo de verificado e maior confiança.</p>
                                            </div>
                                            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                                <span style={{ fontWeight: 800, color: 'var(--success)' }}>R$ 35,00</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ marginTop: '1rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: '100%' }} 
                                        disabled={!tipoUpgrade}
                                        onClick={() => setPassoUpgrade(2)}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 2: DETALHES E INSTRUÇÕES */}
                        {passoUpgrade === 2 && (
                            <div className="animate-fade-in">
                                {tipoUpgrade === 'score' ? (
                                    <div className="text-center" style={{ padding: '0.5rem' }}>
                                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                            <TrendingUp size={30} color="var(--primary)" />
                                        </div>
                                        <h3 className="mb-1">Impulso de Score</h3>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>O score turbinado ajuda você a conseguir crédito mais rápido com taxas menores.</p>
                                        
                                        <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                            <div className="flex-between">
                                                <span>Valor do Upgrade:</span>
                                                <strong style={{ color: 'var(--success)' }}>R$ 35,00</strong>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in">
                                        <h3 className="mb-1" style={{ fontSize: '1.1rem' }}>Sua Privacidade em 1º Lugar</h3>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Não armazenamos fotos de documentos localmente para sua segurança total (LGPD).</p>
                                        
                                        {/* Exibir motivo de rejeição anterior se houver */}
                                        {(() => {
                                            const kycRejeitado = historico.find(h => h.tipo === 'desbloqueio_dados' && h.status === 'falhou');
                                            if (kycRejeitado) {
                                                return (
                                                    <div style={{ background: 'rgba(255, 61, 0, 0.08)', border: '1px solid rgba(255, 61, 0, 0.2)', padding: '10px', borderRadius: '10px', marginBottom: '1rem' }}>
                                                        <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <AlertCircle size={14} /> TENTATIVA ANTERIOR REJEITADA
                                                        </p>
                                                        <p style={{ color: '#fff', fontSize: '0.8rem', marginTop: '4px', fontStyle: 'italic' }}>"{kycRejeitado.detalhes}"</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="input-group mb-1">
                                            <label style={{ fontSize: '0.8rem' }}>Link do Google Drive ou Imgur com seus documentos:</label>
                                            <textarea
                                                className="input-field"
                                                style={{ minHeight: '80px', fontSize: '0.85rem' }}
                                                placeholder="https://drive.google.com/..."
                                                value={kycDetails}
                                                onChange={(e) => setKycDetails(e.target.value)}
                                            />
                                        </div>
                                        <p className="text-muted" style={{ fontSize: '0.7rem' }}>Ou descreva como nos enviou (ex: via WhatsApp).</p>
                                    </div>
                                )}

                                <div className="info-block mb-1 text-center" style={{ background: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                                    <div className="info-label">Custo do Upgrade</div>
                                    <div className="info-value" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>
                                        R$ 35,00
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>O valor será descontado do seu saldo atual.</p>
                                </div>

                                <div className="info-block mb-1">
                                    <div className="flex-between">
                                        <span style={{ fontSize: '0.85rem' }}>Seu Saldo:</span>
                                        <strong style={{ color: usuario.saldo >= 35 ? 'var(--success)' : 'var(--danger)' }}>
                                            R$ {parseFloat(usuario.saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </strong>
                                    </div>
                                </div>

                                {usuario.saldo < 35 && (
                                    <div className="alert alert-warning mb-1" style={{ fontSize: '0.8rem', padding: '10px' }}>
                                        <AlertCircle size={16} /> Você não tem saldo suficiente. <button onClick={() => setActiveView('depositar')} style={{ background: 'none', border: 'none', color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontWeight: 700 }}>Fazer Depósito</button>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ flex: 2 }} 
                                        disabled={(tipoUpgrade === 'verificacao' && !kycDetails) || usuario.saldo < 35}
                                        onClick={() => setPassoUpgrade(3)}
                                    >
                                        Pagar com Saldo
                                    </button>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoUpgrade(1)}>Voltar</button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 3: CONFIRMAÇÃO E ENVIO */}
                        {passoUpgrade === 3 && (
                            <div className="animate-fade-in text-center" style={{ padding: '1rem 0' }}>
                                <div style={{ background: 'rgba(var(--success-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                    <CheckCircle2 size={40} color="var(--success)" />
                                </div>
                                <h3 className="mb-1">Tudo Pronto!</h3>
                                <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>
                                    {tipoUpgrade === 'score' 
                                        ? "Confirme para atualizar seu Score agora mesmo." 
                                        : "Nossa equipe analisará seus documentos e sua conta em até 24h úteis."}
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={tipoUpgrade === 'score' ? handleComprarScore : handleSolicitarVerificacao}
                                    >
                                        Finalizar e Notificar
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setPassoUpgrade(2)}>Revisar</button>
                                </div>
                            </div>
                        )}

                        {/* Removido botão redundante no rodapé */}
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
                        {/* Removido botão redundante no rodapé */}
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
                                <p>Nenhum contrato encontrado.</p>
                            </div>
                        ) : (
                            <>
                                {(() => {
                                    const ativos = meusEmprestimos.filter(e => ['aprovado', 'pendente'].includes(e.status));
                                    const concluidos = meusEmprestimos.filter(e => ['concluido', 'rejeitado', 'falhou'].includes(e.status));

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {/* SEÇÃO: EMPRÉSTIMOS ATIVOS */}
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
                                                                            <span className={`badge ${emp.status === 'aprovado' ? 'badge-success' : 'badge-warning'} `}>
                                                                                {emp.status.toUpperCase()}
                                                                            </span>
                                                                            {emp.status !== 'pendente' && (
                                                                                <button onClick={() => baixarContrato(emp.id)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                                                                                    <FileText size={12} /> Contrato PDF
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        <h3 className="mt-1" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Crédito #{emp.id}</h3>
                                                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                                            Você recebe: <strong style={{ color: 'var(--text-main)' }}>R$ {emp.valor.toLocaleString('pt-BR')}</strong>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p className="text-muted" style={{ fontSize: '0.6rem' }}>VALOR MENSAL</p>
                                                                        <p style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1rem' }}>
                                                                            R$ {emp.valor_parcela.toLocaleString('pt-BR')}
                                                                        </p>
                                                                        {emp.status === 'aprovado' && emp.proximo_vencimento && (
                                                                            <div className="text-muted" style={{ fontSize: '0.65rem', marginTop: '4px' }}>
                                                                                Vencimento: <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{new Date(emp.proximo_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {emp.status === 'pendente' && (
                                                                    <>
                                                                        <ContractTimer expira4h={emp.data_expiracao_4h} expira5d={emp.data_expiracao_5d} arrecadado={emp.valor_arrecadado} />
                                                                        <div style={{ marginBottom: '1rem' }}>
                                                                            <div className="flex-between mb-1" style={{ fontSize: '0.75rem' }}>
                                                                                <span className="text-muted">Arrecadado</span>
                                                                                <span style={{ fontWeight: 700 }}>R$ {emp.valor_arrecadado.toLocaleString('pt-BR')} / R$ {emp.valor.toLocaleString('pt-BR')}</span>
                                                                            </div>
                                                                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                                                                                <div style={{
                                                                                    width: `${Math.min(100, (emp.valor_arrecadado / emp.valor) * 100)}%`,
                                                                                    height: '100%',
                                                                                    background: 'var(--primary)',
                                                                                    boxShadow: '0 0 10px var(--primary)',
                                                                                    transition: 'width 1s ease-in-out'
                                                                                }}></div>
                                                                            </div>

                                                                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px' }}>
                                                                                <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Configuração de Garantia</p>
                                                                                {emp.tipo_garantia === 'hibrida' && <p style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 700, marginBottom: '4px' }}>✨ MODO JATO ATIVO (Pool Acelerado)</p>}
                                                                                
                                                                                {emp.garantidores && emp.garantidores.length > 0 ? (
                                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                                        {emp.garantidores.map((g, idx) => (
                                                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                                                                                <span>{g.nome}</span>
                                                                                                <span style={{ color: g.aceito ? 'var(--success)' : 'var(--warning)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                                    {g.aceito ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                                                                                                    {g.aceito ? 'Assinado' : 'Pendente'}
                                                                                                </span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                                                        {emp.tipo_garantia === 'fisica' ? 'Garantia física configurada.' : 'Aguardando arrecadação para liberação social.'}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}

                                                                {emp.status === 'aguardando_avaliacao' && (
                                                                    <div style={{ background: 'rgba(255, 145, 0, 0.1)', border: '1px solid rgba(255, 145, 0, 0.3)', padding: '15px', borderRadius: '16px', marginBottom: '1rem' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                            <Package size={24} color="var(--warning)" />
                                                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--warning)' }}>Ação Necessária: Entrega Física</h4>
                                                                        </div>
                                                                        <p style={{ fontSize: '0.75rem', marginTop: '8px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                                                                            Seu pedido foi financiado! Agora você deve levar o item <strong>{emp.garantia_descricao}</strong> até o parceiro <strong>{emp.parceiro_nome}</strong> para avaliação e liberação final do saldo.
                                                                        </p>
                                                                        {emp.parceiro_endereco && (
                                                                            <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                                                <MapPin size={16} color="var(--warning)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                                                                <p style={{ fontSize: '0.7rem', color: 'var(--text-main)', margin: 0, lineHeight: '1.3' }}>
                                                                                    <strong>Endereço de Entrega:</strong><br />
                                                                                    {emp.parceiro_endereco}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {emp.status === 'aguardando_garantidores' && (
                                                                    <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', border: '1px solid rgba(var(--primary-rgb), 0.3)', padding: '15px', borderRadius: '16px', marginBottom: '1rem' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                            <Users size={24} color="var(--primary)" />
                                                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary)' }}>Aguardando Assinaturas</h4>
                                                                        </div>
                                                                        <p style={{ fontSize: '0.75rem', marginTop: '8px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                                                                            A parte física foi aprovada (ou meta batida)! Falta apenas seus 2 amigos aceitarem o compromisso social no painel deles para que o dinheiro caia na sua conta.
                                                                        </p>
                                                                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                            {emp.garantidores && emp.garantidores.map((g, idx) => (
                                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px' }}>
                                                                                    <span>{g.nome}</span>
                                                                                    <span style={{ color: g.aceito ? 'var(--success)' : 'var(--warning)', fontWeight: 700 }}>
                                                                                        {g.aceito ? 'Confirmou ✓' : 'Pendente...'}
                                                                                    </span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {emp.status === 'reprovado_garantia' && (
                                                                    <div style={{ background: 'rgba(255, 61, 0, 0.1)', border: '1px solid rgba(255, 61, 0, 0.3)', padding: '15px', borderRadius: '16px', marginBottom: '1rem' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                            <AlertCircle size={24} color="var(--danger)" />
                                                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--danger)' }}>Garantia Reprovada</h4>
                                                                        </div>
                                                                        <p style={{ fontSize: '0.75rem', marginTop: '8px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
                                                                            O parceiro recusou o item físico. Você tem <strong>1 hora</strong> para regularizar (ex: entregar outro item compatível ou resolver com o parceiro). Caso contrário, o pedido será cancelado.
                                                                        </p>
                                                                    </div>
                                                                )}

                                                                <div className="info-block" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', marginTop: '10px' }}>
                                                                    <div>
                                                                        <div className="info-label" style={{ fontSize: '0.6rem' }}>Parcelas</div>
                                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{emp.parcelas_pagas} / {emp.parcelas}</div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <div className="info-label" style={{ fontSize: '0.6rem' }}>Restante</div>
                                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--danger)' }}>R$ {emp.valor_total_restante.toLocaleString('pt-BR')}</div>
                                                                    </div>
                                                                </div>

                                                                {emp.status === 'aprovado' && emp.parcelas_pagas < emp.parcelas && (
                                                                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                                            <button className="btn btn-primary" style={{ padding: '10px', fontSize: '0.8rem' }} onClick={() => handlePagarParcela(emp.id, emp.valor_parcela)}>Pagar Parcela</button>
                                                                            <button className="btn btn-outline" style={{ padding: '10px', fontSize: '0.8rem' }} onClick={() => handleQuitar(emp.id)}>Quitar Tudo</button>
                                                                        </div>

                                                                        {showAvulsoPorId[emp.id] ? (
                                                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '12px', border: '1px solid var(--primary-low)' }}>
                                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                                    <div style={{ position: 'relative', flex: 1 }}>
                                                                                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', opacity: 0.6 }}>R$</span>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="input-field"
                                                                                            placeholder="0,00"
                                                                                            style={{ paddingLeft: '30px', fontSize: '0.85rem' }}
                                                                                            value={valorAvulsoPorId[emp.id] || ''}
                                                                                            onChange={(e) => setValorAvulsoPorId(prev => ({ ...prev, [emp.id]: e.target.value }))}
                                                                                        />
                                                                                    </div>
                                                                                    <button className="btn btn-primary" style={{ padding: '0 15px', fontSize: '0.75rem', width: 'auto' }} onClick={() => handlePagamentoAvulso(emp.id)}>Pagar</button>
                                                                                    <button className="btn btn-secondary" style={{ padding: '0 10px', width: 'auto' }} onClick={() => { setShowAvulsoPorId(prev => ({ ...prev, [emp.id]: false })); setValorAvulsoPorId(prev => ({ ...prev, [emp.id]: '' })); }}><X size={14} /></button>
                                                                                </div>
                                                                                <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>Adiciona taxa de R$ 1,50 ao contrato.</p>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                style={{
                                                                                    fontSize: '0.75rem',
                                                                                    color: '#FFD600',
                                                                                    background: 'rgba(0,0,0,0.85)',
                                                                                    padding: '8px 16px',
                                                                                    textAlign: 'center',
                                                                                    width: '100%',
                                                                                    border: '1px solid rgba(255,214,0,0.3)',
                                                                                    borderRadius: '10px',
                                                                                    cursor: 'pointer',
                                                                                    fontWeight: 700,
                                                                                    letterSpacing: '0.3px',
                                                                                    transition: 'var(--transition)'
                                                                                }}
                                                                                onClick={() => setShowAvulsoPorId(prev => ({ ...prev, [emp.id]: true }))}
                                                                            >
                                                                                Pagar outro valor
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* SEÇÃO: HISTÓRICO DE CONTRATOS */}
                                            {concluidos.length > 0 && (
                                                <div>
                                                    <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <History size={14} /> Histórico de Contratos
                                                    </h4>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {concluidos.slice((paginaContratos - 1) * ITENS_POR_PAGINA, paginaContratos * ITENS_POR_PAGINA).map(emp => (
                                                            <div key={emp.id} style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', opacity: 0.7 }}>
                                                                <div className="flex-between">
                                                                    <div>
                                                                        <span className={`badge ${emp.status === 'concluido' ? 'badge-secondary' : 'badge-danger'}`} style={{ fontSize: '0.55rem' }}>
                                                                            {emp.status.toUpperCase()}
                                                                        </span>
                                                                        <p style={{ fontSize: '0.8rem', fontWeight: 600, marginTop: '4px' }}>Empréstimo #{emp.id}</p>
                                                                        <p className="text-muted" style={{ fontSize: '0.65rem' }}>Total: R$ {emp.valor.toLocaleString('pt-BR')}</p>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: emp.status === 'concluido' ? 'var(--success)' : 'var(--danger)' }}>
                                                                            {emp.status === 'concluido' ? 'QUITADO' : 'ENCERRADO'}
                                                                        </p>
                                                                        <button onClick={() => baixarContrato(emp.id)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.65rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' }}>
                                                                            Baixar Contrato
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {concluidos.length > ITENS_POR_PAGINA && (
                                                        <div className="flex-between mt-1">
                                                            <button className="btn-outline" style={{ padding: '2px 8px', fontSize: '0.65rem' }} disabled={paginaContratos === 1} onClick={() => setPaginaContratos(p => p - 1)}>Anterior</button>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{paginaContratos} / {Math.ceil(concluidos.length / ITENS_POR_PAGINA)}</span>
                                                            <button className="btn-outline" style={{ padding: '2px 8px', fontSize: '0.65rem' }} disabled={(paginaContratos * ITENS_POR_PAGINA) >= concluidos.length} onClick={() => setPaginaContratos(p => p + 1)}>Próxima</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                        
                        {/* NOVO MENU DO CAIXA DO LOJISTA */}
                        {activeView === 'caixa_parceiro' && usuario?.is_parceiro && (
                            <CaixaParceiro 
                                onUpdate={carregarSnapshot}
                                usuario={usuario}
                            />
                        )}
                        {/* Removido botão redundante global */}
                    </div>
                )
            }
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
        </div >
    );
};

export default DashboardTomador;
