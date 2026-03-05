import React, { useState } from 'react';
import { Wallet, TrendingUp, ArrowUpCircle, ArrowDownCircle, Calendar, Info, CheckCircle2 } from 'lucide-react';
import api from '../api';

const CaixaInvestidor = ({ usuario, onUpdate, showModal, closeModal }) => {
    const [valorAporte, setValorAporte] = useState('');
    const [valorResgate, setValorResgate] = useState('');
    const [senha, setSenha] = useState('');
    const [aceitouTermos, setAceitouTermos] = useState(false);
    const [loading, setLoading] = useState(false);
    const [mensagem, setMensagem] = useState(null);

    const hoje = new Date();
    const isDezembroResgate = hoje.getMonth() === 11 && hoje.getDate() >= 19 && hoje.getDate() <= 21;

    const handleAporte = async () => {
        const v = parseFloat(valorAporte);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Digite um valor de aporte maior que zero.', type: 'error' });
        if (!senha) return showModal({ title: 'Senha Requerida', message: 'Digite sua senha de segurança para validar a operação.', type: 'warning' });
        if (!aceitouTermos) return showModal({ title: 'Aceite Necessário', message: 'Você precisa aceitar os termos de ciência de risco para continuar.', type: 'info' });

        setLoading(true);
        try {
            await api.post('/financeiro/caixa/aporte', {
                valor: v,
                senha: senha,
                aceite_termos: aceitouTermos
            });
            setMensagem({ type: 'success', text: `R$ ${v.toLocaleString('pt-BR')} aportados com sucesso no Caixa!` });
            setValorAporte('');
            setSenha('');
            onUpdate();
        } catch (err) {
            setMensagem({ type: 'error', text: err.response?.data?.detail || 'Erro ao aportar.' });
        } finally {
            setLoading(false);
        }
    };

    const handleResgate = async () => {
        const v = parseFloat(valorResgate);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Digite um valor de resgate válido.', type: 'error' });
        if (!senha) return showModal({ title: 'Senha Requerida', message: 'Digite sua senha de segurança para autorizar o resgate.', type: 'warning' });

        setLoading(true);
        try {
            await api.post('/financeiro/caixa/resgate', {
                valor: v,
                senha: senha
            });
            setMensagem({ type: 'success', text: `R$ ${v.toLocaleString('pt-BR')} resgatados para sua conta!` });
            setValorResgate('');
            setSenha('');
            onUpdate();
        } catch (err) {
            setMensagem({ type: 'error', text: err.response?.data?.detail || 'Erro ao resgatar.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in">
            <div className="card mb-1" style={{ background: 'linear-gradient(135deg, var(--card-bg), rgba(var(--primary-rgb), 0.05))', borderColor: 'var(--primary)' }}>
                <div className="flex-between mb-1">
                    <div className="flex-between" style={{ gap: '10px' }}>
                        <TrendingUp size={24} color="var(--primary)" />
                        <h2 style={{ fontSize: '1.2rem' }}>Meu Caixa (Pool)</h2>
                    </div>
                    <div className={`badge ${isDezembroResgate ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                        {isDezembroResgate ? 'RESGATE LIBERADO' : 'PERÍODO DE ACÚMULO'}
                    </div>
                </div>

                <div className="text-center py-1">
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>SALDO NO FUNDO COLETIVO</p>
                    <h1 style={{ fontSize: '2.5rem', color: 'var(--text-main)', margin: '0.5rem 0' }}>
                        R$ {(usuario.saldo_caixa || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h1>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
                        <TrendingUp size={16} />
                        Rendimento Automático (Pool)
                    </div>
                </div>
            </div>

            {mensagem && (
                <div className={`alert alert-${mensagem.type === 'success' ? 'success' : 'danger'} mb-1`}>
                    {mensagem.text}
                </div>
            )}

            {/* BOX DE SEGURANÇA JURÍDICA */}
            <div className="card mb-1" style={{ border: '1px solid rgba(var(--primary-rgb), 0.2)', background: 'rgba(var(--primary-rgb), 0.02)' }}>
                <div className="flex items-center gap-2 mb-1">
                    <Info size={18} color="var(--primary)" />
                    <h4 style={{ fontSize: '0.9rem', margin: 0 }}>Termos de Ciência e Risco</h4>
                </div>
                <div style={{
                    height: '100px',
                    overflowY: 'auto',
                    fontSize: '0.75rem',
                    padding: '10px',
                    background: 'var(--bg-main)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '10px',
                    color: 'var(--text-muted)'
                }}>
                    <p><strong>1. Rastro Digital:</strong> Esta operação registra seu IP, dispositivo e horário. Ao confirmar, você declara ser o autor legítimo da transação.</p>
                    <p><strong>2. Risco de Crédito:</strong> O investidor declara ciência de que o Pool realiza empréstimos P2P e que existe risco de inadimplência.</p>
                    <p><strong>3. Trava de Liquidez:</strong> O aporte é irretratável e o resgate só ocorre entre 19 e 21 de dezembro.</p>
                    <p><strong>4. Garantia Real:</strong> Caso possua dívidas na plataforma, seu saldo no Pool poderá ser utilizado para quitação compulsória.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: '0.8rem', userSelect: 'none' }}>
                    <input
                        type="checkbox"
                        checked={aceitouTermos}
                        onChange={(e) => setAceitouTermos(e.target.checked)}
                    />
                    Estou ciente dos termos e dos riscos da operação.
                </label>
            </div>

            <div className="card mb-1">
                <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Confirme sua senha para validar a operação:</p>
                <input
                    type="password"
                    className="input-field"
                    placeholder="Sua senha de acesso"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                />
            </div>

            <div className="grid-2 mb-1" style={{ gap: '15px' }}>
                <div className="card" style={{ padding: '1.2rem' }}>
                    <div className="flex-between mb-1">
                        <span style={{ fontWeight: 600 }}>Aportar</span>
                        <ArrowUpCircle size={20} color="var(--primary)" />
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.7rem' }}>O valor sairá do seu saldo disponível.</p>
                    <input
                        type="number"
                        className="input-field mt-1"
                        placeholder="R$ 0,00"
                        value={valorAporte}
                        onChange={(e) => setValorAporte(e.target.value)}
                    />
                    <button
                        className="btn btn-primary mt-1 w-100"
                        onClick={handleAporte}
                        disabled={loading || !valorAporte || !senha || !aceitouTermos}
                    >
                        Confirmar Aporte
                    </button>
                </div>

                <div className="card" style={{ padding: '1.2rem' }}>
                    <div className="flex-between mb-1">
                        <span style={{ fontWeight: 600 }}>Resgatar</span>
                        <ArrowDownCircle size={20} color="var(--warning)" />
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.7rem' }}>Disponível apenas em Dezembro.</p>
                    <input
                        type="number"
                        className="input-field mt-1"
                        placeholder="R$ 0,00"
                        value={valorResgate}
                        onChange={(e) => setValorResgate(e.target.value)}
                        disabled={!isDezembroResgate}
                    />
                    <button
                        className="btn btn-outline mt-1 w-100"
                        onClick={handleResgate}
                        disabled={loading || !valorResgate || !isDezembroResgate || !senha}
                    >
                        Solicitar Resgate
                    </button>
                </div>
            </div>

            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                    <Calendar size={18} color="var(--text-muted)" />
                    <h3 style={{ fontSize: '0.95rem' }}>Cronograma do Caixa</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="info-block" style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Info size={16} className="mt-1" color="var(--primary)" />
                            <div>
                                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Janela de Resgate Anual</p>
                                <p className="text-muted" style={{ fontSize: '0.75rem' }}>Para garantir a liquidez dos empréstimos, os resgates só são permitidos de 19/12 a 21/12.</p>
                            </div>
                        </div>
                    </div>

                    <div className="info-block" style={{ margin: 0, padding: '10px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <CheckCircle2 size={16} className="mt-1" color="var(--success)" />
                            <div>
                                <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bônus por Pontualidade</p>
                                <p className="text-muted" style={{ fontSize: '0.75rem' }}>Se você também for tomador de empréstimos, cada parcela paga em dia gera um bônus extra no seu saldo do Caixa.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CaixaInvestidor;
