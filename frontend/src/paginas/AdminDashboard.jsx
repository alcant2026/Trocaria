import React, { useState, useEffect, useMemo } from 'react';
import api, { BASE_URL } from '../api';
import PagamentosRanking from '../componentes/PagamentosRanking';
import './AdminDashboard.css';
import {
    LayoutDashboard, ShieldCheck, Users, TrendingUp, ListTodo,
    BarChart3, Clock, CheckCircle, XCircle, User, ArrowUpRight,
    ArrowDownRight, Copy, Check, ExternalLink, Search, Filter,
    Store, CreditCard, Zap, PlusCircle, Undo2, RefreshCw,
    Sparkles, Star, Eye, Trophy, Trash2, Timer, History,
    AlertCircle, X, ShieldAlert, AlertTriangle, DollarSign,
    Package, Ban, UserCheck, FileText, Image, Edit3,
    ChevronDown, ChevronUp, Globe, Phone, Mail, MessageSquare,
    Gavel, ThumbsUp, ThumbsDown, Activity, ShoppingBag, Scale,
} from 'lucide-react';
import ModalPremium from '../componentes/ModalPremium';

const formatarDataBR = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const formatarMoeda = (v) =>
    `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const StatCard = ({ label, value, icon: Icon, color, subtitle }) => (
    <div className="stat-card">
        <div className="stat-header">
            <span className="stat-label">{label}</span>
            <Icon size={20} color={color} style={{ opacity: 0.5 }} />
        </div>
        <div className="stat-value" style={{ color }}>{value}</div>
        {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
);

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mensagem, setMensagem] = useState('');
    const [pixCopiado, setPixCopiado] = useState(null);
    const [filtroUsuarios, setFiltroUsuarios] = useState('');

    const [showRejeitarModal, setShowRejeitarModal] = useState(false);
    const [rejeicaoData, setRejeicaoData] = useState({ id: null, motivo: '' });
    const [loadingRejeicao, setLoadingRejeicao] = useState(false);

    // Resgates de Pontos
    const [resgates, setResgates] = useState([]);
    const [loadingResgates, setLoadingResgates] = useState(false);

    // Produtos CRUD
    const [produtos, setProdutos] = useState([]);
    const [loadingProdutos, setLoadingProdutos] = useState(false);
    const [showProdutoModal, setShowProdutoModal] = useState(false);
    const [editandoProduto, setEditandoProduto] = useState(null);
    const [formProduto, setFormProduto] = useState({ nome: '', descricao: '', valor_reais: '', quantidade_disponivel: 1, foto_url: '' });

    // Denúncias
    const [denunciasData, setDenunciasData] = useState([]);
    const [expandedDenuncia, setExpandedDenuncia] = useState(null);

    // Disputas
    const [disputas, setDisputas] = useState([]);
    const [loadingDisputas, setLoadingDisputas] = useState(false);

    // Data para fiscal
    const [dataInicio, setDataInicio] = useState(
        new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
    );
    const [dataFim, setDataFim] = useState(
        new Date().toISOString().split('T')[0]
    );
    const [loadingFiscalPDF, setLoadingFiscalPDF] = useState(false);

    useEffect(() => {
        carregarSnapshot();
        const autoRefresh = setInterval(() => carregarSnapshot(true), 30000);
        return () => clearInterval(autoRefresh);
    }, []);

    const carregarSnapshot = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/snapshot');
            setSnapshot(res);
            const admin = res?.admin || {};
            setDenunciasData(admin.denuncias || []);
        } catch (err) {
            if (!silent) setMensagem('Erro: ' + (err.message || err));
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const adminData = snapshot?.admin || {};
    const fiscal = adminData.fiscal || {};
    const pendentes = adminData.pendentes || [];
    const usuarios = adminData.gestao_usuarios || [];

    const handleDownloadFiscalPDF = async () => {
        try {
            setLoadingFiscalPDF(true);
            const blob = await api.getBlob(`/admin/fiscal/pdf?inicio=${dataInicio}&fim=${dataFim}`);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `DEMONSTRATIVO_FISCAL_${dataInicio}_A_${dataFim}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setMensagem('Erro ao baixar PDF: ' + err.message);
        } finally {
            setLoadingFiscalPDF(false);
        }
    };

    const handleAbrirDocumento = (url) => {
        if (!url) { setMensagem('Documento não encontrado.'); return; }
        let fullUrl = url;
        if (url.startsWith('/api')) {
            fullUrl = `${BASE_URL.replace('/api', '')}${url}`;
        } else if (!url.startsWith('http')) {
            fullUrl = `${BASE_URL}${url}`;
        }
        const token = api.getToken();
        if (token) fullUrl += `${fullUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
    };

    const handleAprovarKYC = async (p) => {
        if (!window.confirm(`Aprovar verificação de ${p.usuario_nome}?`)) return;
        try {
            await api.post(`/financeiro/admin/confirmar/${p.transacao_id || p.id}`);
            setMensagem(`✅ ${p.usuario_nome} verificado!`);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.message || err));
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
            setMensagem('Erro: ' + (err.message || err));
        } finally {
            setLoadingRejeicao(false);
        }
    };

    const copiarPix = (chave, id) => {
        navigator.clipboard.writeText(chave);
        setPixCopiado(id);
        setTimeout(() => setPixCopiado(null), 2000);
    };

    // ==================== USUÁRIOS ====================
    const handleSuspender = async (userId, nome) => {
        const motivo = prompt(`Motivo para suspender ${nome}:`);
        if (!motivo) return;
        try {
            await api.post(`/financeiro/admin/suspender/${userId}`, { motivo });
            setMensagem(`🚫 ${nome} suspenso.`);
            carregarSnapshot();
        } catch (err) { setMensagem('Erro: ' + (err.message || err)); }
    };

    const handleReativar = async (userId, nome) => {
        if (!window.confirm(`Reativar ${nome}?`)) return;
        try {
            await api.post(`/financeiro/admin/reativar/${userId}`);
            setMensagem(`✅ ${nome} reativado.`);
            carregarSnapshot();
        } catch (err) { setMensagem('Erro: ' + (err.message || err)); }
    };

    const usuariosFiltrados = useMemo(() =>
        usuarios.filter(u =>
            u.nome.toLowerCase().includes(filtroUsuarios.toLowerCase()) ||
            u.cpf.includes(filtroUsuarios) ||
            u.email?.toLowerCase().includes(filtroUsuarios.toLowerCase())
        ), [usuarios, filtroUsuarios]);

    // ==================== RESGATES ====================
    const carregarResgates = async () => {
        setLoadingResgates(true);
        try {
            const data = await api.get('/marketplace/admin/resgates-pendentes');
            setResgates(data || []);
        } catch (e) { console.error(e); }
        setLoadingResgates(false);
    };

    const handleAprovarResgate = async (id) => {
        if (!confirm('Confirmar resgate? O admin deve enviar o PIX.')) return;
        try {
            const res = await api.post('/marketplace/admin/aprovar-resgate/' + id);
            setMensagem(res.message);
            carregarResgates();
        } catch (e) { setMensagem('Erro: ' + (e.message || e)); }
    };

    const handleRejeitarResgate = async (id) => {
        if (!confirm('Rejeitar resgate? Pontos serão devolvidos.')) return;
        try {
            const res = await api.post('/marketplace/admin/rejeitar-resgate/' + id);
            setMensagem(res.message);
            carregarResgates();
        } catch (e) { setMensagem('Erro: ' + (e.message || e)); }
    };

    // ==================== PRODUTOS ====================
    const carregarProdutos = async () => {
        setLoadingProdutos(true);
        try {
            const data = await api.get('/admin/produtos');
            setProdutos(data || []);
        } catch (e) { console.error(e); }
        setLoadingProdutos(false);
    };

    const abrirNovoProduto = () => {
        setEditandoProduto(null);
        setFormProduto({ nome: '', descricao: '', valor_reais: '', quantidade_disponivel: 1, foto_url: '' });
        setShowProdutoModal(true);
    };

    const abrirEditarProduto = (p) => {
        setEditandoProduto(p);
        setFormProduto({
            nome: p.nome,
            descricao: p.descricao || '',
            valor_reais: String(p.valor_reais),
            quantidade_disponivel: p.quantidade_disponivel,
            foto_url: p.foto_url || '',
        });
        setShowProdutoModal(true);
    };

    const salvarProduto = async () => {
        if (!formProduto.nome || !formProduto.valor_reais) {
            setMensagem('Nome e valor são obrigatórios.');
            return;
        }
        try {
            if (editandoProduto) {
                await api.put(`/admin/produtos/${editandoProduto.id}`, formProduto);
                setMensagem('✅ Produto atualizado!');
            } else {
                await api.post('/admin/produtos', formProduto);
                setMensagem('✅ Produto criado!');
            }
            setShowProdutoModal(false);
            carregarProdutos();
        } catch (err) { setMensagem('Erro: ' + (err.message || err)); }
    };

    const handleDeletarProduto = async (id, nome) => {
        if (!window.confirm(`Deletar "${nome}"?`)) return;
        try {
            await api.delete(`/admin/produtos/${id}`);
            setMensagem(`🗑️ ${nome} removido.`);
            carregarProdutos();
        } catch (err) { setMensagem('Erro: ' + (err.message || err)); }
    };

    // ==================== DENÚNCIAS ====================
    const handleRevisarDenuncia = async (id) => {
        try {
            await api.post(`/financeiro/admin/denuncias/${id}/revisar`);
            setMensagem('Denúncia revisada.');
            carregarSnapshot();
        } catch (err) { setMensagem('Erro: ' + (err.message || err)); }
    };

    // ==================== DISPUTAS ====================
    const carregarDisputas = async () => {
        setLoadingDisputas(true);
        try {
            const data = await api.get('/admin/disputas');
            setDisputas(data || []);
        } catch (e) { console.error(e); }
        setLoadingDisputas(false);
    };

    const handleResolverDisputa = async (id, decisao, notapublica) => {
        try {
            await api.post(`/admin/disputas/${id}/resolver`, { decisao, notapublica });
            setMensagem('Disputa resolvida!');
            carregarDisputas();
        } catch (err) { setMensagem('Erro: ' + (err.message || err)); }
    };

    // ==================== RENDER ====================
    if (loading && !snapshot) {
        return (
            <div className="flex-center" style={{ height: '100vh', background: 'var(--bg-dark)', color: 'var(--primary)' }}>
                <Zap className="animate-pulse" size={48} />
                <p className="ml-1 font-bold">Iniciando TROCARIA Cyber-Hub...</p>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            {/* SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="sidebar-logo">
                    <Zap size={28} />
                    <span>TROCARIA</span>
                    <span className="live-dot" />
                </div>
                <nav className="sidebar-nav">
                    {[
                        { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                        { key: 'pendentes', icon: ListTodo, label: 'Aprovações', badge: kycPendentes => pendentes.filter(p => p.tipo === 'desbloqueio_dados').length },
                        { key: 'financeiro', icon: BarChart3, label: 'Financeiro' },
                        { key: 'denuncias', icon: Gavel, label: 'Denúncias', badge: () => denunciasData.length },
                        { key: 'usuarios', icon: Users, label: 'Usuários' },
                        { key: 'produtos', icon: Package, label: 'Produtos' },
                        { key: 'disputas', icon: Scale, label: 'Disputas', badge: () => disputas.filter(d => d.status === 'aberta' || d.status === 'em_andamento').length },
                        { key: 'resgates', icon: Sparkles, label: 'Resgates' },
                        { key: 'ranking', icon: Trophy, label: 'Ranking' },
                    ].map(item => (
                        <div
                            key={item.key}
                            className={`nav-item ${activeTab === item.key ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab(item.key);
                                if (item.key === 'resgates') carregarResgates();
                                if (item.key === 'produtos') carregarProdutos();
                                if (item.key === 'disputas') carregarDisputas();
                            }}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                            {item.badge && item.badge() > 0 && (
                                <span className="badge-notification">{item.badge()}</span>
                            )}
                        </div>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div className="nav-item" onClick={() => window.location.hash = 'cliente'}>
                        <Undo2 size={18} /> <span>Sair do Painel</span>
                    </div>
                </div>
            </aside>

            {/* MAIN */}
            <main className="admin-main">
                <header className="admin-header">
                    <div>
                        <h1 className="header-title">Painel Administrativo</h1>
                        <p className="text-muted" style={{ fontSize: '0.85rem' }}>TROCARIA • Classificados Gratuitos • Marketplace</p>
                    </div>
                    <div className="flex-start gap-1">
                        <div className="live-indicator"><span className="live-dot" /> Ao vivo</div>
                        <button className="btn btn-icon" onClick={() => carregarSnapshot()} title="Sincronizar">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </header>

                {mensagem && (
                    <div className={`alert ${mensagem.includes('Erro') ? 'alert-danger' : 'alert-success'} mb-1`}>
                        <span>{mensagem}</span>
                        <button onClick={() => setMensagem('')} className="alert-close"><X size={16} /></button>
                    </div>
                )}

                {/* ==================== DASHBOARD ==================== */}
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in">
                        <div className="stats-grid">
                            <StatCard label="Usuários" value={usuarios.length} icon={Users} color="var(--primary)" />
                            <StatCard label="Vendas Concluídas" value={fiscal.total_vendas || 0} icon={TrendingUp} color="var(--success)" />
                            <StatCard label="Anúncios Ativos" value={fiscal.total_anuncios_ativos || 0} icon={Store} color="var(--secondary)" />
                            <StatCard label="KYC Pendentes" value={pendentes.filter(p => p.tipo === 'desbloqueio_dados').length || 0} icon={ShieldCheck} color="var(--warning)" />
                            <StatCard label="Denúncias" value={fiscal.denuncias_pendentes || 0} icon={Gavel} color="var(--danger)" />
                            <StatCard label="Comissões Recebidas" value={formatarMoeda(fiscal.total_comissoes)} icon={DollarSign} color="var(--success)" />
                            <StatCard label="Comissões Pendentes" value={formatarMoeda(fiscal.total_comissoes_pendentes)} icon={Clock} color="var(--warning)" />
                            <StatCard label="Produtos Resgate" value={fiscal.total_produtos || 0} icon={Package} color="var(--primary)" />
                            <StatCard label="Receita Líquida (mês)" value={formatarMoeda(fiscal.lucro_plataforma_total)} icon={BarChart3} color="var(--primary)" />
                            <StatCard label="Receita Histórica" value={formatarMoeda(fiscal.lucro_plataforma_historico)} icon={BarChart3} color="var(--secondary)" />
                        </div>

                        <div className="glass-panel mt-2">
                            <h3>Histórico Mensal de Receita</h3>
                            <div className="chart-bars">
                                {(fiscal.historico_mensal || []).map((h, i) => {
                                    const maxVal = Math.max(...(fiscal.historico_mensal || []).map(x => x.lucro), 1);
                                    const pct = (h.lucro / maxVal) * 100;
                                    return (
                                        <div key={i} className="chart-bar-item">
                                            <div className="chart-bar-value">{formatarMoeda(h.lucro)}</div>
                                            <div className="chart-bar" style={{ height: `${Math.max(pct, 5)}%` }} />
                                            <div className="chart-bar-label">{h.mes?.slice(-2)}</div>
                                        </div>
                                    );
                                })}
                                {(!fiscal.historico_mensal || fiscal.historico_mensal.length === 0) && (
                                    <p className="text-muted">Nenhum dado histórico disponível.</p>
                                )}
                            </div>
                        </div>

                        <div className="glass-panel mt-1">
                            <h3>Sistema</h3>
                            <div className="grid-3">
                                <div className="stat-mini"><span>CPU</span><strong>{fiscal.cpu_uso || 0}%</strong></div>
                                <div className="stat-mini"><span>RAM</span><strong>{fiscal.ram_uso || 0}%</strong></div>
                                <div className="stat-mini"><span>Threads</span><strong>{fiscal.cpu_threads || 0}</strong></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== APROVAÇÕES (KYC) ==================== */}
                {activeTab === 'pendentes' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3><ShieldCheck size={20} /> Verificações KYC Pendentes</h3>
                        </div>
                        {pendentes.filter(p => p.tipo === 'desbloqueio_dados').length === 0 ? (
                            <div className="empty-state">
                                <ShieldCheck size={48} className="mb-1 opacity-20" />
                                <p>Nenhuma verificação pendente.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead><tr><th>Usuário</th><th>CPF</th><th>Documentos</th><th>Ações</th></tr></thead>
                                    <tbody>
                                        {pendentes.filter(p => p.tipo === 'desbloqueio_dados').map(p => (
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
                                                        <button className="btn btn-icon-small text-success" onClick={() => handleAprovarKYC(p)}><CheckCircle size={18} /></button>
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

                {/* ==================== FINANCEIRO ==================== */}
                {activeTab === 'financeiro' && (
                    <div className="animate-fade-in">
                        <div className="stats-grid">
                            <StatCard label="Receita Líquida (mês)" value={formatarMoeda(fiscal.lucro_plataforma_total)} icon={DollarSign} color="var(--success)" subtitle="Taxas de serviço" />
                            <StatCard label="Receita Histórica Total" value={formatarMoeda(fiscal.lucro_plataforma_historico)} icon={BarChart3} color="var(--primary)" subtitle="Desde o início" />
                            <StatCard label="Comissões Recebidas" value={formatarMoeda(fiscal.total_comissoes)} icon={TrendingUp} color="var(--success)" subtitle="3% sobre vendas" />
                            <StatCard label="Comissões Pendentes" value={formatarMoeda(fiscal.total_comissoes_pendentes)} icon={Clock} color="var(--warning)" subtitle="Aguardando pagamento" />
                            <StatCard label="Taxas MP (est.)" value={formatarMoeda(fiscal.total_taxas_mp)} icon={CreditCard} color="var(--danger)" subtitle="1% do processado" />
                            <StatCard label="Vendas Concluídas" value={fiscal.total_vendas || 0} icon={ShoppingBag} color="var(--secondary)" subtitle="Total na plataforma" />
                        </div>

                        <div className="glass-panel mt-2">
                            <div className="section-header">
                                <h3>Relatório Fiscal PDF</h3>
                            </div>
                            <div className="flex-start gap-1">
                                <div>
                                    <label className="text-xs text-muted">De</label>
                                    <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-muted">Até</label>
                                    <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                                </div>
                                <button className="btn btn-primary" onClick={handleDownloadFiscalPDF} disabled={loadingFiscalPDF} style={{ marginTop: '18px' }}>
                                    <FileText size={16} /> {loadingFiscalPDF ? 'Gerando...' : 'Baixar PDF'}
                                </button>
                            </div>
                        </div>

                        <div className="glass-panel mt-1">
                            <h3>Histórico Mensal</h3>
                            <div className="chart-bars">
                                {(fiscal.historico_mensal || []).map((h, i) => {
                                    const maxVal = Math.max(...(fiscal.historico_mensal || []).map(x => x.lucro), 1);
                                    const pct = (h.lucro / maxVal) * 100;
                                    return (
                                        <div key={i} className="chart-bar-item">
                                            <div className="chart-bar-value">{formatarMoeda(h.lucro)}</div>
                                            <div className="chart-bar" style={{ height: `${Math.max(pct, 5)}%` }} />
                                            <div className="chart-bar-label">{h.mes?.slice(-2)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ==================== DENÚNCIAS ==================== */}
                {activeTab === 'denuncias' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3><Gavel size={20} /> Denúncias Pendentes ({denunciasData.length})</h3>
                            <button className="btn btn-sm btn-outline" onClick={() => carregarSnapshot()}><RefreshCw size={14} /> Atualizar</button>
                        </div>
                        {denunciasData.length === 0 ? (
                            <div className="empty-state">
                                <ThumbsUp size={48} className="mb-1 opacity-20" />
                                <p>Nenhuma denúncia pendente.</p>
                            </div>
                        ) : (
                            <div className="denuncias-list">
                                {denunciasData.map(d => (
                                    <div key={d.id} className={`denuncia-card ${d.denunciado_is_active === false ? 'suspended' : ''}`}>
                                        <div className="denuncia-header">
                                            <div className="denuncia-users">
                                                <div className="user-tag">
                                                    <User size={14} />
                                                    <span className="font-bold">{d.denunciante_nome}</span>
                                                    <span className="text-xs text-muted">(denunciante)</span>
                                                </div>
                                                <AlertTriangle size={16} className="text-danger" />
                                                <div className="user-tag">
                                                    <User size={14} />
                                                    <span className="font-bold">{d.denunciado_nome}</span>
                                                    {!d.denunciado_is_active && <span className="status-pill status-danger ml-1">SUSPENSO</span>}
                                                </div>
                                            </div>
                                            <div className="flex-start gap-1">
                                                <button className="btn btn-sm btn-primary" onClick={() => handleRevisarDenuncia(d.id)}>
                                                    <CheckCircle size={14} /> Revisar
                                                </button>
                                                {d.denunciado_is_active !== false && (
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleSuspender(d.denunciado_id, d.denunciado_nome)}>
                                                        <Ban size={14} /> Suspender
                                                    </button>
                                                )}
                                                {d.denunciado_is_active === false && (
                                                    <button className="btn btn-sm btn-outline" onClick={() => handleReativar(d.denunciado_id, d.denunciado_nome)}>
                                                        <UserCheck size={14} /> Reativar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {d.motivo && (
                                            <div className="denuncia-motivo">
                                                <MessageSquare size={14} className="text-muted" />
                                                <span>"{d.motivo}"</span>
                                            </div>
                                        )}
                                        <div className="denuncia-footer">
                                            <Clock size={12} className="text-muted" />
                                            <span className="text-xs text-muted">{formatarDataBR(d.data)}</span>
                                            <span className="text-xs text-muted">ID: {d.id}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== USUÁRIOS ==================== */}
                {activeTab === 'usuarios' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3><Users size={20} /> Usuários ({usuarios.length})</h3>
                            <div className="search-bar">
                                <Search size={16} />
                                <input type="text" placeholder="Nome, CPF ou email..." value={filtroUsuarios}
                                    onChange={e => setFiltroUsuarios(e.target.value)} />
                            </div>
                        </div>
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Usuário</th>
                                        <th>Status</th>
                                        <th>Vendas</th>
                                        <th>Comissão</th>
                                        <th>2FA</th>
                                        <th>Premium</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usuariosFiltrados.map(u => (
                                        <tr key={u.id} className={`row-hover ${!u.is_active ? 'row-suspended' : ''}`}>
                                            <td>
                                                <div className="flex-start gap-1">
                                                    <div className="user-avatar">{u.nome.charAt(0)}</div>
                                                    <div>
                                                        <p className="font-bold">{u.nome}</p>
                                                        <p className="text-xs text-muted">{u.cpf} • ID: {u.id}</p>
                                                        {u.email && <p className="text-xs text-muted">{u.email}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex-column gap-0-5">
                                                    {u.is_active === false ? (
                                                        <span className="status-pill status-danger">Suspenso</span>
                                                    ) : (
                                                        <span className="status-pill status-success">Ativo</span>
                                                    )}
                                                    {u.is_verified && <span className="status-pill status-info">Verif.</span>}
                                                    {u.is_admin && <span className="status-pill status-warning">Admin</span>}
                                                </div>
                                            </td>
                                            <td><span className="font-bold">{u.vendas_completadas || 0}</span></td>
                                            <td>
                                                {u.comissao_devida > 0 ? (
                                                    <span className="text-warning font-bold">{formatarMoeda(u.comissao_devida)}</span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                            <td>{u.two_factor_enabled ? <CheckCircle size={16} className="text-success" /> : <XCircle size={16} className="text-muted" />}</td>
                                            <td>{u.is_subscriber ? <span className="status-pill status-warning">Premium</span> : '—'}</td>
                                            <td>
                                                <div className="flex-start gap-0-5" style={{ flexWrap: 'wrap' }}>
                                                    {u.chave_pix && (
                                                        <button className="btn btn-icon-small text-primary" onClick={() => copiarPix(u.chave_pix, u.id)} title="Copiar PIX">
                                                            {pixCopiado === u.id ? <Check size={14} /> : <Copy size={14} />}
                                                        </button>
                                                    )}
                                                    {u.is_active !== false && !u.is_admin && (
                                                        <button className="btn btn-icon-small text-danger" onClick={() => handleSuspender(u.id, u.nome)} title="Suspender">
                                                            <Ban size={14} />
                                                        </button>
                                                    )}
                                                    {u.is_active === false && (
                                                        <button className="btn btn-icon-small text-success" onClick={() => handleReativar(u.id, u.nome)} title="Reativar">
                                                            <UserCheck size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ==================== PRODUTOS ==================== */}
                {activeTab === 'produtos' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3><Package size={20} /> Produtos para Resgate</h3>
                            <div className="flex-start gap-1">
                                <button className="btn btn-sm btn-outline" onClick={carregarProdutos}><RefreshCw size={14} /></button>
                                <button className="btn btn-sm btn-primary" onClick={abrirNovoProduto}><PlusCircle size={14} /> Novo</button>
                            </div>
                        </div>
                        {loadingProdutos ? (
                            <p className="text-muted">Carregando...</p>
                        ) : produtos.length === 0 ? (
                            <div className="empty-state">
                                <Package size={48} className="mb-1 opacity-20" />
                                <p>Nenhum produto cadastrado.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead><tr><th>Produto</th><th>Valor</th><th>Pontos</th><th>Qtd</th><th>Status</th><th>Ações</th></tr></thead>
                                    <tbody>
                                        {produtos.map(p => (
                                            <tr key={p.id} className="row-hover">
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        {p.foto_url ? (
                                                            <img src={p.foto_url} alt="" className="product-thumb" />
                                                        ) : (
                                                            <div className="product-thumb-placeholder"><Image size={16} /></div>
                                                        )}
                                                        <div>
                                                            <p className="font-bold">{p.nome}</p>
                                                            {p.descricao && <p className="text-xs text-muted">{p.descricao}</p>}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{formatarMoeda(p.valor_reais)}</td>
                                                <td><span className="text-primary font-bold">{p.pontos_minimos}</span></td>
                                                <td>{p.quantidade_disponivel}</td>
                                                <td><span className={`status-pill ${p.status === 'ativo' ? 'status-success' : 'status-danger'}`}>{p.status}</span></td>
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        <button className="btn btn-icon-small text-primary" onClick={() => abrirEditarProduto(p)}><Edit3 size={14} /></button>
                                                        <button className="btn btn-icon-small text-danger" onClick={() => handleDeletarProduto(p.id, p.nome)}><Trash2 size={14} /></button>
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

                {/* ==================== DISPUTAS ==================== */}
                {activeTab === 'disputas' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3><Scale size={20} /> Disputas ({disputas.length})</h3>
                            <button className="btn btn-sm btn-outline" onClick={carregarDisputas}><RefreshCw size={14} /> Atualizar</button>
                        </div>
                        {loadingDisputas ? (
                            <p className="text-muted">Carregando...</p>
                        ) : disputas.length === 0 ? (
                            <div className="empty-state">
                                <Scale size={48} className="mb-1 opacity-20" />
                                <p>Nenhuma disputa registrada.</p>
                            </div>
                        ) : (
                            <div className="disputas-list">
                                {disputas.map(d => (
                                    <div key={d.id} className={`disputa-card ${d.status === 'resolvida' ? 'resolved' : ''} ${d.status === 'aberta' ? 'open' : ''}`}>
                                        <div className="disputa-header">
                                            <div className="flex-start gap-1">
                                                <span className={`status-pill ${d.status === 'aberta' ? 'status-warning' : d.status === 'em_andamento' ? 'status-info' : 'status-success'}`}>
                                                    {d.status}
                                                </span>
                                                <span className="font-bold">#{d.id}</span>
                                            </div>
                                            <div className="text-xs text-muted">{formatarDataBR(d.data)}</div>
                                        </div>
                                        <div className="disputa-body">
                                            <div className="disputa-info">
                                                <div className="info-row"><span className="info-label">Produto:</span><span className="font-bold">{d.produto}</span></div>
                                                <div className="info-row"><span className="info-label">Valor:</span><span>{formatarMoeda(d.valor)}</span></div>
                                                <div className="info-row"><span className="info-label">Aberto por:</span><span>{d.abridor_nome} ({d.abridor_id})</span></div>
                                                <div className="info-row"><span className="info-label">Vendedor:</span><span>{d.vendedor_id}</span></div>
                                                <div className="info-row"><span className="info-label">Comprador:</span><span>{d.comprador_id}</span></div>
                                            </div>
                                            <div className="disputa-motivo">
                                                <strong>Motivo:</strong> {d.motivo}
                                                {d.descricao && <p className="text-xs text-muted mt-1">{d.descricao}</p>}
                                            </div>
                                            {d.decisao && (
                                                <div className="disputa-decisao">
                                                    <strong>Decisão:</strong> {d.decisao}
                                                    {d.notapublica && <p className="text-xs text-muted mt-1">{d.notapublica}</p>}
                                                </div>
                                            )}
                                        </div>
                                        {d.status !== 'resolvida' && (
                                            <div className="disputa-actions">
                                                <button className="btn btn-sm btn-success" onClick={() => {
                                                    const decisao = prompt('Decisão (ex: "Favorável ao comprador"):');
                                                    if (decisao) handleResolverDisputa(d.id, decisao, '');
                                                }}>Resolver</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ==================== RESGATES ==================== */}
                {activeTab === 'resgates' && (
                    <div className="glass-panel animate-fade-in">
                        <div className="section-header">
                            <h3><Sparkles size={20} /> Resgates de Pontos</h3>
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
                                    <thead><tr><th>Usuário</th><th>CPF</th><th>Chave PIX</th><th>Valor</th><th>Data</th><th>Ações</th></tr></thead>
                                    <tbody>
                                        {resgates.map(r => (
                                            <tr key={r.id} className="row-hover">
                                                <td className="font-bold">{r.usuario_nome}</td>
                                                <td className="text-xs">{r.usuario_cpf}</td>
                                                <td className="font-bold" style={{ color: 'var(--success)' }}>{r.chave_pix}</td>
                                                <td>{formatarMoeda(r.valor)}</td>
                                                <td className="text-xs text-muted">{r.data ? formatarDataBR(r.data) : '—'}</td>
                                                <td>
                                                    <div className="flex-start gap-1">
                                                        <button className="btn btn-sm btn-primary" onClick={() => handleAprovarResgate(r.id)}>Aprovar</button>
                                                        <button className="btn btn-sm btn-danger" onClick={() => handleRejeitarResgate(r.id)}>Rejeitar</button>
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

                {/* ==================== RANKING ==================== */}
                {activeTab === 'ranking' && <PagamentosRanking />}
            </main>

            {/* MODAIS */}
            <ModalPremium
                isOpen={showRejeitarModal}
                onClose={() => setShowRejeitarModal(false)}
                title="Rejeitar Solicitação"
                message={`Motivo da rejeição #${rejeicaoData.id}:`}
                type="error"
                onConfirm={confirmarRejeicao}
                confirmText="Rejeitar"
                loading={loadingRejeicao}
            >
                <textarea className="input-field mt-1 w-full"
                    placeholder="Ex: Documento ilegível..."
                    value={rejeicaoData.motivo}
                    onChange={e => setRejeicaoData({ ...rejeicaoData, motivo: e.target.value })}
                />
            </ModalPremium>

            {/* MODAL PRODUTO */}
            {showProdutoModal && (
                <div className="modal-overlay" onClick={() => setShowProdutoModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <h3>{editandoProduto ? 'Editar Produto' : 'Novo Produto'}</h3>
                        <div className="flex-column gap-1 mt-1">
                            <input className="input-field" placeholder="Nome do produto" value={formProduto.nome}
                                onChange={e => setFormProduto({ ...formProduto, nome: e.target.value })} />
                            <textarea className="input-field" placeholder="Descrição" value={formProduto.descricao}
                                onChange={e => setFormProduto({ ...formProduto, descricao: e.target.value })} />
                            <input className="input-field" type="number" step="0.01" placeholder="Valor em R$" value={formProduto.valor_reais}
                                onChange={e => setFormProduto({ ...formProduto, valor_reais: e.target.value })} />
                            <input className="input-field" type="number" placeholder="Quantidade" value={formProduto.quantidade_disponivel}
                                onChange={e => setFormProduto({ ...formProduto, quantidade_disponivel: Number(e.target.value) })} />
                            <input className="input-field" placeholder="URL da foto" value={formProduto.foto_url}
                                onChange={e => setFormProduto({ ...formProduto, foto_url: e.target.value })} />
                        </div>
                        <div className="flex-start gap-1 mt-2">
                            <button className="btn btn-primary" onClick={salvarProduto}>
                                {editandoProduto ? 'Atualizar' : 'Criar'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowProdutoModal(false)}>Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
