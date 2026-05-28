import React, { useState, useEffect } from 'react';
import api, { BACKEND_URL } from '../api';
import { ArrowLeft, BadgeCheck, ShieldCheck, Mail, Phone, Lock, Crown, Gem, Award, ShoppingBag, TrendingUp, MapPin, Calendar } from 'lucide-react';

const ICONE_BADGE = {
    selfie_verificada: BadgeCheck,
    kyc: ShieldCheck,
    email: Mail,
    telefone: Phone,
    '2fa': Lock,
    top_seller: Crown,
    elite_seller: Gem,
};

const COR_BADGE = {
    selfie_verificada: 'var(--success)',
    kyc: 'var(--primary)',
    email: 'var(--info)',
    telefone: 'var(--info)',
    '2fa': 'var(--warning)',
    top_seller: '#FFD600',
    elite_seller: '#E0115F',
};

const PerfilVendedor = ({ usuarioId, onVoltar }) => {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);
    const [erro, setErro] = useState('');

    useEffect(() => {
        if (!usuarioId) return;
        setLoading(true);
        api.get(`/comunidade/perfil-vendedor/${usuarioId}`)
            .then(setDados)
            .catch(err => setErro(err.message || 'Erro ao carregar perfil'))
            .finally(() => setLoading(false));
    }, [usuarioId]);

    if (loading) {
        return (
            <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
                <div className="skeleton-loading skeleton-card" style={{ height: '200px', marginBottom: '10px' }}></div>
                <div className="skeleton-loading skeleton-card" style={{ height: '100px', marginBottom: '10px' }}></div>
                <div className="skeleton-loading skeleton-card" style={{ height: '100px' }}></div>
            </div>
        );
    }

    if (erro || !dados) {
        return (
            <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
                <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{erro || 'Vendedor não encontrado.'}</p>
                <button className="btn btn-secondary w-full" onClick={onVoltar}>Voltar</button>
            </div>
        );
    }

    const { usuario, estatisticas, badges, ranking_posicao } = dados;

    return (
        <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <button onClick={onVoltar} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
                    <ArrowLeft size={20} />
                </button>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Perfil do Vendedor</h2>
            </div>

            <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
                    {usuario.selfie_url && usuario.selfie_verificada ? (
                        <img src={`${BACKEND_URL}${usuario.selfie_url}`} alt={usuario.nome} style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--success)' }} />
                    ) : usuario.foto_url ? (
                        <img src={`${BACKEND_URL}${usuario.foto_url}`} alt={usuario.nome} style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{usuario.nome?.[0]?.toUpperCase()}</span>
                        </div>
                    )}
                    {usuario.selfie_verificada && (
                        <div style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--success)', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-color)' }}>
                            <BadgeCheck size={14} color="#fff" />
                        </div>
                    )}
                </div>

                <h2 style={{ fontSize: '1.2rem', margin: '0 0 4px' }}>{usuario.nome}</h2>

                {(usuario.cidade || usuario.estado) && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <MapPin size={12} /> {usuario.cidade}{usuario.cidade && usuario.estado ? ', ' : ''}{usuario.estado}
                    </p>
                )}

                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Calendar size={12} /> Membro desde {usuario.membro_desde}
                </p>

                {badges.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
                        {badges.map((b, i) => {
                            const Icon = ICONE_BADGE[b.tipo] || Award;
                            return (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: `${COR_BADGE[b.tipo] || 'var(--primary)'}20`, color: COR_BADGE[b.tipo] || 'var(--primary)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600 }}>
                                    <Icon size={12} /> {b.label}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: '1rem' }}>
                <h3 style={{ fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={16} /> Estatísticas
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: 'rgba(var(--success-rgb), 0.05)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                        <ShoppingBag size={20} style={{ color: 'var(--success)', marginBottom: '4px' }} />
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>{estatisticas.vendas_concluidas}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Vendas</div>
                    </div>
                    <div style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                        <Award size={20} style={{ color: 'var(--primary)', marginBottom: '4px' }} />
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>{ranking_posicao ? `#${ranking_posicao}` : '—'}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Ranking</div>
                    </div>
                    <div style={{ background: 'rgba(var(--warning-rgb), 0.05)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                        <ShoppingBag size={20} style={{ color: 'var(--warning)', marginBottom: '4px' }} />
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--warning)' }}>{estatisticas.items_a_venda}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Anúncios</div>
                    </div>
                    <div style={{ background: 'rgba(255, 214, 0, 0.05)', padding: '14px', borderRadius: '12px', textAlign: 'center' }}>
                        <TrendingUp size={20} style={{ color: '#FFD600', marginBottom: '4px' }} />
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FFD600' }}>{estatisticas.mais_vendido || '—'}</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Mais Vendido</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PerfilVendedor;
