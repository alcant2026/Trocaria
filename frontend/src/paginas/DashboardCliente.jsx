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
    Lock,
    Star,
    Plus,
    Flag,
    Sparkles,
    AlertTriangle,
    DollarSign,
    Landmark,
    PartyPopper
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
    aporte_caixa: 'Aporte Caixa',
    resgate_caixa: 'Resgate Caixa',
    bonus_pagador_caixa: 'Bônus de Fidelidade',
    retorno_pool: 'Retorno Fundo Coletivo',
    retorno_investimento: 'Retorno de Investimento',
};

// Tipos que são saídas do tipo "taxa/pagamento"
const TIPOS_TAXA = new Set(['compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'saque', 'investimento', 'pagamento_parcela', 'aporte_caixa']);
// Tipos que são entradas (positivos)
const TIPOS_ENTRADA = new Set(['deposito', 'recebimento', 'comissao_parceiro', 'resgate_caixa', 'bonus_pagador_caixa', 'retorno_pool', 'retorno_investimento']);
// Todos os tipos negativos (sem badge CONCLUIDO)
const TIPOS_NEGATIVO = new Set(['saque', 'investimento', 'compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'pagamento_parcela', 'taxa_postagem', 'aporte_caixa']);

const formatarTipo = (tipo, detalhes) => {
    if (tipo === 'desbloqueio_dados') {
        if (detalhes?.toLowerCase().includes('empr')) return 'Taxa de Solicitação';
        return 'Taxa de Verificação';
    }
    return TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';
};
const prefixoValor = (tipo) => TIPOS_ENTRADA.has(tipo) ? '+' : '-';
const corValor = (tipo) => TIPOS_TAXA.has(tipo) || tipo === 'saque' || tipo === 'investimento' || tipo === 'aporte_caixa' ? 'var(--danger)' : TIPOS_ENTRADA.has(tipo) ? 'var(--success)' : 'var(--text-main)';

// Timer regressivo para cards do marketplace
const MarketTimer = ({ expiresAt }) => {
    const tempo = useCountdown(expiresAt);
    if (!tempo || tempo === 'Expirado') return <span className="market-timer market-timer--expired">Expirado</span>;
    return <span className="market-timer">{tempo}</span>;
};


const DashboardCliente = ({ initialView = 'home' }) => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [snapshot, setSnapshot] = useState({});
    const [meusEmprestimos, setMeusEmprestimos] = useState([]);
    const [activeView, setActiveView] = useState(initialView); // 'home', 'solicitar', 'depositar', 'saque', 'score', 'loja'
    const [verSaldo, setVerSaldo] = useState(true);
    const [aceiteTermos, setAceiteTermos] = useState(false);
    const [showTermos, setShowTermos] = useState(false);
    const [copiadoPix, setCopiadoPix] = useState(false);
    const [copiadoId, setCopiadoId] = useState(false);
    const [valorPool, setValorPool] = useState('');

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
    const [qrCodeData, setQrCodeData] = useState({ 
        qr_code: '', 
        qr_code_base64: '', 
        payment_id: '',
        expires_at: null 
    });
    const [timeLeft, setTimeLeft] = useState(null);

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
    const [parcelas, setParcelas] = useState(1);
    const [senhaSaque, setSenhaSaque] = useState('');
    const [showSenhaSaque, setShowSenhaSaque] = useState(false);
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [passoDeposito, setPassoDeposito] = useState(1);
    const [passoSaque, setPassoSaque] = useState(1);
    const [passoSolicitar, setPassoSolicitar] = useState(1);
    const [passoUpgrade, setPassoUpgrade] = useState(1);
    const [tipoUpgrade, setTipoUpgrade] = useState(null);
    const [limiteInfo, setLimiteInfo] = useState({ limite_total: 0, limite_disponivel: 0, isento_taxa: false });
    const [mensagem, setMensagem] = useState(null);

    // Estados do Marketplace
    const [showPostarLink, setShowPostarLink] = useState(false);
    const [loadingPostagem, setLoadingPostagem] = useState(false);
    const [dadosNovoLink, setDadosNovoLink] = useState({ 
        nome_produto: '', 
        url_afiliado: '', 
        url_imagem: '', 
        valor: '',
        vendas_texto: '',
        codigo_2fa: ''
    });
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [boostTarget, setBoostTarget] = useState(null);
    const [meusLinks, setMeusLinks] = useState([]);
    const [meusLinksMarketplace, setMeusLinksMarketplace] = useState([]);
    const [marketplaceLinks, setMarketplaceLinks] = useState([]);
    const [marketplaceTab, setMarketplaceTab] = useState('explorar'); // 'explorar' ou 'meus'
    const [pageExplorar, setPageExplorar] = useState(1);
    const [hasMoreExplorar, setHasMoreExplorar] = useState(false);
    const [pageMeusLinks, setPageMeusLinks] = useState(1);
    const [hasMoreMeusLinks, setHasMoreMeusLinks] = useState(false);
    const [loadingMarket, setLoadingMarket] = useState(false);

    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => {
                setMensagem(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);

    // Auto-Sync PIX Polling + Timer: Fecha o QR Code sozinho quando o pagamento cai ou expira

    useEffect(() => {
        let interval;
        if (qrCodeData.payment_id && activeView === 'depositar' && passoDeposito === 2) {
            // Polling de Status
            interval = setInterval(async () => {
                try {
                    const res = await api.get(`/financeiro/meu-pix/sync/${qrCodeData.payment_id}`);
                    if (res.status === 'success') {
                        clearInterval(interval);
                        showModal({ 
                            title: 'Pagamento Confirmado! <PartyPopper size={20} style={{ display: "inline", verticalAlign: "middle" }} />', 
                            message: 'Seu depósito foi processado e o saldo já está disponível na sua conta.', 
                            type: 'success' 
                        });
                        setActiveView('home');
                        setPassoDeposito(1);
                        setQrCodeData({ qr_code: '', qr_code_base64: '', payment_id: '', expires_at: null });
                        carregarSnapshot();
                    } else if (res.status === 'expired') {
                        clearInterval(interval);
                        showModal({ 
                            title: 'PIX Expirado', 
                            message: 'O tempo para pagamento deste PIX esgotou. Por favor, gere um novo código.', 
                            type: 'error' 
                        });
                        setPassoDeposito(1);
                        setActiveView('home');
                        setQrCodeData({ qr_code: '', qr_code_base64: '', payment_id: '', expires_at: null });
                    }
                } catch (err) {
                    // Erros silenciosos
                }
            }, 5000);

            // Temporizador Regressivo
            const timerInterval = setInterval(() => {
                if (qrCodeData.expires_at) {
                    const diff = new Date(qrCodeData.expires_at).getTime() - new Date().getTime();
                    if (diff <= 0) {
                        clearInterval(timerInterval);
                        setTimeLeft(0);
                    } else {
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                        setTimeLeft(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
                    }
                }
            }, 1000);

            return () => {
                clearInterval(interval);
                clearInterval(timerInterval);
            };
        }
    }, [qrCodeData.payment_id, qrCodeData.expires_at, activeView, passoDeposito]);

    // Efeito para fechar quando o tempo acaba
    useEffect(() => {
        if (timeLeft === 0) {
            showModal({ 
                title: 'Tempo Esgotado', 
                message: 'O código PIX expirou. Gere um novo se desejar depositar.', 
                type: 'warning' 
            });
            setQrCodeData({ qr_code: '', qr_code_base64: '', payment_id: '', expires_at: null });
            setPassoDeposito(1);
            setActiveView('home');
        }
    }, [timeLeft]);

    const [kycDetails, setKycDetails] = useState('');
    const [fotoRG, setFotoRG] = useState(null);
    const [fotoRenda, setFotoRenda] = useState(null);
    const [fotoResidencia, setFotoResidencia] = useState(null);
    const [mostrarAlertaRejeicao, setMostrarAlertaRejeicaoState] = useState(
        () => localStorage.getItem('alerta_rejeicao_tomador') !== 'fechado'
    );
    const [valorAvulsoPorId, setValorAvulsoPorId] = useState({}); // { id: 'valor' }
    const [showAvulsoPorId, setShowAvulsoPorId] = useState({}); // { id: true/false }

    const fecharAlertaRejeicao = () => {
        localStorage.setItem('alerta_rejeicao_cliente', 'fechado');
        setMostrarAlertaRejeicaoState(false);
    };

    const handleSmartPaste = (texto) => {
        if (!texto) return;
        
        const novosDados = { ...dadosNovoLink };
        
        // 1. Extrair Preço (R$ 00,00)
        const priceMatch = texto.match(/R\$\s*(\d+([,.]\d+)?)/i);
        if (priceMatch) {
            novosDados.valor = priceMatch[1].replace(',', '.');
        }
        
        // 2. Extrair Vendas (ex: 8mil+ vendas)
        const salesMatch = texto.match(/(\d+[\w\+\-\.\s]*vendas)/i);
        if (salesMatch) {
            novosDados.vendas_texto = salesMatch[1].trim();
        }
        
        // 4. Extrair Nome (primeiras linhas que não sejam preço/links)
        const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        if (lines.length > 0 && !lines[0].toLowerCase().includes('http')) {
            // Se a primeira linha for muito curta ou preço, ignoramos
            if (!lines[0].match(/R\$/i) && !lines[0].match(/^\d+/) && lines[0].length > 10) {
                novosDados.nome_produto = lines[0].substring(0, 150);
            }
        }
        
        setDadosNovoLink(novosDados);
    };

    const handleDenunciar = async (link) => {
        if (!confirm(`Deseja denunciar o anúncio "${link.nome_produto}" por conteúdo impróprio ou enganoso?`)) return;
        
        try {
            await api.post('/comunidade/denunciar-link', { link_id: link.id });
            showModal({ 
                title: 'Denúncia Enviada', 
                message: 'Obrigado por sua denúncia. Nossa equipe irá analisar o conteúdo.', 
                type: 'success' 
            });
            // Remover localmente para o usuário não ver mais
            setMarketplaceLinks(prev => prev.filter(l => l.id !== link.id));
        } catch (err) {
            showModal({ 
                title: 'Erro', 
                message: err.response?.data?.detail || 'Não foi possível enviar a denúncia.', 
                type: 'danger' 
            });
        }
    };

    const handleAvaliar = async (linkId, nota) => {
        try {
            const res = await api.post('/comunidade/avaliar-link', { link_id: linkId, nota });
            // Atualizar localmente a nota e o total no feed
            setMarketplaceLinks(prev => prev.map(l => {
                if (l.id === linkId) {
                    return { ...l, nota: res.data.nova_media, total_avaliacoes: res.data.total_avaliacoes };
                }
                return l;
            }));
            // Feedback silencioso ou pequeno toast seria bom, mas opcional
        } catch (err) {
            alert(err.response?.data?.detail || 'Erro ao avaliar');
        }
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
            const data = res.data || res; // Suporte para diferentes formatos de resposta do api.js
            setSnapshot(data);
            
            if (data.perfil) {
                setUsuario(data.perfil);
                localStorage.setItem('usuario', JSON.stringify(data.perfil));
            }
            if (data.cliente_emprestimos) {
                setMeusEmprestimos(data.cliente_emprestimos || []);
            }
            // O limite agora vem calculado do backend baseado no Pool + Score
            api.get('/emprestimos/limite').then(setLimiteInfo).catch(console.error);
            
            if (data.historico) {
                setHistorico(data.historico);
            }
            
            // Carregar parceiros
            api.get('/financeiro/admin/parceiros').then(resP => setParceiros(resP || [])).catch(console.error);
        } catch (err) {
            console.error('Erro ao carregar snapshot:', err);
        }
    };

    const carregarMeusLinksMarketplace = async (reset = false) => {
        const page = reset ? 1 : pageMeusLinks;
        setLoadingMarket(true);
        try {
            const resp = await api.get(`/comunidade/meus-links?page=${page}&limit=12`);
            const novosLinks = resp.links || [];
            if (reset) {
                setMeusLinksMarketplace(novosLinks);
                setMeusLinks(novosLinks);
                setPageMeusLinks(2);
            } else {
                setMeusLinksMarketplace(prev => [...prev, ...novosLinks]);
                setMeusLinks(prev => [...prev, ...novosLinks]);
                setPageMeusLinks(prev => prev + 1);
            }
            setHasMoreMeusLinks(resp.has_more || false);
        } catch (err) {
            console.error('Erro ao carregar meus links:', err);
        } finally {
            setLoadingMarket(false);
        }
    };

    const carregarExplorar = async (reset = false) => {
        const page = reset ? 1 : pageExplorar;
        setLoadingMarket(true);
        try {
            const resp = await api.get(`/comunidade/explorar?page=${page}&limit=12`);
            const novosLinks = resp.links || [];
            if (reset) {
                setMarketplaceLinks(novosLinks);
                setPageExplorar(2);
            } else {
                setMarketplaceLinks(prev => [...prev, ...novosLinks]);
                setPageExplorar(prev => prev + 1);
            }
            setHasMoreExplorar(resp.has_more || false);
        } catch (err) {
            console.error('Erro ao carregar feed explorar:', err);
        } finally {
            setLoadingMarket(false);
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
        if (activeView === 'marketplace') {
            carregarMeusLinksMarketplace(true);
            carregarExplorar(true);
        }
    }, [activeView]);

    const handleSolicitar = async (e) => {
        e.preventDefault();
        const v = parseFloat(valor);
        if (!v || v <= 0) {
            setMensagem('Erro: O valor solicitado deve ser maior que zero.');
            return;
        }

        if (v > limiteInfo.limite_disponivel) {
            setMensagem(`Erro: Seu limite disponível é de R$ ${limiteInfo.limite_disponivel.toFixed(2)}.`);
            return;
        }

        if (!aceiteTermos) {
            showModal({ title: 'Termos de Uso', message: 'Você deve aceitar os termos de uso e as políticas da cooperativa para continuar.', type: 'warning' });
            return;
        }

        try {
            const res = await api.post('/emprestimos/solicitar', {
                valor: v,
                parcelas: parseInt(parcelas),
                aceite_termos: true
            });
            setMensagem(res.message || 'Crédito aprovado e depositado!');
            setActiveView('home');
            setValor('');
            setParcelas(1);
            setPassoSolicitar(1);
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


    const handleGerarPix = async () => {
        const v = parseFloat(valorNotificacao);
        if (!v || v <= 0) {
            showModal({ title: 'Valor Inválido', message: 'Informe um valor de depósito maior que zero.', type: 'error' });
            return;
        }
        setLoadingAction(true);
        try {
            const res = await api.post('/financeiro/pix/gerar', { valor: v });
            setQrCodeData(res);
            setPassoDeposito(2); // Avança pra tela do QR Code pix
        } catch (err) {
            showModal({ title: 'Erro', message: err.response?.data?.detail || err.message, type: 'error' });
        } finally {
            setLoadingAction(false);
        }
    };


    const handleSincronizarPix = async () => {
        setLoadingAction(true);
        try {
            const res = await api.get(`/financeiro/meu-pix/sync/${qrCodeData.payment_id}`);
            if (res.status === 'success') {
                showModal({ title: 'Sucesso', message: res.message, type: 'success' });
                setActiveView('home');
                setPassoDeposito(1);
                carregarSnapshot();
            } else {
                showModal({ title: 'Atenção', message: res.message, type: 'warning' });
            }
        } catch (err) {
            showModal({ title: 'Aguarde', message: 'Pagamento ainda não detectado. Tente novamente em 1 minuto.', type: 'info' });
        } finally {
            setLoadingAction(false);
        }
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
        setLoadingAction(true);
        try {
            await api.post('/financeiro/notificar-deposito', { 
                valor: v,
                metodo: metodoDeposito,
                parceiro_id: metodoDeposito === 'especie' ? parseInt(parceiroIdDeposito) : null
            });
            showModal({ title: 'Notificação Enviada', message: 'Seu depósito está sendo analisado.', type: 'success' });
            setValorNotificacao('');
            setParceiroIdDeposito('');
            carregarSnapshot();
            setActiveView('home');
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        } finally {
            setLoadingAction(false);
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

    const handleAportePool = async () => {
        const v = parseFloat(valorPool);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Informe um valor maior que zero.', type: 'error' });
        setLoadingAction(true);
        try {
            await api.post('/financeiro/investir-pool', { valor: v });
            showModal({ title: 'Sucesso!', message: 'Aporte realizado no Fundo Coletivo!', type: 'success' });
            setValorPool('');
            setActiveView('home');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleResgatePool = async () => {
        const v = parseFloat(valorPool);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Informe um valor maior que zero.', type: 'error' });
        setLoadingAction(true);
        try {
            await api.post('/financeiro/resgatar-pool', { valor: v });
            showModal({ title: 'Sucesso!', message: 'Resgate realizado com sucesso!', type: 'success' });
            setValorPool('');
            setActiveView('home');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const confirmarSolicitarVerificacao = async () => {
        if (!fotoRG || !fotoRenda || !fotoResidencia) return showModal({ title: 'Documentos Incompletos', message: 'Anexe os 3 documentos (RG, Renda e Residência) para prosseguir.', type: 'warning' });
        setLoadingAction(true);
        try {
            const formData = new FormData();
            formData.append('detalhes', kycDetails || '');
            formData.append('foto_rg', fotoRG);
            formData.append('foto_renda', fotoRenda);
            formData.append('foto_residencia', fotoResidencia);

            const res = await api.post('/score/solicitar-verificacao', formData, { 
                isMultipart: true 
            });
            showModal({ title: 'Solicitação Enviada', message: res.data ? res.data.message : res.message, type: 'success' });
            setKycDetails('');
            setFotoRG(null);
            setFotoRenda(null);
            setFotoResidencia(null);
            setPassoUpgrade(1);
            setTipoUpgrade(null);
            setActiveView('home');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro ao solicitar verificação: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingAction(false);
        }
    };

    const handleSolicitarVerificacao = () => {
        if (!kycDetails) return showModal({ title: 'Campo Obrigatório', message: 'Informe os detalhes do envio para prosseguir.', type: 'warning' });
        showModal({
            title: 'Solicitar Verificação',
            message: 'Deseja prosseguir com a solicitação de verificação do seu perfil? (Grátis)',
            type: 'info',
            onConfirm: async () => {
                closeModal();
                await confirmarSolicitarVerificacao();
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
            link.setAttribute('download', `contrato_psy pay_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Erro ao baixar contrato:', err);
        }
    };

    // Render logic
    return (
        <div className="cliente-dashboard">
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
                    <button onClick={() => setMensagem('')} className="alert-close"><X size={16} /></button>
                </div>
            )}

            {/* Top Grid for PC: Balance and Pending Actions */}
            <div className="grid-2">
                <div>
                    {/* Main Balance Card - Nubank Style */}
                    <div className="card card-actionable" onClick={() => setActiveView('home')} style={{ marginTop: '0.5rem' }}>
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
                                    <h2 className="text-clamp-balance">
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

                {usuario.divida_total > 0 && (
                    <div className="hide-on-mobile">
                        {/* PC-only Widget: Resumo Financeiro */}
                        <div className="card" style={{ height: '100%' }}>
                            <h3 className="mb-1" style={{ fontSize: '1rem' }}>Resumo de Dívida</h3>
                            <div className="info-block" style={{ background: 'rgba(255, 61, 0, 0.03)', border: '1px solid rgba(255, 61, 0, 0.1)' }}>
                                <div className="info-label">Saldo Devedor Total</div>
                                <div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--danger)' }}>
                                    R$ {(usuario.divida_total || 0).toLocaleString('pt-BR')}
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Lembre-se: manter seus pagamentos em dia aumenta seu Score e libera limites maiores de até 1.2x seu Pool.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
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

            {/* Action Mosaic / Grid - Home View Content */}
            {activeView === 'home' && (
                <div className="animate-fade-in">
                    {/* Alerta de Rejeição Recente */}
                    {mostrarAlertaRejeicao && historico.some(h => h.status === 'falhou') && (
                        <div className="alert alert-danger mb-1" style={{ maxWidth: '100%', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', position: 'relative' }}>
                            <button
                                onClick={fecharAlertaRejeicao}
                                style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}
                            >
                                <X size={16} />
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

                    <div className="action-grid animate-fade-in">
                        <div className="action-btn" onClick={() => setActiveView('pool')} style={{ borderColor: 'var(--primary)', background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.15) 0%, rgba(var(--primary-rgb), 0.05) 100%)', boxShadow: '0 4px 15px rgba(var(--primary-rgb), 0.1)' }}>
                            <Coins size={32} color="var(--primary)" />
                            <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.9rem' }}>Fundo Coletivo</span>
                        </div>
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
                        <div className="action-btn" onClick={() => { setActiveView('marketplace'); carregarMeusLinksMarketplace(); }}>
                            <ShoppingBag size={28} color="var(--primary)" />
                            <span>Marketplace</span>
                        </div>
                        {usuario.is_parceiro && (
                            <div className="action-btn" onClick={() => setActiveView('caixa_parceiro')} style={{ borderColor: 'var(--warning)', background: 'rgba(255, 145, 0, 0.05)' }}>
                                <Store size={28} color="var(--warning)" />
                                <span style={{ color: 'var(--warning)', fontWeight: 700 }}>Meu Caixa</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* View Switcher Content */}
            {activeView === 'solicitar' && (
                <div className="card">
                    <div className="flex-between mb-1">
                        <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Solicitar Crédito Instantâneo</h2>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {[1, 2].map(i => (
                                <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoSolicitar ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                            ))}
                        </div>
                    </div>

                    {/* PASSO 1: SIMULAÇÃO */}
                    {passoSolicitar === 1 && (
                        <div className="animate-fade-in">
                            <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0 0 5px 0' }}>Seu limite disponível agora:</p>
                                <p style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>R$ {limiteInfo.limite_disponivel.toLocaleString('pt-BR')}</p>
                            </div>
                            
                            {!usuario.is_verified && (
                                <div className="info-block mb-1" style={{ background: 'rgba(255, 145, 0, 0.08)', border: '1px solid rgba(255, 145, 0, 0.2)', padding: '10px', borderRadius: '12px' }}>
                                    <p style={{ color: 'var(--warning)', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                                        <ShieldAlert size={14} /> Conta Não Verificada
                                    </p>
                                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', marginTop: '4px', lineHeight: '1.3' }}>
                                        Seu limite está restrito ao seu saldo em garantia. Para liberar o crédito base de R$ 20,00 e bônus de Score, faça o envio de documentos no menu <strong>Upgrade</strong>.
                                    </p>
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
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '' || parseFloat(v) >= 0) setValor(v);
                                            }}
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
                                    style={{ flex: 2 }} 
                                    disabled={!valor || parseFloat(valor) <= 0 || parseFloat(valor) > limiteInfo.limite_disponivel}
                                    onClick={() => setPassoSolicitar(2)}
                                >
                                    Continuar
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setActiveView('home'); setPassoSolicitar(1); }}>Voltar</button>
                            </div>
                        </div>
                    )}

                    {/* PASSO 2: TERMOS E CONFIRMAÇÃO */}
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
                </div >
            )}
            {activeView === 'pool' && (
                <div className="card">
                    <div className="flex-between mb-1">
                        <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>Fundo Coletivo de Liquidez</h2>
                    </div>

                    <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <div className="flex-between">
                            <span className="text-muted">Seu capital no Pool:</span>
                            <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>R$ {(usuario.saldo_pool || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {usuario.rendimento_pool_pct >= 0 ? (
                            <div className="flex-between mt-1 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                    +{usuario.rendimento_pool_pct.toFixed(2)}% <span className="text-muted" style={{ fontWeight: 'normal' }}>de Rendimento</span>
                                </span>
                                <span className="text-muted text-xs">
                                    (+ R$ {(usuario.rendimento_pool_abs || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                </span>
                            </div>
                        ) : null}
                        <p style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '8px' }}>
                            Rendimentos automáticos e pro-rata aplicados em tempo real sobre os juros de crédito.
                        </p>
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
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (v === '' || parseFloat(v) >= 0) setValorPool(v);
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '1.5rem' }}>
                        <button 
                            className="btn btn-primary" 
                            disabled={!valorPool || parseFloat(valorPool) <= 0 || parseFloat(valorPool) > usuario.saldo}
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
                                            min="0"
                                            style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.2rem', fontWeight: 800 }}
                                            value={valorNotificacao}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '' || parseFloat(v) >= 0) setValorNotificacao(v);
                                            }}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: '100%' }} 
                                        onClick={() => {
                                            if (parseFloat(valorNotificacao) > 0) {
                                                if (metodoDeposito === 'pix') {
                                                    handleGerarPix();
                                                } else {
                                                    setPassoDeposito(2);
                                                }
                                            } else {
                                                showModal({ title: 'Valor Inválido', message: 'Informe um valor maior que zero.', type: 'error' });
                                            }
                                        }}
                                        disabled={loadingAction}
                                    >
                                        {loadingAction && metodoDeposito === 'pix' ? 'Gerando...' : 'Continuar'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 2: INSTRUÇÕES OU QR CODE PIX */}
                        {passoDeposito === 2 && (
                            <div className="animate-fade-in">
                                {metodoDeposito === 'pix' ? (
                                    <div className="text-center">
                                        <p className="mb-1 text-muted">Aguardando pagamento do PIX abaixo:</p>
                                        
                                        {timeLeft && (
                                            <div className="badge-notification bg-dark mb-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '8px 20px', color: 'var(--primary)', borderRadius: '25px', fontSize: '0.85rem', fontWeight: 800, border: '1px solid rgba(var(--primary-rgb), 0.2)' }}>
                                                <Clock size={16} /> Expira em: {timeLeft}
                                            </div>
                                        )}
                                        <img 
                                            src={`data:image/png;base64,${qrCodeData.qr_code_base64}`} 
                                            alt="QR Code PIX" 
                                            style={{ width: '200px', height: '200px', borderRadius: '12px', marginBottom: '1rem', border: '2px solid var(--primary)' }} 
                                        />
                                        
                                        <div className="info-block mb-1" style={{ position: 'relative' }}>
                                            <div className="info-label">Pix Copia e Cola</div>
                                            <div className="info-value" style={{ 
                                                fontSize: '0.8rem', 
                                                wordBreak: 'break-all', 
                                                background: 'rgba(255,255,255,0.05)', 
                                                padding: '10px', 
                                                borderRadius: '8px',
                                                userSelect: 'all'
                                            }}>
                                                {qrCodeData.qr_code}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(qrCodeData.qr_code);
                                                    setCopiadoPix(true);
                                                    setTimeout(() => setCopiadoPix(false), 2000);
                                                }}
                                                className="btn btn-outline"
                                                style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                            >
                                                {copiadoPix ? <Check size={18} /> : <Copy size={18} />}
                                                {copiadoPix ? 'Código Copiado!' : 'Copiar Código PIX'}
                                            </button>
                                        </div>
                                        <div className="info-block mb-1">
                                            <div className="info-label">Valor a pagar</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>R$ {parseFloat(valorNotificacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                        
                                        <button 
                                            className="btn btn-primary" 
                                            style={{ width: '100%', marginBottom: '10px' }}
                                            onClick={handleSincronizarPix}
                                            disabled={loadingAction}
                                        >
                                            {loadingAction ? 'Verificando...' : 'Já realizei o pagamento'}
                                        </button>
                                        
                                        <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
                                            Assim que você pagar, o saldo atualizará automaticamente em até 10 segundos aqui na sua tela.
                                        </p>
                                        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => {
                                            setPassoDeposito(1);
                                            setActiveView('home');
                                            carregarSnapshot();
                                        }}>
                                            Voltar ao Início
                                        </button>
                                    </div>
                                ) : (
                                    <>
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

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ flex: 2 }} 
                                                disabled={!parceiroIdDeposito}
                                                onClick={() => setPassoDeposito(3)}
                                            >
                                                Já realizei o Pagamento
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoDeposito(1)}>Voltar</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* PASSO 3: CONFIRMAÇÃO FINAL (Apenas Espécie) */}
                        {passoDeposito === 3 && metodoDeposito === 'especie' && (
                            <div className="animate-fade-in text-center" style={{ padding: '1rem 0' }}>
                                <div style={{ background: 'rgba(var(--success-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                    <CheckCircle2 size={40} color="var(--success)" />
                                </div>
                                <h3 className="mb-1">Quase lá!</h3>
                                <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>
                                    Estamos verificando seu depósito de <strong>R$ {parseFloat(valorNotificacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                                </p>
                                <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>
                                    O saldo aparecerá na sua conta assim que o pagamento for confirmado pelo Parceiro.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
                                    <button className="btn btn-primary" onClick={handleNotificarDeposito} disabled={loadingAction}>
                                        {loadingAction ? 'Processando...' : 'Confirmar e Notificar'}
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setPassoDeposito(2)} disabled={loadingAction}>Revisar Dados</button>
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
                                                <p className="text-danger mt-1" style={{ fontSize: '0.8rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                    <AlertTriangle size={14} /> Saldo insuficiente (Disponível: R$ {usuario.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
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
                                                <span style={{ fontWeight: 700, color: parseFloat(valorSaque) <= (usuario.saldo_caixa || 0) ? 'var(--success)' : 'var(--danger)' }}>
                                                    {parseFloat(valorSaque) <= (usuario.saldo_caixa || 0) ? 'R$ 0,00 (ISENTO)' : 'R$ 5,00'}
                                                </span>
                                            </div>
                                            <div className="flex-between" style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                                                <span>Valor Líquido:</span>
                                                <span>
                                                    R$ {Math.max(0, parseFloat(valorSaque) - (parseFloat(valorSaque) <= (usuario.saldo_caixa || 0) ? 0 : 5)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showSenhaSaque ? "text" : "password"}
                                                    id="senha-saque"
                                                    name="senha-saque"
                                                    autoComplete="current-password"
                                                    className="input-field"
                                                    placeholder="Sua senha de acesso"
                                                    value={senhaSaque}
                                                    onChange={(e) => setSenhaSaque(e.target.value)}
                                                    style={{ paddingRight: '45px' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSenhaSaque(!showSenhaSaque)}
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
                                                    {showSenhaSaque ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="input-group mb-1">
                                            <label htmlFor="codigo-2fa-saque">Código 2FA</label>
                                            <input
                                                id="codigo-2fa-saque"
                                                name="codigo-2fa-saque"
                                                autoComplete="one-time-code"
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
                                <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Escolha como deseja melhorar seu perfil de cooperado hoje.</p>
                                
                                    {(!usuario.is_verified || usuario.kyc_status === 'pendente') && (
                                        <div 
                                            className="card-minimal clickable" 
                                            style={{ 
                                                background: usuario.kyc_status === 'pendente' ? 'rgba(var(--primary-rgb), 0.08)' : 'rgba(var(--success-rgb), 0.08)', 
                                                padding: '1.5rem', 
                                                borderRadius: '20px', 
                                                border: usuario.kyc_status === 'pendente' ? '2px solid rgba(var(--primary-rgb), 0.2)' : '2px solid rgba(var(--success-rgb), 0.2)',
                                                transition: 'all 0.2s ease',
                                                marginBottom: '1rem',
                                                opacity: usuario.kyc_status === 'pendente' ? 0.8 : 1,
                                                cursor: usuario.kyc_status === 'pendente' ? 'default' : 'pointer'
                                            }}
                                            onClick={() => {
                                                if (usuario.kyc_status === 'pendente') return;
                                                setTipoUpgrade('verificacao');
                                                setPassoUpgrade(2);
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ background: usuario.kyc_status === 'pendente' ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(var(--success-rgb), 0.15)', padding: '12px', borderRadius: '14px' }}>
                                                    {usuario.kyc_status === 'pendente' ? <Clock size={28} color="var(--primary)" /> : <ShieldCheck size={28} color="var(--success)" />}
                                                </div>
                                                <div style={{ textAlign: 'left' }}>
                                                    <h3 style={{ fontSize: '1rem', marginBottom: '4px', color: usuario.kyc_status === 'pendente' ? 'var(--primary)' : 'var(--success)', fontWeight: 800 }}>
                                                        {usuario.kyc_status === 'pendente' ? 'Solicitação em Análise' : 'Verificação de Conta'}
                                                    </h3>
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                        {usuario.kyc_status === 'pendente' ? 'Nossa equipe está revisando seus documentos.' : 'Envie seus documentos para obter o selo e liberar crédito.'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ 
                                                    fontSize: '0.75rem', 
                                                    fontWeight: 700, 
                                                    color: usuario.kyc_status === 'pendente' ? 'var(--primary)' : 'var(--success)', 
                                                    background: usuario.kyc_status === 'pendente' ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(var(--success-rgb), 0.1)', 
                                                    padding: '4px 10px', 
                                                    borderRadius: '6px' 
                                                }}>
                                                    {usuario.kyc_status === 'pendente' ? 'Aguarde 24h' : 'GRÁTIS'}
                                                </span>
                                                <div style={{ color: usuario.kyc_status === 'pendente' ? 'var(--text-muted)' : 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                                                    {usuario.kyc_status === 'pendente' ? 'Análise em curso' : 'Começar Agora →'}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div 
                                        className="card-minimal clickable" 
                                        style={{ 
                                            background: 'rgba(var(--primary-rgb), 0.05)', 
                                            padding: '1.2rem', 
                                            borderRadius: '16px', 
                                            border: '1px solid rgba(var(--primary-rgb), 0.1)',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={() => {
                                            setTipoUpgrade('score');
                                            setPassoUpgrade(2);
                                        }}
                                    >
                                        <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                                            <Zap size={18} /> Novo Sistema de Score
                                        </h3>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
                                            Descubra como ganhar pontos e melhorar seu limite.
                                        </p>
                                        <div style={{ marginTop: '5px', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>Clique para ver as regras</div>
                                    </div>
                                </div>
                            )}

                        {/* PASSO 2: DETALHES E INSTRUÇÕES */}
                        {passoUpgrade === 2 && (
                            <div className="animate-fade-in">
                                {tipoUpgrade === 'score' ? (
                                    <div className="animate-fade-in" style={{ padding: '0.5rem' }}>
                                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                            <TrendingUp size={30} color="var(--primary)" />
                                        </div>
                                        <h3 className="mb-1 text-center" style={{ fontSize: '1.1rem' }}>Como aumentar seu Score?</h3>
                                        <p className="text-muted mb-1 text-center" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Diferente de sistemas antigos, no PSY PAY seu score reflete sua confiança real.</p>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div className="info-block" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderLeft: '4px solid var(--primary)' }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>💰 Depósitos</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ganhe +1.0 ponto a cada R$ 100,00 depositados.</div>
                                            </div>
                                            <div className="info-block" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderLeft: '4px solid var(--warning)' }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>🏦 Aporte no Pool (Caixa)</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ganhe +2.0 pontos a cada R$ 100,00 aplicados no Pool.</div>
                                            </div>
                                            <div className="info-block" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderLeft: '4px solid var(--success)' }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '4px' }}>✅ Pagamentos em Dia</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ganhe +2.0 pontos fixos por cada parcela paga rigorosamente em dia.</div>
                                            </div>
                                            <div className="info-block" style={{ background: 'rgba(255,61,0,0.05)', padding: '12px', borderLeft: '4px solid var(--danger)' }}>
                                                <div style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--danger)', marginBottom: '4px' }}>⚠️ Saques/Resgates</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>O score diminui (-2.0 pts) ao retirar liquidez da plataforma.</div>
                                            </div>
                                        </div>

                                        <div className="mt-1 p-1 text-center" style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '12px', fontSize: '0.75rem' }}>
                                            <p style={{ margin: 0 }}>O Score máximo é 1000. Recompensamos quem ajuda o ecossistema a crescer!</p>
                                        </div>

                                        <div className="mt-1" style={{ display: 'flex', gap: '10px' }}>
                                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setActiveView('home')}>Entendido</button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoUpgrade(1)}>Voltar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in">
                                        <h3 className="mb-1" style={{ fontSize: '1.1rem' }}>Sua Privacidade em 1º Lugar</h3>
                                        <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Não armazenamos fotos de documentos na nuvem de forma pública para sua segurança total (LGPD).</p>
                                        
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
                                            <div style={{ 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                gap: '10px' 
                                            }}>
                                                {/* CAMPO 1: RG */}
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: fotoRG ? '1px solid var(--success)' : '1px dashed rgba(255,255,255,0.1)' }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: fotoRG ? 'var(--success)' : 'var(--text-main)' }}>
                                                        1. Foto do RG ou CNH (Frente e Verso) {fotoRG && '✅'}
                                                    </label>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*,.pdf" 
                                                        onChange={(e) => setFotoRG(e.target.files[0])} 
                                                        style={{ fontSize: '0.75rem', width: '100%' }} 
                                                    />
                                                </div>

                                                {/* CAMPO 2: RESIDENCIA */}
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: fotoResidencia ? '1px solid var(--success)' : '1px dashed rgba(255,255,255,0.1)' }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: fotoResidencia ? 'var(--success)' : 'var(--text-main)' }}>
                                                        2. Comprovante de Residência {fotoResidencia && '✅'}
                                                    </label>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*,application/pdf" 
                                                        onChange={(e) => setFotoResidencia(e.target.files[0])} 
                                                        style={{ fontSize: '0.75rem', width: '100%' }} 
                                                    />
                                                </div>

                                                {/* CAMPO 3: RENDA */}
                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: fotoRenda ? '1px solid var(--success)' : '1px dashed rgba(255,255,255,0.1)' }}>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px', color: fotoRenda ? 'var(--success)' : 'var(--text-main)' }}>
                                                        3. Comprovante de Renda {fotoRenda && '✅'}
                                                    </label>
                                                    <input 
                                                        type="file" 
                                                        accept="image/*,application/pdf" 
                                                        onChange={(e) => setFotoRenda(e.target.files[0])} 
                                                        style={{ fontSize: '0.75rem', width: '100%' }} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="input-group mb-1">
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Mensagem Opcional ao Avaliador:</label>
                                            <textarea className="input-field" rows="2" placeholder="Ex: Mudei de endereço ontem..." value={kycDetails} onChange={(e) => setKycDetails(e.target.value)}></textarea>
                                        </div>
                                        <div className="info-block mb-1 text-center" style={{ background: 'rgba(var(--success-rgb), 0.05)', border: '1px solid rgba(var(--success-rgb), 0.1)', marginTop: '1rem' }}>
                                            <div className="info-label">Custo do Upgrade</div>
                                            <div className="info-value" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>
                                                GRÁTIS
                                            </div>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Este serviço não possui custo para cooperados.</p>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ flex: 2 }} 
                                                disabled={tipoUpgrade === 'verificacao' && (!fotoRG || !fotoRenda || !fotoResidencia)}
                                                onClick={() => setPassoUpgrade(3)}
                                            >
                                                Confirmar Solicitação
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoUpgrade(1)}>Voltar</button>
                                        </div>
                                    </div>
                                )}
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
                                        onClick={tipoUpgrade === 'score' ? () => setMensagem('O score agora cresce com o seu uso da plataforma.') : confirmarSolicitarVerificacao}
                                        disabled={loadingAction}
                                    >
                                        {loadingAction ? 'Processando...' : 'Enviar para Análise (Grátis)'}
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setPassoUpgrade(2)} disabled={loadingAction}>Revisar</button>
                                </div>
                            </div>
                        )}

                        {/* Removido botão redundante no rodapé */}
                    </div>
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
                        {/* Removido botão redundante no rodapé */}
                    </div>
                )
            }

            {/* MENU DO CAIXA DO LOJISTA */}
            {activeView === 'caixa_parceiro' && usuario?.is_parceiro && (
                <CaixaParceiro 
                    onUpdate={carregarSnapshot}
                    usuario={usuario}
                />
            )}

            {/* --- VIEW: MARKETPLACE (COMUNIDADE) --- */}
            {activeView === 'marketplace' && (
                <div className="marketplace-container animate-fade-in">
                    <div className="marketplace-header mb-1">
                        <div className="marketplace-tabs">
                            <button className={`m-tab ${marketplaceTab === 'explorar' ? 'active' : ''}`} onClick={() => setMarketplaceTab('explorar')}>Explorar</button>
                            <button className={`m-tab ${marketplaceTab === 'meus' ? 'active' : ''}`} onClick={() => setMarketplaceTab('meus')}>Meus Anúncios</button>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowPostarLink(true)} style={{ gap: '5px' }}>
                            <Plus size={16} /> Novo Anúncio
                        </button>
                    </div>

                    {marketplaceTab === 'explorar' ? (
                        marketplaceLinks.length > 0 ? (
                            <>
                                <div className="marketplace-grid">
                                    {marketplaceLinks.map(l => (
                                        <div key={l.id} className={`market-card ${l.patrocinado ? 'market-card--boosted' : 'market-card--free'}`}>
                                            <div className="market-img-wrapper">
                                                <img src={l.url_imagem} alt={l.nome_produto} loading="lazy" />
                                                {l.patrocinado ? (
                                                    <div className="market-badge market-badge--gold"><Zap size={10} /> DESTAQUE</div>
                                                ) : (
                                                    <div className="market-badge market-badge--free"><Clock size={10} /> 24H</div>
                                                )}
                                                <button 
                                                    className="market-report-btn" 
                                                    title="Denunciar" 
                                                    onClick={(e) => { 
                                                        e.preventDefault(); 
                                                        e.stopPropagation(); 
                                                        handleDenunciar(l); 
                                                    }}
                                                >
                                                    <Flag size={12} />
                                                </button>
                                                {l.valor > 0 && <div className="market-price-tag">R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
                                            </div>
                                            <div className="market-info">
                                                <h3 className="market-title">{l.nome_produto}</h3>
                                                <div className="market-meta">
                                                    <span className="market-author">por {l.anunciante}</span>
                                                    <span className="market-views"><Eye size={11} /> {l.views_totais || 0}</span>
                                                </div>
                                                <div className="market-rating-row">
                                                    <div className="market-stars">
                                                        {[1, 2, 3, 4, 5].map((s) => {
                                                            const isDono = l.usuario_id === usuario?.id;
                                                            return (
                                                                <Star 
                                                                    key={s} 
                                                                    size={10} 
                                                                    className={isDono ? "" : "star-item-mini"} 
                                                                    fill={s <= (l.nota || 0) ? "var(--warning)" : "transparent"} 
                                                                    color={s <= (l.nota || 0) ? "var(--warning)" : "var(--text-muted)"} 
                                                                    style={{ opacity: s <= (l.nota || 0) ? 1 : 0.4, cursor: isDono ? 'default' : 'pointer' }} 
                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDono) handleAvaliar(l.id, s); }} 
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <span className="market-sales-count">{l.nota ? Number(l.nota).toFixed(1) : '0.0'} ({l.total_avaliacoes || 0})</span>
                                                </div>
                                                {!l.patrocinado && l.expires_at && <div className="market-timer-row"><Timer size={11} /><MarketTimer expiresAt={l.expires_at} /></div>}
                                                <a href={l.url_afiliado} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm market-cta" onClick={() => { api.post('/comunidade/registrar-view', { link_id: l.id }).catch(() => {}); }}>Ver Produto</a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {hasMoreExplorar && (
                                    <div className="market-load-more">
                                        <button className="btn btn-secondary btn-sm" onClick={() => carregarExplorar()} disabled={loadingMarket}>
                                            {loadingMarket ? <RefreshCw className="animate-spin" size={14} /> : 'Carregar Mais Produtos'}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="market-empty">
                                <ShoppingBag size={48} />
                                <p>Nenhum produto em destaque no momento.</p>
                                <button className="btn btn-link" onClick={() => setShowPostarLink(true)}>Seja o primeiro a anunciar!</button>
                            </div>
                        )
                    ) : (
                        meusLinksMarketplace.length > 0 ? (
                            <>
                                <div className="marketplace-grid">
                                    {meusLinksMarketplace.map(l => {
                                        const expirado = l.expires_at && new Date(l.expires_at) < new Date();
                                        const semViews = (l.views_restantes || 0) <= 0;
                                        const inativo = !l.is_active || expirado || semViews;

                                        return (
                                            <div key={l.id} className={`market-card ${inativo ? 'market-card--inactive' : ''}`} style={{ borderColor: inativo ? 'rgba(255,61,0,0.2)' : 'rgba(var(--primary-rgb), 0.2)' }}>
                                                <div className="market-img-wrapper">
                                                    <img src={l.url_imagem} alt={l.nome_produto} style={{ opacity: inativo ? 0.4 : 1 }} />
                                                    {l.is_boosted ? (
                                                        <div className="market-badge market-badge--gold"><Zap size={10} /> PAGO</div>
                                                    ) : (
                                                        <div className="market-badge market-badge--free"><Clock size={10} /> GRÁTIS</div>
                                                    )}
                                                    {inativo && (
                                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 3 }}>
                                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '1px' }}>{semViews ? 'Sem Views' : 'Expirado'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="market-info">
                                                    <h4 className="market-title">{l.nome_produto}</h4>
                                                    <div className="market-rating-row" style={{ marginTop: '-4px', marginBottom: '8px', justifyContent: 'center' }}>
                                                        <div className="market-stars">
                                                            {[1, 2, 3, 4, 5].map((star) => (
                                                                <Star key={star} size={10} fill={star <= (l.nota || 0) ? "var(--warning)" : "transparent"} color={star <= (l.nota || 0) ? "var(--warning)" : "var(--text-muted)"} />
                                                            ))}
                                                        </div>
                                                        {l.vendas_texto && <span className="market-sales-count">{l.vendas_texto}</span>}
                                                    </div>
                                                    <div className="market-stats-row">
                                                        <div className="market-stat"><span className="market-stat-value">{l.views_restantes || 0}</span><span className="market-stat-label">RESTANTES</span></div>
                                                        <div className="market-stat-divider"></div>
                                                        <div className="market-stat"><span className="market-stat-value">{l.views_totais || 0}</span><span className="market-stat-label">CLIQUES</span></div>
                                                        <div className="market-stat-divider"></div>
                                                        <div className="market-stat"><span className="market-stat-value" style={{ color: expirado ? 'var(--danger)' : 'inherit' }}>{l.expires_at ? new Date(l.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span><span className="market-stat-label">EXPIRA</span></div>
                                                    </div>
                                                    {inativo && l.is_boosted ? (
                                                        <button className="btn btn-primary w-full gap-1" onClick={() => { setBoostTarget(l); setShowBoostModal(true); }} style={{ height: '36px', fontSize: '0.75rem', marginTop: 'auto' }}><Rocket size={14} /> Reativar com Views</button>
                                                    ) : !inativo ? (
                                                        <button className="btn btn-secondary w-full gap-1" onClick={() => { setBoostTarget(l); setShowBoostModal(true); }} style={{ height: '36px', fontSize: '0.75rem', marginTop: 'auto' }}><Zap size={14} /> Turbinar Alcance</button>
                                                    ) : (
                                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', fontStyle: 'italic' }}>Anúncio grátis encerrado</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {hasMoreMeusLinks && (
                                    <div className="market-load-more">
                                        <button className="btn btn-secondary btn-sm" onClick={() => carregarMeusLinksMarketplace()} disabled={loadingMarket}>
                                            {loadingMarket ? <RefreshCw className="animate-spin" size={14} /> : 'Carregar Mais Meus Links'}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="market-empty">
                                <PlusCircle size={48} />
                                <p>Você ainda não tem anúncios.</p>
                                <button className="btn btn-link" onClick={() => setShowPostarLink(true)}>Postar meu primeiro link</button>
                            </div>
                        )
                    )}
                </div>
            )}

            <ModalPremium
                isOpen={showPostarLink}
                onClose={() => { 
                    setShowPostarLink(false); 
                    setDadosNovoLink({ nome_produto: '', url_afiliado: '', url_imagem: '', valor: '', vendas_texto: '', codigo_2fa: '' }); 
                }}
                title="Novo Anúncio Grátis"
                type="info"
            >
                <div style={{ textAlign: 'left' }}>
                    <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Anuncie grátis por 24h com 50 views. Preencha os dados ou use a colagem inteligente.</p>
                    
                    <div className="input-group mb-1">
                        <label style={{ color: 'var(--primary)', fontWeight: 600 }}>✨ Colagem Inteligente (Smart Paste)</label>
                        <textarea 
                            className="smart-paste-area" 
                            placeholder="Cole aqui a descrição completa do produto para auto-preenchimento..."
                            onChange={(e) => handleSmartPaste(e.target.value)}
                        />
                    </div>

                    <div className="input-group mb-1">
                        <label>Nome do Produto</label>
                        <input className="input-field" value={dadosNovoLink.nome_produto} onChange={(e) => setDadosNovoLink({...dadosNovoLink, nome_produto: e.target.value})} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="input-group mb-1">
                            <label>Valor (R$)</label>
                            <input 
                                type="number" 
                                className="input-field" 
                                placeholder="0,00"
                                value={dadosNovoLink.valor} 
                                onChange={(e) => setDadosNovoLink({...dadosNovoLink, valor: e.target.value})} 
                            />
                        </div>
                        <div className="input-group mb-1">
                            <label>Vendas (texto)</label>
                            <input 
                                className="input-field" 
                                placeholder="Ex: 8mil+ vendas"
                                value={dadosNovoLink.vendas_texto} 
                                onChange={(e) => setDadosNovoLink({...dadosNovoLink, vendas_texto: e.target.value})} 
                            />
                        </div>
                    </div>

                    <div className="input-group mb-1">
                        <label>URL Imagem</label>
                        <input className="input-field" value={dadosNovoLink.url_imagem} onChange={(e) => setDadosNovoLink({...dadosNovoLink, url_imagem: e.target.value})} />
                    </div>

                    <div className="input-group mb-1">
                        <label>Seu Link Afiliado/WhatsApp</label>
                        <input className="input-field" value={dadosNovoLink.url_afiliado} onChange={(e) => setDadosNovoLink({...dadosNovoLink, url_afiliado: e.target.value})} />
                    </div>

                    <div className="input-group mb-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700 }}>
                            <Lock size={14} /> Código 2FA (Authenticator)
                        </label>
                        <input 
                            className="input-field" 
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="000000"
                            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '8px', fontWeight: 800 }}
                            value={dadosNovoLink.codigo_2fa || ''}
                            onChange={(e) => setDadosNovoLink({...dadosNovoLink, codigo_2fa: e.target.value.replace(/\D/g, '')})}
                        />
                    </div>

                    <button className="btn btn-primary w-full mt-1" disabled={!dadosNovoLink.codigo_2fa || dadosNovoLink.codigo_2fa.length < 6} onClick={async () => {
                        try {
                            await api.post('/comunidade/postar-link', dadosNovoLink);
                            setShowPostarLink(false);
                            setDadosNovoLink({ nome_produto: '', url_afiliado: '', url_imagem: '', valor: '', vendas_texto: '', codigo_2fa: '' });
                            carregarMeusLinksMarketplace();
                            showModal({ title: 'Sucesso!', message: 'Anúncio publicado com sucesso!', type: 'success' });
                        } catch (err) { 
                            showModal({ title: 'Erro', message: err.response?.data?.detail || 'Erro ao postar', type: 'danger' }); 
                        }
                    }}>Publicar Agora</button>
                </div>
            </ModalPremium>

            <ModalPremium
                isOpen={showBoostModal}
                onClose={() => setShowBoostModal(false)}
                title="Turbinar Produto"
                type="warning"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                        { id: 1, v: 500, p: 5 },
                        { id: 2, v: 1500, p: 12 },
                        { id: 3, v: 5000, p: 35 }
                    ].map(pkg => (
                        <div key={pkg.id} className="card-minimal flex-between clickable" onClick={async () => {
                            try {
                                await api.post('/comunidade/comprar-views', { link_id: boostTarget.id, pacote_id: pkg.id });
                                setShowBoostModal(false);
                                carregarSnapshot();
                                showModal({ title: 'Ativado!', message: pkg.v + ' views adicionadas.', type: 'success' });
                            } catch (err) { alert('Erro ao turbinar'); }
                        }}>
                            <div><p className="font-bold">{pkg.v} Views</p></div>
                            <span className="text-primary font-bold">R$ {pkg.p}</span>
                        </div>
                    ))}
                </div>
            </ModalPremium>

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
        </div>
    );
};

export default DashboardCliente;
