import React from 'react';
import { ArrowLeft, User, ShieldCheck, AlertTriangle, Star } from 'lucide-react';

const DetalhesProduto = ({ ad, onVoltar }) => {
    if (!ad) return null;

    const abrirWhatsApp = () => {
        const link = ad.url_afiliado || '';
        const isPhone = /^\d+$/.test(link.replace(/\D/g, ''));
        if (isPhone) {
            const num = link.replace(/\D/g, '');
            window.open(`https://wa.me/${num}`, '_blank');
        } else {
            window.open(link, '_blank');
        }
    };

    return (
        <div className="card animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <button onClick={onVoltar} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                    <ArrowLeft size={20} />
                </button>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Detalhes do Anúncio</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ad.url_imagem && (
                    <img src={ad.url_imagem} className="detail-image" style={{ width: '100%', borderRadius: '12px', maxHeight: '300px', objectFit: 'cover' }} alt="Produto" />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span className="badge badge--primary">{ad.categoria || 'Geral'}</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>
                        R$ {(ad.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'rgba(var(--primary-rgb), 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={18} color="var(--primary)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {ad.anunciante}
                                {ad.anunciante_verificado && <ShieldCheck size={14} color="#00CFFF" title="Vendedor Verificado" />}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                Membro desde {ad.anunciante_desde || 'N/D'}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--success)' }}>
                                {ad.anunciante_vendas || 0} VENDAS
                            </div>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Concluídas</div>
                        </div>
                    </div>
                    {ad.nota > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '0.75rem', color: '#FFD700' }}>
                            <Star size={12} fill="#FFD700" /> {Number(ad.nota).toFixed(1)} ({ad.total_avaliacoes || 0} avaliações)
                        </div>
                    )}
                </div>

                {ad.cidade && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        📍 {ad.cidade}{ad.estado ? `/${ad.estado}` : ''}
                    </div>
                )}

                <div style={{ background: 'rgba(255,214,0,0.05)', padding: '10px', borderRadius: '10px', border: '1px dotted rgba(255,214,0,0.3)' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <AlertTriangle size={16} color="#FFD600" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                            <strong>DICA DE SEGURANÇA:</strong> Nunca realize pagamentos fora do Psy Pay. Prefira negociar a entrega em locais públicos.
                        </p>
                    </div>
                </div>

                <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição</h4>
                    <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {ad.descricao || "Nenhuma descrição fornecida para este anúncio."}
                    </p>
                </div>

                <button className="btn btn-primary detail-cta" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} onClick={abrirWhatsApp}>
                    💬 Falar com Vendedor
                </button>
            </div>
        </div>
    );
};

export default DetalhesProduto;
