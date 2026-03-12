import React, { useState } from 'react';
import { Store, Search, CheckCircle, AlertTriangle, UserCheck, X, DollarSign, RefreshCw } from 'lucide-react';
import api from '../api';

const CaixaParceiro = ({ onUpdate, usuario }) => {
    const [clienteId, setClienteId] = useState('');
    const [valor, setValor] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingSaque, setLoadingSaque] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [erro, setErro] = useState(null);
    const [sucesso, setSucesso] = useState(null);
    const [confirmando, setConfirmando] = useState(false);
    const [activeTab, setActiveTab] = useState('caixa'); // 'caixa' ou 'garantia'
    const [motivoReprovacao, setMotivoReprovacao] = useState('');

    const handleSacarComissao = async () => {
        setErro(null);
        setSucesso(null);
        setLoadingSaque(true);
        try {
            const res = await api.post('/financeiro/parceiro/sacar-comissoes');
            setSucesso(res.message || 'Comissões transferidas para sua carteira!');
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro(err.message || 'Erro ao sacar comissões.');
        } finally {
            setLoadingSaque(false);
        }
    };

    const handleBuscar = async () => {
        setErro(null);
        setSucesso(null);
        setResultado(null);

        const cid = clienteId.trim();
        if (!cid) return setErro("Digite o ID do Cliente.");

        if (activeTab === 'caixa') {
            const v = parseFloat((valor || '').replace(',', '.'));
            if (!v || v <= 0) return setErro("Digite o Valor da Operação.");

            setLoading(true);
            try {
                const res = await api.post('/financeiro/parceiro/transacoes/verificar', {
                    cliente_id: cid,
                    valor: v
                });
                setResultado(res.transacao || res);
            } catch (err) {
                setErro(err.message || "Nenhuma transação pendente encontrada.");
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(true);
            try {
                const res = await api.post('/emprestimos/parceiro/verificar-garantia', {
                    cliente_id: cid
                });
                setResultado(res);
            } catch (err) {
                setErro(err.message || "Nenhuma garantia física pendente.");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleConfirmar = async () => {
        if (!resultado) return;
        setConfirmando(true);
        setLoading(true);
        try {
            const res = await api.post('/financeiro/parceiro/transacoes/confirmar', {
                transacao_id: resultado.id
            });
            setSucesso(res.message || "Transação confirmada com sucesso! Comissão creditada.");
            setResultado(null);
            setClienteId('');
            setValor('');
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro(err.message || "Erro ao confirmar a transação.");
        } finally {
            setLoading(false);
            setConfirmando(false);
        }
    };

    const handleAvaliarGarantia = async (decisao) => {
        if (!resultado) return;
        setLoading(true);
        try {
            const res = await api.post('/emprestimos/parceiro/avaliar-garantia', {
                solicitacao_id: resultado.id,
                decisao: decisao,
                motivo: motivoReprovacao
            });
            setSucesso(res.message);
            setResultado(null);
            setClienteId('');
            setMotivoReprovacao('');
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro(err.message || "Erro ao avaliar garantia.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in card" style={{ borderColor: 'var(--warning)', background: 'rgba(255, 145, 0, 0.05)' }}>
            <div className="flex-between mb-1" style={{ borderBottom: '1px solid rgba(255, 145, 0, 0.2)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Store size={24} color="var(--warning)" />
                    <div>
                        <h2 style={{ fontSize: '1.2rem', color: 'var(--warning)', margin: 0 }}>Terminal Parceiro</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Geração de Saldo & Garantias</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px' }}>
                    <button 
                        onClick={() => { setActiveTab('caixa'); setResultado(null); }}
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '7px', border: 'none', background: activeTab === 'caixa' ? 'var(--warning)' : 'transparent', color: activeTab === 'caixa' ? '#000' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Caixa
                    </button>
                    <button 
                        onClick={() => { setActiveTab('garantia'); setResultado(null); }}
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '7px', border: 'none', background: activeTab === 'garantia' ? 'var(--warning)' : 'transparent', color: activeTab === 'garantia' ? '#000' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}
                    >
                        Garantias
                    </button>
                </div>
            </div>

            <div style={{ padding: '10px 0' }}>
                {/* Card de Comissões com botão de saque */}
                <div style={{ background: 'rgba(255, 145, 0, 0.1)', border: '1px solid rgba(255,145,0,0.3)', borderRadius: 'var(--radius-md)', padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <DollarSign size={14} color="var(--warning)" />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>COMISSÕES ACUMULADAS</span>
                            </div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)', margin: 0 }}>
                                R$ {(usuario?.comissoes_acumuladas || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>1.5% por operação confirmada</p>
                        </div>
                        <button
                            className="btn btn-primary"
                            style={{ background: 'var(--warning)', color: '#000', fontSize: '0.8rem', padding: '0.6rem 1rem' }}
                            onClick={handleSacarComissao}
                            disabled={loadingSaque || !usuario?.comissoes_acumuladas || usuario.comissoes_acumuladas <= 0}
                        >
                            {loadingSaque ? 'Transferindo...' : 'Sacar para Carteira'}
                        </button>
                    </div>
                </div>

                <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                    <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} color="var(--warning)" />
                    <strong>Auditoria Cega:</strong> Solicite o ID e o valor exato apresentado no App do cliente para confirmar a baixa física.
                </p>

                {sucesso && (
                    <div className="alert alert-success" style={{ position: 'static', transform: 'none', margin: '0 0 1rem 0', width: '100%', maxWidth: 'none' }}>
                        <CheckCircle size={18} />
                        <span>{sucesso}</span>
                    </div>
                )}

                {erro && (
                    <div className="alert alert-danger" style={{ position: 'static', transform: 'none', margin: '0 0 1rem 0', width: '100%', maxWidth: 'none' }}>
                        <AlertTriangle size={18} />
                        <span>{erro}</span>
                    </div>
                )}

                <div className="input-row-2" style={{ display: 'grid', gridTemplateColumns: activeTab === 'caixa' ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="input-group">
                        <label>ID do Cliente</label>
                        <input
                            type="text"
                            name="cliente_id_busca"
                            id="cliente_id_busca"
                            autoComplete="off"
                            className="input-field"
                            placeholder="Ex: 8a4c21"
                            value={clienteId}
                            onChange={(e) => { setClienteId(e.target.value); setErro(null); setSucesso(null); }}
                            disabled={loading}
                        />
                    </div>
                    {activeTab === 'caixa' && (
                        <div className="input-group">
                            <label>Valor (R$)</label>
                            <input
                                type="number"
                                name="valor_operacao_caixa"
                                id="valor_operacao_caixa"
                                autoComplete="off"
                                className="input-field"
                                placeholder="0,00"
                                step="0.01"
                                value={valor}
                                onChange={(e) => { setValor(e.target.value); setErro(null); setSucesso(null); }}
                                disabled={loading}
                            />
                        </div>
                    )}
                </div>

                {!resultado ? (
                    <button
                        className="btn btn-primary mt-1"
                        style={{ background: 'var(--warning)', width: '100%' }}
                        onClick={handleBuscar}
                        disabled={loading || !clienteId || (activeTab === 'caixa' && !valor)}
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />}
                        {loading ? 'Buscando...' : activeTab === 'caixa' ? 'Buscar Pedido Pendente' : 'Verificar Garantia'}
                    </button>
                ) : (
                    <div className="animate-slide-up">
                        <div className="card" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'var(--success)', marginBottom: '0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                                <div style={{ background: 'rgba(0, 230, 118, 0.1)', padding: '10px', borderRadius: '12px' }}>
                                    <UserCheck size={24} color="var(--success)" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--success)' }}>{activeTab === 'caixa' ? 'Pedido Encontrado' : 'Solicitação Localizada'}</h3>
                                    <p style={{ margin: 0, fontSize: '0.75rem' }}>{resultado.cliente_nome}</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
                                <div className="info-block" style={{ padding: '12px' }}>
                                    <div className="flex-between">
                                        <span className="info-label">Tipo de Operação</span>
                                        <span className="badge" style={{ background: 'rgba(255, 145, 0, 0.2)', color: 'var(--warning)', fontSize: '0.65rem' }}>
                                            {(resultado.tipo || '').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                                
                                {activeTab === 'garantia' && (
                                    <div className="info-block" style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)' }}>
                                        <div className="info-label">Item a ser Avaliado</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '5px' }}>{resultado.descricao}</div>
                                    </div>
                                )}

                                <div className="info-block" style={{ padding: '12px' }}>
                                    <div className="flex-between">
                                        <span className="info-label">{activeTab === 'caixa' ? 'Valor Esperado' : 'Valor do Empréstimo'}</span>
                                        <span style={{ fontSize: '1rem', fontWeight: 700 }}>R$ {Number(resultado.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                {activeTab === 'caixa' && resultado.valor_liquido && (
                                    <div className="info-block" style={{ padding: '12px', border: '1px solid var(--success)', background: 'rgba(0, 230, 118, 0.05)' }}>
                                        <div className="flex-between">
                                            <span className="info-label" style={{ color: 'var(--success)' }}>{resultado.tipo === 'Depósito' ? 'Crédito ao Cliente' : 'Entrega em Espécie'}</span>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>R$ {Number(resultado.valor_liquido).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {activeTab === 'caixa' ? (
                                confirmando ? (
                                    <div className="info-block" style={{ borderColor: 'var(--warning)', background: 'rgba(255, 145, 0, 0.05)', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.25rem', color: 'var(--text-main)' }}>
                                            Confirma o recebimento/entrega física deste valor?
                                        </p>
                                        <div className="input-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <button className="btn btn-secondary" onClick={() => setConfirmando(false)} disabled={loading}>
                                                Cancelar
                                            </button>
                                            <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={handleConfirmar} disabled={loading}>
                                                {loading ? 'Confirmando...' : 'Sim, Confirmar'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="input-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button className="btn btn-secondary" onClick={() => { setResultado(null); setErro(null); }} disabled={loading}>
                                            Voltar
                                        </button>
                                        <button className="btn btn-primary" style={{ background: 'var(--success)' }} onClick={() => setConfirmando(true)} disabled={loading}>
                                            Processar
                                        </button>
                                    </div>
                                )
                            ) : (
                                <div className="animate-fade-in">
                                    <div className="input-group mb-1">
                                        <label>Motivo (Se reprovado)</label>
                                        <input 
                                            type="text" 
                                            className="input-field" 
                                            placeholder="Ex: Objeto não condiz com o valor" 
                                            value={motivoReprovacao}
                                            onChange={(e) => setMotivoReprovacao(e.target.value)}
                                        />
                                    </div>
                                    <div className="input-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <button 
                                            className="btn btn-secondary" 
                                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} 
                                            onClick={() => handleAvaliarGarantia('reprovar')} 
                                            disabled={loading || !motivoReprovacao}
                                        >
                                            Reprovar
                                        </button>
                                        <button 
                                            className="btn btn-primary" 
                                            style={{ background: 'var(--success)' }} 
                                            onClick={() => handleAvaliarGarantia('aprovar')} 
                                            disabled={loading}
                                        >
                                            {loading ? 'Processando...' : 'Aprovar Item'}
                                        </button>
                                    </div>
                                    <button className="btn btn-outline mt-1" style={{ width: '100%' }} onClick={() => setResultado(null)}>Voltar</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CaixaParceiro;
