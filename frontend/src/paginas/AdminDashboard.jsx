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
    AlertCircle
} from 'lucide-react';

const AdminDashboard = () => {
    const [pendentes, setPendentes] = useState([]);
    const [fiscal, setFiscal] = useState(null);
    const [mensagem, setMensagem] = useState('');
    const [activeTab, setActiveTab] = useState('pendentes'); // 'pendentes', 'fiscal'
    const [showRejeitarModal, setShowRejeitarModal] = useState(false);
    const [rejeicaoData, setRejeicaoData] = useState({ id: null, motivo: '' });
    const [loadingRejeicao, setLoadingRejeicao] = useState(false);

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
            console.error(err);
        }
    };

    useEffect(() => {
        carregarPendentes();
        carregarFiscal();
    }, []);

    const handleConfirmar = async (id, tipo) => {
        try {
            await api.post(`/financeiro/admin/confirmar/${id}`);
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
                        <p className="info-label text-success">Lucro Plataforma</p>
                        <h2 className="mt-1 text-success">R$ {fiscal.lucro_plataforma_total.toLocaleString('pt-BR')}</h2>
                        <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.75rem' }}>
                            <span>Receita Líquida</span>
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
                                        {p.tipo.toUpperCase()}
                                    </span>
                                </div>

                                <div className="info-block mb-1">
                                    <div className="flex-between">
                                        <span className="info-label">Valor</span>
                                        <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>R$ {p.valor.toLocaleString('pt-BR')}</span>
                                    </div>
                                    {p.detalhes && (
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
                                        Ignorar
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        style={{ width: 'auto', minWidth: '180px', padding: '0.6rem 1.5rem' }}
                                        onClick={() => p.tipo === 'desbloqueio_dados' ? handleConfirmarVerificacao(p.transacao_id) : handleConfirmar(p.transacao_id, p.tipo)}
                                    >
                                        Aprovar Agora
                                    </button>
                                </div>
                            </div>
                        ))
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
                            <div className="flex-between">
                                <span className="text-muted">Taxas de Postagem:</span>
                                <strong>R$ {fiscal.detalhamento_lucro.taxas_postagem.toLocaleString('pt-BR')}</strong>
                            </div>
                        </div>
                    </div>

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
                                        <th style={{ padding: '0.5rem 0', textAlign: 'right' }}>Lucro</th>
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
                                            <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>R$ {h.lucro}</td>
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
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(5px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem'
                }}>
                    <div className="card" style={{
                        width: '100%',
                        maxWidth: '450px',
                        animation: 'scaleUp 0.3s ease',
                        border: '1px solid rgba(255, 61, 0, 0.2)'
                    }}>
                        <div className="flex-between mb-1">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                                <AlertCircle size={20} /> Rejeitar Solicitação
                            </h3>
                            <button
                                onClick={() => setShowRejeitarModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            Informe o motivo do cancelamento. Esta mensagem será enviada para o cliente.
                        </p>

                        <div className="input-group">
                            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Motivo da Rejeição</label>
                            <textarea
                                className="input-field mt-1"
                                placeholder="Ex: Documento vencido ou CPF inválido..."
                                style={{ width: '100%', minHeight: '100px', padding: '0.75rem' }}
                                value={rejeicaoData.motivo}
                                onChange={(e) => setRejeicaoData({ ...rejeicaoData, motivo: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, padding: '0.75rem' }}
                                onClick={() => setShowRejeitarModal(false)}
                                disabled={loadingRejeicao}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 2, background: 'var(--danger)', color: '#fff', padding: '0.75rem' }}
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
