import React from 'react';
import { ArrowLeft, User, ShieldCheck, AlertTriangle, Star } from 'lucide-react';

const WhatsAppIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" style={{ flexShrink: 0 }}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
);

// Página de detalhes do produto (estilo OLX)
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
                                <strong>DICA DE SEGURANÇA:</strong> Combine os detalhes diretamente com o vendedor. Prefira negociar a entrega em locais públicos.
                        </p>
                    </div>
                </div>

                <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição</h4>
                    <p style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {ad.descricao || "Nenhuma descrição fornecida para este anúncio."}
                    </p>
                </div>

                <button className="btn btn-primary detail-cta" style={{ width: '100%', padding: '14px', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={abrirWhatsApp}>
                    <WhatsAppIcon /> Falar com Vendedor
                </button>
            </div>
        </div>
    );
};

export default DetalhesProduto;
