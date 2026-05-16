import React, { useState, useEffect } from 'react';
import { ArrowLeft, User, Star, ShieldCheck, AlertTriangle, CheckCircle, Copy, Check } from 'lucide-react';
import api from '../api';
import TermosPlataforma from './TermosPlataforma';
import PagamentoPolling from './PagamentoPolling';

const OportunidadesLista = ({ usuario, onUpdate }) => {
    const [oportunidades, setOportunidades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [aceitando, setAceitando] = useState(null);
    const [aceito, setAceito] = useState(null);
    const [copiado, setCopiado] = useState(false);
    const [showTermosAceite, setShowTermosAceite] = useState(false);
    const [pendenteAceitarId, setPendenteAceitarId] = useState(null);

    useEffect(() => {
        carregar(true);
    }, []);

    const carregar = async (reset = false) => {
        if (reset) setPage(1);
        const p = reset ? 1 : page;
        setLoading(true);
        try {
            const data = await api.get(`/emprestimos/oportunidades?page=${p}&limit=10`);
            const novos = data.oportunidades || [];
            if (reset) {
                setOportunidades(novos);
            } else {
                setOportunidades(prev => [...prev, ...novos]);
            }
            setHasMore(data.has_more || false);
        } catch (e) {
            console.error('Erro ao carregar oportunidades:', e);
        }
        setLoading(false);
    };

    const aceitar = async (id) => {
        setPendenteAceitarId(id);
        setShowTermosAceite(true);
    };

    const aceitarAposAceite = async () => {
        setShowTermosAceite(false);
        const id = pendenteAceitarId;
        setAceitando(id);
        try {
            const result = await api.post(`/emprestimos/aceitar-oferta/${id}`, { aceite_termos_plataforma: true });
            setCopiado(false);
            if (result.qr_code) {
                setAceito({ ...result, aguardando_pagamento: true, transacao_id: result.transacao_id });
            } else {
                setAceito(result);
            }
            carregar();
        } catch (e) {
            alert('Erro: ' + e.message);
        }
        setAceitando(null);
        setPendenteAceitarId(null);
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
            </div>

            <div style={{ background: 'rgba(255,61,0,0.06)', border: '1px solid rgba(255,61,0,0.12)', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px' }}>
                <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3', textAlign: 'center' }}>
                    ⚠️ <strong style={{ color: 'var(--danger)' }}>Risco:</strong> Apoiar via P2P envolve risco de perda total do valor. O Psy Pay não garante pagamentos e não se responsabiliza por inadimplência. Acordo direto entre as partes.
                </p>
            </div>

            {loading && <p className="text-muted">Carregando...</p>}

            {aceito && aceito.aguardando_pagamento && (
                <div className="info-block mb-1" style={{ background: 'rgba(var(--warning-rgb), 0.08)', border: '1px solid rgba(var(--warning-rgb), 0.2)', padding: '15px', borderRadius: '16px' }}>
                    <h4 style={{ textAlign: 'center', marginBottom: '10px' }}>Pague a Taxa de Match</h4>
                    <p style={{ fontSize: '0.85rem', textAlign: 'center', marginBottom: '15px' }}>
                        Pague R$ {aceito.taxa_match.toFixed(2)} via PIX para confirmar seu apoio.
                    </p>
                    {aceito.qr_code_base64 && (
                        <img src={`data:image/jpeg;base64,${aceito.qr_code_base64}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto 15px', borderRadius: '12px' }} />
                    )}
                    {aceito.qr_code && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '10px' }}>
                            <code style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {aceito.qr_code}
                            </code>
                            <button onClick={() => copiarPix(aceito.qr_code)}
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--primary)', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                {copiado ? <Check size={14} /> : <Copy size={14} />}
                                {copiado ? 'Copiado' : 'Copiar PIX'}
                            </button>
                        </div>
                    )}
                    <PagamentoPolling transacaoId={aceito.transacao_id} onConfirmado={() => {
                        setAceito(prev => ({ ...prev, aguardando_pagamento: false }));
                        carregar();
                    }} />
                </div>
            )}

            {aceito && !aceito.aguardando_pagamento && (
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
                            <button onClick={() => copiarPix(aceito.chave_pix_tomador)}
                                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--primary)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {copiado ? <Check size={14} /> : <Copy size={14} />}
                                {copiado ? 'Copiado' : 'Copiar'}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '5px 0' }}>
                            Score: {aceito.score_tomador} | {aceito.parcelas}x
                        </p>
                        {aceito.tomador_telefone && (
                            <a href={`https://wa.me/${aceito.tomador_telefone.replace(/\D/g, '')}?text=Olá! Vi seu pedido no Psy Pay e quero conversar sobre o apoio.`} 
                                target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '8px 14px', background: '#25D366', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Conversar no WhatsApp
                            </a>
                        )}
                    </div>
                    <button className="btn btn-primary mt-1" onClick={() => { setAceito(null); carregar(); }} style={{ width: '100%' }}>
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
                            <div className="opp-stats-row" style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', marginTop: '4px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    Juros: {op.taxa_juros}% (+R$ {op.juros.toFixed(2)})
                                </span>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                    Total: R$ {op.valor_total.toFixed(2)}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    {op.parcelas}x de R$ {op.valor_parcela.toFixed(2)}
                                </span>
                            </div>
                        </div>
                        {op.taxa_match_estimada > 0 && (
                            <p style={{ fontSize: '0.65rem', color: 'var(--warning)', margin: '2px 0 0' }}>
                                Taxa de match estimada: R$ {op.taxa_match_estimada.toFixed(2)}
                            </p>
                        )}
                    </div>
                    <div className="opp-actions-row" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button className="btn btn-primary btn-sm"
                                disabled={aceitando === op.id || op.inadimplente}
                                onClick={() => aceitar(op.id)}
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            >
                                {aceitando === op.id ? '...' : 'Aceitar'}
                        </button>
                        <button className="btn btn-danger btn-sm"
                                onClick={async () => {
                                    const motivo = prompt('Motivo da denúncia (opcional):');
                                    if (motivo === null) return;
                                    try {
                                        await api.post('/comunidade/denunciar-usuario', { denunciado_id: op.usuario_id || op.id, motivo });
                                        alert('Denúncia registrada. Obrigado.');
                                    } catch (err) {
                                        alert(err.response?.data?.detail || 'Erro ao denunciar.');
                                    }
                                }}
                                style={{ padding: '4px 8px', fontSize: '0.6rem', background: 'rgba(255,61,0,0.1)', border: '1px solid rgba(255,61,0,0.2)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer' }}
                                title="Denunciar usuário">
                                🚩 Denunciar
                        </button>
                    </div>
                </div>
            ))}

            {hasMore && (
                <div className="text-center mt-1">
                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                        const nextPage = page + 1;
                        setPage(nextPage);
                        setLoading(true);
                        try {
                            const data = await api.get(`/emprestimos/oportunidades?page=${nextPage}&limit=10`);
                            setOportunidades(prev => [...prev, ...(data.oportunidades || [])]);
                            setHasMore(data.has_more || false);
                        } catch (e) { console.error(e); }
                        setLoading(false);
                    }} disabled={loading} style={{ padding: '8px 20px' }}>
                        {loading ? 'Carregando...' : 'Carregar Mais Pedidos'}
                    </button>
                </div>
            )}

            {showTermosAceite && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: '500px' }}>
                        <TermosPlataforma
                            tipo="apoiar"
                            onAceitar={aceitarAposAceite}
                            onVoltar={function() { setShowTermosAceite(false); }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default OportunidadesLista;
