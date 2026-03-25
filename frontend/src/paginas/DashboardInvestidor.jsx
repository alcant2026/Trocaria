import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import {
    Wallet,
    TrendingUp,
    PlusCircle,
    ArrowUpCircle,
    ArrowDownCircle,
    Lock,
    Unlock,
    Briefcase,
    ChevronRight,
    Eye,
    EyeOff,
    Search,
    ArrowRight,
    ShieldAlert,
    Copy,
    Check,
    AlertCircle,
    FileText,
    CheckCircle2,
    History,
    Bolt,
    Clock,
    Store,
    ArrowLeft
} from 'lucide-react';

// Hook de countdown reutilizável
const useCountdown = (isoDate) => {
    const calcularRestante = useCallback(() => {
        if (!isoDate) return null;
        const diff = new Date(isoDate + 'Z') - new Date();
        if (diff <= 0) return 'Expirado';
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (h >= 24) {
            const d = Math.floor(h / 24);
            return `${d}d ${h % 24}h restantes`;
        }
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, [isoDate]);
    const [tempo, setTempo] = useState(calcularRestante);
    useEffect(() => {
        if (!isoDate) return;
        const id = setInterval(() => setTempo(calcularRestante()), 1000);
        return () => clearInterval(id);
    }, [isoDate, calcularRestante]);
    return tempo;
};

// Timer inline para cada card
const TimerCard = ({ expira4h, expira5d }) => {
    const t4h = useCountdown(expira4h);
    const t5d = useCountdown(expira5d);
    const expirado4h = !expira4h || new Date(expira4h + 'Z') <= new Date();
    return (
        <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '4px 10px', borderRadius: '8px', background: expirado4h ? 'rgba(255,61,0,0.08)' : 'rgba(255,145,0,0.08)', color: expirado4h ? 'var(--danger)' : 'var(--warning)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        <Bolt size={12} /> {t4h || '—'}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>Janela rápida (prioridade)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', padding: '4px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        <Clock size={12} /> {t5d || '—'}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', paddingLeft: '4px' }}>Prazo total do pedido</span>
                </div>
            </div>
        </div>
    );
};

// Mapeamento global de tipos de transação
const TIPOS_LABEL = {
    deposito: 'Depósito',
    saque: 'Saque',
    investimento: 'Investimento',
    recebimento: 'Recebimento',
    compra_score: 'Compra de Score',
    desbloqueio_dados: 'Taxa de Verificação',
    taxa_saque: 'Taxa de Saque',
    taxa_intermediacao: 'Taxa de Intermediação',
    taxa_conveniencia: 'Taxa de Conveniência',
    pagamento_parcela: 'Pagamento de Parcela',
    comissao_parceiro: 'Comissão Recebida',
};
const TIPOS_TAXA = new Set(['compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'saque', 'investimento', 'pagamento_parcela']);
const TIPOS_ENTRADA = new Set(['deposito', 'recebimento', 'comissao_parceiro']);
const TIPOS_NEGATIVO = new Set(['saque', 'investimento', 'compra_score', 'desbloqueio_dados', 'taxa_saque', 'taxa_intermediacao', 'taxa_conveniencia', 'pagamento_parcela']);
const formatarTipo = (tipo, detalhes) => {
    if (tipo === 'desbloqueio_dados') {
        if (detalhes?.toLowerCase().includes('empr')) return 'Taxa de Solicitação';
        return 'Taxa de Verificação';
    }
    return TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';
};
const prefixoValor = (tipo) => TIPOS_ENTRADA.has(tipo) ? '+' : '-';
const corValor = (tipo) => TIPOS_TAXA.has(tipo) || tipo === 'saque' || tipo === 'investimento' ? 'var(--danger)' : TIPOS_ENTRADA.has(tipo) ? 'var(--success)' : 'var(--text-main)';

import ModalPremium from '../componentes/ModalPremium';

import TermosUso from '../componentes/TermosUso';
import CaixaInvestidor from './CaixaInvestidor';
import CaixaParceiro from './CaixaParceiro';

const DashboardInvestidor = () => {
    const [usuario, setUsuario] = useState({ nome: '', saldo: 0, score: 0 });
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [carteira, setCarteira] = useState([]);
    const [activeView, setActiveView] = useState('home'); // 'home', 'mercado', 'carteira', 'depositar', 'resgatar'
    const [verSaldo, setVerSaldo] = useState(true);
    const [showTermos, setShowTermos] = useState(false);
    const [copiadoPix, setCopiadoPix] = useState(false);
    const [copiadoId, setCopiadoId] = useState(false);

    // Forms state
    const [valorNotificacao, setValorNotificacao] = useState('');
    const [metodoDeposito, setMetodoDeposito] = useState('pix'); // 'pix' ou 'especie'
    const [parceiroIdDeposito, setParceiroIdDeposito] = useState('');
    const [parceiros, setParceiros] = useState([]);

    const [valorSaque, setValorSaque] = useState('');
    const [metodoSaque, setMetodoSaque] = useState('pix'); // 'pix' ou 'especie'
    const [parceiroIdSaque, setParceiroIdSaque] = useState('');

    const [valorInvestir, setValorInvestir] = useState({});
    const [aceiteRisco, setAceiteRisco] = useState({}); // Controle por ID de solicitação
    const [senhaSaque, setSenhaSaque] = useState('');
    const [showSenhaSaque, setShowSenhaSaque] = useState(false);
    const [codigo2faSaque, setCodigo2faSaque] = useState('');
    const [passoDeposito, setPassoDeposito] = useState(1);
    const [passoSaque, setPassoSaque] = useState(1);
    const [passoApoio, setPassoApoio] = useState(1);
    const [solicitacaoEmApoio, setSolicitacaoEmApoio] = useState(null); // ID do pedido sendo apoiado
    const [mensagem, setMensagem] = useState(null);

    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => {
                setMensagem(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);
    const [mostrarAlertaRejeicao, setMostrarAlertaRejeicaoState] = useState(
        () => localStorage.getItem('alerta_rejeicao_investidor') !== 'fechado'
    );

    const fecharAlertaRejeicao = () => {
        localStorage.setItem('alerta_rejeicao_investidor', 'fechado');
        setMostrarAlertaRejeicaoState(false);
    };
    const [historico, setHistorico] = useState([]);
    const [kycDetails, setKycDetails] = useState('');
    const [paginaHist, setPaginaHist] = useState(1);
    const [paginaCarteiraHome, setPaginaCarteiraHome] = useState(1);
    const [paginaOportunidades, setPaginaOportunidades] = useState(1);
    const ITENS_POR_PAGINA = 5;

    // Modal Premium State
    const [modalPremium, setModalPremium] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info',
        onConfirm: null,
        confirmText: 'Confirmar'
    });
    const [loadingAction, setLoadingAction] = useState(false);

    const closeModal = () => setModalPremium(prev => ({ ...prev, isOpen: false }));
    const showModal = (config) => setModalPremium({ ...config, isOpen: true });

    // Modal state legado
    const [modal, setModal] = useState({ open: false, type: '', data: null });

    const copiarPix = () => {
        navigator.clipboard.writeText('91980177874');
        setCopiadoPix(true);
        setTimeout(() => setCopiadoPix(false), 2000);
    };

    const handleCopiarId = () => {
        navigator.clipboard.writeText(usuario.id);
        setCopiadoId(true);
        setTimeout(() => setCopiadoId(false), 2000);
    };

    const carregarSnapshot = async () => {
        try {
            const res = await api.get('/snapshot');
            if (res.perfil) {
                setUsuario(res.perfil);
                localStorage.setItem('usuario', JSON.stringify(res.perfil));
            }
            if (res.investidor) {
                setSolicitacoes(res.investidor.solicitacoes_disponiveis || []);
                setCarteira(res.investidor.carteira || []);
            }
            if (res.historico) {
                setHistorico(res.historico);
            }
            
            // Carregar parceiros se necessário
            const resParceiros = await api.get('/financeiro/admin/parceiros');
            setParceiros(resParceiros || []);
        } catch (err) {
            console.error('Erro ao carregar snapshot:', err);
        }
    };

    // Smart Polling (30s) + Visibility Update
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) carregarSnapshot();
        }, 30000);

        const handleVisibility = () => {
            if (!document.hidden) carregarSnapshot();
        };

        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    useEffect(() => {
        carregarSnapshot();
    }, [activeView]);

    const handleInvestir = async (solicitacaoId) => {
        const valor = valorInvestir[solicitacaoId];
        const aceite = aceiteRisco[solicitacaoId];

        const v = parseFloat(valor);
        if (!v || v <= 0) return showModal({ title: 'Valor Inválido', message: 'Digite um valor de investimento maior que zero.', type: 'error' });
        if (!aceite) return showModal({ title: 'Aviso de Risco', message: 'Você deve aceitar os riscos do investimento para continuar.', type: 'warning' });

        try {
            await api.post(`/investidor/investir/${solicitacaoId}`, {
                valor: parseFloat(valor),
                aceite_risco: true
            });
            setMensagem('Investimento realizado com sucesso!');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleNotificarDeposito = async () => {
        const v = parseFloat(valorNotificacao);
        if (!v || v <= 0) {
            showModal({ title: 'Valor Inválido', message: 'Informe um valor de depósito maior que zero.', type: 'error' });
            return;
        }
        if (metodoDeposito === 'especie' && !parceiroIdDeposito) {
            showModal({ title: 'Parceiro Obrigatório', message: 'Selecione o estabelecimento onde fará o depósito.', type: 'warning' });
            return;
        }
        try {
            await api.post('/financeiro/notificar-deposito', { 
                valor: v,
                metodo: metodoDeposito,
                parceiro_id: metodoDeposito === 'especie' ? parseInt(parceiroIdDeposito) : null
            });
            setMensagem('Notificação enviada!');
            setValorNotificacao('');
            setParceiroIdDeposito('');
            carregarSnapshot();
            setActiveView('home');
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const handleSolicitarSaque = async () => {
        if (!senhaSaque || !codigo2faSaque) {
            setMensagem('Erro: Senha e Código 2FA são obrigatórios.');
            return;
        }
        const v = parseFloat(valorSaque);
        if (!v || v <= 0) {
            setMensagem('Erro: O valor de saque deve ser maior que zero.');
            return;
        }
        if (metodoSaque === 'especie' && !parceiroIdSaque) {
            setMensagem('Erro: Selecione o parceiro para saque em espécie.');
            return;
        }
        try {
            await api.post('/financeiro/solicitar-saque', {
                valor: v || 0,
                metodo: metodoSaque || 'pix',
                parceiro_id: metodoSaque === 'especie' ? (parseInt(parceiroIdSaque) || null) : null,
                chave_pix: metodoSaque === 'pix' ? (usuario.chave_pix || "") : "",
                senha: senhaSaque || "",
                codigo_2fa: codigo2faSaque || ""
            });
            setMensagem('Solicitação de saque enviada com sucesso!');
            setValorSaque('');
            setSenhaSaque('');
            setCodigo2faSaque('');
            setParceiroIdSaque('');
            setActiveView('home');
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        }
    };

    const confirmarDesbloqueio = async (solicitacaoId) => {
        setLoadingAction(true);
        try {
            const res = await api.post(`/emprestimos/desbloquear-dados/${solicitacaoId}`);
            showModal({ title: 'Sucesso!', message: res.message, type: 'success' });
            carregarSnapshot();
        } catch (err) {
            showModal({ title: 'Erro', message: err.message || 'Erro ao desbloquear.', type: 'error' });
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDesbloquear = (solicitacaoId) => {
        showModal({
            title: 'Desbloquear Perfil',
            message: 'Deseja desbloquear os dados completos deste perfil por R$ 15,00? \n\n O desbloqueio permite sua análise detalhada, mas não garante o pagamento do empréstimo.',
            type: 'finance',
            onConfirm: async () => {
                closeModal();
                await confirmarDesbloqueio(solicitacaoId);
            }
        });
    };

    const baixarContrato = async (id) => {
        try {
            const blob = await api.getBlob(`/emprestimos/contrato/pdf/${id}`);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `contrato_psy pay_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Erro ao baixar contrato:', err);
        }
    };


    const totalInvestido = carteira.reduce((acc, item) => acc + item.valor_investido, 0);

    return (
        <div className="investidor-dashboard">
            <header className="mb-1">
                <h1>Meus Aportes (Fundo Coletivo)</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div
                        onClick={handleCopiarId}
                        style={{
                            fontSize: '0.65rem',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            border: '1px solid var(--border-color)',
                            color: copiadoId ? 'var(--success)' : 'var(--text-muted)',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        {copiadoId ? <Check size={12} /> : <Copy size={12} />}
                        ID: {usuario.id}
                    </div>
                </div>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Gestão estratégica de capital e ativos P2P.</p>
            </header>

            {mensagem && (
                <div className={`alert ${typeof mensagem === 'string' && mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'}`}>
                    <span>{typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem)}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Grid de Saldo e Performance */}
            <div className="grid-2">
                {/* Wallet Overview Card */}
                <div className="card card-actionable" onClick={() => setActiveView('home')}>
                    <div className="flex-between mb-1">
                        <div className="flex-between" style={{ gap: '10px' }}>
                            <Wallet size={20} color="var(--success)" />
                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>Ativos e Saldo</span>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" />
                    </div>

                    {(() => {
                        const totalRecebido = carteira.reduce((acc, item) => acc + (item.valor_recebido || 0), 0);
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                                    <div>
                                        <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>SALDO DISPONÍVEL</p>
                                        {verSaldo ? (
                                            <h2 style={{ fontSize: '2.2rem', color: 'var(--success)', marginBottom: '1.5rem' }}>
                                                R$ {(usuario.saldo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </h2>
                                        ) : (
                                            <div style={{ height: '40px', width: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1.5rem' }} />
                                        )}

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Total Investido: <strong style={{ color: 'var(--text-main)' }}>R$ {totalInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                            </p>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Já Recebido: <strong style={{ color: 'var(--success)' }}>R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setVerSaldo(!verSaldo); }} 
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '10px' }}
                                    >
                                        {verSaldo ? <Eye size={24} /> : <EyeOff size={24} />}
                                    </button>
                                </div>

                                {historico.length > 0 && (() => {
                                    const diasAgrupados = historico.reduce((acc, item) => {
                                        if (!item.data) return acc;
                                        const dia = new Date(item.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                        const isNegativo = TIPOS_NEGATIVO.has(item.tipo);
                                        const valorReal = isNegativo ? -Math.abs(item.valor || 0) : Math.abs(item.valor || 0);
                                        if (!acc[dia]) acc[dia] = { dia, saldo: 0, operacoes: 0 };
                                        acc[dia].saldo += valorReal;
                                        acc[dia].operacoes += 1;
                                        return acc;
                                    }, {});
                                    const diasArray = Object.values(diasAgrupados).slice(0, 10).reverse();
                                    const maxValDia = Math.max(...diasArray.map(d => Math.abs(d.saldo)), 1);
                                    return (
                                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                                            <div className="flex-between mb-1">
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Fluxo Recente</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{diasArray.length} Dias</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '50px', gap: '8px' }}>
                                                {diasArray.map((d, idx) => {
                                                    const isGreen = d.saldo >= 0;
                                                    const height = Math.max(6, (Math.abs(d.saldo) / maxValDia) * 50);
                                                    return (
                                                        <div key={idx} style={{ flex: 1, height: `${height}px`, background: isGreen ? 'var(--success)' : 'var(--danger)', borderRadius: '4px', opacity: 0.8 }} title={`${d.dia}: R$ ${d.saldo.toLocaleString('pt-BR')}`}></div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })()}
                </div>

                {/* Performance Card - Now visible on mobile too */}
                <div className="card">
                    <div className="flex-between mb-1">
                        <div className="flex-between" style={{ gap: '10px' }}>
                            <TrendingUp size={20} color="var(--primary)" />
                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>Performance da Carteira</span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
                        <div className="info-block" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                            <div className="info-label" style={{ fontSize: '0.7rem', fontWeight: 700 }}>Rentabilidade Total</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: totalInvestido > 0 && (((carteira.reduce((a, i) => a + (i.valor_recebido || 0), 0) - totalInvestido) / totalInvestido) * 100) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {totalInvestido > 0 ? (((carteira.reduce((a, i) => a + (i.valor_recebido || 0), 0) - totalInvestido) / totalInvestido) * 100).toFixed(1) : '0.0'}%
                            </div>
                        </div>

                        {/* Rentabilidade por Mês (Últimos 12 Meses) */}
                        <div style={{ padding: '0 4px' }}>
                            <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 800 }}>Lucro Mensal (12 Meses)</h4>
                            {(() => {
                                const lucrosMensaisRaw = historico.reduce((acc, h) => {
                                    if (!h.data || h.status !== 'concluido') return acc;
                                    const data = new Date(h.data);
                                    // Chave Única por Mês/Ano para ordenação
                                    const chaveSort = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
                                    const label = data.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '');
                                    
                                    if (!acc[chaveSort]) acc[chaveSort] = { label, lucro: 0 };
                                    
                                    // Ganhos: Recebimento de parcela ou comissão
                                    if (h.tipo === 'recebimento' || h.tipo === 'comissao_parceiro') {
                                        acc[chaveSort].lucro += (h.valor || 0);
                                    }
                                    // Custos Operacionais (Taxas deduzidas do lucro direto do investidor)
                                    if (['taxa_intermediacao', 'taxa_conveniencia', 'compra_score', 'desbloqueio_dados'].includes(h.tipo)) {
                                        acc[chaveSort].lucro -= (h.valor || 0);
                                    }
                                    return acc;
                                }, {});

                                // Ordenar e pegar os últimos 12 meses
                                const mensalidades = Object.keys(lucrosMensaisRaw)
                                    .sort((a, b) => b.localeCompare(a))
                                    .slice(0, 12)
                                    .map(key => lucrosMensaisRaw[key]);

                                if (mensalidades.length === 0) return <p className="text-muted" style={{ fontSize: '0.75rem' }}>Nenhum lucro registrado no período.</p>;

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {mensalidades.map((m, idx) => (
                                            <div key={idx} className="flex-between" style={{ paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', textTransform: 'capitalize' }}>{m.label}</span>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: m.lucro >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                    {m.lucro >= 0 ? '+' : ''} R$ {Math.abs(m.lucro).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="grid-2" style={{ gap: '12px' }}>
                            <div className="info-block" style={{ padding: '12px' }}>
                                <div className="info-label" style={{ fontSize: '0.65rem' }}>Ativos</div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{carteira.length} Contratos</div>
                            </div>
                            <div className="info-block" style={{ padding: '12px' }}>
                                <div className="info-label" style={{ fontSize: '0.65rem' }}>Recebível</div>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--primary)' }}>R$ {carteira.reduce((a, i) => a + (i.valor_restante || 0), 0).toLocaleString('pt-BR')}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Mosaic / Grid - Header for Active View */}
            {activeView !== 'home' && (
                <div className="flex-between mb-1 animate-fade-in" style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button 
                            onClick={() => { setActiveView('home'); setPassoDeposito(1); setPassoSaque(1); }}
                            style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <h2 style={{ fontSize: '1.1rem', margin: 0, textTransform: 'capitalize' }}>
                            {activeView === 'caixa_pool' ? 'Caixa (Pool)' : activeView === 'mercado' ? 'Oportunidades' : activeView}
                        </h2>
                    </div>
                </div>
            )}

            {/* Action Mosaic / Grid - Only visible in 'home' view */}
            {activeView === 'home' && (
                <div className="action-grid animate-fade-in">
                    <div className="action-btn" onClick={() => setActiveView('mercado')}>
                        <TrendingUp size={28} color="var(--primary)" />
                        <span>Oportunidades</span>
                    </div>
                    <div className="action-btn" onClick={() => setActiveView('depositar')}>
                        <ArrowUpCircle size={28} />
                        <span>Depositar</span>
                    </div>
                    <div className="action-btn" onClick={() => setActiveView('saque')}>
                        <ArrowDownCircle size={28} />
                        <span>Sacar</span>
                    </div>
                    <div className="action-btn" onClick={() => setActiveView('historico')}>
                        <History size={28} />
                        <span>Histórico</span>
                    </div>
                    <div className="action-btn" onClick={() => setActiveView('carteira')}>
                        <Briefcase size={28} />
                        <span>Carteira</span>
                    </div>
                    <div className="action-btn" onClick={() => setActiveView('caixa_pool')} style={{ borderColor: 'var(--primary)', background: 'rgba(var(--primary-rgb), 0.05)' }}>
                        <TrendingUp size={28} color="var(--primary)" />
                        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Caixa (Pool)</span>
                    </div>
                </div>
            )}

            {activeView === 'home' && (
                <div className="home-content">
                    {/* Alerta de Rejeição Recente */}
                    {mostrarAlertaRejeicao && historico.some(h => h.status === 'falhou') && (
                        <div className="alert alert-danger mb-1" style={{ maxWidth: '100%', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', position: 'relative' }}>
                            <button
                                onClick={fecharAlertaRejeicao}
                                style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}
                            >
                                ✕
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={20} />
                                <strong style={{ fontSize: '0.9rem' }}>Atenção: Você tem solicitações rejeitadas</strong>
                            </div>
                            <p style={{ margin: '8px 0 0 28px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                                Veja o motivo detalhado no seu histórico abaixo.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {activeView === 'historico' && (
                <div className="card mt-1">
                    <div className="flex-between mb-1">
                        <h3>Últimas Atividades</h3>
                        <History size={18} color="var(--text-muted)" />
                    </div>
                    {historico.length === 0 ? (
                        <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>Nenhuma movimentação recente.</p>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {historico.slice((paginaHist - 1) * ITENS_POR_PAGINA, paginaHist * ITENS_POR_PAGINA).map(h => (
                                    <div key={h.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: `3px solid ${h.status === 'falhou' ? 'var(--danger)' : h.status === 'pendente' ? 'var(--warning)' : (TIPOS_NEGATIVO.has(h.tipo) || h.tipo === 'saque' || h.tipo === 'investimento') ? 'var(--danger)' : 'var(--success)'}` }}>
                                        <div className="flex-between">
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase' }}>{formatarTipo(h.tipo, h.detalhes)}</p>
                                                <p className="text-muted" style={{ fontSize: '0.7rem' }}>{h.data ? new Date(h.data).toLocaleString('pt-BR') : '-'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p style={{ fontWeight: 800, color: corValor(h.tipo) }}>
                                                    {prefixoValor(h.tipo)} R$ {h.valor?.toLocaleString('pt-BR')}
                                                </p>
                                                {(!TIPOS_NEGATIVO.has(h.tipo) || h.status !== 'concluido') && (
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: h.status === 'concluido' ? 'var(--success)' : h.status === 'falhou' ? 'var(--danger)' : 'var(--warning)' }}>
                                                        {h.status?.toUpperCase() || '-'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {h.status === 'falhou' && h.detalhes && (
                                            <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255, 61, 0, 0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255, 61, 0, 0.1)' }}>
                                                <AlertCircle size={14} color="var(--danger)" />
                                                <p style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>{h.detalhes}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {historico.length > ITENS_POR_PAGINA && (
                                <div className="flex-between mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                    <button
                                        className="btn-outline"
                                        style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: paginaHist === 1 ? 0.3 : 1, width: 'auto' }}
                                        disabled={paginaHist === 1}
                                        onClick={() => setPaginaHist(p => p - 1)}
                                    >
                                        Anterior
                                    </button>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Página {paginaHist} de {Math.ceil(historico.length / ITENS_POR_PAGINA)}</span>
                                    <button
                                        className="btn-outline"
                                        style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: (paginaHist * ITENS_POR_PAGINA) >= historico.length ? 0.3 : 1, width: 'auto' }}
                                        disabled={(paginaHist * ITENS_POR_PAGINA) >= historico.length}
                                        onClick={() => setPaginaHist(p => p + 1)}
                                    >
                                        Próxima
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                        {/* Removido botão redundante no rodapé */}
                    </div>
                )
            }

            {/* Market Opportunities Detail View */}

            {activeView === 'mercado' && (
                <div className="mt-1">
                    <div className="flex-between mb-1">
                        <h3>Apoio Comunitário</h3>
                    </div>

                    {solicitacoes.length === 0 ? (
                        <div className="card text-center text-muted">Aguardando novos pedidos...</div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                {solicitacoes.slice((paginaOportunidades - 1) * ITENS_POR_PAGINA, paginaOportunidades * ITENS_POR_PAGINA).map(sol => (
                                    <div key={sol.id} className="card">
                                        <div className="flex-between mb-1">
                                            <div>
                                                <div className="flex-between" style={{ gap: '8px' }}>
                                                    <h3 style={{ textTransform: 'capitalize' }}>{sol.nome || 'Dados Ocultos'}</h3>
                                                    {sol.verified && <CheckCircle2 size={16} color="var(--success)" title="Verificado" />}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                                                    <p className="text-muted" style={{ fontSize: '0.7rem' }}>Score: {sol.score}</p>
                                                    <span style={{ 
                                                        fontSize: '0.65rem', 
                                                        padding: '2px 8px', 
                                                        borderRadius: '10px', 
                                                        background: sol.tipo_garantia === 'hibrida' ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.05)',
                                                        color: sol.tipo_garantia === 'hibrida' ? 'var(--success)' : 'var(--text-muted)',
                                                        fontWeight: 700,
                                                        border: `1px solid ${sol.tipo_garantia === 'hibrida' ? 'rgba(0,230,118,0.2)' : 'rgba(255,255,255,0.1)'}`
                                                    }}>
                                                        {sol.tipo_garantia === 'hibrida' ? '⚡ JATO' : sol.tipo_garantia === 'fisica' ? '📦 FÍSICA' : '👥 SOCIAL'}
                                                    </span>
                                                </div>
                                                {sol.unlocked && (
                                                    <div style={{ marginTop: '8px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                        {sol.tipo_garantia === 'fisica' || sol.tipo_garantia === 'hibrida' ? (
                                                            <div style={{ marginBottom: (sol.garantidores?.length > 0 || sol.parceiro_nome) ? '12px' : 0 }}>
                                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Bem em Custódia:</p>
                                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontWeight: 500, marginBottom: '6px' }}>{sol.garantia_descricao || 'Aguardando detalhamento...'}</p>
                                                                
                                                                {sol.parceiro_nome && (
                                                                    <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '6px', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                                                            <Store size={12} color="var(--primary)" />
                                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)' }}>{sol.parceiro_nome}</span>
                                                                        </div>
                                                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '18px' }}>{sol.parceiro_endereco}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : null}
                                                        
                                                        {sol.garantidores?.length > 0 && (
                                                            <div>
                                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>Garantidores Sociais:</p>
                                                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                                    {sol.garantidores.map((g, idx) => (
                                                                        <span key={idx} style={{ fontSize: '0.75rem', color: g.aceito ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                                                                            @{g.nome}{idx < sol.garantidores.length - 1 ? ',' : ''}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.2rem' }}>
                                                    {sol.unlocked ? `${sol.taxa}%` : '●●●%'} <span style={{ fontSize: '0.7rem' }}>a.m</span>
                                                </p>
                                            </div>
                                        </div>
                                        {/* Temporizador */}
                                        <TimerCard expira4h={sol.expira_4h} expira5d={sol.expira_5d} />

                                        <div className="info-block mb-1">
                                            <div className="flex-between" style={{ marginBottom: '8px' }}>
                                                <span className="info-label">Meta</span>
                                                <span style={{ fontWeight: 600 }}>{sol.unlocked ? `R$ ${sol.valor.toLocaleString('pt-BR')}` : 'R$ ●●●'}</span>
                                            </div>
                                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                                                <div style={{ width: `${(sol.valor_arrecadado / sol.valor) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                                            </div>
                                            <div className="flex-between text-muted" style={{ fontSize: '0.7rem' }}>
                                                <span>Valor Necessário: {sol.unlocked ? `R$ ${(sol.valor - sol.valor_arrecadado).toLocaleString('pt-BR')}` : 'R$ ●●●'}</span>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div>Prazo: {sol.unlocked ? `${sol.parcelas}x` : '●●●x'}</div>
                                                    {sol.unlocked && (
                                                        <div style={{ color: 'var(--success)', fontWeight: 600 }}>Total: R$ {(sol.valor * (1 + (sol.taxa / 100) * sol.parcelas)).toLocaleString('pt-BR')}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {!sol.unlocked ? (
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <button
                                                    className="btn btn-outline"
                                                    style={{ borderStyle: 'dashed', width: 'auto', minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                                    onClick={() => handleDesbloquear(sol.id)}
                                                >
                                                    <Lock size={16} /> Desbloquear Perfil (R$ 15)
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {/* WIZARD DE APOIO COMUNITÁRIO */}
                                                {solicitacaoEmApoio !== sol.id ? (
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                        <button 
                                                            className="btn btn-primary" 
                                                            style={{ width: 'auto', padding: '0.4rem 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                            onClick={() => {
                                                                setSolicitacaoEmApoio(sol.id);
                                                                setPassoApoio(1);
                                                            }}
                                                        >
                                                            Apoiar Agora <ArrowRight size={18} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="animate-scale-in" style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '15px', borderRadius: '12px', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                                                        <div className="flex-between mb-1">
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>Passo {passoApoio} de 3</span>
                                                            <button className="btn-icon" onClick={() => setSolicitacaoEmApoio(null)} style={{ padding: '2px' }}><History size={16} /></button>
                                                        </div>

                                                        {passoApoio === 1 && (
                                                            <div className="animate-fade-in">
                                                                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Valor do apoio:</label>
                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                                        <input
                                                                            type="number"
                                                                            className="input-field"
                                                                            placeholder="R$ 0,00"
                                                                            style={{ border: 'none', background: 'transparent', margin: 0, padding: '0.6rem', textAlign: 'center', width: '100%', fontWeight: 700 }}
                                                                            value={valorInvestir[sol.id] || ''}
                                                                            onChange={(e) => setValorInvestir({ ...valorInvestir, [sol.id]: e.target.value })}
                                                                        />
                                                                    </div>
                                                                    <button 
                                                                        className="btn btn-primary" 
                                                                        style={{ width: 'auto', padding: '0.6rem 1rem' }}
                                                                        onClick={() => {
                                                                            if (parseFloat(valorInvestir[sol.id]) > 0) {
                                                                                if (parseFloat(valorInvestir[sol.id]) > (sol.valor - sol.valor_arrecadado)) {
                                                                                    showModal({ title: 'Valor Excedido', message: `O máximo restante para este apoio é R$ ${(sol.valor - sol.valor_arrecadado).toLocaleString('pt-BR')}`, type: 'warning' });
                                                                                } else {
                                                                                    setPassoApoio(2);
                                                                                }
                                                                            }
                                                                            else showModal({ title: 'Valor Inválido', message: 'Digite um valor acima de zero.', type: 'error' });
                                                                        }}
                                                                    >
                                                                        Próximo
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {passoApoio === 2 && (
                                                            <div className="animate-fade-in">
                                                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', marginBottom: '12px' }}>
                                                                    <div className="flex-between" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                                                                        <span className="text-muted">Total a receber:</span>
                                                                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>R$ {(parseFloat(valorInvestir[sol.id]) + (parseFloat(valorInvestir[sol.id]) * (sol.taxa / 100) * sol.parcelas * 0.9)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                    <div className="flex-between" style={{ fontSize: '0.75rem' }}>
                                                                        <span className="text-muted">Lucro Líquido (pós 10%):</span>
                                                                        <span style={{ fontWeight: 600 }}>R$ {(parseFloat(valorInvestir[sol.id]) * (sol.taxa / 100) * sol.parcelas * 0.9).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(255, 61, 0, 0.05)', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        id={`risco-wiz-${sol.id}`}
                                                                        checked={aceiteRisco[sol.id] || false}
                                                                        onChange={(e) => setAceiteRisco({ ...aceiteRisco, [sol.id]: e.target.checked })}
                                                                    />
                                                                    <label htmlFor={`risco-wiz-${sol.id}`} style={{ fontSize: '0.7rem' }}>Aceito os riscos P2P e os Termos de Uso.</label>
                                                                </div>

                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem' }} onClick={() => setPassoApoio(1)}>Voltar</button>
                                                                    <button 
                                                                        className="btn btn-primary" 
                                                                        style={{ flex: 2, padding: '0.4rem' }}
                                                                        disabled={!aceiteRisco[sol.id]}
                                                                        onClick={() => setPassoApoio(3)}
                                                                    >
                                                                        Revisar Apoio
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {passoApoio === 3 && (
                                                            <div className="animate-fade-in text-center">
                                                                <div className="info-block" style={{ marginBottom: '15px' }}>
                                                                    <div className="info-label">Confirmar Apoio</div>
                                                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>R$ {parseFloat(valorInvestir[sol.id]).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem' }} onClick={() => setPassoApoio(2)}>Voltar</button>
                                                                    <button 
                                                                        className="btn btn-success" 
                                                                        style={{ flex: 2, padding: '0.4rem', fontWeight: 700 }}
                                                                        onClick={async () => {
                                                                            await handleInvestir(sol.id);
                                                                            setSolicitacaoEmApoio(null);
                                                                        }}
                                                                    >
                                                                        Confirmar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {solicitacoes.length > ITENS_POR_PAGINA && (
                                <div className="flex-between mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                                    <button
                                        className="btn-outline"
                                        style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: paginaOportunidades === 1 ? 0.3 : 1, width: 'auto' }}
                                        disabled={paginaOportunidades === 1}
                                        onClick={() => setPaginaOportunidades(p => p - 1)}
                                    >
                                        Anterior
                                    </button>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Página {paginaOportunidades} de {Math.ceil(solicitacoes.length / ITENS_POR_PAGINA)}</span>
                                    <button
                                        className="btn-outline"
                                        style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: (paginaOportunidades * ITENS_POR_PAGINA) >= solicitacoes.length ? 0.3 : 1, width: 'auto' }}
                                        disabled={(paginaOportunidades * ITENS_POR_PAGINA) >= solicitacoes.length}
                                        onClick={() => setPaginaOportunidades(p => p + 1)}
                                    >
                                        Próxima
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}


            {activeView === 'carteira' && (
                <div className="mt-1">
                    <div className="flex-between mb-1">
                        <h3>Minha Carteira</h3>
                    </div>
                    {carteira.length === 0 ? (
                        <div className="card text-center text-muted">Você ainda não investiu em ativos.</div>
                    ) : (
                        carteira.map(item => (
                            <div key={item.id} className="card">
                                <div className="flex-between mb-1">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h3 style={{ fontSize: '1rem', textTransform: 'capitalize' }}>{item.tomador_nome}</h3>
                                        <span className="text-muted" style={{ fontSize: '0.8rem' }}># {item.solicitacao_id}</span>
                                        {item.tomador_is_verified && <CheckCircle2 size={16} color="var(--success)" title="Verificado" />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button 
                                            onClick={() => baixarContrato(item.solicitacao_id)} 
                                            className="btn-icon" 
                                            title="Baixar Contrato PDF"
                                            style={{ background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '8px', color: 'var(--text-main)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <div className={`badge ${item.status_emprestimo === 'concluido' ? 'badge-primary' : 'badge-success'}`}>
                                            {item.status_emprestimo === 'concluido' ? 'CONCLUÍDO' : 'RENTABILIZANDO'}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                                        <span className="text-muted">VALOR MENSAL:</span>
                                        <span style={{ fontWeight: 700 }}>R$ {item.valor_mensal.toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                                <div className="grid-2" style={{ gap: '10px', marginTop: '10px' }}>
                                    <div className="info-block" style={{ margin: 0 }}>
                                        <div className="info-label">Aplicado</div>
                                        <div style={{ fontWeight: 600 }}>R$ {item.valor_investido.toLocaleString('pt-BR')}</div>
                                    </div>
                                    <div className="info-block" style={{ margin: 0 }}>
                                        <div className="info-label">Restante</div>
                                        <div style={{ fontWeight: 600, color: 'var(--success)' }}>R$ {item.valor_restante.toLocaleString('pt-BR')}</div>
                                    </div>
                                </div>
                                <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.8rem' }}>
                                    <span>Recebido: R$ {item.valor_recebido.toLocaleString('pt-BR')}</span>
                                    <span>Prazo: {item.parcelas_pagas}/{item.total_parcelas}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeView === 'caixa_pool' && (
                <div className="mt-1">
                    <div className="flex-between mb-1">
                        <h3>Gestão do Caixa</h3>
                    </div>
                    <CaixaInvestidor
                        usuario={usuario}
                        onUpdate={carregarSnapshot}
                        showModal={showModal}
                        closeModal={closeModal}
                    />
                </div>
            )}

            {/* Modal Premium Unificado */}
            <ModalPremium
                isOpen={modalPremium.isOpen}
                onClose={closeModal}
                title={modalPremium.title}
                message={modalPremium.message}
                type={modalPremium.type}
                onConfirm={modalPremium.onConfirm}
                confirmText={modalPremium.confirmText}
                loading={loadingAction}
            />

            {activeView === 'depositar' && (
                    <div className="card">
                        <div className="flex-between mb-1">
                            <h2 style={{ fontSize: '1.2rem' }}>Adicionar Saldo</h2>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoDeposito ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                                ))}
                            </div>
                        </div>

                        {/* PASSO 1: VALOR E MÉTODO */}
                        {passoDeposito === 1 && (
                            <div className="animate-fade-in">
                                <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Escolha como deseja adicionar saldo à sua conta de investidor.</p>
                                
                                <div className="input-group mb-1">
                                    <label>Método de Depósito</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            className={`btn ${metodoDeposito === 'pix' ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ flex: 1, padding: '0.6rem' }}
                                            onClick={() => setMetodoDeposito('pix')}
                                        >
                                            Via PIX
                                        </button>
                                        <button
                                            className={`btn ${metodoDeposito === 'especie' ? 'btn-primary' : 'btn-outline'}`}
                                            style={{ flex: 1, padding: '0.6rem' }}
                                            onClick={() => setMetodoDeposito('especie')}
                                        >
                                            Em Espécie
                                        </button>
                                    </div>
                                </div>

                                <div className="input-group">
                                    <label>Valor do Depósito</label>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="R$ 0,00"
                                            style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.2rem', fontWeight: 800 }}
                                            value={valorNotificacao}
                                            onChange={(e) => setValorNotificacao(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ width: '100%' }} 
                                        onClick={() => {
                                            if (parseFloat(valorNotificacao) > 0) setPassoDeposito(2);
                                            else showModal({ title: 'Valor Inválido', message: 'Informe um valor maior que zero.', type: 'error' });
                                        }}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 2: INSTRUÇÕES */}
                        {passoDeposito === 2 && (
                            <div className="animate-fade-in">
                                {metodoDeposito === 'pix' ? (
                                    <>
                                        <p className="mb-1">Realize a transferência PIX para a chave abaixo:</p>
                                        <div className="info-block mb-1 text-center" style={{ position: 'relative', background: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                                            <div className="info-label">Chave PIX (E-mail)</div>
                                            <div className="info-value" style={{ fontSize: '1.1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                91980177874
                                                <button
                                                    onClick={copiarPix}
                                                    style={{ background: 'none', border: 'none', color: copiadoPix ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                                >
                                                    {copiadoPix ? <Check size={18} /> : <Copy size={18} />}
                                                </button>
                                            </div>
                                            {copiadoPix && <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px' }}>Copiado corporação!</p>}
                                        </div>
                                        <div className="info-block mb-1">
                                            <div className="info-label">Valor a depositar</div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--success)' }}>R$ {parseFloat(valorNotificacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="input-group">
                                        <label>Estabelecimento Parceiro</label>
                                        <select
                                            className="input-field"
                                            value={parceiroIdDeposito}
                                            onChange={(e) => setParceiroIdDeposito(e.target.value)}
                                            style={{ marginBottom: '1rem' }}
                                        >
                                            <option value="">Selecione um local...</option>
                                            {parceiros.map(p => (
                                                <option key={p.id} value={p.id}>{p.nome} - {p.endereco}</option>
                                            ))}
                                        </select>
                                        <p className="text-muted" style={{ fontSize: '0.85rem', textAlign: 'center' }}>Vá até o local escolhido para realizar o depósito em espécie.</p>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ flex: 2 }} 
                                        disabled={metodoDeposito === 'especie' && !parceiroIdDeposito}
                                        onClick={() => setPassoDeposito(3)}
                                    >
                                        Já realizei o Pagamento
                                    </button>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoDeposito(1)}>Voltar</button>
                                </div>
                            </div>
                        )}

                        {/* PASSO 3: CONFIRMAÇÃO */}
                        {passoDeposito === 3 && (
                            <div className="animate-fade-in text-center" style={{ padding: '1rem 0' }}>
                                <div style={{ background: 'rgba(var(--success-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                    <CheckCircle2 size={40} color="var(--success)" />
                                </div>
                                <h3 className="mb-1">Aguardando Verificação</h3>
                                <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>
                                    Notificaremos você assim que o depósito de <strong>R$ {parseFloat(valorNotificacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> for confirmado.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
                                    <button className="btn btn-primary" onClick={handleNotificarDeposito} disabled={loadingAction}>
                                        {loadingAction ? 'Processando...' : 'Confirmar e Notificar'}
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setPassoDeposito(2)} disabled={loadingAction}>Revisar</button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {
                activeView === 'saque' && (
                    <div className="card">
                        <div className="flex-between mb-1">
                            <h2 style={{ fontSize: '1.2rem' }}>Solicitar Saque</h2>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoSaque ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                                ))}
                            </div>
                        </div>

                        {!usuario.two_factor_enabled ? (
                            <div className="text-center" style={{ padding: '1rem' }}>
                                <ShieldAlert size={48} color="var(--warning)" style={{ margin: '0 auto 1rem' }} />
                                <p className="mb-1" style={{ fontWeight: 600 }}>Segurança Obrigatória</p>
                                <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>Ative o 2FA em suas configurações para realizar saques.</p>
                                <button className="btn btn-secondary mt-1" onClick={() => setActiveView('home')}>Voltar</button>
                            </div>
                        ) : (
                            <>
                                {/* PASSO 1: VALOR E MÉTODO */}
                                {passoSaque === 1 && (
                                    <div className="animate-fade-in">
                                        <div className="input-group mb-1">
                                            <label>Forma de Recebimento</label>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button
                                                    className={`btn ${metodoSaque === 'pix' ? 'btn-primary' : 'btn-outline'}`}
                                                    style={{ flex: 1, padding: '0.6rem' }}
                                                    onClick={() => setMetodoSaque('pix')}
                                                >
                                                    Via PIX
                                                </button>
                                                <button
                                                    className={`btn ${metodoSaque === 'especie' ? 'btn-primary' : 'btn-outline'}`}
                                                    style={{ flex: 1, padding: '0.6rem' }}
                                                    onClick={() => setMetodoSaque('especie')}
                                                >
                                                    Em Espécie
                                                </button>
                                            </div>
                                        </div>

                                        <div className="input-group">
                                            <label>Quanto deseja sacar?</label>
                                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '12px', width: '100%', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <input
                                                    type="number"
                                                    className="input-field"
                                                    placeholder="R$ 0,00"
                                                    style={{ flex: 1, border: 'none', background: 'transparent', margin: 0, padding: '0.85rem', textAlign: 'center', width: '100%', fontSize: '1.2rem', fontWeight: 800 }}
                                                    value={valorSaque}
                                                    onChange={(e) => setValorSaque(e.target.value)}
                                                />
                                            </div>
                                            {parseFloat(valorSaque) > usuario.saldo && (
                                                <p className="text-danger mt-1" style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                                                    ⚠️ Saldo insuficiente (Disponível: R$ {usuario.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                                                </p>
                                            )}
                                        </div>

                                        <div style={{ marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ width: '100%' }} 
                                                disabled={!valorSaque || parseFloat(valorSaque) <= 0 || parseFloat(valorSaque) > usuario.saldo}
                                                onClick={() => setPassoSaque(2)}
                                            >
                                                Continuar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* PASSO 2: REVISÃO DE TAXAS */}
                                {passoSaque === 2 && (
                                    <div className="animate-fade-in">
                                        <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                            <div className="flex-between mb-1">
                                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Valor Solicitado:</span>
                                                <span style={{ fontWeight: 700 }}>R$ {parseFloat(valorSaque).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex-between mb-1">
                                                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Taxa de Saque:</span>
                                                <span style={{ fontWeight: 700, color: parseFloat(valorSaque) <= (usuario.saldo_caixa || 0) ? 'var(--success)' : 'var(--danger)' }}>
                                                    {parseFloat(valorSaque) <= (usuario.saldo_caixa || 0) ? 'ISENTO' : 'R$ 5,00'}
                                                </span>
                                            </div>
                                            <div className="flex-between" style={{ color: 'var(--success)', fontWeight: 800, fontSize: '1.1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                                                <span>Valor a Receber:</span>
                                                <span>
                                                    R$ {Math.max(0, parseFloat(valorSaque) - (parseFloat(valorSaque) <= (usuario.saldo_caixa || 0) ? 0 : 5)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>

                                        {metodoSaque === 'pix' ? (
                                            <p className="text-muted mb-1" style={{ fontSize: '0.85rem', textAlign: 'center' }}>
                                                Enviaremos para sua chave PIX:<br /><strong>{usuario.chave_pix}</strong>
                                            </p>
                                        ) : (
                                            <div className="input-group mb-1">
                                                <label>Ponto de Retirada</label>
                                                <select
                                                    className="input-field"
                                                    value={parceiroIdSaque}
                                                    onChange={(e) => setParceiroIdSaque(e.target.value)}
                                                >
                                                    <option value="">Selecione um local...</option>
                                                    {parceiros.map(p => (
                                                        <option key={p.id} value={p.id}>{p.nome} - {p.endereco}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ flex: 2 }} 
                                                disabled={metodoSaque === 'especie' && !parceiroIdSaque}
                                                onClick={() => setPassoSaque(3)}
                                            >
                                                Confirmar e Ir para Segurança
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSaque(1)}>Voltar</button>
                                        </div>
                                    </div>
                                )}

                                {/* PASSO 3: SEGURANÇA */}
                                {passoSaque === 3 && (
                                    <div className="animate-fade-in">
                                        <div className="text-center mb-1">
                                            <Lock size={32} color="var(--primary)" style={{ marginBottom: '10px' }} />
                                            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Confirme sua identidade para finalizar o saque.</p>
                                        </div>

                                        <div className="input-group mb-1">
                                            <label>Sua Senha</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type={showSenhaSaque ? "text" : "password"}
                                                    className="input-field"
                                                    placeholder="Sua senha de acesso"
                                                    value={senhaSaque}
                                                    onChange={(e) => setSenhaSaque(e.target.value)}
                                                    style={{ paddingRight: '45px' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowSenhaSaque(!showSenhaSaque)}
                                                    style={{
                                                        position: 'absolute',
                                                        right: '12px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '4px'
                                                    }}
                                                >
                                                    {showSenhaSaque ? <EyeOff size={20} /> : <Eye size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="input-group mb-1">
                                            <label htmlFor="codigo-2fa-saque-inv">Código 2FA</label>
                                            <input
                                                id="codigo-2fa-saque-inv"
                                                name="codigo-2fa-saque-inv"
                                                autoComplete="one-time-code"
                                                type="text"
                                                className="input-field"
                                                placeholder="000000"
                                                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontWeight: 700 }}
                                                value={codigo2faSaque}
                                                onChange={(e) => setCodigo2faSaque(e.target.value)}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ flex: 2 }} 
                                                onClick={handleSolicitarSaque}
                                                disabled={!senhaSaque || !codigo2faSaque}
                                            >
                                                Finalizar Saque
                                            </button>
                                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoSaque(2)}>Voltar</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )
            }
            
            {activeView !== 'home' && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem', paddingBottom: '2rem' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto', minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => setActiveView('home')}><ArrowLeft size={18} /> Voltar</button>
                </div>
            )}

            {showTermos && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ width: '90%', maxWidth: '500px' }}>
                        <TermosUso onConfirm={() => setShowTermos(false)} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardInvestidor;
