import React from 'react';
import { ShieldCheck, Camera, BadgeCheck, ChevronRight, Gem } from 'lucide-react';

const ScoreView = ({
    usuario, setPassoUpgrade, setTipoUpgrade, carregarSnapshot,
    loadingAction, setLoadingAction, setMensagem, api
}) => {
    return (
        <div className="card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>
                Melhore seu perfil e ganhe badges de confiança na plataforma.
            </p>

            {/* SELFIE VERIFICATION */}
            <div
                className="card-minimal clickable"
                style={{
                    background: usuario.selfie_verificada ? 'rgba(var(--success-rgb), 0.08)' : 'rgba(var(--primary-rgb), 0.05)',
                    padding: '1.2rem',
                    borderRadius: '16px',
                    border: usuario.selfie_verificada ? '2px solid rgba(var(--success-rgb), 0.2)' : '1px solid rgba(var(--primary-rgb), 0.1)',
                    cursor: 'pointer'
                }}
                onClick={() => window.location.hash = 'perfil'}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: usuario.selfie_verificada ? 'rgba(var(--success-rgb), 0.15)' : 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '14px' }}>
                        {usuario.selfie_verificada ? <BadgeCheck size={28} color="var(--success)" /> : <Camera size={28} color="var(--primary)" />}
                    </div>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '4px', color: usuario.selfie_verificada ? 'var(--success)' : 'var(--primary)', fontWeight: 800 }}>
                            {usuario.selfie_verificada ? 'Selfie Verificada' : usuario.selfie_url ? 'Selfie em Análise' : 'Selfie de Verificação'}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            {usuario.selfie_verificada
                                ? 'Badge de verificação conquistado!'
                                : usuario.selfie_url
                                    ? 'Aguardando aprovação do administrador.'
                                    : 'Envie sua selfie para ganhar um badge de verificação no perfil.'}
                        </p>
                    </div>
                    <ChevronRight size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
            </div>

            {/* UPGRADE PREMIUM */}
            <div
                className="card-minimal clickable"
                style={{
                    background: usuario.is_subscriber ? 'rgba(var(--success-rgb), 0.08)' : 'rgba(255, 214, 0, 0.05)',
                    padding: '1.2rem',
                    borderRadius: '16px',
                    border: usuario.is_subscriber ? '2px solid rgba(var(--success-rgb), 0.2)' : '1px solid rgba(255, 214, 0, 0.2)',
                    cursor: 'pointer'
                }}
                onClick={() => setTipoUpgrade?.('premium')}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: usuario.is_subscriber ? 'rgba(var(--success-rgb), 0.15)' : 'rgba(255, 214, 0, 0.15)', padding: '12px', borderRadius: '14px' }}>
                        <Gem size={28} color={usuario.is_subscriber ? 'var(--success)' : '#FFD600'} />
                    </div>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '4px', color: usuario.is_subscriber ? 'var(--success)' : '#FFD600', fontWeight: 800 }}>
                            {usuario.is_subscriber ? 'Premium Ativo' : 'Upgrade Premium'}
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                            {usuario.is_subscriber
                                ? 'Aproveite os benefícios exclusivos.'
                                : 'Ganhe pontos turbo, destaque nos anúncios e selo VIP.'}
                        </p>
                    </div>
                    <ChevronRight size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
            </div>

            {/* BADGES ATUAIS */}
            {usuario.badges && usuario.badges.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Seus Badges</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {usuario.badges.map((b, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(var(--success-rgb), 0.1)', color: 'var(--success)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 600 }}>
                                {b === 'selfie' && <BadgeCheck size={12} />}
                                {b === 'kyc' && <ShieldCheck size={12} />}
                                {b === 'email' && '📧'}
                                {b === 'telefone' && '📱'}
                                {b === '2fa' && '🔐'}
                                {b === 'top_seller' && '👑'}
                                {b}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScoreView;
