import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Star, ShieldCheck, AlertTriangle, CheckCircle, Copy, Check } from 'lucide-react';
import api from '../api';

const OportunidadesLista = ({ usuario, onUpdate }) => {
    const [oportunidades, setOportunidades] = useState([]);
    const [poolTotal, setPoolTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [aceitando, setAceitando] = useState(null);
    const [aceito, setAceito] = useState(null);
    const [copiado, setCopiado] = useState(false);

    useEffect(() => {
        carregar();
    }, []);

    const carregar = async () => {
        setLoading(true);
        try {
            const data = await api.get('/emprestimos/oportunidades');
            setOportunidades(data.oportunidades || []);
            setPoolTotal(data.pool_disponivel || 0);
        } catch (e) {
            console.error('Erro ao carregar oportunidades:', e);
        }
        setLoading(false);
    };

    const aceitar = async (id) => {
        setAceitando(id);
        try {
            const result = await api.post(`/emprestimos/aceitar-oferta/${id}`);
            setCopiado(false);
            setAceito(result);
            carregar();
        } catch (e) {
            alert('Erro: ' + e.message);
        }
        setAceitando(null);
    };

    const copiarPix = async (texto) => {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        } catch {
            prompt('Copie a chave PIX:', texto);
        }
    };

    return (
        <div className="card">
            <div className="flex-between mb-1">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => onUpdate()} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '8px', borderRadius: '10px' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Pedidos de Apoio</h2>
                </div>
                <span className="badge badge-primary">Pool: R$ {poolTotal.toFixed(2)}</span>
            </div>

            {loading && <p className="text-muted">Carregando...</p>}

            {aceito && (
                <div className="info-block mb-1" style={{ background: 'rgba(var(--success-rgb), 0.08)', border: '1px solid rgba(var(--success-rgb), 0.2)', padding: '15px', borderRadius: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <CheckCircle size={24} color="var(--success)" />
                        <strong style={{ color: 'var(--success)' }}>Pedido Aceito!</strong>
                    </div>
                    <p style={{ fontSize: '0.9rem', margin: '5px 0' }}>
                        Envie R$ {aceito.valor.toFixed(2)} via PIX para:
                    </p>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '10px', marginTop: '8px' }}>
                        <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
                            {aceito.tomador_nome}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--success)', margin: 0 }}>
                                PIX: {aceito.chave_pix_tomador}
                            </p>
                            <button
                                onClick={() => copiarPix(aceito.chave_pix_tomador)}
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--primary)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                {copiado ? <Check size={14} /> : <Copy size={14} />}
                                {copiado ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '5px 0' }}>
                            Score: {aceito.score_tomador} | {aceito.parcelas}x
                        </p>
                        {aceito.taxa_match && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--warning)', margin: '5px 0', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                                Taxa de match (2%): R$ {aceito.taxa_match.toFixed(2)} — paga pelo tomador
                            </p>
                        )}
                    </div>
                    <button className="btn btn-primary mt-1" onClick={() => setAceito(null)} style={{ width: '100%' }}>
                        OK, Já Enviei o PIX
                    </button>
                </div>
            )}

            {!loading && oportunidades.length === 0 && !aceito && (
                <div className="text-center" style={{ padding: '30px 0' }}>
                    <User size={40} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: '10px' }} />
                    <p className="text-muted">Nenhum pedido de apoio no momento.</p>
                </div>
            )}

            {oportunidades.map((op) => (
                <div key={op.id} className="info-block mb-1" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '12px' }}>
                    <div className="flex-between">
                        <div>
                            <p style={{ fontWeight: 700, margin: '0 0 4px 0' }}>
                                {op.tomador_nome}
                            </p>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>R$ {op.valor.toFixed(2)}</span>
                                <span>{op.parcelas}x</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <Star size={12} /> {op.score_tomador}
                                </span>
                                {op.verificado && (
                                    <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <ShieldCheck size={12} /> Verificado
                                    </span>
                                )}
                                {op.inadimplente && (
                                    <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                        <AlertTriangle size={12} /> Inadimplente
                                    </span>
                                )}
                            </div>
                            <p style={{ fontSize: '0.7rem', color: 'var(--success)', margin: '4px 0 0' }}>
                                PIX: {op.chave_pix_tomador}
                            </p>
                        </div>
                        {op.taxa_match_estimada > 0 && (
                            <p style={{ fontSize: '0.65rem', color: 'var(--warning)', margin: '2px 0 0' }}>
                                Taxa de match estimada: R$ {op.taxa_match_estimada.toFixed(2)}
                            </p>
                        )}
                    </div>
                    <button className="btn btn-primary btn-sm"
                            disabled={aceitando === op.id || op.inadimplente}
                            onClick={() => aceitar(op.id)}
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                        >
                            {aceitando === op.id ? '...' : 'Aceitar'}
                        </button>
                </div>
            ))}
        </div>
    );
};

export default OportunidadesLista;
