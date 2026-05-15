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
    PartyPopper,
    Info,
    QrCode,
    Flame,
    TrendingDown,
    User
} from 'lucide-react';
import ModalPremium from '../componentes/ModalPremium';
import TermosUso from '../componentes/TermosUso';
import BannerCookies from '../componentes/BannerCookies';
import SolicitarEmprestimo from '../componentes/SolicitarEmprestimo';
import OportunidadesLista from '../componentes/OportunidadesLista';
import TermosPlataforma from '../componentes/TermosPlataforma';
import PagamentoPolling from '../componentes/PagamentoPolling';
import HomeView from '../componentes/HomeView';
import ScoreView from '../componentes/ScoreView';
import HistoricoView from '../componentes/HistoricoView';
import ContratosView from '../componentes/ContratosView';
import MarketplaceView from '../componentes/MarketplaceView';
import NovoAnuncioPage from '../componentes/NovoAnuncioPage';

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
    recebimento: 'Recebimento',
    desbloqueio_dados: 'Verificação',
    taxa_servico: 'Taxa de Serviço',
    taxa_plataforma: 'Taxa da Plataforma',
    taxa_match: 'Taxa de Match',
    taxa_solicitacao: 'Taxa de Publicação',
    confirmacao_pagamento: 'Pagamento Pendente',
    confirmacao_recebimento: 'Recebimento Confirmado',
    pagamento_parcela: 'Pagamento',
    comissao_parceiro: 'Comissão',
    assinatura: 'Assinatura Premium',
    bonus: 'Bônus',
};

const NOMES_SECOES = {
    home: 'Início',
    oportunidades: 'Ver Pedidos',
    solicitar: 'Pedir Apoio',
    historico: 'Minhas Atividades',
    contratos: 'Meus Termos',
    score: 'Upgrade',
    marketplace: 'Marketplace',
};

const TIPOS_SAIDA = new Set(['desbloqueio_dados', 'taxa_servico', 'taxa_plataforma', 'taxa_match', 'taxa_solicitacao', 'pagamento_parcela', 'assinatura', 'confirmacao_pagamento']);
const TIPOS_ENTRADA = new Set(['deposito', 'recebimento', 'comissao_parceiro', 'bonus', 'confirmacao_recebimento']);
const TIPOS_NEGATIVO = new Set(['desbloqueio_dados', 'taxa_servico', 'taxa_plataforma', 'taxa_match', 'taxa_solicitacao', 'pagamento_parcela', 'assinatura']);

const formatarTipo = (tipo, detalhes) => {
    if (tipo === 'desbloqueio_dados') {
        if (detalhes?.toLowerCase().includes('empr')) return 'Taxa de Solicitação';
        return 'Taxa de Verificação';
    }
    return TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';
};
const prefixoValor = (tipo) => TIPOS_ENTRADA.has(tipo) ? '+' : '-';
const corValor = (tipo) => TIPOS_SAIDA.has(tipo) || tipo === 'saque' ? 'var(--danger)' : TIPOS_ENTRADA.has(tipo) ? 'var(--success)' : 'var(--text-main)';

// Timer regressivo para cards do marketplace
const MarketTimer = ({ expiresAt }) => {
    const tempo = useCountdown(expiresAt);
    if (!tempo || tempo === 'Expirado') return <span className="market-timer market-timer--expired">Expirado</span>;
    return <span className="market-timer">{tempo}</span>;
};


const DashboardCliente = ({ initialView = 'home' }) => {
    const [usuario, setUsuario] = useState(() => {
        const cached = localStorage.getItem('usuario_snapshot');
        return cached ? JSON.parse(cached) : { nome: '', saldo: 0, score: 0 };
    });
    const [snapshot, setSnapshot] = useState(() => {
        const cached = localStorage.getItem('full_snapshot');
        return cached ? JSON.parse(cached) : {};
    });
    const savedView = sessionStorage.getItem('psypay_activeView') || initialView;
    const [activeView, setActiveView] = useState(savedView);
    const [verSaldo, setVerSaldo] = useState(true);
    const [aceiteTermos, setAceiteTermos] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    
    // NOVO: Assinatura Premium
    const [showAssinarModal, setShowAssinarModal] = useState(false);
    const [loadingAssinatura, setLoadingAssinatura] = useState(false);
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
    const [qrCodeData, setQrCodeData] = useState({ 
        qr_code: '', 
        qr_code_base64: '', 
        payment_id: '',
        expires_at: null 
    });
    const [timeLeft, setTimeLeft] = useState(null);
    const [qrCodeVerificacao, setQrCodeVerificacao] = useState(null);
    const closeModal = () => setModalPremium(prev => ({ ...prev, isOpen: false }));
    const showModal = (config) => setModalPremium({ ...config, isOpen: true });

    // Modal state legado (quitar, score, kyc) - vou manter por enquanto mas adaptar para o Premium
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    // Forms state
    const [valorNotificacao, setValorNotificacao] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editTelefone, setEditTelefone] = useState('');
    const [editChavePix, setEditChavePix] = useState('');
    const [metodoDeposito, setMetodoDeposito] = useState('pix');
    const [parceiroIdDeposito, setParceiroIdDeposito] = useState('');
    const [parceiros, setParceiros] = useState([]);

    const [valorSaque, setValorSaque] = useState('');
    const [metodoSaque, setMetodoSaque] = useState('pix');
    const [parceiroIdSaque, setParceiroIdSaque] = useState('');

    const [valor, setValor] = useState('');
    const [parcelas, setParcelas] = useState(1);
    const [taxaCompensacao, setTaxaCompensacao] = useState('5');
    const [senhaSaque, setSenhaSaque] = useState('');
    const [showSenhaSaque, setShowSenhaSaque] = useState(false);

    const [loadingPDF, setLoadingPDF] = useState(false);
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [passoDeposito, setPassoDeposito] = useState(1);
    const [passoSaque, setPassoSaque] = useState(1);
    const [passoSolicitar, setPassoSolicitar] = useState(1);
    const [passoUpgrade, setPassoUpgrade] = useState(1);
    const [tipoUpgrade, setTipoUpgrade] = useState(null);
    const [mensagem, setMensagem] = useState(null);

    // Estados do Marketplace
    const [showPostarLink, setShowPostarLink] = useState(false);
    const [loadingPostagem, setLoadingPostagem] = useState(false);
    const [dadosNovoLink, setDadosNovoLink] = useState({ 
        nome_produto: '', 
        descricao: '',
        categoria: 'Geral',
        url_afiliado: '', 
        url_imagem: '', 
        valor: '', 
        vendas_texto: '', 
        codigo_2fa: '' 
    });

    const CATEGORIAS_MARKETPLACE = [
        "Geral", "Celulares", "Informatica", "Eletronicos", "Veiculos",
        "Imoveis", "Servicos", "Cursos", "Games", "Moda", "Casa", "Saude", "Alimentacao"
    ];
    const [showBoostModal, setShowBoostModal] = useState(false);
    const [boostTarget, setBoostTarget] = useState(null);
    const [pixDestaque, setPixDestaque] = useState(null);
    const [pixBoost, setPixBoost] = useState(null);
    const [pixCobranca, setPixCobranca] = useState(null);
    const [pixAssinatura, setPixAssinatura] = useState(null);
    const [meusLinks, setMeusLinks] = useState([]);
    const [meusLinksMarketplace, setMeusLinksMarketplace] = useState([]);
    const [marketplaceLinks, setMarketplaceLinks] = useState([]);
    const [meusEmprestimos, setMeusEmprestimos] = useState([]);
    const [marketplaceTab, setMarketplaceTab] = useState(sessionStorage.getItem('psypay_marketTab') || 'explorar');
    const [pageExplorar, setPageExplorar] = useState(1);
    const [hasMoreExplorar, setHasMoreExplorar] = useState(false);
    const [pageMeusLinks, setPageMeusLinks] = useState(1);
    const [hasMoreMeusLinks, setHasMoreMeusLinks] = useState(false);
    const [loadingMarket, setLoadingMarket] = useState(false);
    const [mpStatus, setMpStatus] = useState({ conectado: false, mp_user_id: null, expira_em: null });
    const [loadingMP, setLoadingMP] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('Geral');
    const [selectedCity, setSelectedCity] = useState('Todas');
    const [selectedAdDetails, setSelectedAdDetails] = useState(null);

    const isFirstLoad = !usuario.nome && !isOffline;

    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => {
                setMensagem(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);

    // Persistir activeView ao mudar
    useEffect(() => {
        if (activeView && activeView !== 'home') {
            sessionStorage.setItem('psypay_activeView', activeView);
        } else {
            sessionStorage.removeItem('psypay_activeView');
        }
        if (activeView !== 'marketplace') {
            sessionStorage.removeItem('psypay_marketTab');
        }
    }, [activeView]);

    // Persistir marketplaceTab
    useEffect(() => {
        if (activeView === 'marketplace') {
            sessionStorage.setItem('psypay_marketTab', marketplaceTab);
        }
    }, [marketplaceTab, activeView]);


    const [kycDetails, setKycDetails] = useState('');
    const [fotoRG, setFotoRG] = useState(null);
    const [fotoResidencia, setFotoResidencia] = useState(null);
    const [mostrarAlertaRejeicao, setMostrarAlertaRejeicaoState] = useState(
        () => localStorage.getItem('alerta_rejeicao_tomador') !== 'fechado'
    );
    const [showTermosAceite, setShowTermosAceite] = useState(false);
    const [termosTipo, setTermosTipo] = useState('criar');

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
        
        // 3. Extrair Link ou WhatsApp
        const linkMatch = texto.match(/https?:\/\/[^\s]+/i);
        if (linkMatch) {
            novosDados.url_afiliado = linkMatch[0];
        } else {
            // Se não achar link, procura por um padrão de telefone
            const phoneMatch = texto.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}/);
            if (phoneMatch) {
                novosDados.url_afiliado = phoneMatch[0].replace(/\D/g, '');
            }
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
                    return { ...l, nota: res.nova_media, total_avaliacoes: res.total_avaliacoes };
                }
                return l;
            }));
            // Feedback visual
            setMensagem({ tipo: 'sucesso', texto: `Avaliacao ${nota} estrela(s) registrada!` });
        } catch (err) {
            setMensagem({ tipo: 'erro', texto: err.response?.data?.detail || err.message || 'Erro ao avaliar' });
        }
    };

    const handleAssinarPlano = async (tipoPlano = 'mensal') => {
        setLoadingAssinatura(true);
        try {
            const res = await api.post('/financeiro/assinar-plano', { plano: tipoPlano });
            setShowAssinarModal(false);
            if (res.qr_code) {
                setPixAssinatura({ payment_id: res.payment_id, transacao_id: res.transacao_id, qr_code: res.qr_code, qr_code_base64: res.qr_code_base64, valor: res.preco });
            } else {
                showModal({ title: 'Aviso', message: res.message || 'Erro ao gerar PIX. Tente novamente.', type: 'warning' });
            }
        } catch (err) { 
            showModal({ title: 'Assinatura', message: err.response?.data?.detail || err.message, type: 'danger' }); 
        } finally { 
            setLoadingAssinatura(false); 
        }
    };

    const handleCopiarId = () => {
        navigator.clipboard.writeText(usuario.id);
        setCopiadoId(true);
        setTimeout(() => setCopiadoId(false), 2000);
    };

    const [historico, setHistorico] = useState(() => {
        const cached = localStorage.getItem('historico_snapshot');
        return cached ? JSON.parse(cached) : [];
    });
    const [paginaHist, setPaginaHist] = useState(1);
    const [paginaContratos, setPaginaContratos] = useState(1);
    const ITENS_POR_PAGINA = 5;

    const carregarSnapshot = async () => {
        try {
            const res = await api.get('/snapshot');
            const data = res.data || res;
            setSnapshot(data);
            localStorage.setItem('full_snapshot', JSON.stringify(data));
            
            if (data.perfil) {
                setUsuario(data.perfil);
                localStorage.setItem('usuario_snapshot', JSON.stringify(data.perfil));
                setEditEmail(data.perfil.email || '');
                setEditTelefone(data.perfil.telefone || '');
                setEditChavePix(data.perfil.chave_pix || '');
            }
            if (data.cliente_emprestimos) {
                setMeusEmprestimos(data.cliente_emprestimos || []);
                localStorage.setItem('meus_emprestimos_snapshot', JSON.stringify(data.cliente_emprestimos));
            }
            
            if (data.historico) {
                setHistorico(data.historico);
                localStorage.setItem('historico_snapshot', JSON.stringify(data.historico));
            }
            
            setIsOffline(false);
        } catch (err) {
            console.error('Erro ao carregar snapshot:', err);
            // Se falhar a conexão, marcamos como offline mas mantemos os dados do cache
            setIsOffline(true);
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
            const catParam = selectedCategory && selectedCategory !== 'Geral' ? `&categoria=${selectedCategory}` : '';
            const cityParam = selectedCity && selectedCity !== 'Todas' ? `&cidade=${encodeURIComponent(selectedCity)}` : '';
            const resp = await api.get(`/comunidade/explorar?page=${page}&limit=12${catParam}${cityParam}`);
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

    // Recarregar ao mudar categoria
    useEffect(() => {
        if (activeView === 'marketplace' && marketplaceTab === 'explorar') {
            carregarExplorar(true);
        }
    }, [selectedCategory, selectedCity, activeView]);

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
            verificarStatusMP();
        }

        // Detectar retorno do OAuth Mercado Pago
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        if (params.get('status') === 'success') {
            showModal({ title: 'Marketplace', message: 'Conta Mercado Pago conectada com sucesso!', type: 'success' });
            // Limpar a URL para não repetir o aviso
            window.location.hash = window.location.hash.split('?')[0];
            verificarStatusMP();
        } else if (params.get('status') === 'error') {
            showModal({ title: 'Erro Marketplace', message: params.get('msg') || 'Não foi possível conectar sua conta.', type: 'danger' });
            window.location.hash = window.location.hash.split('?')[0];
        }
    }, [activeView]);

    const handleSolicitar = async (e) => {
        e.preventDefault();
        const v = parseFloat(valor);
        if (!v || v <= 0) { setMensagem('Valor invalido.'); return; }
        if (!aceiteTermos) { showModal({ title: 'Termos', message: 'Aceite os termos.', type: 'warning' }); return; }
        const tx = parseFloat(taxaCompensacao);
        if (tx < 0) { setMensagem('Taxa de compensacao invalida.'); return; }
        setTermosTipo('criar');
        setShowTermosAceite(true);
    };

    const handleSolicitarAposAceite = async () => {
        setShowTermosAceite(false);
        const v = parseFloat(valor);
        const tx = parseFloat(taxaCompensacao);
        setLoadingAction(true);
        try {
            const taxaRes = await api.post('/emprestimos/gerar-taxa-solicitacao', {
                valor: v, parcelas: parseInt(parcelas),
                taxa_compensacao: tx, aceite_termos: true, aceite_termos_plataforma: true
            });
            if (taxaRes.qr_code) {
                setQrCodeData({ qr_code: taxaRes.qr_code, qr_code_base64: taxaRes.qr_code_base64, payment_id: taxaRes.payment_id, transacao_id: taxaRes.transacao_id });
                setActiveView('pagar-taxa');
            } else {
                setMensagem('Erro ao gerar PIX.');
            }
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        } finally { setLoadingAction(false); }
    };

    const handlePagarParcela = (id, valorParcela, chavePix) => {
        setPagamentoDados({ id, valor: valorParcela, chave_pix: chavePix, tipo: 'parcela' });
        setShowPagamentoModal(true);
    };

    const [showConfirmarTipo, setShowConfirmarTipo] = useState(false);
    const [confirmarTipoId, setConfirmarTipoId] = useState(null);
    const [showPagamentoModal, setShowPagamentoModal] = useState(false);
    const [pagamentoDados, setPagamentoDados] = useState({});

    const handleConfirmarPagtoRecebido = (id) => {
        setConfirmarTipoId(id);
        setShowConfirmarTipo(true);
    };

    const confirmarRecebimentoComTipo = async (tipo) => {
        setShowConfirmarTipo(false);
        try {
            const res = await api.post('/emprestimos/confirmar-recebimento/' + confirmarTipoId, { tipo });
            setMensagem(res.message);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
        setConfirmarTipoId(null);
    };

    const handleQuitarTotalP2P = (id, total, chavePix) => {
        setPagamentoDados({ id, valor: total, chave_pix: chavePix, tipo: 'quitacao' });
        setShowPagamentoModal(true);
    };

    const handlePagarAvulsoP2P = (id, chavePix) => {
        setPagamentoDados({ id, valor: 0, chave_pix: chavePix, tipo: 'avulso' });
        setShowPagamentoModal(true);
    };

    const handlePagamentoAvulso = async (id) => {
        const val = parseFloat(valorAvulsoPorId[id]);
        if (!val || val <= 0) return showModal({ title: 'Valor Inválido', message: 'Informe um valor válido para o pagamento mensal.', type: 'error' });

        try {
            const res = await api.post(`/emprestimos/confirmar-pagamento/${id}`, { valor_pagamento: val });
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
                    await api.post(`/emprestimos/confirmar-recebimento/${emprestimoId}`, { tipo: 'quitacao' });
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


    const handleDepositarVirtual = async () => {
        const v = parseFloat(valorNotificacao);
        if (!v || v <= 0) {
            showModal({ title: 'Valor Inválido', message: 'Informe um valor maior que zero.', type: 'error' });
            return;
        }
        if (v < 10) {
            showModal({ title: 'Valor Mínimo', message: 'O valor mínimo para depósito virtual é R$ 10,00.', type: 'warning' });
            return;
        }
        setLoadingAction(true);
        try {
            const res = await api.post('/financeiro/deposito-pix', { valor: v });
            if (res.qr_code) {
                setQrCodeData({ qr_code: res.qr_code, qr_code_base64: res.qr_code_base64, payment_id: res.payment_id || 'virtual' });
                setPassoDeposito(2);
            } else {
                showModal({ title: 'Pronto!', message: `Crédito de R$ ${v.toFixed(2)} liberado!`, type: 'success' });
                carregarSnapshot();
                setActiveView('home');
            }
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

    const verificarStatusMP = async () => {
        try {
            const res = await api.get('/marketplace/status');
            setMpStatus(res);
        } catch (err) {
            console.error('Erro ao verificar status MP:', err);
        }
    };

    const handleConectarMP = async () => {
        setLoadingMP(true);
        try {
            const res = await api.get('/marketplace/auth-url');
            window.location.href = res.url;
        } catch (err) {
            showModal({ title: 'Erro Marketplace', message: err.response?.data?.detail || 'Erro ao gerar URL de autorização.', type: 'danger' });
        } finally {
            setLoadingMP(false);
        }
    };

    const handleSolicitarResgate = async () => {
        try {
            const res = await api.post('/marketplace/solicitar-resgate');
            showModal({ title: 'Resgate Solicitado', message: res.message, type: 'success' });
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleDesconectarMP = async () => {
        if (!confirm('Deseja realmente desconectar sua conta do Mercado Pago?')) return;
        setLoadingMP(true);
        try {
            await api.post('/marketplace/desconectar');
            setMpStatus({ conectado: false, mp_user_id: null, expira_em: null });
            showModal({ title: 'Marketplace', message: 'Conta desconectada com sucesso.', type: 'info' });
        } catch (err) {
            showModal({ title: 'Erro', message: 'Erro ao desconectar conta.', type: 'danger' });
        } finally {
            setLoadingMP(false);
        }
    };

    const confirmarSolicitarVerificacao = async () => {
        if (!fotoRG || !fotoResidencia) return showModal({ title: 'Documentos Incompletos', message: 'Anexe a selfie e o documento (RG/CNH) para prosseguir.', type: 'warning' });
        setLoadingAction(true);
        try {
            const formData = new FormData();
            formData.append('detalhes', kycDetails || '');
            formData.append('foto_rg', fotoRG);
            formData.append('foto_residencia', fotoResidencia);

            const res = await api.post('/score/solicitar-verificacao', formData, { 
                isMultipart: true 
            });
            showModal({ title: 'Solicitação Enviada', message: res.data ? res.data.message : res.message, type: 'success' });
            setKycDetails('');
            setFotoRG(null);
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
            link.setAttribute('download', `contrato_psypay_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Erro ao baixar contrato:', err);
        }
    };

    const handleReverPix = async (transacaoId) => {
        try {
            const res = await api.get(`/financeiro/deposito/pix-detalhes/${transacaoId}`);
            setQrCodeData({
                qr_code: res.qr_code,
                qr_code_base64: res.qr_code_base64,
                payment_id: res.payment_id,
                expires_at: res.expires_at
            });
            setActiveView('depositar');
            setPassoDeposito(2);
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleCancelarPendente = async (id) => {
        if (!confirm('Cancelar esta transacao pendente?')) return;
        try {
            const res = await api.post('/emprestimos/cancelar-pendente/' + id);
            setMensagem(res.message || 'Transacao cancelada.');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleConfirmarRecebimento = async (id) => {
        if (!confirm('Deseja confirmar que recebeu o PIX deste saque corretamente na sua conta?')) return;
        setLoadingAction(true);
        try {
            await api.post(`/financeiro/confirmar-recebimento/${id}`);
            showModal({ 
                title: 'Confirmado!', 
                message: 'Obrigado por confirmar o recebimento. Isso ajuda na segurança da nossa comunidade.', 
                type: 'success' 
            });
            carregarSnapshot();
        } catch (err) {
            showModal({ 
                title: 'Erro na Confirmação', 
                message: err.message || 'Não foi possível confirmar o recebimento agora.', 
                type: 'danger' 
            });
        } finally {
            setLoadingAction(false);
        }
    };

    // Render logic
    return (
        <div className="cliente-dashboard">
            <header className="mb-1">
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Olá, {usuario.nome.split(' ')[0]}
                    {isOffline && (
                        <div className="badge bg-warning text-dark animate-pulse" style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '20px', fontWeight: 800, marginLeft: '10px' }}>
                             Offline
                        </div>
                    )}
                    {usuario.is_verified ? (
                        <ShieldCheck size={24} color="var(--success)" title="Conta Verificada" />
                    ) : (
                        <ShieldAlert size={24} color="var(--warning)" title="Conta não verificada" />
                    )}
                </h1>
                <p className="text-muted">Rede de Apoio entre Pares.</p>
            </header>

            {mensagem && (
                <div className={`alert ${typeof mensagem === 'string' && (mensagem.toLowerCase().includes('erro') || mensagem.toLowerCase().includes('não') || mensagem.toLowerCase().includes('falha')) ? 'alert-danger animate-shake' : 'alert-success'} `}>
                    <div className="alert-icon">
                        {typeof mensagem === 'string' && (mensagem.toLowerCase().includes('erro') || mensagem.toLowerCase().includes('não') || mensagem.toLowerCase().includes('falha')) ? (
                            <AlertCircle size={20} />
                        ) : (
                            <CheckCircle size={20} />
                        )}
                    </div>
                    <span>{typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem)}</span>
                    <button onClick={() => setMensagem('')} className="alert-close"><X size={16} /></button>
                </div>
            )}

            {/* Top Grid for PC: Balance and Pending Actions */}
            <div className="dashboard-grid">

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
                            onClick={() => { setActiveView('home'); setPassoSolicitar(1); setPassoUpgrade(1); }}
                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800, color: 'var(--text-main)' }}>
                            {NOMES_SECOES[activeView] || (activeView?.replace(/_/g, ' ').toUpperCase())}
                        </h2>
                    </div>
                </div>
            )}

            {/* Action Mosaic / Grid - Home View Content */}
            {activeView === 'home' && (
                <HomeView 
                    usuario={usuario}
                    historico={historico}
                    isFirstLoad={isFirstLoad}
                    isOffline={isOffline}
                    mostrarAlertaRejeicao={mostrarAlertaRejeicao}
                    fecharAlertaRejeicao={fecharAlertaRejeicao}
                    setActiveView={setActiveView}
                    carregarMeusLinksMarketplace={carregarMeusLinksMarketplace}
                />
            )}

            {/* View Switcher Content */}
            {activeView === 'solicitar' && (
                <SolicitarEmprestimo
                    passoSolicitar={passoSolicitar}
                    setPassoSolicitar={setPassoSolicitar}
                    usuario={usuario}
                    aceiteTermos={aceiteTermos}
                    setAceiteTermos={setAceiteTermos}
                    valor={valor}
                    setValor={setValor}
                    parcelas={parcelas}
                    setParcelas={setParcelas}
                    taxaCompensacao={taxaCompensacao}
                    setTaxaCompensacao={setTaxaCompensacao}
                    loadingAction={loadingAction}
                    handleSolicitar={handleSolicitar}
                />
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

            {activeView === 'pagar-taxa' && qrCodeData.qr_code && (
                <div className="card text-center">
                    <div className="flex-end mb-1">
                        <button onClick={() => { setActiveView('home'); setQrCodeData({}); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '8px' }}>
                            <ArrowLeft size={20} />
                        </button>
                    </div>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Pague a Taxa via PIX</h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 auto 1rem', maxWidth: '300px' }}>
                        Pague R$ 2,00 para publicar seu pedido. O pedido sera criado automaticamente apos a confirmacao do pagamento.
                    </p>
                    {qrCodeData.qr_code_base64 && (
                        <img src={`data:image/jpeg;base64,${qrCodeData.qr_code_base64}`} alt="QR Code PIX" style={{ width: '200px', height: '200px', borderRadius: '12px', marginBottom: '1rem' }} />
                    )}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px', marginBottom: '1rem', wordBreak: 'break-all' }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Codigo PIX:</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, flex: 1, margin: 0 }}>{qrCodeData.qr_code}</p>
                            <button onClick={() => { navigator.clipboard.writeText(qrCodeData.qr_code); setMensagem('Codigo PIX copiado!'); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }} title="Copiar codigo PIX">
                                <Copy size={16} />
                            </button>
                        </div>
                    </div>
                    <PagamentoPolling transacaoId={qrCodeData.transacao_id} onConfirmado={() => {
                        setActiveView('home');
                        setQrCodeData({});
                        setValor(''); setParcelas(1); setPassoSolicitar(1);
                        carregarSnapshot();
                        setMensagem('Pagamento confirmado! Pedido criado com sucesso.');
                    }} />
                </div>
            )}

            {activeView === 'oportunidades' && (
                <OportunidadesLista
                    usuario={usuario}
                    onUpdate={() => { carregarSnapshot(); setActiveView('home'); }}
                />
            )}
            {activeView === 'score' && (
                <ScoreView 
                    usuario={usuario}
                    passoUpgrade={passoUpgrade}
                    setPassoUpgrade={setPassoUpgrade}
                    tipoUpgrade={tipoUpgrade}
                    setTipoUpgrade={setTipoUpgrade}
                    qrCodeVerificacao={qrCodeVerificacao}
                    setQrCodeVerificacao={setQrCodeVerificacao}
                    carregarSnapshot={carregarSnapshot}
                    kycDetails={kycDetails}
                    setKycDetails={setKycDetails}
                    fotoRG={fotoRG}
                    setFotoRG={setFotoRG}
                    fotoResidencia={fotoResidencia}
                    setFotoResidencia={setFotoResidencia}
                    loadingAction={loadingAction}
                    setLoadingAction={setLoadingAction}
                    setMensagem={setMensagem}
                    historico={historico}
                    api={api}
                />
            )}


            {activeView === 'historico' && (
                <HistoricoView 
                    historico={historico}
                    isFirstLoad={isFirstLoad}
                    loadingAction={loadingAction}
                    paginaHist={paginaHist}
                    setPaginaHist={setPaginaHist}
                    handleReverPix={handleReverPix}
                    handleCancelarPendente={handleCancelarPendente}
                    handleConfirmarRecebimento={handleConfirmarRecebimento}
                />
            )}

            {activeView === 'contratos' && (
                <ContratosView 
                    meusEmprestimos={meusEmprestimos}
                    handlePagarParcela={handlePagarParcela}
                    handleQuitarTotalP2P={handleQuitarTotalP2P}
                    handlePagarAvulsoP2P={handlePagarAvulsoP2P}
                    handleConfirmarPagtoRecebido={handleConfirmarPagtoRecebido}
                    baixarContrato={baixarContrato}
                />
            )}

            {activeView === 'marketplace' && (
                <MarketplaceView
                    usuario={usuario}
                    marketplaceTab={marketplaceTab}
                    setMarketplaceTab={setMarketplaceTab}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    selectedCity={selectedCity}
                    setSelectedCity={setSelectedCity}
                    marketplaceLinks={marketplaceLinks}
                    meusLinksMarketplace={meusLinksMarketplace}
                    loadingMarket={loadingMarket}
                    hasMoreExplorar={hasMoreExplorar}
                    hasMoreMeusLinks={hasMoreMeusLinks}
                    carregarExplorar={carregarExplorar}
                    carregarMeusLinksMarketplace={carregarMeusLinksMarketplace}
                    handleDenunciar={handleDenunciar}
                    handleAvaliar={handleAvaliar}
                    setActiveView={setActiveView}
                    setSelectedAdDetails={setSelectedAdDetails}
                    setShowAssinarModal={setShowAssinarModal}
                    handleSolicitarResgate={handleSolicitarResgate}
                    setBoostTarget={setBoostTarget}
                    setShowBoostModal={setShowBoostModal}
                    setPixDestaque={setPixDestaque}
                    showModal={showModal}
                    api={api}
                    setMensagem={setMensagem}
                />
            )}
            
            {activeView === 'novo-anuncio' && (
                <NovoAnuncioPage
                    usuario={usuario}
                    api={api}
                    showModal={showModal}
                    CATEGORIAS_MARKETPLACE={CATEGORIAS_MARKETPLACE}
                    onVoltar={() => setActiveView('marketplace')}
                    onSucesso={() => {
                        carregarMeusLinksMarketplace();
                        setTimeout(() => setActiveView('marketplace'), 1500);
                    }}
                />
            )}
<ModalPremium
                isOpen={showBoostModal}
                onClose={() => setShowBoostModal(false)}
                title="Turbinar Produto"
                type="warning"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Escolha um pacote de views para turbinar seu anuncio. Pagamento via PIX.</p>
                    {[
                        { id: 1, v: 100, p: 1, desc: 'Teste o alcance por 1 real' },
                        { id: 2, v: 500, p: 5, desc: 'Alcance medio para mais pessoas' },
                        { id: 3, v: 1500, p: 12, desc: 'Alcance avancado com bom custo-beneficio' },
                        { id: 4, v: 5000, p: 35, desc: 'Alcance maximo para vender rapido' }
                    ].map(pkg => (
                        <div key={pkg.id} className="card-minimal clickable" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={async () => {
                            try {
                                const res = await api.post('/comunidade/gerar-pix-boost', { link_id: boostTarget.id, pacote_id: pkg.id });
                                if (res.payment_id && res.qr_code) {
                                    setShowBoostModal(false);
                                    setPixBoost({ payment_id: res.payment_id, transacao_id: res.transacao_id, qr_code: res.qr_code, qr_code_base64: res.qr_code_base64, valor: res.valor, views: res.views });
                                } else {
                                    showModal({ title: 'Erro', message: 'Erro ao gerar PIX.', type: 'danger' });
                                }
                            } catch (err) { showModal({ title: 'Erro', message: err.message || 'Erro ao turbinar', type: 'danger' }); }
                        }}>
                            <div>
                                <p className="font-bold" style={{ margin: '0 0 2px' }}>{pkg.v} Views</p>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>{pkg.desc}</p>
                            </div>
                            <span className="text-primary font-bold" style={{ fontSize: '1.1rem' }}>R$ {pkg.p}</span>
                        </div>
                    ))}
                </div>
            </ModalPremium>

            {pixDestaque && (
                <div className="modal-overlay" onClick={() => setPixDestaque(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '10px' }}>Destaque seu Anuncio</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Pague R$ 5,00 via PIX para destacar seu anuncio por 7 dias!</p>
                        {pixDestaque.qr_code_base64 && (
                            <img src={`data:image/png;base64,${pixDestaque.qr_code_base64}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', margin: '0 auto 1rem', borderRadius: '12px' }} />
                        )}
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, flex: 1, wordBreak: 'break-all', margin: 0 }}>{pixDestaque.qr_code}</p>
                            <button onClick={() => { navigator.clipboard.writeText(pixDestaque.qr_code); setMensagem({ tipo: 'sucesso', texto: 'Codigo PIX copiado!' }); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }} title="Copiar codigo PIX">
                                <Copy size={16} />
                            </button>
                        </div>
                        {pixDestaque.transacao_id && (
                            <PagamentoPolling transacaoId={pixDestaque.transacao_id} onConcluido={() => {
                                setPixDestaque(null);
                                carregarSnapshot();
                                showModal({ title: 'Destaque Ativado!', message: 'Seu anuncio agora aparece em destaque por 7 dias.', type: 'success' });
                            }} />
                        )}
                        <button className="btn btn-secondary mt-1" style={{ width: '100%' }} onClick={() => setPixDestaque(null)}>Fechar</button>
                    </div>
                </div>
            )}

            {pixBoost && (
                <div className="modal-overlay" onClick={() => setPixBoost(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '10px' }}>Turbinar Anuncio</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Adquira {pixBoost.views} views para seu anuncio! Pague via PIX.</p>
                        {pixBoost.qr_code_base64 && (
                            <img src={`data:image/png;base64,${pixBoost.qr_code_base64}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', margin: '0 auto 1rem', borderRadius: '12px' }} />
                        )}
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, flex: 1, wordBreak: 'break-all', margin: 0 }}>{pixBoost.qr_code}</p>
                            <button onClick={() => { navigator.clipboard.writeText(pixBoost.qr_code); setMensagem({ tipo: 'sucesso', texto: 'Codigo PIX copiado!' }); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                                <Copy size={16} />
                            </button>
                        </div>
                        {pixBoost.transacao_id && (
                            <PagamentoPolling transacaoId={pixBoost.transacao_id} onConcluido={() => {
                                setPixBoost(null);
                                carregarSnapshot();
                                showModal({ title: 'Views Adicionadas!', message: `${pixBoost.views} views adicionadas ao seu anuncio.`, type: 'success' });
                            }} />
                        )}
                        <button className="btn btn-secondary mt-1" style={{ width: '100%' }} onClick={() => setPixBoost(null)}>Fechar</button>
                    </div>
                </div>
            )}

            {pixCobranca && (
                <div className="modal-overlay" onClick={() => setPixCobranca(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '10px' }}>Cobranca do Devedor</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Pague R$ 2,00 via PIX para enviar cobranca a {pixCobranca.tomador_nome} (debito: R$ {pixCobranca.debito?.toFixed(2)}).</p>
                        {pixCobranca.qr_code_base64 && (
                            <img src={`data:image/png;base64,${pixCobranca.qr_code_base64}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', margin: '0 auto 1rem', borderRadius: '12px' }} />
                        )}
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, flex: 1, wordBreak: 'break-all', margin: 0 }}>{pixCobranca.qr_code}</p>
                            <button onClick={() => { navigator.clipboard.writeText(pixCobranca.qr_code); setMensagem({ tipo: 'sucesso', texto: 'Codigo PIX copiado!' }); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                                <Copy size={16} />
                            </button>
                        </div>
                        {pixCobranca.transacao_id && (
                            <PagamentoPolling transacaoId={pixCobranca.transacao_id} onConcluido={() => {
                                setPixCobranca(null);
                                carregarSnapshot();
                                showModal({ title: 'Cobranca Enviada!', message: `Email e WhatsApp enviados para ${pixCobranca.tomador_nome}.`, type: 'success' });
                                if (pixCobranca.tomador_telefone) {
                                    const num = pixCobranca.tomador_telefone.replace(/\D/g, '');
                                    const tel = num.startsWith('55') ? num : '55' + num;
                                    const msg = encodeURIComponent(`Ola ${pixCobranca.tomador_nome.split(' ')[0]}, voce tem um debito de R$ ${pixCobranca.debito?.toFixed(2)}. Entre em contato para regularizar. - Psy Pay`);
                                    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
                                }
                            }} />
                        )}
                        <button className="btn btn-secondary mt-1" style={{ width: '100%' }} onClick={() => setPixCobranca(null)}>Fechar</button>
                    </div>
                </div>
            )}

            {pixAssinatura && (
                <div className="modal-overlay" onClick={() => setPixAssinatura(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '10px' }}>Pagamento Assinatura Premium</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Pague R$ {pixAssinatura.valor?.toFixed(2) || '19,99'} via PIX para ativar seu plano!</p>
                        {pixAssinatura.qr_code_base64 && (
                            <img src={`data:image/png;base64,${pixAssinatura.qr_code_base64}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', margin: '0 auto 1rem', borderRadius: '12px' }} />
                        )}
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 700, flex: 1, wordBreak: 'break-all', margin: 0 }}>{pixAssinatura.qr_code}</p>
                            <button onClick={() => { navigator.clipboard.writeText(pixAssinatura.qr_code); setMensagem({ tipo: 'sucesso', texto: 'Codigo PIX copiado!' }); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px', flexShrink: 0 }} title="Copiar codigo PIX">
                                <Copy size={16} />
                            </button>
                        </div>
                        {pixAssinatura.transacao_id && (
                            <PagamentoPolling transacaoId={pixAssinatura.transacao_id} onConcluido={() => {
                                setPixAssinatura(null);
                                carregarSnapshot();
                                showModal({ title: 'Premium Ativo!', message: 'Agora voce e um membro Premium. Aproveite os beneficios!', type: 'success' });
                            }} />
                        )}
                        <button className="btn btn-secondary mt-1" style={{ width: '100%' }} onClick={() => setPixAssinatura(null)}>Fechar</button>
                    </div>
                </div>
            )}

            {showPagamentoModal && (
                <div className="modal-overlay" onClick={() => setShowPagamentoModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '10px' }}>
                            {pagamentoDados.tipo === 'avulso' ? 'Pagar Outro Valor' : pagamentoDados.tipo === 'quitacao' ? 'Quitar Total' : 'Pagar Parcela'}
                        </h3>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Chave PIX do Credor:</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ fontSize: '0.9rem', wordBreak: 'break-all', flex: 1 }}>{pagamentoDados.chave_pix || '---'}</strong>
                                <button onClick={() => { navigator.clipboard.writeText(pagamentoDados.chave_pix || ''); setMensagem({ tipo: 'sucesso', texto: 'Chave PIX copiada!' }); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                                    <Copy size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="input-group mb-1">
                            <label>Valor a pagar (R$)</label>
                            <input type="number" className="input-field" step="0.01" min="0.01"
                                value={pagamentoDados.tipo === 'avulso' ? (pagamentoDados.avulsoValor || '') : (pagamentoDados.valor || 0)}
                                onChange={(e) => {
                                    if (pagamentoDados.tipo === 'avulso') {
                                        setPagamentoDados(prev => ({ ...prev, avulsoValor: e.target.value }));
                                    }
                                }}
                                disabled={pagamentoDados.tipo !== 'avulso'}
                                placeholder="0,00"
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => {
                                const valorPagar = pagamentoDados.tipo === 'avulso' ? parseFloat(pagamentoDados.avulsoValor) : pagamentoDados.valor;
                                if (!valorPagar || valorPagar <= 0) { setMensagem({ tipo: 'erro', texto: 'Valor invalido.' }); return; }
                                try {
                                    await api.post('/emprestimos/confirmar-pagamento/' + pagamentoDados.id, { valor_pagamento: valorPagar });
                                    setShowPagamentoModal(false);
                                    showModal({ title: 'Pagamento Registrado', message: 'Aguardando confirmacao do recebedor.', type: 'success' });
                                    carregarSnapshot();
                                } catch (err) { setMensagem({ tipo: 'erro', texto: err.message }); }
                            }}>
                                <CheckCircle size={16} /> Ja Enviei o PIX
                            </button>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowPagamentoModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {showTermosAceite && (
                <div className="modal-overlay" onClick={() => setShowTermosAceite(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <TermosPlataforma
                            tipo={termosTipo}
                            onAceitar={termosTipo === 'criar' ? handleSolicitarAposAceite : () => {}}
                            onVoltar={() => setShowTermosAceite(false)}
                        />
                    </div>
                </div>
            )}

            {showConfirmarTipo && (
                <div className="modal-overlay" onClick={() => setShowConfirmarTipo(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <h3 style={{ textAlign: 'center', marginBottom: '15px' }}>Confirmar Recebimento</h3>
                        <p style={{ textAlign: 'center', fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-muted)' }}>
                            O que o tomador pagou?
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={() => confirmarRecebimentoComTipo('parcela')}>Parcela completa</button>
                            <button className="btn btn-outline" onClick={() => confirmarRecebimentoComTipo('avulso')}>Pagamento parcial</button>
                            <button className="btn btn-outline" onClick={() => confirmarRecebimentoComTipo('quitacao')}>Quitacao total</button>
                            <button className="btn btn-secondary" onClick={() => setShowConfirmarTipo(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Modal de Detalhes do Anúncio (OLX Style) */}
            <ModalPremium
                isOpen={!!selectedAdDetails}
                onClose={() => setSelectedAdDetails(null)}
                title={selectedAdDetails?.nome_produto || "Detalhes do Anúncio"}
                type="info"
            >
                {selectedAdDetails && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '70vh' }}>
                        <img 
                            src={selectedAdDetails.url_imagem} 
                            style={{ width: '100%', borderRadius: '12px', maxHeight: '200px', objectFit: 'cover', flexShrink: 0 }} 
                            alt="Produto"
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <span className="badge badge--primary">{selectedAdDetails.categoria}</span>
                            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>
                                R$ {selectedAdDetails.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <User size={18} color="var(--primary)" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {selectedAdDetails.anunciante}
                                        {selectedAdDetails.anunciante_verificado && <ShieldCheck size={14} color="#00CFFF" title="Vendedor Verificado" />}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                        Membro desde {selectedAdDetails.anunciante_desde}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--success)' }}>
                                        {selectedAdDetails.anunciante_vendas} VENDAS
                                    </div>
                                    <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Concluídas</div>
                                </div>
                            </div>
                        </div>

                        {/* Dica de Segurança */}
                        <div style={{ background: 'rgba(255,214,0,0.05)', padding: '10px', borderRadius: '10px', border: '1px dotted rgba(255,214,0,0.3)' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <AlertTriangle size={16} color="#FFD600" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                                    <strong>DICA DE SEGURANÇA:</strong> Nunca realize pagamentos fora do Psy Pay. Prefira negociar a entrega em locais públicos.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição</h4>
                            <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {selectedAdDetails.descricao || "Nenhuma descrição fornecida para este anúncio."}
                            </p>
                        </div>
                        <button 
                            className="btn btn-primary w-full" 
                            style={{ height: '48px', fontSize: '1rem', flexShrink: 0 }}
                            onClick={() => {
                                const link = selectedAdDetails.url_afiliado || '';
                                const isPhone = /^\d+$/.test(link.replace(/\D/g, ''));
                                if (isPhone) {
                                    const num = link.replace(/\D/g, '');
                                    window.open(`https://wa.me/${num}`, '_blank');
                                } else {
                                    window.open(link, '_blank');
                                }
                            }}
                        >
                            💬 Falar com Vendedor
                        </button>
                    </div>
                )}
            </ModalPremium>
            <ModalPremium
                isOpen={showAssinarModal}
                onClose={() => setShowAssinarModal(false)}
                title={<span style={{display: 'flex', alignItems: 'center', gap: '8px'}}><Flame size={20} className="text-danger" /> Upgrade Premium Marketplace</span>}
                type="info"
            >
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                        Desbloqueie vantagens exclusivas e turbine seus resultados na plataforma!
                    </p>

                    {/* BENEFÍCIOS PRIMEIRO */}
                    <div style={{ textAlign: 'left', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>O que você ganha:</p>
                        <ul style={{ margin: 0, paddingLeft: '0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '2', listStyle: 'none' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Coins size={16} style={{ color: 'var(--success)', flexShrink: 0 }} /> <span><strong style={{ color: 'var(--text-main)' }}>Pontos Turbo</strong> — Ganhe de <strong>1 a 5 pontos aleatórios</strong> por clique (vs 1 fixo do plano grátis).</span></li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><TrendingDown size={16} style={{ color: 'var(--success)', flexShrink: 0 }} /> <span><strong style={{ color: 'var(--text-main)' }}>Destaque nos Anúncios</strong> — Seus links aparecem primeiro no Marketplace.</span></li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Gem size={16} style={{ color: '#FFD600', flexShrink: 0 }} /> <span><strong style={{ color: 'var(--text-main)' }}>Selo VIP</strong> — Badge dourado exclusivo no seu perfil.</span></li>
                        </ul>
                    </div>

                    {/* ESCOLHA DE PLANO */}
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Escolha seu plano:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* PLANO MENSAL */}
                        <div 
                            className="card-minimal clickable" 
                            style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '16px 20px', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'border-color 0.2s'
                            }}
                            onClick={() => handleAssinarPlano('mensal')}
                        >
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Plano Mensal</div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Cobrado uma vez, válido por 30 dias</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--primary)' }}>R$ 19,99</div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>por mês</div>
                            </div>
                        </div>

                        {/* PLANO ANUAL */}
                        <div 
                            className="card-minimal clickable" 
                            style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '16px 20px', 
                                border: '2px solid var(--warning)',
                                background: 'rgba(255,214,0,0.05)',
                                borderRadius: '12px',
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'pointer'
                            }}
                            onClick={() => handleAssinarPlano('anual')}
                        >
                            <div style={{ 
                                position: 'absolute', top: 0, right: 0,
                                background: 'var(--warning)', color: '#000',
                                fontSize: '0.55rem', fontWeight: 900,
                                padding: '3px 12px', borderBottomLeftRadius: '8px'
                            }}>
                                ECONOMIZE 16%
                            </div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--warning)' }}>Plano Anual <Gem size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></div>
                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Acesso completo por 1 ano inteiro + bônus de Score</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--warning)' }}>R$ 199,99</div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>~R$ 16,66/mês</div>
                            </div>
                        </div>
                    </div>

                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '14px', opacity: 0.7 }}>
                        Pagamento via PIX (Mercado Pago). Após o pagamento, a assinatura é ativada automaticamente.
                    </p>

                    {loadingAssinatura && <div className="mt-1" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>Processando assinatura...</div>}
                </div>
            </ModalPremium>
            <BannerCookies usuario={usuario} onUpdate={carregarSnapshot} />

            {/* MODAL PARA SELEÇÃO DE ANO DO RELATÓRIO PDF */}
        </div>
    );
};

export default DashboardCliente;
