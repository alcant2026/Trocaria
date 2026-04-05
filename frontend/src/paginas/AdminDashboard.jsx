import React, { useState, useEffect, useMemo } from 'react';
import api, { BASE_URL } from '../api';
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
    Trash2,
    CheckCircle2,
    Timer,
    History,
    AlertCircle,
    X,
    ShieldAlert
} from 'lucide-react';
import ModalPremium from '../componentes/ModalPremium';

// --- CONSTANTES E UTILITÁRIOS ---
const TIPOS_LABEL = {
    deposito: 'Depósito',
    saque: 'Saque',
    investimento: 'Investimento',
    recebimento: 'Recebimento',
    compra_score: 'Compra de Score',
    desbloqueio_dados: 'Verificação KYC',
    taxa_saque: 'Taxa de Saque',
    taxa_intermediacao: 'Taxa de Intermediação',
    taxa_conveniencia: 'Taxa de Conveniência',
    aporte_capital: 'Aporte de Capital',
    taxa_postagem: 'Taxa de Postagem',
    retorno_investimento: 'Retorno de Investimento',
    aporte_caixa: 'Aporte Caixa (Investimento)',
    resgate_caixa: 'Resgate Caixa (Desinvestimento)',
    bonus_pagador_caixa: 'Bônus de Fidelidade',
    retorno_pool: 'Retorno Fundo Coletivo',
    taxa_adm_emprestimo: 'Comissão Gestão 10%'
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
            const token = localStorage.getItem('token_psypay');
            const response = await api.post(`/api/admin/fiscal/executar-cobranca`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

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

        // Se a BASE_URL termina em /api e a url começa com /api, removemos a duplicidade
        let fullUrl = url;
        if (url.startsWith('/api')) {
            const apiRoot = BASE_URL.endsWith('/api') ? BASE_URL.replace('/api', '') : BASE_URL;
            fullUrl = `${apiRoot}${url}`;
        } else if (!url.startsWith('http')) {
            fullUrl = `${BASE_URL}${url}`;
        }

        console.log("📂 Abrindo documento:", fullUrl);
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
    };

    const handleRejeitar = (id) => {
        setRejeicaoData({ id, motivo: '' });
        setShowRejeitarModal(true);
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
                        <LayoutDashboard size={20} /> <span>Fiscal Hub</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'pendentes' ? 'active' : ''}`} onClick={() => setActiveTab('pendentes')}>
                        <ListTodo size={20} /> <span>Aprovações</span>
                        {pendentes.length > 0 && <span className="badge-notification">{pendentes.length}</span>}
                    </div>
                    <div className={`nav-item ${activeTab === 'fiscal' ? 'active' : ''}`} onClick={() => setActiveTab('fiscal')}>
                        <BarChart3 size={20} /> <span>Financeiro</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'emprestimos' ? 'active' : ''}`} onClick={() => setActiveTab('emprestimos')}>
                        <Banknote size={20} /> <span>Crédito</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'usuarios' ? 'active' : ''}`} onClick={() => setActiveTab('usuarios')}>
                        <Users size={20} /> <span>Usuários</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'parceiros' ? 'active' : ''}`} onClick={() => setActiveTab('parceiros')}>
                        <Store size={20} /> <span>Lojistas</span>
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
                            <h1>{activeTab === 'dashboard' ? 'Fiscal' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Hub</h1>
                            <div className="live-indicator-dot" title="Monitoramento em Tempo Real Ativo"></div>
                        </div>
                        <p className="text-muted">Gestão estratégica e financeira da economia Psy Pay.</p>
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

                {/* --- VIEW: DASHBOARD / OVERVIEW --- */}
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in">
                        <div className="stats-grid">
                            <StatCard 
                                label="Custódia Total" 
                                value={`R$ ${fiscal.saldo_usuarios_gerenciado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                icon={Users}
                                color="var(--primary)"
                                trend={null}
                            />
                            <StatCard 
                                label="Receita Bruta (Mês)" 
                                value={`R$ ${fiscal.lucro_plataforma_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                icon={TrendingUp}
                                color="var(--primary)"
                                trend={null}
                            />
                            <StatCard 
                                label="Lucro Líquido Real" 
                                value={`R$ ${fiscal.lucro_real_liquido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                icon={TrendingUp}
                                color="var(--success)"
                                trend={null}
                            />
                            <StatCard 
                                label="Custo Intermediação (Checkout Pro)" 
                                value={`R$ ${fiscal.total_taxas_mp?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                icon={CreditCard}
                                color="#ff4d4d"
                                trend={null}
                            />
                            <StatCard 
                                label="Custos Infra (Mensal)" 
                                value={`R$ ${fiscal.custos_infra_estimados?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                icon={Zap}
                                color="var(--warning)"
                                trend={null}
                            />
                            <StatCard 
                                label="Liquidez do Pool" 
                                value={`R$ ${fiscal.saldo_pool_caixa?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                icon={Banknote}
                                color="var(--secondary)"
                                trend={null}
                            />
                            <StatCard 
                                label="Crédito Ativo" 
                                value={`R$ ${fiscal.total_credito_ativo?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`}
                                icon={ShieldCheck}
                                color="#4da6ff"
                                trend={null}
                            />
                        </div>

                        {/* --- NOVA SEÇÃO: GESTÃO FISCAL --- */}
                        <div className="glass-panel mb-3 animate-fade-in" style={{ borderLeft: '4px solid var(--primary)', marginBottom: '20px' }}>
                            <div className="section-header">
                                <div className="flex-start gap-1">
                                    <ShieldCheck size={20} color="var(--primary)" />
                                    <div>
                                        <h3 style={{ margin: 0 }}>Gestão Fiscal e Auditoria (CPF)</h3>
                                        <p className="text-xs text-muted">Gere documentos para comprovação de custódia e preenchimento de Carnê-Leão.</p>
                                    </div>
                                </div>
                                <div className="flex-start gap-1">
                                    <div className="flex-start gap-1" style={{ background: 'var(--bg-accent)', padding: '5px 10px', borderRadius: '8px' }}>
                                        <div className="text-xs font-bold text-muted">DE:</div>
                                        <input 
                                            type="date" 
                                            value={dataInicio} 
                                            onChange={(e) => setDataInicio(e.target.value)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '12px', outline: 'none' }}
                                        />
                                        <div className="text-xs font-bold text-muted">ATÉ:</div>
                                        <input 
                                            type="date" 
                                            value={dataFim} 
                                            onChange={(e) => setDataFim(e.target.value)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '12px', outline: 'none' }}
                                        />
                                    </div>
                                    <button 
                                        className="btn btn-primary" 
                                        onClick={handleDownloadFiscalPDF}
                                        disabled={loadingFiscalPDF}
                                        style={{ height: '36px', padding: '0 15px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    >
                                        {loadingFiscalPDF ? (
                                            <><RefreshCw size={14} className="spin" /> GERANDO...</>
                                        ) : (
                                            <><BarChart3 size={14} /> GERAR PDF FISCAL</>
                                        )}
                                    </button>

                                    <button 
                                        className="btn" 
                                        onClick={handleExecutarCobranca}
                                        disabled={loadingCobranca}
                                        style={{ 
                                            height: '36px', 
                                            padding: '0 15px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '8px', 
                                            background: '#ff4d4d', 
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {loadingCobranca ? (
                                            <><RefreshCw size={14} className="spin" /> PROCESSANDO...</>
                                        ) : (
                                            <><ShieldAlert size={14} /> EXECUTAR CLÁUSULA 3.3</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="fiscal-grid">
                            <section className="glass-panel">
                                <div className="section-header">
                                    <h3>Aprovações Pendentes</h3>
                                    <span className="text-primary text-xs font-bold pointer" onClick={() => setActiveTab('pendentes')}>VER TODAS</span>
                                </div>
                                {pendentes.length === 0 ? (
                                    <div className="empty-state">Tudo em dia por aqui! <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', opacity: 0.6 }} /></div>
                                ) : (
                                    pendentes.slice(0, 3).map(p => (
                                        <div key={p.transacao_id} className="revenue-item row-hover">
                                            <div className="flex-start gap-1">
                                                <div className="user-avatar">{p.usuario_nome.charAt(0)}</div>
                                                <div>
                                                    <p className="font-bold">{p.usuario_nome}</p>
                                                    <p className="text-xs text-muted">{TIPOS_LABEL[p.tipo]}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold">R$ {p.valor.toLocaleString('pt-BR')}</p>
                                                <p className="text-xs text-muted">{formatarDataBR(p.data)}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </section>

                            <section className="glass-panel">
                                <h3>Saúde do Sistema</h3>
                                <div className="mt-1">
                                    <div className="flex-between">
                                        <div className="stat-label">Processamento (CPU) - {fiscal.cpu_threads || 0} Threads</div>
                                        <span className="text-xs font-bold" style={{ color: (fiscal.cpu_uso > 80) ? 'var(--danger)' : 'var(--primary)' }}>{fiscal.cpu_uso?.toFixed(1) || '0.0'}%</span>
                                    </div>
                                    <div className="progress-bar-bg mb-1">
                                        <div 
                                            className="progress-bar-fill" 
                                            style={{ 
                                                width: `${fiscal.cpu_uso || 0}%`, 
                                                background: (fiscal.cpu_uso > 80) ? 'var(--danger)' : 'var(--primary)' 
                                            }}
                                        ></div>
                                    </div>
                                    <div className="flex-between" style={{ marginTop: '0.5rem' }}>
                                        <div className="stat-label">Memória RAM - {fiscal.ram_total || 0} GB</div>
                                        <span className="text-xs font-bold" style={{ color: (fiscal.ram_uso > 90) ? 'var(--danger)' : 'var(--success)' }}>{fiscal.ram_uso?.toFixed(1) || '0.0'}%</span>
                                    </div>
                                    <div className="progress-bar-bg">
                                        <div 
                                            className="progress-bar-fill" 
                                            style={{ 
                                                width: `${fiscal.ram_uso || 0}%`, 
                                                background: (fiscal.ram_uso > 90) ? 'var(--danger)' : 'var(--success)' 
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {/* --- VIEW: PENDENTES (REFORMULADO) --- */}
                {activeTab === 'pendentes' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Fila de Auditoria Financeira</h3>
                            <div className="flex-start gap-1">
                                <Filter size={16} /> <span className="text-xs">FILTRAR (PENDENTES)</span>
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Usuário</th>
                                        <th>Tipo</th>
                                        <th>Valor</th>
                                        <th>Data/Hora</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendentes.map(p => (
                                        <tr key={p.transacao_id} className="row-hover">
                                            <td>
                                                <div className="flex-start gap-1">
                                                    <div className="user-avatar">{p.usuario_nome.charAt(0)}</div>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <p className="font-bold">{p.usuario_nome}</p>
                                                            {p.tipo === 'desbloqueio_dados' && (
                                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                                    {p.url_rg && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.url_rg)}><Eye size={12} /> RG</button>}
                                                                    {p.url_renda && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.url_renda)}><Eye size={12} /> Renda</button>}
                                                                    {p.url_residencia && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.url_residencia)}><Eye size={12} /> Res.</button>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted">CPF: {p.usuario_cpf}</p>
                                                        {p.detalhes && (
                                                            <p className="text-xs text-primary" style={{ marginTop: '4px', maxWidth: '300px', wordBreak: 'break-all' }}>
                                                                <strong>Nota:</strong> {p.detalhes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-pill ${p.tipo === 'deposito' ? 'status-success' : 'status-danger'}`} style={p.tipo === 'desbloqueio_dados' ? {background: 'var(--primary)', color: 'white'} : {}}>
                                                    {TIPOS_LABEL[p.tipo]}
                                                </span>
                                            </td>
                                            <td className="font-bold">{p.tipo === 'desbloqueio_dados' ? 'GRÁTIS' : `R$ ${p.valor.toLocaleString('pt-BR')}`}</td>
                                            <td className="text-muted text-xs">{formatarDataBR(p.data)}</td>
                                            <td>
                                                <div className="flex-start gap-1">
                                                    <button className="btn btn-icon-small text-danger" onClick={() => handleRejeitar(p.transacao_id)}>
                                                        <XCircle size={18} />
                                                    </button>
                                                    <button className="btn btn-icon-small text-success" onClick={() => handleAprovar(p.transacao_id, p.tipo)}>
                                                        <CheckCircle size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* SEÇÃO: SAQUES RECENTES CONCLUÍDOS (NOVO) */}
                        <div className="section-header mt-3" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={20} color="var(--success)" />
                                <h3>Saques Recentes (Auditoria de Recebimento)</h3>
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Membro</th>
                                        <th>Valor Líquido</th>
                                        <th>Status do Log</th>
                                        <th>Confirmação Cliente</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(adminData.concluidos_recentes || []).map(c => (
                                        <tr key={c.transacao_id} className="row-hover">
                                            <td className="text-xs">
                                                <p className="font-bold">{c.usuario_nome}</p>
                                                <p className="text-muted">{formatarDataBR(c.data)}</p>
                                            </td>
                                            <td className="font-bold">R$ {c.valor.toLocaleString('pt-BR')}</td>
                                            <td className="text-xs text-muted" style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {c.detalhes || 'Sem logs.'}
                                            </td>
                                            <td>
                                                {c.confirmado_cliente ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 700 }}>
                                                        <CheckCircle2 size={16} /> Recebido em {new Date(c.data_confirmacao_cliente).toLocaleDateString('pt-BR')}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)', fontSize: '0.75rem' }}>
                                                        <Timer size={16} /> Aguardando Confirmação
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- VIEW: FINANCEIRO (DETALHAMENTO 10%) --- */}
                {activeTab === 'fiscal' && (
                    <div className="animate-fade-in">
                        <div className="fiscal-grid">
                            <section className="glass-panel">
                                <h3>Detalhamento de Receitas</h3>
                                <p className="text-muted text-xs mb-2">Monitoramento da saúde operacional da Psy Pay.</p>
                                
                                <div className="grid-2">
                                    <div className="revenue-item">
                                        <span className="info-label">KYC & Score</span>
                                        <span className="font-bold">R$ {fiscal.detalhamento_lucro.kyc_score?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item">
                                        <span className="info-label">Taxas de Saque</span>
                                        <span className="font-bold">R$ {fiscal.detalhamento_lucro.taxas_saque?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item" style={{ border: '1px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                                        <span className="info-label text-primary">Comissão Gestão (10%)</span>
                                        <span className="font-bold text-primary">R$ {fiscal.detalhamento_lucro.taxa_adm_emprestimo?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item">
                                        <span className="info-label">Intermediação P2P</span>
                                        <span className="font-bold">R$ {fiscal.detalhamento_lucro.taxa_intermediacao?.toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div className="revenue-item">
                                        <span className="info-label">Aportes Institucionais</span>
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
                                        <span className="info-label" style={{ color: '#ff4d4d' }}>Bonificações (Marketplace)</span>
                                        <span className="font-bold" style={{ color: '#ff4d4d' }}>- R$ {fiscal.detalhamento_lucro.premios_marketplace?.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                            </section>

                            <section className="glass-panel">
                                <h3>Ações de Caixa</h3>
                                <div className="flex-column gap-1 mt-1">
                                    <button className="btn btn-primary w-full gap-1" onClick={() => handleOpenAcao('saque')}>
                                        <ArrowUpRight size={18} /> Resgatar Lucro Líquido
                                    </button>
                                    <button className="btn btn-outline w-full gap-1" onClick={() => handleOpenAcao('aporte')}>
                                        <PlusCircle size={18} /> Injetar Capital (Aporte)
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                )}

                {/* --- VIEW: EMPRÉSTIMOS ATIVOS --- */}
                {activeTab === 'emprestimos' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Gestão de Crédito Ativo</h3>
                            <div className="flex-start gap-1">
                                <Zap size={16} color="var(--primary)" /> <span>Monitoramento P2P</span>
                            </div>
                        </div>

                        <div className="grid-2">
                            {solicitacoesAtivas.length === 0 ? (
                                <div className="empty-state">Nenhuma solicitação aguardando aporte institucional no momento.</div>
                            ) : (
                                solicitacoesAtivas.map(sa => (
                                    <div key={sa.id} className="revenue-item" style={{ flexDirection: 'column', gap: '8px' }}>
                                        <div className="flex-between">
                                            <p className="font-bold">{sa.tomador}</p>
                                            <span className="text-xs text-primary">Score {sa.score}</span>
                                        </div>
                                        <div className="progress-bar-bg">
                                            <div 
                                                className="progress-bar-fill" 
                                                style={{ width: `${(sa.valor_arrecadado / sa.valor) * 100}%`, background: 'var(--primary)' }}
                                            ></div>
                                        </div>
                                        <div className="flex-between text-xs text-muted">
                                            <span>R$ {sa.valor_arrecadado.toLocaleString('pt-BR')} / R$ {sa.valor.toLocaleString('pt-BR')}</span>
                                            <span>Juros {sa.taxa}% a.m</span>
                                        </div>
                                        <button className="btn btn-primary text-xs py-1 mt-1">Investimento Institucional</button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'parceiros' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Parceiros de Caixa (Lojistas)</h3>
                            <button className="btn btn-primary text-xs gap-1" onClick={() => setShowNovoParceiroModal(true)}>
                                <PlusCircle size={16} /> Novo Parceiro
                            </button>
                        </div>
                        
                        {parceiros.length === 0 ? (
                            <div className="empty-state">
                                <Store size={48} className="mb-1 opacity-20" />
                                <p>Nenhum parceiro cadastrado.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Nome do Ponto</th>
                                            <th>ID Dono</th>
                                            <th>Status Caixa</th>
                                            <th>Prazo / Taxa</th>
                                            <th>Saldo Atual</th>
                                            <th>Comissões</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parceiros.map(p => (
                                            <tr key={p.id} className="row-hover">
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        <div className="user-avatar" style={{ background: 'var(--secondary)' }}><Store size={14} /></div>
                                                        <div>
                                                            <p className="font-bold">{p.nome}</p>
                                                            <p className="text-xs text-muted">{p.endereco}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="text-xs font-mono">{p.usuario_id || 'Sem Vínculo'}</span>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${p.caixa_aberto ? 'status-success' : 'status-danger'}`}>
                                                        {p.caixa_aberto ? 'ABERTO' : 'FECHADO'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex-column" style={{ gap: '2px' }}>
                                                        <span className="text-xs font-bold text-primary" style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content' }}>
                                                            D+{p.prazo_liquidacao || 0}
                                                        </span>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                            {p.taxa_comissao}% comissão
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="text-primary font-bold">R$ {p.saldo_atual.toLocaleString('pt-BR')}</td>
                                                <td className="text-success">R$ {p.comissao.toLocaleString('pt-BR')}</td>
                                                <td>
                                                    <button 
                                                        className="btn btn-outline btn-danger text-xs p-1"
                                                        title="Excluir Parceiro"
                                                        onClick={() => {
                                                            setParceiroParaExcluir(p);
                                                            setShowExcluirParceiroModal(true);
                                                        }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'usuarios' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3>Gestão de Membros</h3>
                            <div className="search-bar">
                                <Search size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome ou CPF..." 
                                    value={filtroUsuarios}
                                    onChange={(e) => setFiltroUsuarios(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Membro</th>
                                        <th>Score</th>
                                        <th>Saldo Conta</th>
                                        <th>Saldo Pool</th>
                                        <th>Status</th>
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
                                                        <p className="text-xs text-muted">{u.cpf}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="text-primary font-bold">{u.score}</span>
                                            </td>
                                            <td>R$ {u.saldo.toLocaleString('pt-BR')}</td>
                                            <td>
                                                <div className="flex-start gap-1">
                                                    R$ {u.saldo_caixa.toLocaleString('pt-BR')}
                                                    {u.is_good_payer && (
                                                        <span className="loyalty-badge" title="Bônus Fidelidade 1.5x Ativo" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Star size={12} color="var(--warning)" fill="var(--warning)" /> 1.5x
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span className={`status-pill ${u.is_verified ? 'status-success' : 'status-warning'}`}>
                                                        {u.is_verified ? 'Verificado' : 'Pendente'}
                                                    </span>
                                                    <button className="btn btn-outline text-xs" onClick={() => { setLimiteData({ id: u.id, valor: '' }); setShowLimiteModal(true); }}>
                                                        Ajustar Limite
                                                    </button>
                                                </div>
                                            </td>
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
