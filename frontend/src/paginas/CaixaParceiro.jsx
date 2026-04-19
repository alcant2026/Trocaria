import React, { useState, useEffect } from 'react';
import { Store, Search, CheckCircle, AlertTriangle, UserCheck, X, DollarSign, RefreshCw, ArrowUpCircle, ArrowDownCircle, Clock, Lock, Play } from 'lucide-react';
import api from '../api';

const CaixaParceiro = ({ onUpdate, usuario }) => {
    const [activeTab, setActiveTab] = useState('caixa');
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');
    
    // Estados do Formulário de Intermediação
    const [codigoCliente, setCodigoCliente] = useState('');
    const [valor, setValor] = useState('');
    const [tipoOp, setTipoOp] = useState('deposito');
    const [simulacao, setSimulacao] = useState(null);
    const [fundoReserva, setFundoReserva] = useState('');

    const limparMensagens = () => {
        setErro('');
        setSucesso('');
    };

    const handleAbrirCaixa = async () => {
        if (!fundoReserva || parseFloat(fundoReserva) < 10) {
            setErro("O fundo de reserva mínimo é de R$ 10,00!");
            return;
        }
        setLoading(true);
        limparMensagens();
        try {
            const valorFinal = fundoReserva.replace(',', '.');
            const res = await api.post('/parceiros/abrir-caixa', { valor_gaveta: parseFloat(valorFinal) });
            setSucesso(res.message);
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro(err.message || "Erro ao abrir o caixa.");
        } finally {
            setLoading(false);
        }
    };

    const handleFecharCaixa = async () => {
        const totalDevolvido = (usuario?.saldo_caixa_inicial || 0) + (usuario?.comissoes_acumuladas || 0);
        const mensagemConfirma = `Você está encerrando o turno.\n\n` +
                                `- Fundo de Reserva: R$ ${usuario?.saldo_caixa_inicial?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
                                `- Comissões D+0: R$ ${usuario?.comissoes_acumuladas?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n` +
                                `Total de R$ ${totalDevolvido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} será transferido para sua conta digital.\n\n` +
                                `O saldo remanescente da gaveta física deve permanecer com você.\n\n` +
                                `Deseja confirmar o encerramento?`;

        if (!window.confirm(mensagemConfirma)) return;
        
        setLoading(true);
        limparMensagens();
        try {
            const res = await api.post('/parceiros/fechar-caixa');
            setSucesso(res.message);
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro(err.message || "Erro ao fechar o caixa.");
        } finally {
            setLoading(false);
        }
    };

    const handleSimularOperacao = async () => {
        limparMensagens();
        
        if (!codigoCliente) {
            setErro("Digite o ID do Cliente para buscar ou simular.");
            return;
        }

        setLoading(true);
        try {
            // 1. SEMPRE tentamos buscar um saque reservado primeiro (Independente do que o lojista marcou) 🔍
            try {
                const res = await api.get(`/parceiros/buscar-saque-pendente/${codigoCliente}`);
                setSimulacao({
                    id: res.transacao_id,
                    isReserva: true,
                    bruto: res.valor_bruto,
                    entrega: res.valor_entrega,
                    taxaPlataforma: res.taxa_plataforma,
                    cliente: res.cliente_nome
                });
                setValor(res.valor_bruto.toString());
                setTipoOp('saque'); // Muda automaticamente para Saque
                setLoading(false);
                return; 
            } catch (e) {
                // Se der erro 404, apenas ignoramos e tentamos o fluxo de depósito (se for o caso)
                if (tipoOp === 'saque' && e.status === 404) {
                    setErro("Nenhum saque reservado encontrado para este ID.");
                    setSimulacao(null);
                    setLoading(false);
                    return;
                }
            }

            // 2. Fluxo de Depósito (Simulação Manual) 💰
            if (tipoOp === 'deposito') {
                const v = parseFloat(valor);
                if (!v || v <= 0) {
                    setErro("Informe o valor do DEPÓSITO para simular.");
                    setLoading(false);
                    return;
                }
                
                const taxaPlataforma = v * 0.05;
                const valorLiquido = v - taxaPlataforma;
                const comissaoLoja = v * ((usuario?.taxa_loja || 0) / 100);

                setSimulacao({
                    bruto: v,
                    taxa: taxaPlataforma,
                    liquido: valorLiquido,
                    comissao: comissaoLoja
                });
            }
        } catch (err) {
            setErro(err.message || "Erro ao processar consulta.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarOperacao = async () => {
        setLoading(true);
        limparMensagens();
        try {
            // Se for uma reserva pendente, usamos a rota de confirmação de entrega
            if (simulacao?.isReserva) {
                const res = await api.post('/parceiros/confirmar-entrega', { transacao_id: simulacao.id });
                setSucesso(res.message);
            } else {
                // Fluxo padrão para depósitos
                const payload = {
                    codigo_cliente: codigoCliente,
                    valor: parseFloat(valor),
                    tipo_operacao: tipoOp
                };
                const res = await api.post('/parceiros/intermediar', payload);
                setSucesso(res.message);
            }
            
            setCodigoCliente('');
            setValor('');
            setSimulacao(null);
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro(err.message || "Erro ao processar operação.");
        } finally {
            setLoading(false);
        }
    };

    // Sincronizar status do MP ao entrar na aba config
    useEffect(() => {
        if (activeTab === 'config') {
            api.get('/marketplace/status')
                .then(res => {
                    if (res.conectado) {
                        // Força a atualização do objeto usuário local se detectado conexão
                        if (usuario) usuario.mp_access_token = true;
                    }
                })
                .catch(err => console.error(err));
        }
    }, [activeTab, usuario]);

    const handleGerarPixCaixa = async () => {
        if (!codigoCliente || !valor) {
            setErro("Informe o ID do cliente e o valor.");
            return;
        }
        setLoading(true);
        limparMensagens();
        try {
            const res = await api.post('/parceiros/gerar-pix-caixa', {
                codigo_cliente: codigoCliente,
                valor: parseFloat(valor),
                tipo_operacao: 'deposito'
            });
            // Reutiliza a lógica de exibir QR Code se já existir, ou criamos uma específica
            setQrCodeData(res);
            setSucesso("PIX gerado com sucesso! Peça ao cliente para escanear.");
        } catch (err) {
            setErro(err.message || "Erro ao gerar PIX no terminal.");
        } finally {
            setLoading(false);
        }
    };

    const handleConectarMP = async () => {
        setLoading(true);
        try {
            const res = await api.get('/marketplace/auth-url');
            if (res.url) {
                window.location.href = res.url;
            }
        } catch (err) {
            setErro("Erro ao iniciar conexão com Mercado Pago.");
        } finally {
            setLoading(false);
        }
    };

    const handleDesconectarMP = async () => {
        if (!window.confirm("Deseja realmente desconectar sua conta do Mercado Pago? Você deixará de receber PIX descentralizado.")) return;
        setLoading(true);
        try {
            await api.post('/marketplace/desconectar');
            setSucesso("Conta desconectada com sucesso.");
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro("Erro ao desconectar conta.");
        } finally {
            setLoading(false);
        }
    };

    // Auto-Busca quando o ID está completo (5 caracteres) 🔍
    useEffect(() => {
        if (codigoCliente.length === 5) {
            handleSimularOperacao();
        }
    }, [codigoCliente]);

    const handleTrocarPlano = async (novoPrazo) => {
        setLoading(true);
        limparMensagens();
        try {
            const res = await api.patch('/parceiros/configurar-plano', { prazo: novoPrazo });
            setSucesso(res.message);
            if (onUpdate) onUpdate();
        } catch (err) {
            setErro(err.message || "Erro ao trocar plano.");
        } finally {
            setLoading(false);
        }
    };

    // --- TELA DE CAIXA FECHADO (DESIGN PREMIUM HARMONIZADO) ---
    if (!usuario?.caixa_aberto && activeTab === 'caixa') {
        return (
            <div className="animate-fade-in" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <div className="card" style={{ 
                    textAlign: 'center', 
                    padding: '40px 30px', 
                    maxWidth: '450px', 
                    width: '100%', 
                    borderRadius: 'var(--radius-lg)'
                }}>
                    <div style={{ 
                        width: '90px', 
                        height: '90px', 
                        background: 'rgba(var(--primary-rgb), 0.1)', 
                        borderRadius: '28px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 25px',
                        border: '1px solid var(--border-color)',
                        position: 'relative'
                    }}>
                        <Lock size={42} style={{ color: 'var(--primary)' }} />
                        <div style={{ position: 'absolute', top: -5, right: -5, width: '12px', height: '12px', background: 'var(--danger)', borderRadius: '50%', border: '2px solid var(--background)' }} />
                    </div>

                    <h2 className="text-clamp-h2" style={{ fontWeight: 800, marginBottom: '10px' }}>Turno Encerrado</h2>
                    <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: '35px' }}>
                        Abra o seu turno para começar a transacionar. O valor do fundo de reserva será **debitado** do seu saldo digital.
                    </p>

                    {/* Status de Saldo Disponível */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 15px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <span className="text-muted" style={{ fontSize: '0.65rem', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Saldo Disponível</span>
                            <span className="text-primary" style={{ fontSize: '1.2rem', fontWeight: 900 }}>R$ {usuario?.saldo?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="input-group" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                        <div className="flex-between mb-1">
                            <label className="custom-select-label" style={{ color: 'var(--primary)' }}>Fundo de Reserva</label>
                            <button 
                                onClick={() => setFundoReserva(usuario?.saldo?.toString())}
                                className="badge badge-success"
                                style={{ cursor: 'pointer', border: 'none' }}
                            >
                                USAR SALDO
                            </button>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontWeight: 900, color: 'var(--success)', fontSize: '1.4rem' }}>R$</div>
                            <input 
                                type="number" 
                                className="input-field" 
                                placeholder="0,00"
                                value={fundoReserva}
                                onChange={(e) => setFundoReserva(e.target.value)}
                                style={{ paddingLeft: '50px', fontSize: '1.6rem', fontWeight: 900 }}
                            />
                        </div>
                    </div>

                    <button className="btn btn-primary btn-full" onClick={handleAbrirCaixa} disabled={loading} style={{ height: '60px' }}>
                        {loading ? <RefreshCw className="animate-spin" size={24} /> : <Play fill="currentColor" size={20} />}
                        ABRIR CAIXA E TRABALHAR
                    </button>

                    {erro && <div className="alert alert-danger mt-1">{erro}</div>}
                    {sucesso && <div className="alert alert-success mt-1">{sucesso}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="terminal-parceiro animate-fade-in" style={{ padding: '15px' }}>
            {/* Header Harmonizado */}
            <div className="flex-between mb-2">
                <div>
                    <h1 className="text-clamp-h2" style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '2px' }}>Terminal Parceiro</h1>
                    <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>Gestão de Caixa & Comissões</p>
                </div>
                <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span className="custom-select-label" style={{ fontSize: '0.6rem', color: 'var(--primary)' }}>Sua Taxa Atual</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 900, display: 'block' }}>{usuario?.taxa_loja || 0}% <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Comissão</span></span>
                </div>
            </div>

            {/* Dashboard Mini Cards Glass style */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                <div className="card" style={{ padding: '15px', marginBottom: 0 }}>
                    <span className="custom-select-label" style={{ fontSize: '0.6rem' }}>COMISSÃO DISPONÍVEL</span>
                    <div className="text-success" style={{ fontSize: '1.2rem', fontWeight: 900 }}>R$ {usuario?.comissoes_acumuladas?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="card" style={{ padding: '15px', marginBottom: 0 }}>
                    <span className="custom-select-label" style={{ fontSize: '0.6rem' }}>AGUARDANDO (D+{usuario?.prazo || 0})</span>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--warning)' }}>R$ {usuario?.comissoes_pendentes?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            {/* Tabs de Navegação Estilo PSY PAY (Ajustado) */}
            <div className="flex mb-2" style={{ gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '18px', border: '1px solid var(--border-color)', justifyContent: 'space-between' }}>
                {[
                    { id: 'caixa', label: 'CAIXA' },
                    { id: 'garantias', label: 'GARANTIAS' },
                    { id: 'config', label: 'CONFIG' }
                ].map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)} 
                        className={`flex-1 p-1 rounded-xl font-bold text-xs transition-all ${activeTab === tab.id ? 'bg-primary text-black' : 'text-muted'}`}
                        style={{ 
                            background: activeTab === tab.id ? 'var(--primary)' : 'transparent', 
                            color: activeTab === tab.id ? '#000' : 'var(--text-muted)',
                            border: 'none',
                            cursor: 'pointer',
                            minWidth: '80px'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Conteúdo: CAIXA */}
            {activeTab === 'caixa' && (
                <div className="animate-fade-in">
                    <div className="card mb-2" style={{ border: '1px solid var(--border-color)', padding: '20px' }}>
                        <div className="flex-between mb-2">
                            <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>Nova Operação</h3>
                            <div className="flex" style={{ background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
                                <button onClick={() => setTipoOp('deposito')} className={`text-xs p-1 px-3 rounded-md transition-all ${tipoOp === 'deposito' ? 'bg-success text-black font-bold' : 'text-muted'}`} style={{ background: tipoOp === 'deposito' ? 'var(--success)' : 'transparent', color: tipoOp === 'deposito' ? '#000' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>Depósito</button>
                                <button onClick={() => setTipoOp('saque')} className={`text-xs p-1 px-3 rounded-md transition-all ${tipoOp === 'saque' ? 'bg-danger text-white font-bold' : 'text-muted'}`} style={{ background: tipoOp === 'saque' ? 'var(--danger)' : 'transparent', color: tipoOp === 'saque' ? 'white' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>Saque</button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Código do Cliente (ID)</label>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} className="text-primary" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input type="text" className="input-field" placeholder="Ex: A1B2C" value={codigoCliente} onChange={(e) => setCodigoCliente(e.target.value.toUpperCase())} style={{ paddingLeft: '40px' }} />
                            </div>
                        </div>
                        
                        {tipoOp === 'deposito' && (
                            <div className="input-group animate-slide-up">
                                <label>Valor do Depósito (R$)</label>
                                <div style={{ position: 'relative' }}>
                                    <DollarSign size={16} className="text-primary" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                    <input type="number" className="input-field" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} style={{ paddingLeft: '40px', fontSize: '1.2rem', fontWeight: 700 }} />
                                </div>
                            </div>
                        )}

                        <button 
                            className="btn btn-primary btn-full mt-1" 
                            onClick={handleSimularOperacao}
                            disabled={loading || !codigoCliente}
                            style={{ height: '50px', fontSize: '1rem' }}
                        >
                            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
                            {loading ? 'BUSCANDO...' : 'BUSCAR PEDIDOS'}
                        </button>

                        {tipoOp === 'deposito' && usuario?.mp_access_token && (
                            <button 
                                className="btn btn-full mt-1" 
                                onClick={handleGerarPixCaixa}
                                disabled={loading || !codigoCliente || !valor}
                                style={{ 
                                    height: '50px', 
                                    fontSize: '1rem', 
                                    background: '#009aff', 
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px'
                                }}
                            >
                                <Zap size={20} fill="white" />
                                RECEBER VIA PIX
                            </button>
                        )}
                        
                        <div className="alert mt-1" style={{ padding: '10px', background: 'rgba(255,145,0,0.05)', border: '1px dashed var(--warning)' }}>
                            <AlertTriangle size={14} className="text-warning" />
                            <span style={{ fontSize: '0.7rem', color: 'var(--warning)' }}>Taxa de serviço de 5% aplicada ao cliente.</span>
                        </div>
                    </div>

                    <button className="btn btn-outline btn-full" onClick={handleFecharCaixa} disabled={loading} style={{ opacity: 0.7 }}>
                        Encerrar Turno e Liquidar Comissões
                    </button>

                    {/* Modal/Seção de QR Code no Terminal */}
                    {qrCodeData && (
                        <div className="card mt-2 animate-slide-up" style={{ textAlign: 'center', border: '2px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                            <div className="flex-between mb-2">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Pagar via PIX</h3>
                                <button onClick={() => setQrCodeData(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontWeight: 'bold', cursor: 'pointer' }}>FECHAR</button>
                            </div>
                            
                            <div style={{ background: 'white', padding: '15px', borderRadius: '15px', display: 'inline-block', marginBottom: '15px' }}>
                                <img src={`data:image/png;base64,${qrCodeData.qr_code_base64}`} alt="QR Code PIX" style={{ width: '200px', height: '200px' }} />
                            </div>

                            <div className="input-group">
                                <label>Copia e Cola</label>
                                <input 
                                    type="text" 
                                    readOnly 
                                    value={qrCodeData.qr_code} 
                                    className="input-field" 
                                    onClick={(e) => e.target.select()}
                                    style={{ fontSize: '0.7rem', textAlign: 'center' }}
                                />
                            </div>
                            
                            <p className="text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                                O saldo será creditado automaticamente após o pagamento.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Conteúdo: CONFIGURAÇÕES */}
            {activeTab === 'config' && (
                <div className="animate-fade-in">
                    <div className="card">
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '20px', color: 'var(--primary)' }}>Configurações de Recebimento</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { prazo: 0, taxa: 1, label: 'Fast (Na Hora)', color: 'var(--success)', desc: 'Ideal para capital de giro imediato.' },
                                { prazo: 14, taxa: 2, label: 'Standard (14 dias)', color: 'var(--warning)', desc: 'Equilíbrio entre comissão e espera.' },
                                { prazo: 35, taxa: 3, label: 'Premium (35 dias)', color: '#a855f7', desc: 'Melhor lucro para quem pode esperar.' }
                            ].map(plano => {
                                const isActive = Number(usuario?.prazo) === Number(plano.prazo);
                                return (
                                    <div 
                                        key={plano.prazo}
                                        onClick={() => handleTrocarPlano(plano.prazo)}
                                        className="card-actionable"
                                        style={{
                                            padding: '16px',
                                            borderRadius: 'var(--radius-md)',
                                            border: `2px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'}`,
                                            background: isActive ? 'rgba(255,204,0,0.08)' : 'rgba(255,255,255,0.02)',
                                            margin: 0,
                                            boxShadow: isActive ? '0 0 15px rgba(255,204,0,0.1)' : 'none'
                                        }}
                                    >
                                        <div className="flex-between mb-1">
                                            <div className="flex" style={{ gap: '10px' }}>
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: plano.color }} />
                                                <span style={{ fontWeight: 800, color: isActive ? 'var(--primary)' : 'white' }}>{plano.label}</span>
                                            </div>
                                            <div style={{ fontWeight: 900, color: plano.color, fontSize: '1.1rem' }}>{plano.taxa}%</div>
                                        </div>
                                        <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>{plano.desc}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* SEÇÃO MERCADO PAGO */}
                    <div className="card mt-2" style={{ border: '1px solid rgba(var(--primary-rgb), 0.2)', background: 'rgba(var(--primary-rgb), 0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
                            <div style={{ padding: '10px', background: 'rgba(0,154,255,0.1)', borderRadius: '12px' }}>
                                <Store size={24} color="#009aff" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Integração Financeira</h3>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Receba pagamentos PIX direto na sua conta</p>
                            </div>
                        </div>

                        {usuario?.mp_access_token ? (
                            <div className="animate-fade-in" style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px', border: '1px solid var(--success)' }}>
                                <div className="flex-between mb-1">
                                    <div className="flex" style={{ gap: '8px' }}>
                                        <CheckCircle size={16} color="var(--success)" />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--success)' }}>MERCADO PAGO CONECTADO</span>
                                    </div>
                                    <button 
                                        onClick={handleDesconectarMP}
                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                        Desconectar
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Sua loja já está habilitada para receber depósitos PIX de forma descentralizada.
                                </p>
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <p style={{ fontSize: '0.8rem', marginBottom: '15px', lineHeight: '1.4' }}>
                                    Para que os clientes possam pagar para você via PIX, é necessário vincular sua conta do Mercado Pago.
                                </p>
                                <button 
                                    className="btn btn-primary btn-full" 
                                    onClick={handleConectarMP} 
                                    disabled={loading}
                                    style={{ background: '#009aff', color: 'white', border: 'none' }}
                                >
                                    {loading ? <RefreshCw className="animate-spin" size={20} /> : <Store size={20} />}
                                    CONECTAR MERCADO PAGO
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Confirmação Glass */}
            {simulacao && (
                <div className="modal-overlay">
                    <div className="modal-card animate-slide-up" style={{ maxWidth: '400px' }}>
                        <div className="flex-between mb-2">
                            <h3 style={{ fontWeight: 800 }}>{simulacao.isReserva ? 'Confirmar Entrega' : 'Simulação de Operação'}</h3>
                            <button className="btn-close" onClick={() => setSimulacao(null)}><X size={20} /></button>
                        </div>
                        
                        <div className="info-block mb-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)', textAlign: 'center' }}>
                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>{simulacao.isReserva ? 'CLIENTE IDENTIFICADO' : 'VALOR BRUTO'}</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>
                                {simulacao.isReserva ? simulacao.cliente : `R$ ${simulacao.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                            </div>
                        </div>

                        {simulacao.isReserva ? (
                            <div className="card mb-1" style={{ background: 'rgba(255, 61, 0, 0.05)', border: '1px solid rgba(255, 61, 0, 0.2)' }}>
                                <div className="text-center">
                                    <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 800 }}>MUITO IMPORTANTE: ENTREGAR EM MÃOS</span>
                                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--danger)', margin: '10px 0' }}>
                                        R$ {simulacao.entrega.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>O valor bruto de R$ {simulacao.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} será creditado em sua conta digital.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex-between mb-1">
                                    <span className="text-muted">Crédito p/ Cliente:</span>
                                    <span className="text-success" style={{ fontWeight: 700 }}>R$ {simulacao.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex-between mb-1" style={{ fontSize: '0.9rem' }}>
                                    <span className="text-muted">Taxa Plataforma (5%):</span>
                                    <span style={{ color: 'var(--danger)' }}>R$ {simulacao.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex-between mb-1" style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span className="text-muted">Sua Comissão ({usuario?.taxa_loja || 0}%):</span>
                                    <span className="text-success" style={{ fontWeight: 800 }}>+ R$ {simulacao.comissao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </>
                        )}

                        <div className="flex gap-1 mt-2">
                            <button className="btn btn-primary flex-1" onClick={handleConfirmarOperacao} disabled={loading} style={{ background: simulacao.isReserva ? 'var(--danger)' : 'var(--primary)' }}>
                                {loading ? <RefreshCw className="animate-spin" size={18} /> : (simulacao.isReserva ? 'Confirmar Entrega Dinheiro' : 'Executar Operação')}
                            </button>
                        </div>
                        {erro && <div className="alert alert-danger mt-1">{erro}</div>}
                    </div>
                </div>
            )}

            {/* Notificações Harmonizadas */}
            {erro && <div className="alert alert-danger mt-1 animate-bounce" onClick={() => setErro('')}><AlertTriangle size={20} />{erro}</div>}
            {sucesso && <div className="alert alert-success mt-1 animate-fade-in" onClick={() => setSucesso('')}><CheckCircle size={20} />{sucesso}</div>}
        </div>
    );
};

export default CaixaParceiro;
