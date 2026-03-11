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
    Check,
    Store,
    Plus,
    Trash2,
    MapPin,
    ShoppingBag,
    Link as LinkIcon,
    Image as ImageIcon,
    ChevronLeft,
    ChevronRight,
    Banknote,
    PlusCircle,
    BarChart3,
    ArrowDown,
    RefreshCw,
    Calendar
} from 'lucide-react';
import ModalPremium from '../componentes/ModalPremium';

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
};

// Tipos que para o Admin são ENTRADA de lucro
const TIPOS_ENTRADA_ADMIN = new Set(['deposito', 'recebimento', 'taxa_intermediacao', 'taxa_conveniencia', 'taxa_saque', 'compra_score', 'desbloqueio_dados', 'aporte_capital', 'taxa_postagem']);

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
                    <h3 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Banknote size={20} /> Resgatar Lucro
                    </h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Disponível: <strong style={{ color: 'var(--success)' }}>R$ {(lucroDisponivel || 0).toLocaleString('pt-BR')}</strong>
                    </p>
                </div>
                <button
                    className={`btn ${aberto ? 'btn-outline' : 'btn-primary'}`}
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
                    <h3 style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <PlusCircle size={20} /> Injetar Lucro (Aporte)
                    </h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Injete capital externo para cobrir custos ou bônus.
                    </p>
                </div>
                <button
                    className={`btn ${aberto ? 'btn-outline' : 'btn-primary'}`}
                    style={{ borderColor: 'var(--success)', color: aberto ? 'var(--success)' : '#fff', background: aberto ? 'transparent' : 'var(--success)' }}
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

// Componente de Gestão de Reinvestimento do Lucro no Pool (Aumento de Patrimônio)
const ReinvestimentoPoolCard = ({ onMensagem, lucroDisponivel, meuSaldoPool, lucroAcumuladoPool }) => {
    const [valor, setValor] = useState('');
    const [tipo, setTipo] = useState('reinvestir'); // 'reinvestir' ou 'resgatar'
    const [loading, setLoading] = useState(false);
    const [aberto, setAberto] = useState(false);

    const handleAcao = async (e) => {
        e.preventDefault();
        const v = parseFloat(valor);
        if (!v || v <= 0) return alert('O valor deve ser maior que zero.');
        
        const endpoint = tipo === 'reinvestir' ? '/financeiro/admin/reinvestir-lucro-pool' : '/financeiro/admin/resgatar-pool-para-lucro';
        const saldoValidar = tipo === 'reinvestir' ? lucroDisponivel : meuSaldoPool;

        if (v > saldoValidar) return alert('Saldo insuficiente para esta operação.');

        setLoading(true);
        try {
            const res = await api.post(endpoint, { dados: v });
            onMensagem(res.message || 'Operação realizada!');
            setValor('');
            setAberto(false);
        } catch (err) {
            onMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card mb-1" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div className="flex-between">
                <div>
                    <h3 style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={20} /> Gestão de Patrimônio
                    </h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Reinvista o lucro no Pool para ganhar juros.
                    </p>
                </div>
                <button
                    className={`btn ${aberto ? 'btn-outline' : 'btn-primary'}`}
                    style={{ borderColor: 'var(--warning)', color: aberto ? 'var(--warning)' : '#111', background: aberto ? 'transparent' : 'var(--warning)' }}
                    onClick={() => setAberto(!aberto)}
                >
                    {aberto ? 'Fechar' : 'Gerenciar'}
                </button>
            </div>

            {aberto && (
                <form onSubmit={handleAcao} style={{ marginTop: '1.2rem', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px', margin: '1.2rem auto 0' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                        <button 
                            type="button" 
                            className={`btn ${tipo === 'reinvestir' ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, fontSize: '0.75rem', height: 'auto', padding: '8px', background: tipo === 'reinvestir' ? 'var(--warning)' : 'transparent', borderColor: 'var(--warning)', color: tipo === 'reinvestir' ? '#111' : 'var(--warning)' }}
                            onClick={() => setTipo('reinvestir')}
                        >
                            Reinvestir Lucro
                        </button>
                        <button 
                            type="button" 
                            className={`btn ${tipo === 'resgatar' ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, fontSize: '0.75rem', height: 'auto', padding: '8px', background: tipo === 'resgatar' ? 'var(--warning)' : 'transparent', borderColor: 'var(--warning)', color: tipo === 'resgatar' ? '#111' : 'var(--warning)' }}
                            onClick={() => setTipo('resgatar')}
                        >
                            Resgatar p/ Lucro
                        </button>
                    </div>

                    <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                            {tipo === 'reinvestir' ? 'Valor a Reinvestir (do Lucro)' : 'Valor a Resgatar para o Lucro Operacional'}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number"
                                placeholder="0,00"
                                value={valor}
                                onChange={e => setValor(e.target.value)}
                                min="0.01"
                                step="0.01"
                                required
                                style={{ width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                            />
                            <p style={{ fontSize: '0.65rem', marginTop: '4px', textAlign: 'right', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                                {tipo === 'reinvestir' 
                                    ? `Lucro Disponível para Aporte: R$ ${lucroDisponivel.toLocaleString('pt-BR')}` 
                                    : (
                                        <>
                                            Total na Cota: R$ {meuSaldoPool.toLocaleString('pt-BR')} <br/>
                                            <span style={{ color: 'var(--success)' }}>
                                                (Capital: R$ {(meuSaldoPool - (lucroAcumuladoPool || 0)).toLocaleString('pt-BR')} | Juros: R$ {(lucroAcumuladoPool || 0).toLocaleString('pt-BR')})
                                            </span>
                                        </>
                                    )
                                }
                            </p>
                        </div>
                    </div>

                    <div style={{ padding: '10px', background: 'rgba(255,193,7,0.05)', borderRadius: '10px', border: '1px dashed rgba(255,193,7, 0.3)' }}>
                        <p style={{ fontSize: '0.65rem', color: 'var(--warning)', margin: 0, lineHeight: 1.4 }}>
                            🔒 <strong>Garantia de Isolação:</strong> Cada participante (Investidor ou Plataforma) possui uma conta individual dentro do fundo. O resgate acima afetará <u>apenas</u> o patrimônio pertencente à plataforma.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ background: 'var(--warning)', color: '#111', border: 'none' }}
                        disabled={loading}
                    >
                        {loading ? 'Processando...' : `Confirmar ${tipo === 'reinvestir' ? 'Reinvestimento' : 'Resgate Próprio'}`}
                    </button>
                </form>
            )}
        </div>
    );
};
// Componente de Gestão de Parceiros (Estabelecimentos para Depósito/Saque em Espécie)
const GerenciarParceirosCard = ({ onMensagem }) => {
    const [parceiros, setParceiros] = useState([]);
    const [nome, setNome] = useState('');
    const [endereco, setEndereco] = useState('');
    const [usuarioId, setUsuarioId] = useState('');
    const [loading, setLoading] = useState(false);
    const [aberto, setAberto] = useState(false);

    const carregarParceiros = async () => {
        try {
            const res = await api.get('/financeiro/admin/parceiros');
            setParceiros(res || []);
        } catch (err) {
            console.error('Erro ao carregar parceiros:', err);
        }
    };

    useEffect(() => {
        if (aberto) carregarParceiros();
    }, [aberto]);

    const handleAdicionar = async (e) => {
        e.preventDefault();
        if (!nome || !endereco) return alert('Preencha nome e endereço.');
        setLoading(true);
        try {
            await api.post('/financeiro/admin/parceiros', { nome, endereco, usuario_id: usuarioId });
            onMensagem('Parceiro adicionado com sucesso!');
            setNome('');
            setEndereco('');
            setUsuarioId('');
            carregarParceiros();
        } catch (err) {
            onMensagem('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAtivo = async (p) => {
        try {
            await api.put(`/financeiro/admin/parceiros/${p.id}`, { 
                nome: p.nome, 
                endereco: p.endereco, 
                usuario_id: p.usuario_id,
                ativo: !p.is_active 
            });
            carregarParceiros();
        } catch (err) {
            onMensagem('Erro: ' + err.message);
        }
    };

    const handleDeletar = async (id) => {
        if (!window.confirm('Deseja realmente excluir este parceiro?')) return;
        try {
            await api.delete(`/financeiro/admin/parceiros/${id}`);
            onMensagem('Parceiro removido com sucesso!');
            carregarParceiros();
        } catch (err) {
            onMensagem('Erro: ' + err.message);
        }
    };

    return (
        <div className="card mb-1" style={{ borderLeft: '4px solid var(--primary-low)' }}>
            <div className="flex-between">
                <div>
                    <h3 style={{ color: 'var(--text-main)' }}>🏪 Parceiros (Espécie)</h3>
                    <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Gerencie locais para depósitos e saques presenciais.
                    </p>
                </div>
                <button
                    className={`btn ${aberto ? 'btn-outline' : 'btn-primary'}`}
                    style={{ width: 'auto', padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                    onClick={() => setAberto(!aberto)}
                >
                    {aberto ? 'Fechar' : 'Gerenciar'}
                </button>
            </div>

            {aberto && (
                <div style={{ marginTop: '1.2rem' }}>
                    <form onSubmit={handleAdicionar} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>Novo Parceiro</p>
                        <div className="grid-2" style={{ gap: '10px' }}>
                            <input 
                                type="text" 
                                placeholder="Nome do Estabelecimento" 
                                className="input-field" 
                                value={nome} 
                                onChange={e => setNome(e.target.value)}
                                style={{ fontSize: '0.85rem' }}
                            />
                            <input 
                                type="text" 
                                placeholder="Endereço Completo" 
                                className="input-field" 
                                value={endereco} 
                                onChange={e => setEndereco(e.target.value)}
                                style={{ fontSize: '0.85rem' }}
                            />
                            <input 
                                type="text" 
                                placeholder="ID do Usuário (Dono)" 
                                className="input-field" 
                                value={usuarioId} 
                                onChange={e => setUsuarioId(e.target.value)}
                                style={{ fontSize: '0.85rem', gridColumn: 'span 2' }}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem', fontSize: '0.8rem' }} disabled={loading}>
                            <Plus size={16} /> {loading ? 'Adicionando...' : 'Adicionar Local'}
                        </button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {parceiros.length === 0 ? (
                            <p className="text-muted text-center" style={{ fontSize: '0.8rem' }}>Nenhum parceiro cadastrado.</p>
                        ) : (
                            parceiros.map(p => (
                                <div key={p.id} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ padding: '8px', background: p.is_active ? 'rgba(0,230,118,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                            <Store size={18} color={p.is_active ? 'var(--success)' : 'var(--text-muted)'} />
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: p.is_active ? 'var(--text-main)' : 'var(--text-muted)' }}>{p.nome}</p>
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={12} /> {p.endereco}
                                            </p>
                                            {p.usuario_id && (
                                                <p style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <User size={12} /> Usuário: {p.usuario_id}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button 
                                            onClick={() => handleToggleAtivo(p)}
                                            style={{ 
                                                padding: '4px 10px', 
                                                borderRadius: '6px', 
                                                border: '1px solid var(--border-color)', 
                                                background: p.is_active ? 'rgba(0,230,118,0.05)' : 'transparent',
                                                color: p.is_active ? 'var(--success)' : 'var(--text-muted)',
                                                fontSize: '0.7rem',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}
                                        >
                                            {p.is_active ? 'ATIVO' : 'INATIVO'}
                                        </button>
                                        <button 
                                            onClick={() => handleDeletar(p.id)}
                                            style={{ 
                                                padding: '6px', 
                                                borderRadius: '6px', 
                                                border: '1px solid rgba(255, 61, 0, 0.1)', 
                                                background: 'transparent',
                                                color: 'var(--danger)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Excluir Parceiro"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};



// Componente de Gestão da Loja de Afiliados
const GerenciarLojaCard = ({ onMensagem }) => {
    const [itens, setItens] = useState([]);
    const [nome, setNome] = useState('');
    const [url, setUrl] = useState('');
    const [imagem, setImagem] = useState('');
    const [aberto, setAberto] = useState(false);
    const [loading, setLoading] = useState(false);
    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);

    const carregarItens = async (p = 1) => {
        try {
            const data = await api.get(`/financeiro/admin/loja/itens?pagina=${p}`);
            setItens(data.itens);
            setTotalPaginas(data.paginas);
            setPagina(data.pagina_atual);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (aberto) carregarItens(pagina);
    }, [aberto, pagina]);

    const handleAdicionar = async (e) => {
        e.preventDefault();
        if (!nome || !url) return onMensagem('Nome e Link são obrigatórios!');
        setLoading(true);
        try {
            await api.post('/financeiro/admin/loja/itens', { 
                nome_produto: nome, 
                url_afiliado: url, 
                url_imagem: imagem 
            });
            onMensagem('Produto adicionado com sucesso!');
            setNome('');
            setUrl('');
            setImagem('');
            carregarItens(1);
        } catch (err) {
            onMensagem('Erro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAtivo = async (item) => {
        try {
            await api.put(`/financeiro/admin/loja/itens/${item.id}`, { 
                nome_produto: item.nome_produto, 
                url_afiliado: item.url_afiliado, 
                url_imagem: item.url_imagem,
                is_active: !item.is_active 
            });
            carregarItens(pagina);
        } catch (err) {
            onMensagem('Erro: ' + err.message);
        }
    };

    const handleDeletar = async (id) => {
        if (!window.confirm('Excluir este produto da loja?')) return;
        try {
            await api.delete(`/financeiro/admin/loja/itens/${id}`);
            onMensagem('Produto removido!');
            carregarItens(pagina);
        } catch (err) {
            onMensagem('Erro: ' + err.message);
        }
    };

    return (
        <div className="card mb-1" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="flex-between">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="icon-box" style={{ background: 'rgba(255, 204, 0, 0.1)', color: 'var(--primary)' }}>
                        <ShoppingBag size={20} />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1rem', marginBottom: '2px' }}>Loja de Afiliados</h3>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gerencie links da Shopee, Mercado Livre, etc.</p>
                    </div>
                </div>
                <button 
                    className="btn btn-secondary" 
                    style={{ width: 'auto', padding: '0.5rem 1.2rem', fontSize: '0.85rem' }}
                    onClick={() => setAberto(!aberto)}
                >
                    {aberto ? 'Fechar' : 'Gerenciar'}
                </button>
            </div>

            {aberto && (
                <div style={{ marginTop: '1.2rem' }}>
                    <form onSubmit={handleAdicionar} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)' }}>Novo Link de Afiliado</p>
                        <div className="grid-2" style={{ gap: '10px' }}>
                            <input 
                                type="text" 
                                placeholder="Nome do Produto" 
                                className="input-field" 
                                value={nome} 
                                onChange={e => setNome(e.target.value)}
                                style={{ fontSize: '0.85rem' }}
                            />
                            <input 
                                type="text" 
                                placeholder="URL do Afiliado" 
                                className="input-field" 
                                value={url} 
                                onChange={e => setUrl(e.target.value)}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>
                        <input 
                            type="text" 
                            placeholder="URL da Imagem (Opcional)" 
                            className="input-field" 
                            value={imagem} 
                            onChange={e => setImagem(e.target.value)}
                            style={{ fontSize: '0.85rem' }}
                        />
                        <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem', fontSize: '0.8rem', width: '100%' }} disabled={loading}>
                            <Plus size={16} /> {loading ? 'Adicionando...' : 'Adicionar Produto'}
                        </button>
                    </form>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {itens.length === 0 ? (
                            <p className="text-muted text-center" style={{ fontSize: '0.8rem' }}>Nenhum link cadastrado.</p>
                        ) : (
                            <>
                                {itens.map(item => (
                                    <div key={item.id} style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                            <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {item.url_imagem ? (
                                                    <img src={item.url_imagem} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <ImageIcon size={18} color="var(--text-muted)" />
                                                )}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: item.is_active ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nome_produto}</p>
                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    <LinkIcon size={10} /> {item.url_afiliado}
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
                                            <button 
                                                onClick={() => handleToggleAtivo(item)}
                                                style={{ 
                                                    padding: '4px 10px', 
                                                    borderRadius: '6px', 
                                                    border: '1px solid var(--border-color)', 
                                                    background: item.is_active ? 'rgba(0,230,118,0.05)' : 'transparent',
                                                    color: item.is_active ? 'var(--success)' : 'var(--text-muted)',
                                                    fontSize: '0.65rem',
                                                    cursor: 'pointer',
                                                    fontWeight: 600
                                                }}
                                            >
                                                {item.is_active ? 'ATIVO' : 'INATIVO'}
                                            </button>
                                            <button 
                                                onClick={() => handleDeletar(item.id)}
                                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid rgba(255, 61, 0, 0.1)', background: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {totalPaginas > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '1rem', padding: '10px' }}>
                                        <button 
                                            disabled={pagina === 1}
                                            onClick={() => setPagina(pagina - 1)}
                                            style={{ background: 'transparent', border: 'none', color: pagina === 1 ? 'var(--text-muted)' : 'var(--primary)', cursor: pagina === 1 ? 'default' : 'pointer' }}
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{pagina} / {totalPaginas}</span>
                                        <button 
                                            disabled={pagina === totalPaginas}
                                            onClick={() => setPagina(pagina + 1)}
                                            style={{ background: 'transparent', border: 'none', color: pagina === totalPaginas ? 'var(--text-muted)' : 'var(--primary)', cursor: pagina === totalPaginas ? 'default' : 'pointer' }}
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// Componentes Dinâmicos de Formatação Financeira (Injetam cores baseadas em + e -)
const FormatSaldos = ({ valor }) => {
    const v = Number(valor) || 0;
    if (v === 0) return <span style={{ color: 'var(--text-main)' }}>R$ 0</span>;
    return <span style={{ color: v > 0 ? 'var(--success)' : 'var(--danger)' }}>R$ {v.toLocaleString('pt-BR')}</span>;
};

const FormatReceitas = ({ valor, isInverso = false, ocultarZeros = false }) => {
    const v = Number(valor) || 0;
    if (v === 0) return ocultarZeros ? <span style={{ color: 'var(--text-main)' }}>—</span> : <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>R$ 0</span>;
    if (isInverso) {
        return <span style={{ fontWeight: 600, color: v > 0 ? 'var(--danger)' : 'var(--success)' }}>{v > 0 ? '- ' : '+ '}R$ {Math.abs(v).toLocaleString('pt-BR')}</span>;
    }
    return <span style={{ fontWeight: 600, color: v > 0 ? 'var(--success)' : 'var(--danger)' }}>{v > 0 ? '+ ' : '- '}R$ {Math.abs(v).toLocaleString('pt-BR')}</span>;
};

const AdminDashboard = () => {
    const [pendentes, setPendentes] = useState([]);
    const [fiscal, setFiscal] = useState(null);
    const [mensagem, setMensagem] = useState(null);

    useEffect(() => {
        if (mensagem) {
            const timer = setTimeout(() => {
                setMensagem(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [mensagem]);
    const [stuckLoans, setStuckLoans] = useState([]);
    const [solicitacoesAtivas, setSolicitacoesAtivas] = useState([]);
    const [activeTab, setActiveTab] = useState('pendentes'); // 'pendentes', 'fiscal', 'emprestimos'
    const [showRejeitarModal, setShowRejeitarModal] = useState(false);
    const [rejeicaoData, setRejeicaoData] = useState({ id: null, motivo: '' });
    const [loadingRejeicao, setLoadingRejeicao] = useState(false);
    const [ultimasAcoes, setUltimasAcoes] = useState([]);
    const [pixCopiado, setPixCopiado] = useState(null);
    const [showLiberarModal, setShowLiberarModal] = useState(false);
    const [liberacaoId, setLiberacaoId] = useState(null);
    const [loadingLiberacao, setLoadingLiberacao] = useState(false);

    // Investimento Institucional
    const [showInvestirModal, setShowInvestirModal] = useState(false);
    const [investirData, setInvestirData] = useState({ id: null, valor: '', motivo: '', tomador: '' });
    const [loadingInvestir, setLoadingInvestir] = useState(false);

    // Confirmação de Aporte Sugerido do Pool
    const [showConfirmPoolModal, setShowConfirmPoolModal] = useState(false);
    const [confirmPoolData, setConfirmPoolData] = useState({ id: null, valor: 0 });
    const [loadingPool, setLoadingPool] = useState(false);

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

    const carregarSnapshot = async () => {
        try {
            const res = await api.get('/snapshot');
            if (res.admin) {
                setPendentes(res.admin.pendentes || []);
                setFiscal(res.admin.fiscal);
                setStuckLoans(res.admin.emprestimos_para_liberar || []);
                setSolicitacoesAtivas(res.admin.solicitacoes_ativas || []);
            }
        } catch (err) {
            console.error('Erro ao carregar snapshot:', err);
        }
    };

    // Smart Polling (60s) - Só roda se a aba estiver visível
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden) {
                carregarSnapshot();
            }
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        carregarSnapshot();
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
            carregarSnapshot();
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
            carregarSnapshot();
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
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + err.message);
        } finally {
            setLoadingRejeicao(false);
        }
    };

    const handleLiberarEspecial = (id) => {
        setLiberacaoId(id);
        setShowLiberarModal(true);
    };

    const confirmarLiberarEspecial = async () => {
        setLoadingLiberacao(true);
        try {
            const res = await api.post(`/emprestimos/admin/liberar-especial/${liberacaoId}`);
            setMensagem(res.message || "Empréstimo liberado com sucesso!");
            setShowLiberarModal(false);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingLiberacao(false);
        }
    };

    const handleConfirmarAportePool = (id, valor) => {
        setConfirmPoolData({ id, valor });
        setShowConfirmPoolModal(true);
    };

    const executarAportePool = async () => {
        const { id } = confirmPoolData;
        setLoadingPool(true);
        try {
            const res = await api.post(`/emprestimos/confirmar-pool/${id}`);
            setMensagem(res.message);
            setShowConfirmPoolModal(false);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro no Pool: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingPool(false);
        }
    };

    const handleInvestirLucro = (loan) => {
        const restante = loan.valor - loan.valor_arrecadado;
        setInvestirData({
            id: loan.id,
            tomador: loan.tomador,
            valor: '',
            restante: restante,
            motivo: 'Aporte institucional para fomento de crédito.'
        });
        setShowInvestirModal(true);
    };

    const confirmarInvestirLucro = async () => {
        const { id, valor, motivo } = investirData;
        const valorNumerico = parseFloat(valor);

        if (!id) return alert("Erro: Solicitação inválida selecionada.");
        if (Number.isNaN(valorNumerico) || valorNumerico <= 0) {
            return alert("Por favor, insira um valor numérico válido e maior que zero.");
        }
        if (!motivo || motivo.length < 5) {
            return alert("Insira uma justificativa detalhada para a auditoria (mín. 5 carac.).");
        }

        setLoadingInvestir(true);
        try {
            const res = await api.post('/financeiro/admin/investir-lucro', {
                solicitacao_id: id,
                valor: parseFloat(valor),
                motivo: motivo
            });
            setMensagem(res.message || "Investimento realizado!");
            setShowInvestirModal(false);
            carregarSnapshot();
        } catch (err) {
            setMensagem('Erro: ' + (err.response?.data?.detail || err.message));
        } finally {
            setLoadingInvestir(false);
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
                <div className={`alert ${typeof mensagem === 'string' && mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'}`}>
                    <span>{typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem)}</span>
                    <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                </div>
            )}

            {/* Quick Summary Section */}
            {fiscal && (
                <div className="grid-3 mb-1">
                    <div className="card">
                        <p className="info-label">Custódia (Passivo)</p>
                        <h2 className="mt-1"><FormatSaldos valor={fiscal.saldo_usuarios_gerenciado} /></h2>
                        <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.75rem' }}>
                            <span>Total Gerido</span>
                            <Landmark size={14} />
                        </div>
                    </div>
                    <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(var(--primary-rgb), 0.02)' }}>
                        <p className="info-label text-primary">Saldo do Pool (Caixa)</p>
                        <h2 className="mt-1 text-primary"><FormatSaldos valor={fiscal.saldo_pool_caixa} /></h2>
                        <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.72rem' }}>
                            <span>Fundo dos Investidores</span>
                            <TrendingUp size={14} color="var(--primary)" />
                        </div>
                    </div>
                    <div className="card" style={{ borderLeft: '4px solid var(--success)', background: 'rgba(var(--success-rgb), 0.02)' }}>
                        <p className="info-label text-success">Lucro da Plataforma</p>
                        <h2 className="mt-1 text-success"><FormatSaldos valor={fiscal.lucro_disponivel ?? fiscal.lucro_plataforma_historico} /></h2>
                        <div className="flex-between mt-1 text-muted" style={{ fontSize: '0.72rem' }}>
                            <span>Operacional</span>
                            <Landmark size={14} color="var(--success)" />
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex-center mb-1 overflow-x-auto">
                <div className="tab-group">
                    <button
                        className={`tab-item ${activeTab === 'pendentes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pendentes')}
                    >
                        Fila de Aprovação
                    </button>
                    <button
                        className={`tab-item ${activeTab === 'fiscal' ? 'active' : ''}`}
                        onClick={() => setActiveTab('fiscal')}
                    >
                        Relatório Fiscal
                    </button>
                    <button
                        className={`tab-item ${activeTab === 'emprestimos' ? 'active' : ''}`}
                        onClick={() => setActiveTab('emprestimos')}
                    >
                        Empréstimos
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
                                                {p.detalhes?.includes('http') ? (
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

                                <div className="flex-center mt-1" style={{ gap: '15px' }}>
                                    <button
                                        className="btn btn-outline"
                                        style={{ color: 'var(--danger)', borderColor: 'rgba(255, 61, 0, 0.2)' }}
                                        onClick={() => handleRejeitar(p.transacao_id)}
                                    >
                                        Rejeitar
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => p.tipo === 'desbloqueio_dados' ? handleConfirmarVerificacao(p.transacao_id) : handleConfirmar(p.transacao_id, p.tipo)}
                                    >
                                        Aprovar
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Nova Seção: Empréstimos que bateram a meta mas faltam garantidores */}
                    {stuckLoans.length > 0 && (
                        <div className="mt-2">
                            <h3 className="mb-1" style={{ fontSize: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShieldCheck size={18} /> Aguardando Garantidores (Bateram a Meta)
                            </h3>
                            {stuckLoans.map(loan => (
                                <div key={`stuck-${loan.id}`} className="card mb-1" style={{ borderLeft: '4px solid var(--warning)' }}>
                                    <div className="flex-between">
                                        <div>
                                            <p style={{ fontWeight: 700 }}>{loan.tomador} (ID #{loan.id})</p>
                                            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                                                Arrecadado: R$ {loan.arrecadado.toLocaleString('pt-BR')} / R$ {loan.valor.toLocaleString('pt-BR')}
                                            </p>
                                            <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                Status: <span style={{ color: 'var(--warning)', fontWeight: 600 }}>Meta Batida</span> • {loan.garantidores_atuais} / 2 Garantidores
                                            </p>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleLiberarEspecial(loan.id)}
                                        >
                                            Liberar Manualmente
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
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

            {/* Content View: Empréstimos Ativos (Para Investimento Institucional) */}
            {activeTab === 'emprestimos' && (
                <div className="animate-fade-in">
                    <div className="flex-between mb-1">
                        <h3>Solicitações Ativas</h3>
                        <TrendingUp size={18} color="var(--primary)" />
                    </div>

                    {solicitacoesAtivas.length === 0 ? (
                        <div className="card text-center text-muted py-2">Nenhuma solicitação ativa para investimento no momento.</div>
                    ) : (
                        <div className="grid-2">
                            {solicitacoesAtivas.map(sa => (
                                <div key={sa.id} className="card">
                                    <div className="flex-between mb-1">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                                <User size={18} color="var(--primary)" />
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{sa.tomador}</p>
                                                <p className="text-muted" style={{ fontSize: '0.7rem' }}>Pedido #{sa.id}</p>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--success)' }}>
                                            Score: {sa.score}
                                        </span>
                                    </div>

                                    <div className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <div className="flex-between mb-1">
                                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Arrecadado:</span>
                                            <span style={{ fontWeight: 600 }}>R$ {sa.valor_arrecadado.toLocaleString('pt-BR')} / R$ {sa.valor.toLocaleString('pt-BR')}</span>
                                        </div>
                                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${(sa.valor_arrecadado / sa.valor) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.4s ease' }} />
                                        </div>
                                        <div className="flex-between mt-1" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            <span>Juros: {sa.taxa}% a.m</span>
                                            <span>{sa.parcelas} Meses</span>
                                        </div>
                                    </div>

                                    <div className="flex-between mb-1" style={{ padding: '8px', background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '8px', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                                        <div>
                                            <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sugestão Pool (Score)</p>
                                            <p style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>R$ {sa.sugestao_pool?.toLocaleString('pt-BR') || '0,00'}</p>
                                        </div>
                                        {sa.sugestao_pool > 0 && (
                                            <button
                                                className="btn btn-primary"
                                                style={{ width: 'auto', padding: '4px 12px', fontSize: '0.7rem', height: 'auto' }}
                                                onClick={() => handleConfirmarAportePool(sa.id, sa.sugestao_pool)}
                                            >
                                                Aprovar Aporte
                                            </button>
                                        )}
                                    </div>

                                    <button
                                        className="btn btn-outline"
                                        style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                        onClick={() => handleInvestirLucro(sa)}
                                    >
                                        Investir via Pool (Governança)
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'fiscal' && fiscal && (
                <div className="animate-fade-in">

                    {mensagem && (
                        <div className={`alert ${typeof mensagem === 'string' && mensagem.toLowerCase().includes('erro') ? 'alert-danger' : 'alert-success'} `}>
                            <span>{typeof mensagem === 'string' ? mensagem : JSON.stringify(mensagem)}</span>
                            <button onClick={() => setMensagem('')} className="alert-close">✕</button>
                        </div>
                    )}

                    <div className="grid-2">
                        <div className="card">
                            <h3 className="mb-1" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BarChart3 size={20} color="var(--primary)" /> Detalhes da Receita
                            </h3>
                            <div className="info-block" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="flex-between">
                                    <span className="info-label">Ações de KYC/Score:</span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.kyc_score} />
                                </div>
                                <div className="flex-between">
                                    <span className="info-label">Desbloqueio de Dados:</span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.desbloqueio_dados} />
                                </div>
                                <div className="flex-between">
                                    <span className="info-label">Taxas de Postagem:</span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.taxas_postagem} />
                                </div>
                                <div className="flex-between">
                                    <span className="info-label">Saques Extras (Taxas):</span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.taxas_saque} />
                                </div>
                                <div className="flex-between">
                                    <span className="info-label">Intermediação P2P (10%):</span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.taxa_intermediacao} />
                                </div>
                                <div className="flex-between">
                                    <span className="info-label">Taxa Espécie (0.5%):</span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.taxa_especie} />
                                </div>
                                <div className="flex-between">
                                    <span className="info-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ArrowDown size={14} /> Aportes Externos:
                                    </span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.aportes_externos} />
                                </div>
                                <div className="flex-between">
                                    <span className="info-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <RefreshCw size={14} /> Retorno Investimento:
                                    </span>
                                    <FormatReceitas valor={fiscal.detalhamento_lucro.retorno_investimento} />
                                </div>

                            </div>

                            <div className="mt-2">
                                <SaqueLucroCard
                                    onMensagem={(m) => { setMensagem(m); carregarSnapshot(); }}
                                    lucroDisponivel={fiscal.lucro_disponivel}
                                />
                                <AporteLucroCard
                                    onMensagem={(m) => { setMensagem(m); carregarSnapshot(); }}
                                />
                                <ReinvestimentoPoolCard
                                    onMensagem={(m) => { setMensagem(m); carregarSnapshot(); }}
                                    lucroDisponivel={fiscal.lucro_disponivel}
                                    meuSaldoPool={fiscal.meu_saldo_pool}
                                    lucroAcumuladoPool={fiscal.lucro_acumulado_pool}
                                />

                                <GerenciarParceirosCard
                                    onMensagem={(m) => setMensagem(m)}
                                />
                                <GerenciarLojaCard
                                    onMensagem={(m) => setMensagem(m)}
                                />
                            </div>
                        </div>

                        <div className="card">
                            <h3 className="mb-1" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} color="var(--primary)" /> Histórico Mensal
                            </h3>
                            <div className="table-responsive">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Mês</th>
                                            <th>Fluxo (In/Out)</th>
                                            <th>Receita</th>
                                            <th>Sacado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fiscal.historico_mensal.map((h, i) => (
                                            <tr key={i}>
                                                <td>{new Date(h.mes).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</td>
                                                <td>
                                                    {(h.total_entrada || 0) > 0 ? <span style={{ color: 'var(--success)', fontSize: '0.75rem', display: 'block' }}>+{(h.total_entrada || 0).toLocaleString('pt-BR')}</span> : null}
                                                    {(h.total_saida || 0) > 0 ? <span style={{ color: 'var(--danger)', fontSize: '0.75rem', display: 'block' }}>-{(h.total_saida || 0).toLocaleString('pt-BR')}</span> : null}
                                                    {((h.total_entrada || 0) === 0 && (h.total_saida || 0) === 0) && <span style={{ color: 'var(--text-main)', fontSize: '0.75rem', display: 'block' }}>0</span>}
                                                </td>
                                                <td><FormatReceitas valor={h.receita_plataforma} ocultarZeros={true} /></td>
                                                <td><FormatReceitas valor={h.total_sacado} isInverso={true} ocultarZeros={true} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Rejeição */}
            <ModalPremium
                isOpen={showRejeitarModal}
                onClose={() => setShowRejeitarModal(false)}
                title="Rejeitar Solicitação"
                message={`Deseja realmente rejeitar a solicitação #${rejeicaoData.id}? Informe o motivo para o usuário.`}
                type="error"
                onConfirm={confirmarRejeicao}
                confirmText="Confirmar Rejeição"
                loading={loadingRejeicao}
            >
                <textarea
                    className="input-field mt-1"
                    placeholder="Ex: Documento vencido ou CPF inválido..."
                    style={{ width: '100%', minHeight: '100px' }}
                    value={rejeicaoData.motivo}
                    onChange={(e) => setRejeicaoData({ ...rejeicaoData, motivo: e.target.value })}
                />
            </ModalPremium>

            {/* Modal de Liberação Especial */}
            <ModalPremium
                isOpen={showLiberarModal}
                onClose={() => setShowLiberarModal(false)}
                title="Liberação Especial"
                message={`Esta ação libera o valor para o tomador SEM a necessidade de garantidores. \nUse apenas em casos excepcionais onde a garantia foi validada externamente.\nDeseja prosseguir com a liberação manual do empréstimo #${liberacaoId}?`}
                type="warning"
                onConfirm={confirmarLiberarEspecial}
                confirmText="Sim, Liberar Agora"
                loading={loadingLiberacao}
            />

            {/* Modal de Investimento Institucional */}
            <ModalPremium
                isOpen={showInvestirModal}
                onClose={() => setShowInvestirModal(false)}
                title="Investimento Institucional"
                message="Utilizando o saldo do Pool (Caixa) para financiar este pedido."
                type="pool"
                onConfirm={confirmarInvestirLucro}
                confirmText="Confirmar Investimento"
                loading={loadingInvestir}
            >
                <div className="p-1 mb-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '12px', border: '1px solid rgba(var(--primary-rgb), 0.1)' }}>
                    <p style={{ fontSize: '0.85rem' }}>Tomador: <strong>{investirData.tomador}</strong></p>
                </div>

                <div className="input-group mb-1">
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Valor do Investimento (R$)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="number"
                            className="input-field"
                            placeholder="0,00"
                            min="0.01"
                            step="0.01"
                            style={{ flex: 1 }}
                            value={investirData.valor}
                            onChange={e => setInvestirData({ ...investirData, valor: e.target.value })}
                        />
                        <button
                            className="btn btn-secondary"
                            style={{ width: 'auto', padding: '0 1rem', fontSize: '0.75rem' }}
                            onClick={() => setInvestirData({ ...investirData, valor: investirData.restante.toString() })}
                        >
                            Total (R$ {investirData.restante?.toLocaleString('pt-BR')})
                        </button>
                    </div>
                </div>

                <div className="input-group mb-1">
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Justificativa Auditoria</label>
                    <textarea
                        className="input-field mt-1"
                        style={{ minHeight: '80px' }}
                        value={investirData.motivo}
                        onChange={e => setInvestirData({ ...investirData, motivo: e.target.value })}
                    />
                </div>
            </ModalPremium>

            {/* Modal de Confirmação de Aporte do Pool */}
            <ModalPremium
                isOpen={showConfirmPoolModal}
                onClose={() => setShowConfirmPoolModal(false)}
                title="Confirmar Aporte do Pool"
                message="Este valor será deduzido do Caixa Coletivo e injetado na solicitação de empréstimo."
                type="pool"
                onConfirm={executarAportePool}
                confirmText="Sim, Confirmar Aporte"
                loading={loadingPool}
            >
                <div className="p-1 text-center" style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '12px' }}>
                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>Valor Sugerido (Baseado no Score):</p>
                    <h2 style={{ fontSize: '2rem', color: 'var(--primary)', margin: '0.5rem 0' }}>
                        R$ {confirmPoolData.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </h2>
                </div>
            </ModalPremium>
        </div >
    );
};

export default AdminDashboard;
