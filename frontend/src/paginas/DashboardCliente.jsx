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
    FileDown,
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
import RankingSemanal from '../componentes/RankingSemanal';

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
    const [meusEmprestimos, setMeusEmprestimos] = useState(() => {
        const cached = localStorage.getItem('meus_emprestimos_snapshot');
        return cached ? JSON.parse(cached) : [];
    });
    const [activeView, setActiveView] = useState(initialView); 
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

    // Relatório PDF (Receita Federal)
    const [showModalRelatorio, setShowModalRelatorio] = useState(false);
    const [anoRelatorio, setAnoRelatorio] = useState(new Date().getFullYear());
    const [loadingPDF, setLoadingPDF] = useState(false);

    const handleDownloadPDF = async () => {
        try {
            setLoadingPDF(true);
            const res = await api.getBlob(`/financeiro/relatorio/pdf?ano=${anoRelatorio}`);
            
            // Tratamento de blob para download direto
            const blob = res.data || res;
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `INFORME_PSY_PAY_${usuario.nome.replace(/\s+/g, '_')}_${anoRelatorio}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            setMensagem('Informe gerado com sucesso!');
            setShowModalRelatorio(false);
        } catch (err) {
            console.error('Erro ao baixar PDF:', err);
            setMensagem('Erro ao gerar relatório. Tente novamente.');
        } finally {
            setLoadingPDF(false);
        }
    };
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
        "Geral", "Celulares", "Informática", "Eletrônicos", "Veículos", 
        "Imóveis", "Serviços", "Empréstimos P2P", "Cursos", "Games"
    ];
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
    const [mpStatus, setMpStatus] = useState({ conectado: false, mp_user_id: null, expira_em: null });
    const [loadingMP, setLoadingMP] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('Geral');
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
                    return { ...l, nota: res.data.nova_media, total_avaliacoes: res.data.total_avaliacoes };
                }
                return l;
            }));
            // Feedback silencioso ou pequeno toast seria bom, mas opcional
        } catch (err) {
            showModal({ title: 'Erro na Avaliação', message: err.response?.data?.detail || 'Erro ao avaliar', type: 'danger' });
        }
    };

    const handleAssinarPlano = async (tipoPlano = 'mensal') => {
        setLoadingAssinatura(true);
        try {
            const res = await api.post('/financeiro/assinar-plano', { plano: tipoPlano });
            carregarSnapshot();
            setShowAssinarModal(false);
            showModal({ 
                title: 'Parabéns!', 
                message: res.message || 'Agora você é um membro Premium Psy Pay!', 
                type: 'success' 
            });
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
            const resp = await api.get(`/comunidade/explorar?page=${page}&limit=12${catParam}`);
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
    }, [selectedCategory, activeView]);

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

    const handlePagarParcela = async (id, valorParcela, chavePix) => {
        const msg = `Envie R$ ${valorParcela.toFixed(2)} via PIX para:\n\n${chavePix || '---'}\n\nDepois de enviar, confirme aqui.`;
        showModal({
            title: 'Pagar Parcela',
            message: msg,
            type: 'info',
            onConfirm: async () => {
                try {
                    const res = await api.post('/emprestimos/confirmar-pagamento/' + id, { valor_pagamento: valorParcela });
                    showModal({ title: 'Pagamento Registrado', message: 'Aguardando confirmacao do recebedor.', type: 'success' });
                    carregarSnapshot();
                } catch (err) {
                    setMensagem('Erro: ' + err.message);
                }
            },
            confirmText: 'Ja Enviei o PIX'
        });
    };

    const [showConfirmarTipo, setShowConfirmarTipo] = useState(false);
    const [confirmarTipoId, setConfirmarTipoId] = useState(null);

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

    const handleQuitarTotalP2P = async (id, total, chavePix) => {
        const msg = 'Envie R$ ' + total.toFixed(2) + ' via PIX para:\n\n' + (chavePix || '---') + '\n\nDepois de enviar, confirme aqui.';
        showModal({
            title: 'Quitar Total',
            message: msg,
            type: 'info',
            onConfirm: async () => {
                try {
                    const res = await api.post('/emprestimos/confirmar-pagamento/' + id, { valor_pagamento: total });
                    showModal({ title: 'Pagamento Registrado', message: 'Aguardando confirmacao do recebedor.', type: 'success' });
                    carregarSnapshot();
                } catch (err) {
                    setMensagem('Erro: ' + err.message);
                }
            },
            confirmText: 'Ja Enviei o PIX'
        });
    };

    const handlePagarAvulsoP2P = async (id, chavePix) => {
        const valor = prompt('Digite o valor que deseja pagar:');
        if (!valor) return;
        const v = parseFloat(valor);
        if (!v || v <= 0) { setMensagem('Valor invalido.'); return; }
        const msg = 'Envie R$ ' + v.toFixed(2) + ' via PIX para:\n\n' + (chavePix || '---') + '\n\nDepois de enviar, confirme aqui.';
        showModal({
            title: 'Pagar R$ ' + v.toFixed(2),
            message: msg,
            type: 'info',
            onConfirm: async () => {
                try {
                    const res = await api.post('/emprestimos/confirmar-pagamento/' + id, { valor_pagamento: v });
                    showModal({ title: 'Pagamento Registrado', message: 'Aguardando confirmacao do recebedor.', type: 'success' });
                    carregarSnapshot();
                } catch (err) {
                    setMensagem('Erro: ' + err.message);
                }
            },
            confirmText: 'Ja Enviei o PIX'
        });
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
            const res = await api.post('/emprestimos/depositar-virtual', { valor_pagamento: v });
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

    const handleCancelarPendente = async () => {
        if (!confirm('Cancelar esta transação pendente?')) return;
        try {
            const res = await api.post('/emprestimos/cancelar-pendente');
            setMensagem(res.message || 'Transação cancelada.');
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
                        <div className="action-btn" onClick={() => setActiveView('oportunidades')} style={{ borderColor: 'var(--success)', background: 'linear-gradient(135deg, rgba(var(--success-rgb), 0.15) 0%, rgba(var(--success-rgb), 0.05) 100%)' }}>
                            <HandCoins size={32} color="var(--success)" />
                            <span style={{ color: 'var(--success)', fontWeight: 800, fontSize: '0.9rem' }}>Ver Pedidos</span>
                        </div>
                        <div className="action-btn" onClick={() => setActiveView('solicitar')}>
                            <PlusCircle size={28} color="var(--primary)" />
                            <span>Solicitar</span>
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
                    </div>
                    
                    <h3 className="section-title">Últimas Atividades</h3>
                    <div className="activity-list">
                        {isFirstLoad ? (
                            [1,2,3].map(i => <div key={i} className="skeleton-loading skeleton-card"></div>)
                        ) : historico.length === 0 ? (
                            <div className="empty-state">
                                <Clock size={32} />
                                <p>Nenhuma atividade recente.</p>
                            </div>
                        ) : (
                            historico.slice(0, 5).map((h, i) => (
                                <div key={h.id} className="activity-item">
                                    <div className="activity-icon">
                                        {TIPOS_ENTRADA.has(h.tipo) ? <ArrowUpCircle size={20} color="var(--success)" /> : <ArrowDownCircle size={20} color="var(--danger)" />}
                                    </div>
                                    <div className="activity-info">
                                        <span className="activity-title">{formatarTipo(h.tipo, h.detalhes)}</span>
                                        <span className="activity-date">{new Date(h.data).toLocaleDateString()}</span>
                                    </div>
                                    <span className="activity-value" style={{ color: corValor(h.tipo) }}>
                                        {prefixoValor(h.tipo)} R$ {h.valor.toLocaleString('pt-BR')}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
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
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Código PIX:</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{qrCodeData.qr_code}</p>
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
            {
                activeView === 'score' && (
                    <div className="card">
                        <div className="flex-end mb-1">
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoUpgrade ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                                ))}
                            </div>
                        </div>

                        {/* PASSO 1: SELEÇÃO DO UPGRADE */}
                        {passoUpgrade === 1 && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Escolha como deseja melhorar seu perfil hoje.</p>
                                
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
                                                    {usuario.kyc_status === 'pendente' ? 'Aguarde 24h' : 'R$ 14,99'}
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

                            {/* MEUS DADOS / EDITAR PERFIL */}
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(0,0,0,0.15)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <h4 style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>MEUS DADOS</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email</label>
                                            <input type="email" className="input" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder={usuario.email || 'Seu email'} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Telefone</label>
                                            <input type="tel" className="input" value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} placeholder={usuario.telefone || '(DDD) 9xxxx-xxxx'} />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Chave PIX</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <input type="text" className="input" style={{ flex: 1 }} value={editChavePix} onChange={(e) => setEditChavePix(e.target.value)} placeholder={usuario.chave_pix || 'Sua chave PIX'} />
                                            <button className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={async () => {
                                                const campos = {};
                                                if (editEmail !== usuario.email && editEmail.trim()) campos.email = editEmail.trim();
                                                if (editTelefone !== usuario.telefone && editTelefone.trim()) campos.telefone = editTelefone.trim();
                                                if (editChavePix !== usuario.chave_pix && editChavePix.trim()) campos.chave_pix = editChavePix.trim();
                                                if (Object.keys(campos).length === 0) { setMensagem({ tipo: 'info', texto: 'Nenhum campo alterado.' }); return; }
                                                try {
                                                    const res = await api.put('/auth/perfil', campos);
                                                    setMensagem({ tipo: 'sucesso', texto: res.message });
                                                    carregarSnapshot();
                                                } catch (e) {
                                                    setMensagem({ tipo: 'erro', texto: e?.response?.data?.detail || 'Erro ao salvar.' });
                                                }
                                            }}>Salvar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        {/* PASSO 2: DETALHES E INSTRUÇÕES */}
                        {passoUpgrade === 2 && (
                            <div className="animate-fade-in">
                                {tipoUpgrade === 'score' ? (
                                    <div className="animate-fade-in" style={{ padding: '0.5rem' }}>
                                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                            <TrendingUp size={30} color="var(--primary)" />
                                        </div>
                                        <h3 className="mb-1 text-center" style={{ fontSize: '1.1rem' }}>Como funciona o Score?</h3>
                                        <p className="text-muted mb-1 text-center" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Seu score reflete sua confianca na plataforma.</p>
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div className="info-block" style={{ background: 'rgba(var(--success-rgb), 0.05)', padding: '12px', borderLeft: '4px solid var(--success)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div style={{ background: 'rgba(var(--success-rgb), 0.1)', padding: '8px', borderRadius: '8px' }}>
                                                    <CheckCircle2 size={20} color="var(--success)" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px' }}>Pagamento em Dia</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+5 pontos por parcela paga dentro do prazo.</div>
                                                </div>
                                            </div>
                                            <div className="info-block" style={{ background: 'rgba(255,61,0,0.05)', padding: '12px', borderLeft: '4px solid var(--danger)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div style={{ background: 'rgba(255, 61, 0, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                                    <ArrowDownCircle size={20} color="var(--danger)" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px', color: 'var(--danger)' }}>Pagamento Atrasado</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-10 pontos por parcela paga apos o vencimento.</div>
                                                </div>
                                            </div>
                                            <div className="info-block" style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '12px', borderLeft: '4px solid var(--primary)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '8px', borderRadius: '8px' }}>
                                                    <ShieldCheck size={20} color="var(--primary)" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px' }}>Verificacao KYC</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+10 pontos ao ter a conta verificada.</div>
                                                </div>
                                            </div>
                                            <div className="info-block" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderLeft: '4px solid var(--danger)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div style={{ background: 'rgba(255, 61, 0, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                                    <ShieldAlert size={20} color="var(--danger)" />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px', color: 'var(--danger)' }}>Calote</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zera o score e marca como inadimplente.</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-1 p-1 text-center" style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '12px', fontSize: '0.75rem' }}>
                                            <p style={{ margin: 0 }}>Score maximo: 1000. Quanto maior seu score, mais credibilidade.</p>
                                        </div>

                                        <div className="mt-1">
                                            <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setPassoUpgrade(1)}>Voltar</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in">
                                        {usuario.is_verified ? (
                                            <div className="text-center">
                                                <div style={{ background: 'rgba(var(--success-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                                    <ShieldCheck size={36} color="var(--success)" />
                                                </div>
                                                <h3 style={{ color: 'var(--success)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Conta Verificada</h3>
                                                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Seu perfil ja possui o selo de verificacao. Obrigado pela confianca!</p>
                                                {!usuario.is_subscriber && (
                                                    <button className="btn btn-primary mt-1" onClick={() => { setTipoUpgrade('score'); setPassoUpgrade(2); }}>
                                                        Ver Regras do Score
                                                    </button>
                                                )}
                                            </div>
                                        ) : qrCodeVerificacao ? (
                                            <div className="text-center">
                                                <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Pague R$ 14,99 via PIX para verificar sua conta</p>
                                                {qrCodeVerificacao.qr_code_base64 && (
                                                    <img src={`data:image/png;base64,${qrCodeVerificacao.qr_code_base64}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', margin: '0 auto 1rem', borderRadius: '12px' }} />
                                                )}
                                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', marginBottom: '0.5rem' }}>
                                                    <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>{qrCodeVerificacao.qr_code}</p>
                                                </div>
                                                {qrCodeVerificacao.transacao_id && (
                                                    <PagamentoPolling transacaoId={qrCodeVerificacao.transacao_id} onConcluido={() => {
                                                        carregarSnapshot();
                                                        setPassoUpgrade(1);
                                                        setQrCodeVerificacao(null);
                                                    }} />
                                                )}
                                                <button className="btn btn-secondary mt-1" style={{ width: '100%' }} onClick={() => { setQrCodeVerificacao(null); setPassoUpgrade(1); }}>Voltar</button>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ display: 'flex', gap: '15px', marginBottom: '1rem' }}>
                                                    <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '14px' }}>
                                                        <ShieldCheck size={28} color="var(--primary)" />
                                                    </div>
                                                    <div>
                                                        <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Verificacao de Conta</h3>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pague R$ 14,99 e tenha sua conta verificada instantaneamente. Ganhe +10 pontos no score!</p>
                                                    </div>
                                                </div>
                                                <div className="info-block mb-1 text-center" style={{ background: 'rgba(var(--success-rgb), 0.05)', border: '1px solid rgba(var(--success-rgb), 0.1)' }}>
                                                    <div className="info-label">Valor</div>
                                                    <div className="info-value" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>R$ 14,99</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={async () => {
                                                        try {
                                                            setLoading(true);
                                                            const res = await api.post('/score/gerar-taxa-verificacao');
                                                            if (res.payment_id && res.qr_code) {
                                                                setQrCodeVerificacao({ payment_id: res.payment_id, qr_code: res.qr_code, qr_code_base64: res.qr_code_base64, transacao_id: res.transacao_id, valor: res.valor });
                                                            } else {
                                                                setMensagem({ tipo: 'erro', texto: typeof res.detail === 'string' ? res.detail : 'Erro ao gerar PIX.' });
                                                            }
                                                        } catch (e) {
                                                            const msg = e?.response?.data?.detail || 'Erro ao gerar PIX. Tente novamente.';
                                                            setMensagem({ tipo: 'erro', texto: msg });
                                                        } finally { setLoading(false); }
                                                    }} disabled={loading}>
                                                        {loading ? <span className="spinner" /> : 'Pagar R$ 14,99 via PIX'}
                                                    </button>
                                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoUpgrade(1)}>Voltar</button>
                                                </div>
                                            </div>
                                        )}
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
                    <div className="card animate-fade-in">
                        <div className="flex-end mb-1">
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    className="btn btn-outline btn-sm" 
                                    style={{ gap: '6px', fontSize: '0.75rem', padding: '8px 12px', border: 'none', background: 'rgba(255,255,255,0.05)' }}
                                    onClick={() => setShowModalRelatorio(true)}
                                >
                                    <FileDown size={14} /> Informe IRPF
                                </button>
                                <History size={18} color="var(--text-muted)" />
                            </div>
                        </div>
                        {isFirstLoad ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[1,2,3,4,5].map(i => <div key={i} className="skeleton-loading skeleton-card"></div>)}
                            </div>
                        ) : historico.length === 0 ? (
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

                                            {/* BOTÃO PARA REVER PIX (Depósitos Pendentes) */}
                                            {h.tipo === 'deposito' && h.metodo === 'pix' && h.status === 'pendente' && (
                                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <button 
                                                        className="btn btn-outline" 
                                                        style={{ width: '100%', fontSize: '0.75rem', padding: '8px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                                        onClick={() => handleReverPix(h.id)}
                                                        disabled={loadingAction}
                                                    >
                                                        <QrCode size={14} /> Pagar Agora
                                                    </button>
                                                </div>
                                            )}

                                            {/* BOTÃO CANCELAR (Depósitos Virtuais e Taxas Pendentes) */}
                                            {h.status === 'pendente' && (h.tipo === 'taxa_deposito_virtual' || h.tipo === 'taxa_solicitacao') && (
                                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <button 
                                                        className="btn btn-outline" 
                                                        style={{ width: '100%', fontSize: '0.75rem', padding: '8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                                        onClick={() => handleCancelarPendente(h.id)}
                                                        disabled={loadingAction}
                                                    >
                                                        <X size={14} /> Cancelar
                                                    </button>
                                                </div>
                                            )}

                                            {/* BOTÃO DE CONFIRMAÇÃO DE RECEBIMENTO (Saques Concluídos) */}
                                            {h.tipo === 'saque' && h.status === 'concluido' && (
                                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    {h.confirmado_cliente ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 700 }}>
                                                            <CheckCircle size={16} /> Você confirmou o recebimento em {new Date(h.data_confirmacao_cliente).toLocaleDateString('pt-BR')} às {new Date(h.data_confirmacao_cliente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                    ) : (
                                                        <div className="alert alert-info animate-slide-down" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div className="alert-icon">
                                                                    <Info size={20} />
                                                                </div>
                                                                <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                                                                    Deseja confirmar que recebeu o PIX deste saque corretamente na sua conta?
                                                                </p>
                                                            </div>
                                                            <button 
                                                                className="btn btn-primary" 
                                                                style={{ width: '100%', fontSize: '0.75rem', padding: '10px' }}
                                                                onClick={() => handleConfirmarRecebimento(h.id)}
                                                            >
                                                                <CheckCircle size={16} /> Confirmei o Recebimento
                                                            </button>
                                                        </div>
                                                    )}
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
                                                                        <h3 className="mt-1" style={{ fontSize: '0.95rem', fontWeight: 800 }}>Apoio #{emp.id}</h3>
                                                                        <div className="text-muted" style={{ fontSize: '0.7rem' }}>
                                                                            {emp.tipo === 'tomador' ? `Você recebe de: ${emp.contraparte_nome || 'Aguardando'}` : `Você enviou para: ${emp.contraparte_nome || 'Aguardando'}`}
                                                                            <br />
                                                                            Chave PIX: <strong style={{ color: 'var(--text-main)' }}>{emp.chave_pix_pagamento || '—'}</strong>
                                                                        </div>
                                                                        <div className="mt-0-5" style={{ fontSize: '0.7rem' }}>
                                                                            {emp.tipo === 'tomador' ? `Recebeu: R$ ${emp.valor.toLocaleString('pt-BR')}` : `Enviou: R$ ${emp.valor.toLocaleString('pt-BR')}`}
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
                                                                                {emp.tipo_garantia === 'hibrida' && <p style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Sparkles size={12} className="text-primary" /> MODO JATO ATIVO (Pool Acelerado)</p>}
                                                                                
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
                                                                                        {g.aceito ? <span style={{display: 'inline-flex', alignItems: 'center', gap: '4px'}}>Confirmou <CheckCircle size={12} /></span> : 'Pendente...'}
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
                                                                        {emp.pagamento_pendente ? (
                                                                            <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(var(--warning-rgb), 0.1)', border: '1px solid rgba(var(--warning-rgb), 0.2)', textAlign: 'center' }}>
                                                                                {emp.tipo === 'tomador' ? (
                                                                                    <p style={{ fontSize: '0.75rem', color: 'var(--warning)', margin: 0 }}>Aguardando confirmacao do credor...</p>
                                                                                ) : (
                                                                                    <p style={{ fontSize: '0.75rem', color: 'var(--success)', margin: '0 0 8px 0' }}>Tomador ja enviou o PIX! Confira sua conta e confirme.</p>
                                                                                )}
                                                                                {emp.tipo !== 'tomador' && (
                                                                                    <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }} onClick={() => handleConfirmarPagtoRecebido(emp.id)}>Confirmar Recebimento</button>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                             <>
                                                                                {emp.tipo === 'tomador' ? (
                                                                                    <>
                                                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                                                                            <button className="btn btn-primary" style={{ padding: '10px', fontSize: '0.8rem' }} onClick={() => handlePagarParcela(emp.id, emp.valor_parcela, emp.chave_pix_pagamento)}>Pagar Parcela</button>
                                                                                            <button className="btn btn-outline" style={{ padding: '10px', fontSize: '0.8rem' }} onClick={() => handleQuitarTotalP2P(emp.id, emp.valor_total_restante, emp.chave_pix_pagamento)}>Quitar Tudo</button>
                                                                                        </div>
                                                                                        <button className="btn btn-sm" style={{ padding: '8px', fontSize: '0.75rem', color: '#FFD600', background: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,214,0,0.3)', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }} onClick={() => handlePagarAvulsoP2P(emp.id, emp.chave_pix_pagamento)}>Pagar outro valor</button>
                                                                                    </>
                                                                                ) : (
                                                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>Aguardando tomador enviar o pagamento...</p>
                                                                                )}
                                                                            </>
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



            {/* --- VIEW: MARKETPLACE (COMUNIDADE) --- */}
            {activeView === 'marketplace' && (
                <div className="marketplace-container animate-fade-in">
                    <div className="marketplace-header mb-1" style={{ flexWrap: 'wrap', gap: '10px' }}>
                        <div className="marketplace-tabs" style={{ flex: 1 }}>
                            <button className={`m-tab ${marketplaceTab === 'explorar' ? 'active' : ''}`} onClick={() => setMarketplaceTab('explorar')}>Explorar</button>
                            <button className={`m-tab ${marketplaceTab === 'meus' ? 'active' : ''}`} onClick={() => setMarketplaceTab('meus')}>Meus Anúncios</button>
                            <button className={`m-tab ${marketplaceTab === 'config' ? 'active' : ''}`} onClick={() => setMarketplaceTab('config')}>Configurações</button>
                        </div>
                        
                        {marketplaceTab === 'explorar' && (
                            <select 
                                className="input-field" 
                                style={{ width: 'auto', minWidth: '150px', height: '38px', borderRadius: '10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)' }}
                                value={selectedCategory}
                                onChange={(e) => {
                                    setSelectedCategory(e.target.value);
                                    setPageExplorar(1);
                                    // carregarExplorarMarketplace(1, e.target.value); // Função será atualizada
                                }}
                            >
                                {CATEGORIAS_MARKETPLACE.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        )}

                        <button className="btn btn-primary btn-sm" onClick={() => setShowPostarLink(true)} style={{ gap: '5px', height: '38px' }}>
                            <Plus size={16} /> Novo Anúncio
                        </button>
                    </div>

                    {/* BANNER PREMIUM / PONTOS */}
                    {usuario.is_subscriber ? (
                        <div style={{ 
                            background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.2) 0%, rgba(0,0,0,0.4) 100%)', 
                            padding: '15px', 
                            borderRadius: '16px', 
                            marginBottom: '1.5rem', 
                            border: '1px solid rgba(var(--primary-rgb), 0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div>
                                <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                    <Zap size={18} fill="var(--primary)" /> MEMBRO PREMIUM ATIVO
                                </h4>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Você ganha 1 ponto por cada link aberto. A cada 1.000 pontos = R$ 0,10 de saldo!</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Seus Pontos</div>
                                 <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>{usuario.pontos_marketplace || 0} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>pts</span></div>
                                {(usuario.pontos_marketplace || 0) >= 1000 && (
                                    <button className="btn btn-sm btn-primary mt-0-5" style={{ fontSize: '0.65rem', padding: '4px 8px' }} onClick={handleSolicitarResgate}>
                                        Solicitar Resgate
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div style={{ 
                            background: 'linear-gradient(135deg, rgba(255,214,0,0.1) 0%, rgba(0,0,0,0.6) 100%)', 
                            padding: '15px', 
                            borderRadius: '16px', 
                            marginBottom: '1.5rem', 
                            border: '1px solid rgba(255,214,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px'
                        }}>
                            <div style={{ background: 'rgba(255,214,0,0.1)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Zap size={24} color="#FFD600" fill="#FFD600" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#FFD600' }}>Seja um Membro Premium Marketplace</h4>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0' }}>Ganhe de 1 a 5 pontos por clique (aleatório) e converta em dinheiro real! Grátis: 1 ponto fixo.</p>
                            </div>
                            <button 
                                className="btn btn-primary btn-sm" 
                                style={{ background: '#FFD600', color: '#000', border: 'none', fontWeight: 800, width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }} 
                                onClick={() => setShowAssinarModal(true)}
                            >
                                <Gem size={14} /> ASSINAR PREMIUM
                            </button>
                        </div>
                    )}

                    {marketplaceTab === 'config' && (
                        <div className="animate-fade-in" style={{ 
                            background: 'rgba(255,255,255,0.03)', 
                            padding: '20px', 
                            borderRadius: '16px', 
                            border: '1px solid rgba(255,255,255,0.05)',
                            marginBottom: '2rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '10px', borderRadius: '12px' }}>
                                    <CreditCard size={24} color="var(--primary)" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Links de Afiliados</h3>
                                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Compartilhe links de produtos e servicos. Ao clicar, o usuario e redirecionado diretamente para o site do anunciante. Nao processamos pagamentos — apenas conectamos pessoas.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {marketplaceTab === 'explorar' ? (<div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}><div style={{ flex: 1, minWidth: 0 }}>
                        {loadingMarket && marketplaceLinks.length === 0 ? (
                            <div className="marketplace-grid">
                                {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-loading" style={{ height: '280px', borderRadius: '16px' }}></div>)}
                            </div>
                        ) : marketplaceLinks.length > 0 ? (
                            <>
                                <div className="marketplace-grid">
                                    {marketplaceLinks.map(l => (
                                        <div key={l.id} className={`market-card ${l.patrocinado ? 'market-card--boosted' : 'market-card--free'}`}>
                                            <div className="market-img-wrapper">
                                                <img src={l.url_imagem} alt={l.nome_produto} loading="lazy" />
                                                {l.patrocinado ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'absolute', top: '10px', left: '10px', zIndex: 2 }}>
                                                        <div className="market-badge market-badge--gold" style={{ position: 'static' }}><Zap size={10} /> DESTAQUE</div>
                                                        {usuario.is_subscriber && l.ponto_max > 1 && (
                                                            <div className="market-badge" style={{ position: 'static', background: 'var(--success)', color: '#000', fontWeight: 900, border: 'none' }}>
                                                                + ATÉ {l.ponto_max} PTS
                                                            </div>
                                                        )}
                                                    </div>
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
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                        <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                                            {l.categoria || 'Geral'}
                                                        </span>
                                                        <span className="market-views"><Eye size={11} /> {l.views_totais || 0}</span>
                                                    </div>
                                                    <h3 className="market-title" style={{ marginBottom: '8px' }}>{l.nome_produto}</h3>
                                                    
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                                        <button 
                                                            className="btn btn-primary" 
                                                            style={{ flex: 1, height: '32px', fontSize: '0.75rem', padding: '0 10px' }}
                                                            onClick={() => window.open(l.url_afiliado, '_blank')}
                                                        >
                                                            COMPRAR
                                                        </button>
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ height: '32px', fontSize: '0.75rem', padding: '0 10px', background: 'rgba(255,255,255,0.05)' }}
                                                            onClick={() => setSelectedAdDetails(l)}
                                                        >
                                                            DETALHES
                                                        </button>
                                                    </div>

                                                    <div className="market-meta" style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                                                        <span className="market-author">por {l.anunciante}</span>
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
                        )}
                    </div><RankingSemanal usuario={usuario} sidebar /></div>
                    ) : (
                        loadingMarket && meusLinksMarketplace.length === 0 ? (
                            <div className="marketplace-grid">
                                {[1,2,3].map(i => <div key={i} className="skeleton-loading" style={{ height: '280px', borderRadius: '16px' }}></div>)}
                            </div>
                        ) : meusLinksMarketplace.length > 0 ? (
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
                title="Novo Anúncio"
                type="info"
            >
                <div style={{ textAlign: 'left' }}>
                    <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Anuncie gratuitamente por 24h. Preencha os dados do seu produto ou servico.</p>

                    <div className="input-group mb-1">
                        <label>Nome do Produto / Servico</label>
                        <input className="input-field" placeholder="Ex: Curso de Marketing Digital" value={dadosNovoLink.nome_produto} onChange={(e) => setDadosNovoLink({...dadosNovoLink, nome_produto: e.target.value})} />
                    </div>

                    <div className="input-group mb-1">
                        <label>Descricao</label>
                        <textarea className="input-field" rows="3" placeholder="Descreva seu produto ou servico..." style={{ width: '100%', resize: 'none' }}
                            value={dadosNovoLink.descricao} onChange={(e) => setDadosNovoLink({...dadosNovoLink, descricao: e.target.value})} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div className="input-group mb-1">
                            <label>Valor (R$)</label>
                            <input type="number" className="input-field" placeholder="0,00" value={dadosNovoLink.valor} onChange={(e) => setDadosNovoLink({...dadosNovoLink, valor: e.target.value})} />
                        </div>
                        <div className="input-group mb-1">
                            <label>Categoria</label>
                            <select className="input-field" style={{ width: '100%', padding: '10px', borderRadius: '8px' }}
                                value={dadosNovoLink.categoria} onChange={(e) => setDadosNovoLink({...dadosNovoLink, categoria: e.target.value})}>
                                {CATEGORIAS_MARKETPLACE.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="input-group mb-1">
                        <label>URL da Imagem</label>
                        <input className="input-field" placeholder="https://..." value={dadosNovoLink.url_imagem} onChange={(e) => setDadosNovoLink({...dadosNovoLink, url_imagem: e.target.value})} />
                    </div>

                    <div className="input-group mb-1">
                        <label>Link de Afiliado / WhatsApp</label>
                        <input className="input-field" placeholder="https://seu-link.com ou 5511999999999"
                            value={dadosNovoLink.url_afiliado} onChange={(e) => setDadosNovoLink({...dadosNovoLink, url_afiliado: e.target.value})} />
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            <Info size={14} /> Se inserir so o numero do WhatsApp, criamos o link automaticamente.
                        </p>
                    </div>

                    <div className="input-group mb-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700 }}>
                            <Lock size={14} /> Codigo 2FA (anti-spam)
                        </label>
                        <input className="input-field" type="text" inputMode="numeric" maxLength={6}
                            placeholder="000000"
                            style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '8px', fontWeight: 800 }}
                            value={dadosNovoLink.codigo_2fa || ''}
                            onChange={(e) => setDadosNovoLink({...dadosNovoLink, codigo_2fa: e.target.value.replace(/\D/g, '')})} />
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>Para evitar spam, ative o 2FA no menu Seguranca e informe o codigo do Google Authenticator.</p>
                    </div>

                    <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                            <AlertTriangle size={14} className="text-warning inline-block mr-1" /> <strong>AVISO LEGAL:</strong> Ao publicar, voce declara ser o unico responsavel pelo produto/servico. A Psy Pay atua apenas como plataforma de classificados e nao se responsabiliza por vicios, defeitos ou falta de entrega.
                        </p>
                    </div>

                    <button className="btn btn-primary w-full mt-1" disabled={!dadosNovoLink.nome_produto || !dadosNovoLink.url_afiliado} onClick={async () => {
                        try {
                            await api.post('/comunidade/postar-link', dadosNovoLink);
                            setShowPostarLink(false);
                            setDadosNovoLink({ nome_produto: '', descricao: '', categoria: 'Geral', url_afiliado: '', url_imagem: '', valor: '', vendas_texto: '', codigo_2fa: '' });
                            carregarMeusLinksMarketplace();
                            showModal({ title: 'Sucesso!', message: 'Anuncio publicado!', type: 'success' });
                        } catch (err) { 
                            showModal({ title: 'Erro', message: err.response?.data?.detail || 'Erro ao publicar', type: 'danger' }); 
                        }
                    }}>Publicar Anuncio</button>
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
                            } catch (err) { showModal({ title: 'Erro', message: err.response?.data?.detail || 'Erro ao turbinar anúncio', type: 'danger' }); }
                        }}>
                            <div><p className="font-bold">{pkg.v} Views</p></div>
                            <span className="text-primary font-bold">R$ {pkg.p}</span>
                        </div>
                    ))}
                </div>
            </ModalPremium>

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
                            onClick={() => window.open(selectedAdDetails.url_afiliado, '_blank')}
                        >
                            Comprar / Chamar no WhatsApp
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
            {showModalRelatorio && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-icon" style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>
                            <FileDown size={32} />
                        </div>
                        <h2>Informe de Rendimentos</h2>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Escolha o ano-calendário para gerar o documento oficial de auxílio à Receita Federal (IRPF).
                        </p>
                        
                        <div className="input-group" style={{ marginBottom: '20px' }}>
                            <label>Selecione o Ano</label>
                            <select 
                                className="input-field" 
                                value={anoRelatorio} 
                                onChange={(e) => setAnoRelatorio(parseInt(e.target.value))}
                                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff' }}
                            >
                                {[2026, 2025, 2024, 2023, 2022].map(ano => (
                                    <option key={ano} value={ano} style={{ background: '#1a1a1a' }}>{ano}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-center-column" style={{ gap: '15px', width: '100%' }}>
                            <button 
                                className="btn btn-primary" 
                                style={{ width: '100%' }}
                                onClick={handleDownloadPDF}
                                disabled={loadingPDF}
                            >
                                {loadingPDF ? <RefreshCw className="animate-spin" size={18} /> : 'Gerar e Baixar PDF'}
                            </button>
                            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowModalRelatorio(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardCliente;
