import React, { useState, useEffect, useMemo } from 'react';
import api, { BASE_URL } from '../api';
import PagamentosRanking from '../componentes/PagamentosRanking';
import './AdminDashboard.css';
import {
    LayoutDashboard,
    ShieldCheck,
    Banknote,
    Users,
    TrendingUp,
    ListTodo,
    BarChart3,
    Clock,
    CheckCircle,
    XCircle,
    User,
    ArrowUpRight,
    ArrowDownRight,
    Copy,
    Check,
    ExternalLink,
    Search,
    Filter,
    Store,
    CreditCard,
    Zap,
    PlusCircle,
    Undo2,
    Calendar,
    ArrowDown,
    RefreshCw,
    Sparkles,
    Star,
    Eye,
    Trophy,
    Trash2,
    CheckCircle2,
    Timer,
    History,
    AlertCircle,
    X,
    ShieldAlert,
    AlertTriangle
} from 'lucide-react';
import ModalPremium from '../componentes/ModalPremium';

// --- CONSTANTES E UTILITÁRIOS ---
const TIPOS_LABEL = {
    deposito: 'Depósito',
    saque: 'Saque',
    recebimento: 'Recebimento',
    compra_score: 'Compra de Score',
    desbloqueio_dados: 'Verificação KYC',
    taxa_saque: 'Taxa de Saque',
    taxa_match: 'Taxa de Match',
    taxa_solicitacao: 'Taxa de Publicação',
    taxa_postagem: 'Marketplace',
    taxa_intermediacao: 'Taxa de Intermediação',
    taxa_adm_emprestimo: 'Taxa Admin',
    assinatura: 'Assinatura Premium',
    bonus: 'Bônus',
    resgate_pontos: 'Resgate de Pontos',
    retorno_investimento: 'Retorno Investimento',
    aporte_capital: 'Aporte de Capital',
    ajuste: 'Ajuste',
};

const TAXAS_PRAZOS = {
    0: 1,   // D+0 (Fast)
    14: 2,  // D+14 (Standard)
    35: 3   // D+35 (Premium)
};

const formatarDataBR = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- COMPONENTES ATOMICOS ---
const StatCard = ({ label, value, icon: Icon, color, trend }) => (
    <div className="stat-card">
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ color: color }}>{value}</div>
        <div className="flex-between">
            {trend !== null && trend !== undefined && trend !== 0 && (
                <span className="stat-change" style={{ color: trend >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {trend}% este mês
                </span>
            )}
            <Icon size={20} color={color} style={{ opacity: 0.5 }} />
        </div>
    </div>
);

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mensagem, setMensagem] = useState('');
    const [pixCopiado, setPixCopiado] = useState(null);
    const [filtroUsuarios, setFiltroUsuarios] = useState('');

    // Modais
    const [showRejeitarModal, setShowRejeitarModal] = useState(false);
    const [rejeicaoData, setRejeicaoData] = useState({ id: null, motivo: '' });
    const [loadingRejeicao, setLoadingRejeicao] = useState(false);

    // Add Saldo Manual
    const [showAddSaldo, setShowAddSaldo] = useState(false);
    const [addSaldoUserId, setAddSaldoUserId] = useState('');
    const [addSaldoValor, setAddSaldoValor] = useState('');
    const [loadingAddSaldo, setLoadingAddSaldo] = useState(false);

    const handleAddSaldo = async () => {
        if (!addSaldoUserId || !addSaldoValor) return;
        setLoadingAddSaldo(true);
        try {
            const formData = new FormData();
            formData.append('usuario_id', addSaldoUserId);
            formData.append('valor', addSaldoValor);
            await api.post('/financeiro/admin/adicionar-saldo', formData, { isMultipart: true });
            setMensagem(`R$ ${addSaldoValor} adicionado a ${addSaldoUserId}!`);
            setAddSaldoUserId('');
            setAddSaldoValor('');
            setShowAddSaldo(false);
            carregarSnapshot();
        } catch (e) {
            setMensagem('Erro: ' + (e.message || e));
        }
        setLoadingAddSaldo(false);
    };

    const handleResolverDisputa = async (id, acao) => {
        if (!confirm('Tem certeza? Isso afetara o score dos usuarios envolvidos.')) return;
        try {
            if (acao === 'calote') {
                await api.post('/emprestimos/calote/' + id);
                setMensagem('Calote registrado! Credor reembolsado, tomador marcado como inadimplente.');
            } else {
                await api.post('/emprestimos/confirmar-recebimento/' + id);
                setMensagem('Pagamento confirmado manualmente!');
            }
            carregarSnapshot();
        } catch (e) {
            setMensagem('Erro: ' + (e.message || e));
        }
    };

    // Resgates de Pontos
    const [resgates, setResgates] = useState([]);
    const [loadingResgates, setLoadingResgates] = useState(false);

    const carregarResgates = async () => {
        setLoadingResgates(true);
        try {
            const data = await api.get('/marketplace/admin/resgates-pendentes');
            setResgates(data || []);
        } catch (e) {
            console.error('Erro ao carregar resgates:', e);
        }
        setLoadingResgates(false);
    };

    const handleAprovarResgate = async (id) => {
        if (!confirm('Confirmar resgate? O admin deve enviar o PIX para o usuario.')) return;
        try {
            const res = await api.post('/marketplace/admin/aprovar-resgate/' + id);
            setMensagem(res.message);
            carregarResgates();
        } catch (e) {
            setMensagem('Erro: ' + (e.message || e));
        }
    };

    const handleRejeitarResgate = async (id) => {
        if (!confirm('Rejeitar resgate? Os pontos serao devolvidos.')) return;
        try {
            const res = await api.post('/marketplace/admin/rejeitar-resgate/' + id);
            setMensagem(res.message);
            carregarResgates();
        } catch (e) {
            setMensagem('Erro: ' + (e.message || e));
        }
    };

    // Ações de Caixa
    const [showAcaoModal, setShowAcaoModal] = useState(false); 
    const [acaoTipo, setAcaoTipo] = useState(''); // 'saque' ou 'aporte'
    const [acaoData, setAcaoData] = useState({ valor: '', chave_pix: '', motivo: '' });
    const [loadingAcao, setLoadingAcao] = useState(false);
    
    // Gestão de Parceiros
    const [showNovoParceiroModal, setShowNovoParceiroModal] = useState(false);
    const [novoParceiroData, setNovoParceiroData] = useState({ 
        nome: '', 
        endereco: '', 
        usuario_id: '', 
        prazo_liquidacao: 0, 
        taxa_comissao: 3.00 
    });
    const [loadingNovoParceiro, setLoadingNovoParceiro] = useState(false);
    const [showExcluirParceiroModal, setShowExcluirParceiroModal] = useState(false);
    const [parceiroParaExcluir, setParceiroParaExcluir] = useState(null);
    const [loadingExclusao, setLoadingExclusao] = useState(false);

    const [kycPendentes, setKycPendentes] = useState([]);
    const [pixData, setPixData] = useState(null); // { qr_code, qr_code_base64, payment_id }
    
    // Filtros Fiscais (Admin)
    const [dataInicio, setDataInicio] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
    const [loadingFiscalPDF, setLoadingFiscalPDF] = useState(false);
    const [loadingCobranca, setLoadingCobranca] = useState(false);

    // Limits
    const [showLimiteModal, setShowLimiteModal] = useState(false);
    const [limiteData, setLimiteData] = useState({ id: null, valor: '' });

    useEffect(() => {
        carregarSnapshot();
        
        // Auto-Refresh a cada 30 segundos (Real-time monitoring)
        const autoRefresh = setInterval(() => {
            carregarSnapshot(true); // Chamada silenciosa
        }, 30000);

        return () => clearInterval(autoRefresh);
    }, []);

    useEffect(() => {
        let interval;
        if (pixData && pixData.payment_id) {
            interval = setInterval(verificarStatusPagamento, 5000);
        }
        return () => clearInterval(interval);
    }, [pixData]);

    const verificarStatusPagamento = async () => {
        if (!pixData || !pixData.payment_id) return;
        try {
            const res = await api.get(`/financeiro/admin/sync-pix/${pixData.payment_id}`);
            if (res.status === 'success' || res.message?.includes('aprovado')) {
                setMensagem('Aporte Institucional de R$ ' + acaoData.valor + ' confirmado automaticamente!');
                setPixData(null);
                setShowAcaoModal(false);
                carregarSnapshot();
            }
        } catch (e) {
            console.error("Erro no polling do aporte", e);
        }
    };

    const carregarSnapshot = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/snapshot');
            console.log("📊 Admin Snapshot Data:", res);
            setSnapshot(res);
            try {
                const kycRes = await api.get('/financeiro/admin/kyc-pendentes');
                setKycPendentes(kycRes || []);
            } catch(e) { console.error("Erro kyc", e); }
        } catch (err) {
            if (!silent) setMensagem('Erro ao carregar dados: ' + (err.response?.data?.detail || err.message));
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const adminData = snapshot?.admin || {};
    const fiscal = adminData.fiscal || {};
    const pendentes = adminData.pendentes || [];
    const usuarios = adminData.gestao_usuarios || [];
    const solicitacoesAtivas = adminData.solicitacoes_ativas || [];
    const parceiros = adminData.gestao_parceiros || [];

    // --- LOGICA DE AÇÕES ---
    const handleExcluirParceiro = async () => {
        if (!parceiroParaExcluir) return;
        setLoadingExclusao(true);
        try {
            await api.delete(`/financeiro/admin/parceiros/${parceiroParaExcluir.id}`);
            setMensagem(`Parceiro ${parceiroParaExcluir.nome} desativado com sucesso.`);
            setShowExcluirParceiroModal(false);
            carregarSnapshot(); // Recarrega para limpar a lista
        } catch (err) {
            setMensagem('Erro ao excluir parceiro: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingExclusao(false);
            setParceiroParaExcluir(null);
        }
    };

    const handleAjustarLimite = async () => {
        setLoadingAcao(true);
        try {
            const limitVal = parseFloat(limiteData.valor.replace(',', '.'));
            await api.put(`/financeiro/admin/cliente/${limiteData.id}/limite`, {
                limite: isNaN(limitVal) ? null : limitVal
            });
            setMensagem('Limite atualizado com sucesso.');
            setShowLimiteModal(false);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro ao definir limite: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingAcao(false);
        }
    };

    const handleDownloadFiscalPDF = async () => {
        try {
            setLoadingFiscalPDF(true);
            const res = await api.getBlob(`/admin/fiscal/pdf?inicio=${dataInicio}&fim=${dataFim}`);
            
            const blob = res.data || res;
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `DEMONSTRATIVO_FISCAL_PSY_PAY_${dataInicio}_A_${dataFim}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setMensagem('Erro ao baixar relatório fiscal: ' + err.message);
        } finally {
            setLoadingFiscalPDF(false);
        }
    };

    const handleExecutarCobranca = async () => {
        if (!confirm("⚠️ ATENÇÃO: Deseja executar a Cláusula 3.3 agora? O sistema irá varrer inadimplentes com mais de 5 dias e liquidar a dívida usando o saldo do Pool do devedor.")) {
            return;
        }

        setLoadingCobranca(true);
        try {
            const response = await api.post(`/admin/fiscal/executar-cobranca`);

            if (response.data.status === "sucesso") {
                toast.success(response.data.mensagem);
                if (response.data.detalhes && response.data.detalhes.length > 0) {
                    console.log("LOGS DE COBRANÇA:", response.data.detalhes);
                }
                fetchSnapshot();
            }
        } catch (error) {
            console.error("Erro ao executar cobrança:", error);
            const errorMsg = error.response?.data?.detail || "Falha ao processar cobrança automática.";
            toast.error(errorMsg);
        } finally {
            setLoadingCobranca(false);
        }
    };

    const handleAprovar = async (id, tipo) => {
        try {
            const res = await api.post(`/financeiro/admin/confirmar/${id}`, { tipo });
            setMensagem(res.message || 'Operação aprovada!');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleAbrirDocumento = (url) => {
        if (!url) {
            setMensagem('Erro: Link do documento não encontrado.');
            return;
        }

        let fullUrl = url;
        if (url.startsWith('/api')) {
            const apiRoot = BASE_URL.endsWith('/api') ? BASE_URL.replace('/api', '') : BASE_URL;
            fullUrl = `${apiRoot}${url}`;
        } else if (!url.startsWith('http')) {
            fullUrl = `${BASE_URL}${url}`;
        }

        const token = api.getToken();
        if (token) {
            fullUrl += `${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        }

        window.open(fullUrl, '_blank', 'noopener,noreferrer');
    };

    const handleRejeitar = (id) => {
        setRejeicaoData({ id, motivo: '' });
        setShowRejeitarModal(true);
    };

    const handleConfirmarVerificacao = async (p) => {
        if (!window.confirm(`Aprovar verificacao de ${p.usuario_nome}?`)) return;
        try {
            const id = p.transacao_id || p.id;
            await api.post(`/financeiro/admin/confirmar/${id}`);
            setMensagem(`Verificacao de ${p.usuario_nome} aprovada!`);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        }
    };

    const confirmarRejeicao = async () => {
        setLoadingRejeicao(true);
        try {
            await api.post(`/financeiro/admin/rejeitar/${rejeicaoData.id}`, { motivo: rejeicaoData.motivo });
            setMensagem('Solicitação rejeitada.');
            setShowRejeitarModal(false);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        } finally {
            setLoadingRejeicao(false);
        }
    };

    const handleOpenAcao = (tipo) => {
        setAcaoTipo(tipo);
        setAcaoData({ valor: '', chave_pix: '', motivo: '' });
        setShowAcaoModal(true);
    };

    const confirmarAcaoCaixa = async () => {
        setLoadingAcao(true);
        try {
            if (acaoTipo === 'aporte') {
                // NOVO FLUXO: Mercado Pago AUTOMÁTICO
                const res = await api.post('/financeiro/admin/aporte-capital/gerar', {
                    valor: parseFloat(acaoData.valor.replace(',', '.'))
                });
                setPixData(res);
                return; // Não fecha o modal ainda, espera o PIX
            }

            // FLUXO ANTIGO: Saque de Lucro (Manual)
            const endpoint = '/financeiro/admin/sacar-lucro';
            const res = await api.post(endpoint, {
                valor: parseFloat(acaoData.valor.replace(',', '.')),
                chave_pix: acaoData.chave_pix,
                motivo: acaoData.motivo
            });
            setMensagem(res.message || 'Ação concluída com sucesso!');
            setShowAcaoModal(false);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingAcao(false);
        }
    };

    const handleSincronizarTokens = async () => {
        try {
            const res = await api.post('/financeiro/admin/parceiros/sincronizar-tokens');
            setMensagem(res.message || res.data?.message || 'Tokens sincronizados com sucesso!');
            carregarParceiros();
        } catch (err) {
            setMensagem('Erro ao sincronizar: ' + (err.response?.data?.detail || err.message));
        }
    };

    const handleCriarParceiro = async () => {
        if (!novoParceiroData.nome || !novoParceiroData.endereco) {
            setMensagem('Erro: Preencha todos os campos do parceiro.');
            return;
        }
        setLoadingNovoParceiro(true);
        try {
            await api.post('/financeiro/admin/fiscal/parceiros', novoParceiroData);
            setMensagem('Sucesso: Parceiro cadastrado!');
            setShowNovoParceiroModal(false);
            setNovoParceiroData({ 
                nome: '', 
                endereco: '', 
                usuario_id: '', 
                prazo_liquidacao: 0, 
                taxa_comissao: 3.00 
            });
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro ao cadastrar: ' + err.message);
        } finally {
            setLoadingNovoParceiro(false);
        }
    };

    const handleConfirmarExclusaoParceiro = async () => {
        if (!parceiroParaExcluir) return;
        setLoadingExclusao(true);
        try {
            await api.delete(`/financeiro/admin/fiscal/parceiros/${parceiroParaExcluir.id}`);
            setMensagem('Sucesso: Parceiro removido.');
            setShowExcluirParceiroModal(false);
            setParceiroParaExcluir(null);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro ao remover: ' + err.message);
        } finally {
            setLoadingExclusao(false);
        }
    };

    const copiarPix = (chave, id) => {
        navigator.clipboard.writeText(chave);
        setPixCopiado(id);
        setTimeout(() => setPixCopiado(null), 2000);
    };

    const usuariosFiltrados = useMemo(() => {
        return usuarios.filter(u => 
            u.nome.toLowerCase().includes(filtroUsuarios.toLowerCase()) || 
            u.cpf.includes(filtroUsuarios)
        );
    }, [usuarios, filtroUsuarios]);

    if (loading && !snapshot) {
        return (
            <div className="flex-center" style={{ height: '100vh', background: 'var(--bg-dark)', color: 'var(--primary)' }}>
                <Zap className="animate-pulse" size={48} />
                <p className="ml-1 font-bold">Iniciando PSY PAY Cyber-Hub...</p>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            {/* --- SIDEBAR --- */}
            <aside className="admin-sidebar">
                <div className="sidebar-logo">
                    <Zap size={28} />
                    <span>PSY PAY</span>
                </div>

                <nav className="sidebar-nav">
                    <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                        <LayoutDashboard size={20} /> <span>Dashboard</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'pendentes' ? 'active' : ''}`} onClick={() => setActiveTab('pendentes')}>
                        <ListTodo size={20} /> <span>Aprovações</span>
                        {pendentes.length > 0 && <span className="badge-notification">{pendentes.length}</span>}
                    </div>
                    <div className={`nav-item ${activeTab === 'emprestimos' ? 'active' : ''}`} onClick={() => setActiveTab('emprestimos')}>
                        <CreditCard size={16} /> Pedidos
                    </div>
                    <div className={`nav-item ${activeTab === 'financeiro' ? 'active' : ''}`} onClick={() => setActiveTab('financeiro')}>
                        <BarChart3 size={16} /> Movimentação
                    </div>
                    <div className={`nav-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>
                        <Users size={20} /> <span>Usuários</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'resgates' ? 'active' : ''}`} onClick={() => { setActiveTab('resgates'); carregarResgates(); }}>
                        <Sparkles size={20} /> <span>Resgates</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'ranking' ? 'active' : ''}`} onClick={() => setActiveTab('ranking')}>
                        <Trophy size={20} /> <span>Ranking</span>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <div className="nav-item">
                        <Undo2 size={18} /> <span>Sair do Painel</span>
                    </div>
                </div>
            </aside>

            {/* --- CONTEUDO PRINCIPAL --- */}
            <main className="admin-main">
                <header className="admin-header">
                    <div className="header-title">
                        <div className="flex-start gap-1">
                            <h1>Painel Administrativo</h1>
                        </div>
                        <p className="text-muted">Rede de Apoio entre Pares.</p>
                    </div>
                    
                    <div className="header-actions">
                        <button className="btn btn-icon" onClick={carregarSnapshot} title="Sincronizar Dados">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {mensagem && (
                    <div className={`alert ${mensagem.toLowerCase().includes('erro') || mensagem.toLowerCase().includes('falha') ? 'alert-danger animate-shake' : 'alert-success'} mb-1`}>
                        <div className="alert-icon">
                            {mensagem.toLowerCase().includes('erro') || mensagem.toLowerCase().includes('falha') ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                        </div>
                        <span>{mensagem}</span>
                        <button onClick={() => setMensagem('')} className="alert-close"><X size={16} /></button>
                    </div>
                )}

                {/* --- VIEW: DASHBOARD --- */}
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in">
                        <div className="stats-grid">
                            <StatCard label="Usuários" value={usuarios.length} icon={Users} color="var(--primary)" trend={null} />
                            <StatCard label="Apoios Ativos" value={snapshot?.admin?.emprestimos_para_liberar?.length || 0} icon={ShieldCheck} color="var(--success)" trend={null} />
                            <StatCard label="Pedidos Pendentes" value={solicitacoesAtivas.length} icon={Clock} color="var(--warning)" trend={null} />
                            <StatCard label="KYC Pendentes" value={kycPendentes?.length || 0} icon={ListTodo} color="var(--primary)" trend={null} />
                            <StatCard label="Saldo Plataforma" value={`R$ ${(snapshot?.admin?.saldo_plataforma || 0).toFixed(2)}`} icon={BarChart3} color="var(--success)" trend={null} />
                        </div>
                    </div>
                )}

                {/* --- VIEW: PENDENTES (KYC) --- */}
                {activeTab === 'pendentes' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Verificações KYC Pendentes</h3>
                        </div>

                        {kycPendentes.length === 0 ? (
                            <div className="empty-state">
                                <ShieldCheck size={48} className="mb-1 opacity-20" />
                                <p>Nenhuma verificação pendente.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Usuário</th>
                                            <th>CPF</th>
                                            <th>Documentos</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {kycPendentes.map(p => (
                                            <tr key={p.transacao_id || p.id} className="row-hover">
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        <div className="user-avatar">{p.usuario_nome?.charAt(0)}</div>
                                                        <div>
                                                            <p className="font-bold">{p.usuario_nome}</p>
                                                            {p.detalhes && <p className="text-xs text-primary">{p.detalhes}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-xs">{p.usuario_cpf}</td>
                                                <td>
                                                    <div className="flex-start gap-0-5">
                                                        {p.url_rg && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.url_rg)}><Eye size={12} /> RG</button>}
                                                        {p.url_renda && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.url_renda)}><Eye size={12} /> Renda</button>}
                                                        {p.url_residencia && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.url_residencia)}><Eye size={12} /> Res.</button>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        <button className="btn btn-icon-small text-success" onClick={() => handleConfirmarVerificacao(p)}><CheckCircle size={18} /></button>
                                                        <button className="btn btn-icon-small text-danger" onClick={() => handleRejeitar(p.transacao_id || p.id)}><XCircle size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* --- VIEW: MOVIMENTAÇÃO --- */}
                {activeTab === 'fiscal' && (
                    <div className="animate-fade-in">
                        <div className="fiscal-grid">
                            <section className="glass-panel">
                                <h3>Taxas Arrecadadas</h3>
                                <p className="text-muted text-xs mb-2">Resumo de taxas de serviço da plataforma.</p>
                                
                                <div className="grid-2">
                                    <div className="revenue-item">
                                        <span className="info-label">Verificações KYC</span>
                                        <span className="font-bold">R$ {fiscal.detalhamento_lucro.kyc_score?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item">
                                        <span className="info-label">Taxas de Saque</span>
                                        <span className="font-bold">R$ {fiscal.detalhamento_lucro.taxas_saque?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item" style={{ border: '1px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                                        <span className="info-label text-primary">Taxa de Serviço</span>
                                        <span className="font-bold text-primary">R$ {fiscal.detalhamento_lucro.taxa_adm_emprestimo?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item">
                                        <span className="info-label">Taxa de Match</span>
                                        <span className="font-bold">R$ {fiscal.detalhamento_lucro.taxa_intermediacao?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item">
                                        <span className="info-label">Contribuições</span>
                                        <span className="font-bold">R$ {fiscal.detalhamento_lucro.aportes_externos?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item" style={{ border: '1px solid var(--secondary)', background: 'rgba(var(--secondary-rgb), 0.05)' }}>
                                        <span className="info-label text-secondary">Marketplace Ads</span>
                                        <span className="font-bold text-secondary">R$ {fiscal.detalhamento_lucro.taxa_postagem?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item" style={{ border: '1px solid #FFD600', background: 'rgba(255, 214, 0, 0.05)' }}>
                                        <span className="info-label" style={{ color: '#FFD600' }}>Assinaturas Premium</span>
                                        <span className="font-bold" style={{ color: '#FFD600' }}>R$ {fiscal.detalhamento_lucro.assinaturas?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item" style={{ border: '1px solid #ff4d4d', background: 'rgba(255, 77, 77, 0.05)' }}>
                                        <span className="info-label" style={{ color: '#ff4d4d' }}>Bônus Concedidos</span>
                                        <span className="font-bold" style={{ color: '#ff4d4d' }}>- R$ {fiscal.detalhamento_lucro.premios_marketplace?.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-panel">
                                 <h3>Ações Administrativas</h3>
                                 <div className="flex-column gap-1 mt-1">
                                     <button className="btn btn-primary w-full gap-1" onClick={() => handleOpenAcao('saque')}>
                                         <ArrowUpRight size={18} /> Retirar Saldo Disponível
                                     </button>
                                     <button className="btn btn-outline w-full gap-1" onClick={() => handleOpenAcao('aporte')}>
                                         <PlusCircle size={18} /> Injetar Capital (Aporte)
                                     </button>
                                     <button className="btn btn-secondary w-full gap-1" onClick={() => setShowAddSaldo(!showAddSaldo)}>
                                         <PlusCircle size={18} /> Adicionar Saldo a Usuário
                                     </button>
                                 </div>
                                 {showAddSaldo && (
                                     <div className="mt-1" style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px' }}>
                                         <input className="input-field mb-0-5" placeholder="ID do usuário" value={addSaldoUserId} onChange={e => setAddSaldoUserId(e.target.value)} />
                                         <input className="input-field mb-0-5" type="number" placeholder="Valor R$" value={addSaldoValor} onChange={e => setAddSaldoValor(e.target.value)} />
                                         <button className="btn btn-primary btn-sm w-full" disabled={!addSaldoUserId || !addSaldoValor || loadingAddSaldo} onClick={handleAddSaldo}>
                                             {loadingAddSaldo ? '...' : 'Confirmar'}
                                         </button>
                                     </div>
                                 )}
                            </section>
                        </div>
                    </div>
                )}

                {/* --- VIEW: PEDIDOS DE APOIO --- */}
                {activeTab === 'emprestimos' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Pedidos de Apoio</h3>
                        </div>

                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Tomador</th>
                                        <th>Valor</th>
                                        <th>Taxa</th>
                                        <th>Parcelas</th>
                                        <th>Score</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(snapshot?.cliente_emprestimos || []).filter(e => e.status === 'pendente').map(s => (
                                        <tr key={s.id} className="row-hover">
                                            <td className="font-bold">{s.contraparte_nome || s.tomador_nome || '—'}</td>
                                            <td>R$ {s.valor?.toFixed(2)}</td>
                                            <td>{s.taxa}%</td>
                                            <td>{s.parcelas}x</td>
                                            <td>{s.score_tomador || '—'}</td>
                                            <td><span className="badge badge-warning">Pendente</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- VIEW: DISPUTAS / PAGAMENTOS PENDENTES --- */}
                {activeTab === 'emprestimos' && (
                    <div className="glass-panel animate-fade-in mt-2">
                        <div className="section-header">
                            <h3>Pagamentos Pendentes de Confirmação</h3>
                            <AlertTriangle size={16} color="var(--warning)" />
                        </div>
                        <p className="text-xs text-muted mb-2">Empréstimos onde o tomador já pagou mas o credor ainda não confirmou. Se o credor não confirmar, o admin pode resolver.</p>
                        
                        {(() => {
                            const pendentes = (snapshot?.cliente_emprestimos || []).filter(e => e.pagamento_pendente);
                            if (pendentes.length === 0) return <p className="text-muted">Nenhum pagamento pendente de confirmação.</p>;
                            return pendentes.map(emp => (
                                <div key={emp.id} className="info-block mb-1" style={{ border: '1px solid rgba(var(--warning-rgb), 0.3)', padding: '12px', borderRadius: '12px' }}>
                                    <div className="flex-between">
                                        <div>
                                            <p style={{ fontWeight: 700, margin: 0 }}>Apoio #{emp.id}</p>
                                            <p className="text-xs text-muted" style={{ margin: '2px 0' }}>
                                                Tomador: {emp.contraparte_nome} | Credor: {emp.tipo === 'credor' ? 'Você' : emp.contraparte_nome}
                                            </p>
                                            <p className="text-xs text-muted" style={{ margin: 0 }}>
                                                Pago em: {emp.confirmacao_pagamento_data || '—'}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="btn btn-sm btn-primary" style={{ padding: '6px 12px', fontSize: '0.7rem' }} onClick={() => handleResolverDisputa(emp.id, 'confirmar')}>
                                                Confirmar (forçar)
                                            </button>
                                            <button className="btn btn-sm" style={{ padding: '6px 12px', fontSize: '0.7rem', background: 'var(--danger)', color: '#fff', border: 'none' }} onClick={() => handleResolverDisputa(emp.id, 'calote')}>
                                                Marcar Calote
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {activeTab === 'resgates' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Resgates de Pontos</h3>
                            <button className="btn btn-sm btn-outline" onClick={carregarResgates}><RefreshCw size={14} /> Atualizar</button>
                        </div>

                        {loadingResgates ? (
                            <p className="text-muted">Carregando...</p>
                        ) : resgates.length === 0 ? (
                            <div className="empty-state">
                                <Sparkles size={48} className="mb-1 opacity-20" />
                                <p>Nenhum resgate pendente.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Usuário</th>
                                            <th>CPF</th>
                                            <th>Chave PIX</th>
                                            <th>Valor</th>
                                            <th>Data</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resgates.map(r => (
                                            <tr key={r.id} className="row-hover">
                                                <td className="font-bold">{r.usuario_nome}</td>
                                                <td className="text-xs">{r.usuario_cpf}</td>
                                                <td style={{ color: 'var(--success)', fontWeight: 700 }}>{r.chave_pix}</td>
                                                <td>R$ {r.valor.toFixed(2)}</td>
                                                <td className="text-xs text-muted">{r.data ? new Date(r.data).toLocaleString('pt-BR') : '—'}</td>
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        <button className="btn btn-sm btn-primary" style={{ padding: '4px 10px', fontSize: '0.7rem' }} onClick={() => handleAprovarResgate(r.id)}>Aprovar</button>
                                                        <button className="btn btn-sm" style={{ padding: '4px 10px', fontSize: '0.7rem', background: 'var(--danger)', color: '#fff', border: 'none' }} onClick={() => handleRejeitarResgate(r.id)}>Rejeitar</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ranking' && <PagamentosRanking />}

                {activeTab === 'usuarios' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Usuários</h3>
                            <div className="search-bar">
                                <Search size={16} />
                                <input type="text" placeholder="Buscar por nome ou CPF..." value={filtroUsuarios}
                                    onChange={(e) => setFiltroUsuarios(e.target.value)} />
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Membro</th>
                                        <th>Score</th>
                                        <th>Verificado</th>
                                        <th>Admin</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usuariosFiltrados.map(u => (
                                        <tr key={u.id} className="row-hover">
                                            <td>
                                                <div className="flex-start gap-1">
                                                    <div className="user-avatar">{u.nome.charAt(0)}</div>
                                                    <div>
                                                        <p className="font-bold">{u.nome}</p>
                                                        <p className="text-xs text-muted">{u.cpf} (ID: {u.id})</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className="text-primary font-bold">{u.score}</span></td>
                                            <td><span className={`status-pill ${u.is_verified ? 'status-success' : 'status-warning'}`}>{u.is_verified ? 'Sim' : 'Não'}</span></td>
                                            <td>{u.is_admin ? 'Sim' : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* --- MODAIS (REUTILIZADOS) --- */}
            <ModalPremium
                isOpen={showRejeitarModal}
                onClose={() => setShowRejeitarModal(false)}
                title="Rejeitar Solicitação"
                message={`Deseja rejeitar a solicitação #${rejeicaoData.id}? Informe o motivo.`}
                type="error"
                onConfirm={confirmarRejeicao}
                confirmText="Rejeitar Agora"
                loading={loadingRejeicao}
            >
                <textarea
                    className="input-field mt-1 w-full"
                    placeholder="Ex: Documento borrado ou chave PIX incorreta..."
                    value={rejeicaoData.motivo}
                    onChange={(e) => setRejeicaoData({ ...rejeicaoData, motivo: e.target.value })}
                />
            </ModalPremium>

            {/* Modal Ações de Caixa */}
            <ModalPremium
                isOpen={showAcaoModal}
                onClose={() => { setShowAcaoModal(false); setPixData(null); }}
                title={acaoTipo === 'saque' ? 'Resgatar Lucro Líquido' : 'Injetar Capital na Plataforma'}
                message={acaoTipo === 'saque' ? 'Retirada de lucro disponível direto do caixa livre da Psy Pay.' : 'Aporte de recurso externo para aumentar o patrimônio da plataforma.'}
                type={acaoTipo === 'saque' ? 'warning' : 'info'}
                onConfirm={confirmarAcaoCaixa}
                confirmText={pixData ? null : (acaoTipo === 'saque' ? 'Confirmar Resgate' : 'Gerar PIX de Aporte')}
                loading={loadingAcao}
            >
                {pixData ? (
                    <div className="pix-container animate-fade-in" style={{ textAlign: 'center', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--primary-low)' }}>
                        <p className="text-primary font-bold mb-1">Aporte de R$ {acaoData.valor}</p>
                        <img src={`data:image/jpeg;base64,${pixData.qr_code_base64}`} alt="QR Code PIX Admin" className="qr-img mb-1" style={{ width: '200px', margin: '0 auto', border: '4px solid white', borderRadius: '8px' }} />
                        
                        <div className="input-group">
                            <label className="text-xs">Código Copia e Cola</label>
                            <div className="flex-start gap-1">
                                <input readOnly value={pixData.qr_code} className="input-field text-xs" style={{ background: 'var(--bg-dark)' }} />
                                <button className="btn btn-primary btn-sm" onClick={() => copiarPix(pixData.qr_code, 'pix-admin')}>
                                    {pixCopiado === 'pix-admin' ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                            </div>
                        </div>
                        
                        <div className="mt-2 text-xs text-muted flex-center gap-1">
                            <RefreshCw size={12} className="animate-spin" />
                            Aguardando confirmação do pagamento...
                        </div>
                    </div>
                ) : (
                    <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                        <div className="input-group mb-1">
                            <label>Valor (R$)</label>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="0.00"
                                value={acaoData.valor}
                                onChange={(e) => setAcaoData({ ...acaoData, valor: e.target.value })}
                                min="0.01"
                                step="0.01"
                            />
                        </div>
                        {acaoTipo === 'saque' && (
                            <div className="input-group mb-1">
                                <label>Chave PIX de Destino</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Ex: financeiro@psypay.com"
                                    value={acaoData.chave_pix}
                                    onChange={(e) => setAcaoData({ ...acaoData, chave_pix: e.target.value })}
                                />
                            </div>
                        )}
                        <div className="input-group">
                            <label>Motivo ou Justificativa</label>
                            <textarea
                                className="input-field"
                                placeholder={acaoTipo === 'saque' ? 'Ex: Distribuição de lucros aos sócios...' : 'Ex: Aporte institucional para liquidez de crédito...'}
                                value={acaoData.motivo}
                                onChange={(e) => setAcaoData({ ...acaoData, motivo: e.target.value })}
                            />
                        </div>
                    </div>
                )}
            </ModalPremium>

            {/* Modal de Customização de Limite */}
            <ModalPremium
                isOpen={showLimiteModal}
                onClose={() => setShowLimiteModal(false)}
                title="Ajuste de Limite Personalizado"
                message="Defina um teto de crédito manual para este usuário (Mestre). Deixe em branco se quiser devolver o usuário para a regra automática de Algoritmo do Score."
                type="info"
                onConfirm={handleAjustarLimite}
                confirmText="Salvar Limite"
                loading={loadingAcao}
            >
                <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                    <div className="input-group mb-1">
                        <label>Novo Limite Permitido (R$)</label>
                        <input
                            type="number"
                            className="input-field"
                            placeholder="Deixe em branco para usar o Robô/Algoritmo"
                            value={limiteData.valor}
                            onChange={(e) => setLimiteData({ ...limiteData, valor: e.target.value })}
                            min="0.00"
                            step="0.01"
                        />
                    </div>
                </div>
            </ModalPremium>
            {/* Modal Novo Parceiro */}
            <ModalPremium
                isOpen={showNovoParceiroModal}
                onClose={() => setShowNovoParceiroModal(false)}
                title="Cadastrar Novo Parceiro (Lojista)"
                message="Parceiros autorizados realizam depósitos e saques em espécie para os membros da PSY PAY."
                type="info"
                onConfirm={handleCriarParceiro}
                confirmText="Salvar Parceiro"
                loading={loadingNovoParceiro}
            >
                <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                    <div className="input-group mb-1">
                        <label>Nome do Estabelecimento</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ex: Mercadinho do Josias"
                            value={novoParceiroData.nome}
                            onChange={(e) => setNovoParceiroData({ ...novoParceiroData, nome: e.target.value })}
                        />
                    </div>
                    <div className="input-group mb-1">
                        <label>ID do Usuário Vínculo (5 chars)</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ex: A1B2C"
                            maxLength={5}
                            value={novoParceiroData.usuario_id}
                            onChange={(e) => setNovoParceiroData({ ...novoParceiroData, usuario_id: e.target.value.toUpperCase() })}
                        />
                    </div>
                    <div className="input-group mb-1">
                        <label>Endereço Completo</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ex: Av. Paulista, 1000 - São Paulo"
                            value={novoParceiroData.endereco}
                            onChange={(e) => setNovoParceiroData({ ...novoParceiroData, endereco: e.target.value })}
                        />
                    </div>
                    <div className="grid-2 gap-1">
                        <div className="input-group">
                            <label>Prazo de Liquidação</label>
                            <select 
                                className="input-field"
                                value={novoParceiroData.prazo_liquidacao}
                                onChange={(e) => {
                                    const prazo = parseInt(e.target.value);
                                    setNovoParceiroData({ 
                                        ...novoParceiroData, 
                                        prazo_liquidacao: prazo,
                                        taxa_comissao: TAXAS_PRAZOS[prazo]
                                    });
                                }}
                            >
                                <option value={0}>Imediato (D+0) → {TAXAS_PRAZOS[0]}%</option>
                                <option value={14}>14 dias (D+14) → {TAXAS_PRAZOS[14]}%</option>
                                <option value={35}>35 dias (D+35) → {TAXAS_PRAZOS[35]}%</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Taxa de Serviço</label>
                            <div className="text-primary font-bold mt-1" style={{ fontSize: '1.2rem' }}>
                                {TAXAS_PRAZOS[novoParceiroData.prazo_liquidacao]}% (Fixo)
                            </div>
                        </div>
                    </div>
                </div>
            </ModalPremium>

            {/* Modal Excluir Parceiro */}
            <ModalPremium
                isOpen={showExcluirParceiroModal}
                onClose={() => setShowExcluirParceiroModal(false)}
                title="Remover Parceiro?"
                message={`Deseja desativar o parceiro "${parceiroParaExcluir?.nome}"? Ele não aparecerá mais como ponto de atendimento.`}
                type="error"
                onConfirm={handleConfirmarExclusaoParceiro}
                confirmText="Sim, Remover"
                loading={loadingExclusao}
            />
        </div>
    );
};

export default AdminDashboard;
