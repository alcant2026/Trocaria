import React, { useState, useEffect } from 'react';
import api from '../api';
import {
    ShieldCheck,
    Landmark,
    ListTodo,
    CalendarDays,
    CheckCircle,
    TrendingUp,
    ArrowUpRight,
    ArrowDownRight,
    User,
    Clock,
    ExternalLink,
    X,
    AlertCircle,
    Undo2,
    Copy,
    Check
} from 'lucide-react';

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
};

// Tipos que para o Admin são ENTRADA de lucro
const TIPOS_ENTRADA_ADMIN = new Set(['deposito', 'recebimento', 'taxa_intermediacao', 'taxa_conveniencia', 'taxa_saque', 'compra_score', 'desbloqueio_dados', 'aporte_capital']);

const formatarTipoAdmin = (tipo) => TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';

// Componente de Saque do Lucro da Plataforma
const SaqueLucroCard = ({ onMensagem, lucroDisponivel }) => {
    const [valor, setValor] = useState('');
    const [chavePix, setChavePix] = useState('');
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);
    const [aberto, setAberto] = useState(false);

    const handleSacar = async (e) => {
        e.preventDefault();
        const v = parseFloat(valor);
        if (!v || v <= 0) return alert('O valor de saque deve ser maior que zero.');
        if (!chavePix || !motivo) return alert('Preencha a chave PIX e o motivo.');
        if (motivo.length < 5) return alert('Descreva o motivo com pelo menos 5 caracteres.');

        setLoading(true);
        try {
            const res = await api.post('/financeiro/admin/sacar-lucro', {
                valor: parseFloat(valor),
                chave_pix: chavePix,
                motivo: motivo
            });
            onMensagem(res.message || 'Saque registrado!');
            setValor('');
            setChavePix('');
            setMotivo('');
            setAberto(false);
        } catch (err) {
            onMensagem('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card mb-1" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="flex-between">
                <div>
                    <h3 style={{ color: 'var(--primary)' }}>💰 Resgatar Lucro</h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Disponível: <strong style={{ color: 'var(--success)' }}>R$ {(lucroDisponivel || 0).toLocaleString('pt-BR')}</strong>
                    </p>
                </div>
                <button
                    className={`btn ${aberto ? 'btn-outline' : 'btn-primary'}`}
                    style={{ width: 'auto', padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                    onClick={() => setAberto(!aberto)}
                >
                    {aberto ? 'Cancelar' : 'Sacar'}
                </button>
            </div>

            {aberto && (
                <form onSubmit={handleSacar} style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px', margin: '1.2rem auto 0' }}>

                    {/* Campo de Valor com botão Sacar Tudo */}
                    <div style={{ position: 'relative' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Valor</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="number"
                                placeholder="0,00"
                                value={valor}
                                onChange={e => setValor(e.target.value)}
                                min="0.01"
                                step="0.01"
                                max={lucroDisponivel}
                                required
                                style={{ flex: 1, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700, outline: 'none' }}
                            />
                            <button
                                type="button"
                                onClick={() => setValor(lucroDisponivel.toFixed(2))}
                                style={{ flexShrink: 0, padding: '0 16px', background: 'rgba(var(--primary-rgb, 83,130,255),0.12)', border: '1px solid var(--primary)', borderRadius: '12px', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}
                            >
                                Tudo
                            </button>
                        </div>
                    </div>

                    {/* Campo Chave PIX */}
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Chave PIX</label>
                        <input
                            type="text"
                            placeholder="CPF, e-mail, telefone ou chave aleatória"
                            value={chavePix}
                            onChange={e => setChavePix(e.target.value)}
                            required
                            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>

                    {/* Campo Motivo / Justificativa */}
                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Justificativa / Motivo do Resgate</label>
                        <textarea
                            placeholder="Ex: Pagamento de fornecedores, Pró-labore, etc."
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            required
                            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700 }}
                        disabled={loading}
                    >
                        {loading ? 'Registrando...' : `Confirmar Saque${valor ? ' de R$ ' + parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}`}
                    </button>
                </form>
            )}
        </div>
    );
};

// Componente de Aporte de Capital Externo
const AporteLucroCard = ({ onMensagem }) => {
    const [valor, setValor] = useState('');
    const [origem, setOrigem] = useState('');
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);
    const [aberto, setAberto] = useState(false);

    const handleAportar = async (e) => {
        e.preventDefault();
        const v = parseFloat(valor);
        if (!v || v <= 0) return alert('O valor do aporte deve ser maior que zero.');
        if (!origem || !motivo) return alert('Preencha a origem e o motivo.');
        if (motivo.length < 5) return alert('Descreva o motivo com pelo menos 5 caracteres.');

        setLoading(true);
        try {
            const res = await api.post('/financeiro/admin/aportar-lucro', {
                valor: parseFloat(valor),
                chave_pix: origem,
                motivo: motivo
            });
            onMensagem(res.message || 'Aporte registrado!');
            setValor('');
            setOrigem('');
            setMotivo('');
            setAberto(false);
        } catch (err) {
            onMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card mb-1" style={{ borderLeft: '4px solid var(--success)' }}>
            <div className="flex-between">
                <div>
                    <h3 style={{ color: 'var(--success)' }}>📥 Injetar Lucro (Aporte)</h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Injete capital externo para cobrir custos ou bônus.
                    </p>
                </div>
                <button
                    className={`btn ${aberto ? 'btn-outline' : 'btn-primary'}`}
                    style={{ width: 'auto', padding: '0.5rem 1.2rem', fontSize: '0.85rem', background: aberto ? 'transparent' : 'var(--success)', borderColor: 'var(--success)', color: aberto ? 'var(--success)' : '#fff' }}
                    onClick={() => setAberto(!aberto)}
                >
                    {aberto ? 'Cancelar' : 'Aportar'}
                </button>
            </div>

            {aberto && (
                <form onSubmit={handleAportar} style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px', margin: '1.2rem auto 0' }}>

                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Valor do Aporte</label>
                        <input
                            type="number"
                            placeholder="0,00"
                            value={valor}
                            onChange={e => setValor(e.target.value)}
                            min="0.01"
                            step="0.01"
                            required
                            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Origem (Conta/PIX)</label>
                        <input
                            type="text"
                            placeholder="Ex: Minha conta pessoal, bônus sócio..."
                            value={origem}
                            onChange={e => setOrigem(e.target.value)}
                            required
                            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Justificativa do Aporte</label>
                        <textarea
                            placeholder="Ex: Cobrir custos de servidor, Reserva de segurança..."
                            value={motivo}
                            onChange={e => setMotivo(e.target.value)}
                            required
                            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', minHeight: '80px', resize: 'vertical' }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ padding: '0.75rem', fontSize: '0.9rem', fontWeight: 700, background: 'var(--success)', borderColor: 'var(--success)', color: '#fff' }}
                        disabled={loading}
                    >
                        {loading ? 'Processando...' : `Confirmar Aporte${valor ? ' de R$ ' + parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}`}
                    </button>
                </form>
            )}
        </div>
    );
};

const AdminDashboard = () => {
    const [pendentes, setPendentes] = useState([]);
    const [fiscal, setFiscal] = useState(null);
    const [mensagem, setMensagem] = useState('');
    const [activeTab, setActiveTab] = useState('pendentes'); // 'pendentes', 'fiscal'
    const [showRejeitarModal, setShowRejeitarModal] = useState(false);
    const [rejeicaoData, setRejeicaoData] = useState({ id: null, motivo: '' });
    const [loadingRejeicao, setLoadingRejeicao] = useState(false);
    const [ultimasAcoes, setUltimasAcoes] = useState([]);
    const [pixCopiado, setPixCopiado] = useState(null); // id da transacao com pix copiado

    const extrairChavePix = (detalhes) => {
        if (!detalhes) return null;
        // Detecta padrão: "Solicitação de saque para chave PIX: XXXXX"
        const match = detalhes.match(/chave PIX:\s*(.+)/i);
        return match ? match[1].trim() : null;
    };

    const copiarPix = (chave, id) => {
        navigator.clipboard.writeText(chave);
        setPixCopiado(id);
        setTimeout(() => setPixCopiado(null), 2500);
    };

    const formatarDataBrasilia = (valor) => {
        if (!valor) return '-';
        const texto = String(valor);
        const temTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(texto);
        const isoNormalizado = temTimezone ? texto : `${texto}Z`;
        const data = new Date(isoNormalizado);
        if (Number.isNaN(data.getTime())) return texto;

        return data.toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const carregarPendentes = async () => {
        try {
            const data = await api.get('/financeiro/admin/pendentes');
            setPendentes(data);
        } catch (err) {
            setMensagem('Erro ao carregar: ' + err.message);
        }
    };

    const carregarFiscal = async () => {
        try {
            const data = await api.get('/financeiro/admin/fiscal');
            setFiscal(data);
        } catch (err) {
            console.error('Erro ao carregar dados fiscais:', err);
            // Não bloqueia a tela, apenas loga. O polling tentará novamente.
        }
    };

    // Polling Automático (30s)
    useEffect(() => {
        const interval = setInterval(() => {
            carregarPendentes();
            carregarFiscal();
        }, 30000); // 30 segundos

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        carregarPendentes();
        carregarFiscal();
    }, [activeTab]);

    const handleConfirmar = async (id, tipo) => {
        try {
            await api.post(`/financeiro/admin/confirmar/${id}`);

            // Log local
            const item = pendentes.find(p => p.transacao_id === id);
            if (item) {
                setUltimasAcoes(prev => [{
                    nome: item.usuario_nome,
                    tipo: item.tipo,
                    status: 'APROVADO',
                    timestamp: new Date().toLocaleTimeString('pt-BR')
                }, ...prev].slice(0, 5));
            }

            setMensagem(`${tipo === 'deposito' ? 'Depósito' : 'Saque'} confirmado!`);
            carregarPendentes();
            carregarFiscal();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleConfirmarVerificacao = async (id) => {
        try {
            await api.post(`/financeiro/admin/confirmar-verificacao/${id}`);

            // Log local
            const item = pendentes.find(p => p.transacao_id === id);
            if (item) {
                setUltimasAcoes(prev => [{
                    nome: item.usuario_nome,
                    tipo: 'KYC / VERIFICAÇÃO',
                    status: 'APROVADO',
                    timestamp: new Date().toLocaleTimeString('pt-BR')
                }, ...prev].slice(0, 5));
            }

            setMensagem('Identidade verificada com sucesso!');
            carregarPendentes();
            carregarFiscal();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleRejeitar = (id) => {
        setRejeicaoData({ id, motivo: 'Documento ilegível ou dados incorretos.' });
        setShowRejeitarModal(true);
    };

    const confirmarRejeicao = async () => {
        const { id, motivo } = rejeicaoData;
        if (!motivo) return alert("Por favor, insira um motivo.");

        setLoadingRejeicao(true);
        try {
            await api.post(`/financeiro/admin/rejeitar/${id}?motivo=${encodeURIComponent(motivo)}`);

            // Adicionar ao log local
            const item = pendentes.find(p => p.transacao_id === id);
            if (item) {
                setUltimasAcoes(prev => [{
                    nome: item.usuario_nome,
                    tipo: item.tipo,
                    status: 'REJEITADO',
                    motivo: motivo,
                    timestamp: new Date().toLocaleTimeString('pt-BR')
                }, ...prev].slice(0, 5));
            }

            setMensagem('Transação rejeitada e notificação enviada.');
            setShowRejeitarModal(false);
            carregarPendentes();
            carregarFiscal();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        } finally {
            setLoadingRejeicao(false);
        }
    };

    return (
        <div className="admin-dashboard">
            <header className="mb-1">
                <div className="flex-between">
                    <div>
                        <h1>Gestão Peer</h1>
                        <p className="text-muted">Monitoramento de fluxo e conformidade.</p>
                    </div>
                    <ShieldCheck size={40} color="var(--primary)" />
                </div>
            </header>

            {mensagem && (
                <div className={`alert ${mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'}`}>
                    <span>{mensagem}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Quick Summary Section */}
            {fiscal && (
                <div className="grid-2 mt-1 mb-1">
                    <div className="card">
                        <p className="info-label">Custódia (Passivo)</p>
                        <h2 className="mt-1">R$ {fiscal.saldo_usuarios_gerenciado.toLocaleString('pt-BR')}</h2>
                        <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.75rem' }}>
                            <span>Total Gerido</span>
                            <Landmark size={14} />
                        </div>
                    </div>
                    <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
                        <p className="info-label text-success">Lucro Disponível</p>
                        <h2 className="mt-1 text-success">R$ {(fiscal.lucro_disponivel ?? fiscal.lucro_plataforma_historico).toLocaleString('pt-BR')}</h2>
                        <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.72rem' }}>
                            <span>Bruto: R$ {fiscal.lucro_plataforma_historico?.toLocaleString('pt-BR')}</span>
                            <TrendingUp size={14} color="var(--success)" />
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '4px', display: 'flex', gap: '4px', width: 'fit-content' }}>
                    <button
                        className={`btn ${activeTab === 'pendentes' ? 'btn-primary' : ''}`}
                        style={{ border: 'none', borderRadius: '8px', padding: '0.6rem 1.5rem', width: 'auto', fontSize: '0.9rem' }}
                        onClick={() => setActiveTab('pendentes')}
                    >
                        Fila de Aprovação
                    </button>
                    <button
                        className={`btn ${activeTab === 'fiscal' ? 'btn-primary' : ''}`}
                        style={{ border: 'none', borderRadius: '8px', padding: '0.6rem 1.5rem', width: 'auto', fontSize: '0.9rem' }}
                        onClick={() => setActiveTab('fiscal')}
                    >
                        Relatório Fiscal
                    </button>
                </div>
            </div>

            {/* Content View: Pendentes */}
            {activeTab === 'pendentes' && (
                <div>
                    <div className="flex-between mb-1">
                        <h3>Aguardando Revisão</h3>
                        <ListTodo size={18} color="var(--primary)" />
                    </div>

                    {pendentes.length === 0 ? (
                        <div className="card text-center text-muted py-2">Tudo em dia! Nenhuma pendência encontrada.</div>
                    ) : (
                        pendentes.map(p => (
                            <div key={p.transacao_id} className="card">
                                <div className="flex-between mb-1">
                                    <div className="flex-between" style={{ gap: '10px' }}>
                                        <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                            <User size={20} color="var(--text-muted)" />
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <p style={{ fontWeight: 600 }}>{p.usuario_nome}</p>
                                                {p.usuario_verificado ? (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        background: 'rgba(0, 230, 118, 0.1)',
                                                        color: '#00e676',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        <CheckCircle size={10} /> Verificado
                                                    </span>
                                                ) : (
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        background: 'rgba(255, 145, 0, 0.1)',
                                                        color: '#ff9100',
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.65rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        <Clock size={10} /> Pendente (KYC)
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <p className="text-muted" style={{ fontSize: '0.75rem' }}>CPF: {p.usuario_cpf}</p>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>•</span>
                                                <p className="text-muted" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} /> {formatarDataBrasilia(p.data)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`badge ${p.tipo === 'deposito' ? 'badge-success' : p.tipo === 'saque' ? 'badge-danger' : 'badge-warning'}`}>
                                        {formatarTipoAdmin(p.tipo)}
                                    </span>
                                </div>

                                <div className="info-block mb-1">
                                    <div className="flex-between">
                                        <span className="info-label">Valor</span>
                                        <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>R$ {p.valor.toLocaleString('pt-BR')}</span>
                                    </div>
                                    {p.tipo === 'saque' && p.detalhes && (() => {
                                        const chave = extrairChavePix(p.detalhes);
                                        return chave ? (
                                            <div className="mt-1" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, flexShrink: 0 }}>Chave PIX</span>
                                                <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', wordBreak: 'break-all', minWidth: 0 }}>{chave}</span>
                                                <button
                                                    onClick={() => copiarPix(chave, p.transacao_id)}
                                                    title="Copiar chave PIX"
                                                    style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', color: pixCopiado === p.transacao_id ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', transition: 'var(--transition)', flexShrink: 0 }}
                                                >
                                                    {pixCopiado === p.transacao_id ? <Check size={16} /> : <Copy size={16} />}
                                                </button>
                                            </div>
                                        ) : null;
                                    })()}
                                    {/* Comprovante/Detalhes apenas para não-saques (pix já exibido acima) */}
                                    {p.detalhes && p.tipo !== 'saque' && (
                                        <div className="mt-1 p-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <p className="info-label mb-1">Comprovante/Detalhes:</p>
                                            <p style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                                                {p.detalhes.includes('http') ? (
                                                    <>
                                                        <span style={{ display: 'block', marginBottom: '4px' }}>{p.detalhes.split('http')[0]}</span>
                                                        <a
                                                            href={'http' + p.detalhes.split('http')[1].split(' ')[0]}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                                        >
                                                            Ver Documento <ExternalLink size={14} />
                                                        </a>
                                                    </>
                                                ) : p.detalhes}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1rem' }}>
                                    <button
                                        className="btn btn-outline"
                                        style={{ width: 'auto', minWidth: '120px', padding: '0.6rem 1rem', color: 'var(--danger)', borderColor: 'rgba(255, 61, 0, 0.2)' }}
                                        onClick={() => handleRejeitar(p.transacao_id)}
                                    >
                                        Rejeitar
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        style={{ width: 'auto', minWidth: '180px', padding: '0.6rem 1.5rem' }}
                                        onClick={() => p.tipo === 'desbloqueio_dados' ? handleConfirmarVerificacao(p.transacao_id) : handleConfirmar(p.transacao_id, p.tipo)}
                                    >
                                        Aprovar
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Log de Ações Recentes (Admin Feedback) */}
                    {ultimasAcoes.length > 0 && (
                        <div className="mt-2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                            <div className="flex-between mb-1">
                                <h4 className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Ações Recentes desta Sessão</h4>
                                <Undo2 size={14} color="var(--text-muted)" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {ultimasAcoes.map((acao, i) => (
                                    <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{acao.timestamp}</span>
                                            <p style={{ fontSize: '0.85rem' }}><strong>{acao.nome}</strong>: {acao.tipo.toUpperCase()}</p>
                                        </div>
                                        <div className="text-right">
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: acao.status === 'APROVADO' ? 'var(--success)' : 'var(--danger)' }}>{acao.status}</span>
                                            {acao.motivo && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acao.motivo}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Content View: Fiscal */}
            {activeTab === 'fiscal' && fiscal && (
                <div className="animate-fade-in">
                    <div className="card mb-1">
                        <h3>Detalhes da Receita</h3>
                        <div className="info-block mt-1">
                            <div className="flex-between mb-1">
                                <span className="text-muted">Ações de KYC/Score:</span>
                                <strong>R$ {fiscal.detalhamento_lucro.kyc_e_score.toLocaleString('pt-BR')}</strong>
                            </div>
                            <div className="flex-between mb-1">
                                <span className="text-muted">Desbloqueio de Dados:</span>
                                <strong>R$ {fiscal.detalhamento_lucro.desbloqueio_lgpd.toLocaleString('pt-BR')}</strong>
                            </div>
                            <div className="flex-between mb-1">
                                <span className="text-muted">Taxas de Postagem:</span>
                                <strong>R$ {fiscal.detalhamento_lucro.taxas_postagem.toLocaleString('pt-BR')}</strong>
                            </div>
                            <div className="flex-between mb-1">
                                <span className="text-muted">Saques Extras (Taxas):</span>
                                <strong>R$ {fiscal.detalhamento_lucro.taxas_saque_extra.toLocaleString('pt-BR')}</strong>
                            </div>
                            <div className="flex-between">
                                <span className="text-muted">Intermediação P2P (10%):</span>
                                <strong>R$ {fiscal.detalhamento_lucro.taxas_intermediacao_p2p.toLocaleString('pt-BR')}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Card: Resgatar Lucro */}
                    <SaqueLucroCard onMensagem={(msg) => { setMensagem(msg); carregarFiscal(); }} lucroDisponivel={fiscal.lucro_disponivel ?? fiscal.lucro_plataforma_historico} />

                    {/* NOVO: Card de Aporte de Lucro */}
                    <AporteLucroCard onMensagem={(msg) => { setMensagem(msg); carregarFiscal(); }} />

                    <div className="card">
                        <div className="flex-between mb-1">
                            <h3>Histórico Mensal</h3>
                            <CalendarDays size={18} color="var(--primary)" />
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                <thead>
                                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'left' }}>Mês</th>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'center' }}>Fluxo (In/Out)</th>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Receita</th>
                                        <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Sacado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fiscal.historico_mensal.map((h, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem 0', fontWeight: 600 }}>{new Date(h.mes + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</td>
                                            <td style={{ padding: '1rem 0', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span style={{ color: 'var(--success)', fontSize: '0.7rem' }}>+{h.depositos}</span>
                                                    <span style={{ color: 'var(--danger)', fontSize: '0.7rem' }}>-{h.saques}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>R$ {h.lucro.toLocaleString('pt-BR')}</td>
                                            <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 700, color: h.lucro_sacado > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                                                {h.lucro_sacado > 0 ? `- R$ ${h.lucro_sacado.toLocaleString('pt-BR')}` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Rejeição Customizado */}
            {showRejeitarModal && (
                <div className="modal-overlay" onClick={() => setShowRejeitarModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()} style={{ border: '1px solid rgba(255, 61, 0, 0.2)', textAlign: 'left' }}>
                        <div className="modal-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', marginBottom: 0 }}>
                                <AlertCircle size={20} /> Rejeitar Solicitação
                            </h3>
                            <button
                                onClick={() => setShowRejeitarModal(false)}
                                className="modal-close"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            Informe o motivo do cancelamento. Esta mensagem será enviada para o cliente.
                        </p>

                        <div className="input-group">
                            <label>Motivo da Rejeição</label>
                            <textarea
                                className="input-field mt-1"
                                placeholder="Ex: Documento vencido ou CPF inválido..."
                                style={{ width: '100%', minHeight: '100px' }}
                                value={rejeicaoData.motivo}
                                onChange={(e) => setRejeicaoData({ ...rejeicaoData, motivo: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => setShowRejeitarModal(false)}
                                disabled={loadingRejeicao}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 2, background: 'var(--danger)', color: '#fff' }}
                                onClick={confirmarRejeicao}
                                disabled={loadingRejeicao || !rejeicaoData.motivo}
                            >
                                {loadingRejeicao ? 'Processando...' : 'Confirmar Rejeição'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
