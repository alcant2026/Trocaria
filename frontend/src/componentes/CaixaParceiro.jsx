import React, { useState, useEffect } from 'react';
import api from '../api';
import { Store, UserCheck, Banknote, DollarSign, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';

const CaixaParceiro = ({ onBack, setMensagem }) => {
    const [caixaData, setCaixaData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Formulários
    const [valorAbertura, setValorAbertura] = useState('');
    
    const [opCliente, setOpCliente] = useState('');
    const [opValor, setOpValor] = useState('');
    const [opTipo, setOpTipo] = useState('saque');
    const [processando, setProcessando] = useState(false);

    const carregarCaixa = async () => {
        setLoading(true);
        try {
            const data = await api.get('/parceiros/meu-caixa');
            setCaixaData(data);
        } catch (err) {
            setMensagem({ type: 'error', text: 'Erro ao carregar dados do Caixa.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarCaixa();
    }, []);

    const handleAbrirCaixa = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/parceiros/abrir-caixa', { valor_gaveta: parseFloat(valorAbertura) });
            setMensagem({ type: 'success', text: res.message });
            setValorAbertura('');
            carregarCaixa();
        } catch (err) {
            setMensagem({ type: 'error', text: err.response?.data?.detail || 'Erro ao abrir caixa.' });
        }
    };

    const handleIntermediar = async (e) => {
        e.preventDefault();
        setProcessando(true);
        try {
            const res = await api.post('/parceiros/intermediar', {
                codigo_cliente: opCliente,
                valor: parseFloat(opValor),
                tipo_operacao: opTipo
            });
            setMensagem({ type: 'success', text: res.message });
            setOpCliente('');
            setOpValor('');
            carregarCaixa();
        } catch (err) {
            setMensagem({ type: 'error', text: err.response?.data?.detail || 'Erro na operação.' });
        } finally {
            setProcessando(false);
        }
    };

    const handleFecharCaixa = async () => {
        if (!window.confirm("Deseja fechar o caixa e resgatar suas comissões? O resgate vai para seu saldo local.")) return;
        setProcessando(true);
        try {
            const res = await api.post('/parceiros/fechar-caixa');
            setMensagem({ type: 'success', text: `Caixa fechado! Você ganhou R$ ${res.comissao_recebida.toFixed(2)} de comissão.`});
            carregarCaixa();
        } catch (err) {
            setMensagem({ type: 'error', text: err.response?.data?.detail || 'Erro ao fechar caixa.' });
        } finally {
            setProcessando(false);
        }
    };

    if (loading) return <div className="card text-center py-2">Carregando balcão...</div>;

    if (!caixaData || !caixaData.is_parceiro) {
        return (
            <div className="card text-center py-2">
                <AlertTriangle size={48} color="var(--warning)" style={{ margin: '0 auto 1rem' }} />
                <h3>Acesso Negado</h3>
                <p className="text-muted">Você não está habilitado como um Parceiro Autorizado.</p>
                <button onClick={onBack} className="btn btn-secondary mt-1">Voltar</button>
            </div>
        );
    }

    return (
        <div className="card animate-fade-in">
            <div className="flex-between mb-1" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                        <Store size={24} /> Balcão do Parceiro
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{caixaData.nome_loja}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${caixaData.caixa_aberto ? 'badge-success' : 'badge-warning'}`}>
                        {caixaData.caixa_aberto ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
                    </span>
                </div>
            </div>

            {!caixaData.caixa_aberto ? (
                 <form onSubmit={handleAbrirCaixa} style={{ margin: '2rem 0', textAlign: 'center' }}>
                     <p className="mb-1" style={{ fontSize: '0.9rem' }}>Para iniciar as atividades hoje, informe quanto de <strong>dinheiro físico</strong> você tem em mãos para troco/saques.</p>
                     
                     <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                         <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', maxWidth: '250px', border: '1px solid rgba(255,255,255,0.05)' }}>
                             <input
                                 type="number"
                                 className="input-field"
                                 placeholder="Valor em Espécie (R$)"
                                 style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%' }}
                                 value={valorAbertura}
                                 min="0"
                                 step="0.01"
                                 required
                                 onChange={(e) => setValorAbertura(e.target.value)}
                             />
                         </div>
                     </div>
                     <button type="submit" className="btn btn-primary" style={{ width: 'auto', minWidth: '200px' }}>Abrir Caixa</button>
                 </form>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="grid-2" style={{ gap: '10px' }}>
                        <div className="info-block" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                            <div className="info-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Banknote size={14} /> Espécie em Gaveta</div>
                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--success)' }}>R$ {caixaData.saldo_gaveta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                        <div className="info-block" style={{ background: 'rgba(255, 145, 0, 0.05)', border: '1px solid rgba(255, 145, 0, 0.2)' }}>
                            <div className="info-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--warning)' }}><DollarSign size={14} /> Comissões Acumuladas</div>
                            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--warning)' }}>R$ {caixaData.comissoes_acumuladas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        </div>
                    </div>

                    <div style={{ padding: '15px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-card)' }}>
                        <h3 className="mb-1" style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserCheck size={18} color="var(--primary)" /> Nova Operação
                        </h3>
                        
                        <form onSubmit={handleIntermediar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select 
                                    className="input-field" 
                                    value={opTipo} 
                                    onChange={(e) => setOpTipo(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="saque">Cliente quer SACAR Espécie</option>
                                    <option value="deposito">Cliente quer DEPOSITAR Espécie</option>
                                </select>
                            </div>
                            
                            <div className="grid-2" style={{ gap: '10px' }}>
                                <input 
                                    type="text" 
                                    className="input-field" 
                                    placeholder="ID do Cliente (ex: 8A9B2)" 
                                    value={opCliente}
                                    onChange={(e) => setOpCliente(e.target.value)}
                                    required
                                />
                                <input 
                                    type="number" 
                                    className="input-field" 
                                    placeholder="Valor (R$)" 
                                    value={opValor}
                                    onChange={(e) => setOpValor(e.target.value)}
                                    min="0.01"
                                    step="0.01"
                                    required
                                />
                            </div>

                            <button type="submit" className="btn btn-primary mt-1" disabled={processando}>
                                {processando ? 'Processando...' : 'Confirmar Operação e Receber Comissão'}
                            </button>
                        </form>
                        
                        <div className="mt-1">
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                <strong>Saque:</strong> Você entrega o dinheiro físico da sua gaveta para o cliente. Seu saldo virtual aumenta e sua gaveta abaixa.<br/>
                                <strong>Depósito:</strong> Você pega o dinheiro físico do cliente. Seu saldo virtual é enviado ao cliente, e sua gaveta abaixa.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', borderTop: '1px dashed var(--border-color)', paddingTop: '1.5rem' }}>
                         <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={handleFecharCaixa} disabled={processando}>
                             <LogOut size={16} /> Fechar Caixa e Resgatar Lucro
                         </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px' }} onClick={onBack}>Voltar</button>
            </div>
        </div>
    );
};

export default CaixaParceiro;
