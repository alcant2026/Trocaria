import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
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
    Eye
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

    const [kycPendentes, setKycPendentes] = useState([]);
    
    // Limits
    const [showLimiteModal, setShowLimiteModal] = useState(false);
    const [limiteData, setLimiteData] = useState({ id: null, valor: '' });

    useEffect(() => {
        carregarSnapshot();
    }, []);

    const carregarSnapshot = async () => {
        setLoading(true);
        try {
            const res = await api.get('/snapshot');
            setSnapshot(res);
            try {
                const kycRes = await api.get('/financeiro/admin/kyc-pendentes');
                setKycPendentes(kycRes || []);
            } catch(e) { console.error("Erro kyc", e); }
        } catch (err) {
            setMensagem('Erro ao carregar dados: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    const adminData = snapshot?.admin || {};
    const fiscal = adminData.fiscal || {};
    const pendentes = adminData.pendentes || [];
    const usuarios = adminData.gestao_usuarios || [];
    const solicitacoesAtivas = adminData.solicitacoes_ativas || [];
    const parceiros = adminData.gestao_parceiros || [];

    // --- LOGICA DE AÇÕES ---
    const handleAbrirDocumento = async (usuario_id, tipo) => {
        try {
            const blob = await api.getBlob(`/financeiro/admin/view-doc/${usuario_id}/${tipo}`);
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (err) {
            setMensagem('Erro ao baixar documento: ' + err.message);
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

    const handleAprovar = async (id, tipo) => {
        try {
            const res = await api.post(`/financeiro/admin/confirmar/${id}`, { tipo });
            setMensagem(res.message || 'Operação aprovada!');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        }
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
            const endpoint = acaoTipo === 'saque' ? '/financeiro/admin/sacar-lucro' : '/financeiro/admin/aportar-lucro';
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
                        <h1>{activeTab === 'dashboard' ? 'Fiscal' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Hub</h1>
                        <p className="text-muted">Gestão estratégica e financeira da economia Psy Pay.</p>
                    </div>
                    
                    <div className="header-actions">
                        <button className="btn btn-icon" onClick={carregarSnapshot} title="Sincronizar Dados">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {mensagem && (
                    <div className={`alert ${mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'} mb-2`}>
                        <span>{mensagem}</span>
                        <XCircle size={18} onClick={() => setMensagem('')} />
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
                                label="Lucro Líquido Real" 
                                value={`R$ ${fiscal.lucro_real_liquido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                icon={TrendingUp}
                                color="var(--success)"
                                trend={null}
                            />
                            <StatCard 
                                label="Taxas Mercado Pago" 
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
                                    <div className="stat-label">Uso do Pool (Alocação)</div>
                                    <div className="progress-bar-bg mb-1">
                                        <div 
                                            className="progress-bar-fill" 
                                            style={{ 
                                                width: `${Math.min(100, (fiscal.total_credito_ativo / (fiscal.saldo_pool_caixa || 1)) * 100)}%`, 
                                                background: 'var(--primary)' 
                                            }}
                                        ></div>
                                    </div>
                                    <div className="stat-label">Eficiência de Operação</div>
                                    <div className="progress-bar-bg">
                                        <div 
                                            className="progress-bar-fill" 
                                            style={{ 
                                                width: `${Math.min(100, (fiscal.lucro_plataforma_historico / (fiscal.saldo_pool_caixa || 1)) * 20)}%`, 
                                                background: 'var(--success)' 
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
                                <Filter size={16} /> <span className="text-xs">FILTRAR</span>
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
                                                                    {p.tem_rg && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.usuario_id, 'rg')}><Eye size={12} /> RG</button>}
                                                                    {p.tem_renda && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.usuario_id, 'renda')}><Eye size={12} /> Renda</button>}
                                                                    {p.tem_residencia && <button className="btn-doc-mini" onClick={() => handleAbrirDocumento(p.usuario_id, 'residencia')}><Eye size={12} /> Res.</button>}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted">CPF: {p.usuario_cpf}</p>
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
                                </div>
                            </section>

                            <section className="glass-panel">
                                <h3>Ações de Caixa</h3>
                                <div className="flex-column gap-1 mt-1">
                                    <button className="btn btn-primary w-full gap-1" onClick={() => handleOpenAcao('saque')}>
                                        <ArrowUpRight size={18} /> Resgatar Lucro
                                    </button>
                                    <button className="btn btn-outline w-full gap-1" onClick={() => handleOpenAcao('aporte')}>
                                        <PlusCircle size={18} /> Injetar Capital
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
                            <button className="btn btn-primary text-xs gap-1">
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
                                            <th>Status Caixa</th>
                                            <th>Endereço</th>
                                            <th>Saldo Atual</th>
                                            <th>Comissões</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parceiros.map(p => (
                                            <tr key={p.id} className="row-hover">
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        <div className="user-avatar" style={{ background: 'var(--secondary)' }}><Store size={14} /></div>
                                                        <p className="font-bold">{p.nome}</p>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`status-pill ${p.caixa_aberto ? 'status-success' : 'status-danger'}`}>
                                                        {p.caixa_aberto ? 'ABERTO' : 'FECHADO'}
                                                    </span>
                                                </td>
                                                <td className="text-xs text-muted">{p.endereco}</td>
                                                <td className="text-primary font-bold">R$ {p.saldo_atual.toLocaleString('pt-BR')}</td>
                                                <td className="text-success">R$ {p.comissao.toLocaleString('pt-BR')}</td>
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
                onClose={() => setShowAcaoModal(false)}
                title={acaoTipo === 'saque' ? 'Resgatar Lucro Líquido' : 'Injetar Capital na Plataforma'}
                message={acaoTipo === 'saque' ? 'Retirada de lucro disponível direto do caixa livre da Psy Pay.' : 'Aporte de recurso externo para aumentar o patrimônio da plataforma.'}
                type={acaoTipo === 'saque' ? 'warning' : 'info'}
                onConfirm={confirmarAcaoCaixa}
                confirmText={acaoTipo === 'saque' ? 'Confirmar Resgate' : 'Confirmar Aporte'}
                loading={loadingAcao}
            >
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
                    <div className="input-group mb-1">
                        <label>Chave PIX {acaoTipo === 'saque' ? 'de Destino (Para onde vai o dinheiro)' : 'de Origem (De onde veio o dinheiro)'}</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Ex: financeiro@psypay.com"
                            value={acaoData.chave_pix}
                            onChange={(e) => setAcaoData({ ...acaoData, chave_pix: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label>Motivo ou Justificativa</label>
                        <textarea
                            className="input-field"
                            placeholder={acaoTipo === 'saque' ? 'Ex: Distribuição de lucros aos sócios...' : 'Ex: Aporte do investidor, injetado no mercado...'}
                            value={acaoData.motivo}
                            onChange={(e) => setAcaoData({ ...acaoData, motivo: e.target.value })}
                        />
                    </div>
                </div>
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
        </div>
    );
};

export default AdminDashboard;
