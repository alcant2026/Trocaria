import React from 'react';
import { Clock, ShieldCheck, Zap, TrendingUp, CheckCircle2, ArrowDownCircle, ShieldAlert, CheckCircle, AlertCircle } from 'lucide-react';
import PagamentoPolling from './PagamentoPolling';

const ScoreView = ({
    usuario, passoUpgrade, setPassoUpgrade, tipoUpgrade, setTipoUpgrade,
    qrCodeVerificacao, setQrCodeVerificacao, carregarSnapshot,
    kycDetails, setKycDetails, fotoRG, setFotoRG, fotoResidencia, setFotoResidencia,
    loadingAction, setLoadingAction, setMensagem, historico, api
}) => {
    return (
        <div className="card">
            <div className="flex-end mb-1">
                <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ width: '20px', height: '4px', borderRadius: '2px', background: i <= passoUpgrade ? 'var(--primary)' : 'rgba(255,255,255,0.1)' }} />
                    ))}
                </div>
            </div>

            {/* PASSO 1: SELEÇÃO DO UPGRADE */}
            {passoUpgrade === 1 && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p className="text-muted mb-1" style={{ fontSize: '0.85rem' }}>Escolha como deseja melhorar seu perfil hoje.</p>
                    
                    {(!usuario.is_verified || usuario.kyc_status === 'pendente') && (
                        <div 
                            className="card-minimal clickable" 
                            style={{ 
                                background: usuario.kyc_status === 'pendente' ? 'rgba(var(--primary-rgb), 0.08)' : 'rgba(var(--success-rgb), 0.08)', 
                                padding: '1.5rem', 
                                borderRadius: '20px', 
                                border: usuario.kyc_status === 'pendente' ? '2px solid rgba(var(--primary-rgb), 0.2)' : '2px solid rgba(var(--success-rgb), 0.2)',
                                transition: 'all 0.2s ease',
                                marginBottom: '1rem',
                                opacity: usuario.kyc_status === 'pendente' ? 0.8 : 1,
                                cursor: usuario.kyc_status === 'pendente' ? 'default' : 'pointer'
                            }}
                            onClick={() => {
                                if (usuario.kyc_status === 'pendente') return;
                                setTipoUpgrade('verificacao');
                                setPassoUpgrade(2);
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ background: usuario.kyc_status === 'pendente' ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(var(--success-rgb), 0.15)', padding: '12px', borderRadius: '14px' }}>
                                    {usuario.kyc_status === 'pendente' ? <Clock size={28} color="var(--primary)" /> : <ShieldCheck size={28} color="var(--success)" />}
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <h3 style={{ fontSize: '1rem', marginBottom: '4px', color: usuario.kyc_status === 'pendente' ? 'var(--primary)' : 'var(--success)', fontWeight: 800 }}>
                                        {usuario.kyc_status === 'pendente' ? 'Solicitação em Análise' : 'Verificação de Conta'}
                                    </h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {usuario.kyc_status === 'pendente' ? 'Nossa equipe esta revisando seus documentos.' : 'Envie selfie + documento para ganhar o selo de verificacao e +10 pontos no score.'}
                                    </p>
                                </div>
                            </div>
                            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700, 
                                    color: usuario.kyc_status === 'pendente' ? 'var(--primary)' : 'var(--success)', 
                                    background: usuario.kyc_status === 'pendente' ? 'rgba(var(--primary-rgb), 0.1)' : 'rgba(var(--success-rgb), 0.1)', 
                                    padding: '4px 10px', 
                                    borderRadius: '6px' 
                                }}>
                                    {usuario.kyc_status === 'pendente' ? 'Aguarde 24h' : 'GRATIS'}
                                </span>
                                <div style={{ color: usuario.kyc_status === 'pendente' ? 'var(--text-muted)' : 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {usuario.kyc_status === 'pendente' ? 'Análise em curso' : 'Começar Agora →'}
                                </div>
                            </div>
                        </div>
                    )}

                    <div 
                        className="card-minimal clickable" 
                        style={{ 
                            background: 'rgba(var(--primary-rgb), 0.05)', 
                            padding: '1.2rem', 
                            borderRadius: '16px', 
                            border: '1px solid rgba(var(--primary-rgb), 0.1)',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => {
                            setTipoUpgrade('score');
                            setPassoUpgrade(2);
                        }}
                    >
                        <h3 style={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                            <Zap size={18} /> Novo Sistema de Score
                        </h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
                            Descubra como ganhar pontos e melhorar seu limite.
                        </p>
                        <div style={{ marginTop: '5px', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>Clique para ver as regras</div>
                    </div>
                </div>
            )}

            {/* PASSO 2: DETALHES E INSTRUÇÕES */}
            {passoUpgrade === 2 && (
                <div className="animate-fade-in">
                    {tipoUpgrade === 'score' ? (
                        <div className="animate-fade-in" style={{ padding: '0.5rem' }}>
                            <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                                <TrendingUp size={30} color="var(--primary)" />
                            </div>
                            <h3 className="mb-1 text-center" style={{ fontSize: '1.1rem' }}>Como funciona o Score?</h3>
                            <p className="text-muted mb-1 text-center" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>Seu score reflete sua confianca na plataforma.</p>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div className="info-block" style={{ background: 'rgba(var(--success-rgb), 0.05)', padding: '12px', borderLeft: '4px solid var(--success)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ background: 'rgba(var(--success-rgb), 0.1)', padding: '8px', borderRadius: '8px' }}>
                                        <CheckCircle2 size={20} color="var(--success)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px' }}>Pagamento em Dia</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+5 pontos por parcela paga dentro do prazo.</div>
                                    </div>
                                </div>
                                <div className="info-block" style={{ background: 'rgba(255,61,0,0.05)', padding: '12px', borderLeft: '4px solid var(--danger)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ background: 'rgba(255, 61, 0, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                        <ArrowDownCircle size={20} color="var(--danger)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px', color: 'var(--danger)' }}>Pagamento Atrasado</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-10 pontos por parcela paga apos o vencimento.</div>
                                    </div>
                                </div>
                                <div className="info-block" style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '12px', borderLeft: '4px solid var(--primary)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '8px', borderRadius: '8px' }}>
                                        <ShieldCheck size={20} color="var(--primary)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px' }}>Verificacao KYC</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+10 pontos ao ter a conta verificada.</div>
                                    </div>
                                </div>
                                <div className="info-block" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderLeft: '4px solid var(--danger)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <div style={{ background: 'rgba(255, 61, 0, 0.1)', padding: '8px', borderRadius: '8px' }}>
                                        <ShieldAlert size={20} color="var(--danger)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '2px', color: 'var(--danger)' }}>Calote</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Zera o score e marca como inadimplente.</div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-1 p-1 text-center" style={{ background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '12px', fontSize: '0.75rem' }}>
                                <p style={{ margin: 0 }}>Score maximo: 1000. Quanto maior seu score, mais credibilidade.</p>
                            </div>

                            <div className="mt-1">
                                <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setPassoUpgrade(1)}>Voltar</button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            {usuario.is_verified ? (
                                <div className="text-center">
                                    <div style={{ background: 'rgba(var(--success-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                                        <ShieldCheck size={36} color="var(--success)" />
                                    </div>
                                    <h3 style={{ color: 'var(--success)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Conta Verificada</h3>
                                    <p className="text-muted" style={{ fontSize: '0.85rem' }}>Seu perfil ja possui o selo de verificacao. Obrigado pela confianca!</p>
                                    {!usuario.is_subscriber && (
                                        <button className="btn btn-primary mt-1" onClick={() => { setTipoUpgrade('score'); setPassoUpgrade(2); }}>
                                            Ver Regras do Score
                                        </button>
                                    )}
                                </div>
                            ) : qrCodeVerificacao ? (
                                <div className="text-center">
                                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Pague R$ 14,99 via PIX para verificar sua conta</p>
                                    {qrCodeVerificacao.qr_code_base64 && (
                                        <img src={`data:image/png;base64,${qrCodeVerificacao.qr_code_base64}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', margin: '0 auto 1rem', borderRadius: '12px' }} />
                                    )}
                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', marginBottom: '0.5rem' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: 700 }}>{qrCodeVerificacao.qr_code}</p>
                                    </div>
                                    {qrCodeVerificacao.transacao_id && (
                                        <PagamentoPolling transacaoId={qrCodeVerificacao.transacao_id} onConcluido={() => {
                                            carregarSnapshot();
                                            setPassoUpgrade(1);
                                            setQrCodeVerificacao(null);
                                        }} />
                                    )}
                                    <button className="btn btn-secondary mt-1" style={{ width: '100%' }} onClick={() => { setQrCodeVerificacao(null); setPassoUpgrade(1); }}>Voltar</button>
                                </div>
                            ) : (
                                <div>
                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '1rem' }}>
                                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '14px' }}>
                                            <ShieldCheck size={28} color="var(--primary)" />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Verificacao de Conta</h3>
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Envie seus documentos para verificacao gratuita. Apos aprovado, ganha +10 pontos no score!</p>
                                        </div>
                                    </div>

                                    {(() => {
                                        const kycRejeitado = historico.find(h => h.tipo === 'desbloqueio_dados' && h.status === 'falhou');
                                        if (kycRejeitado) {
                                            return (
                                                <div style={{ background: 'rgba(255, 61, 0, 0.08)', border: '1px solid rgba(255, 61, 0, 0.2)', padding: '10px', borderRadius: '10px', marginBottom: '1rem' }}>
                                                    <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <AlertCircle size={14} /> TENTATIVA ANTERIOR REJEITADA
                                                    </p>
                                                    <p style={{ color: '#fff', fontSize: '0.8rem', marginTop: '4px', fontStyle: 'italic' }}>"{kycRejeitado.detalhes}"</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    <div className="input-group mb-1">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: fotoRG && fotoResidencia ? '1px solid var(--success)' : '1px dashed rgba(255,255,255,0.1)' }}>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                                    Selfie segurando o documento {fotoRG && fotoResidencia && <CheckCircle size={16} className="text-success ml-1" />}
                                                </label>
                                                <input type="file" accept="image/*" onChange={(e) => setFotoRG(e.target.files[0])} style={{ fontSize: '0.75rem', width: '100%' }} />
                                            </div>
                                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', border: fotoResidencia ? '1px solid var(--success)' : '1px dashed rgba(255,255,255,0.1)' }}>
                                                <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                                                    Foto do RG ou CNH {fotoResidencia && <CheckCircle size={16} className="text-success ml-1" />}
                                                </label>
                                                <input type="file" accept="image/*,.pdf" onChange={(e) => setFotoResidencia(e.target.files[0])} style={{ fontSize: '0.75rem', width: '100%' }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="info-block mb-1 text-center" style={{ background: 'rgba(var(--success-rgb), 0.05)', border: '1px solid rgba(var(--success-rgb), 0.1)' }}>
                                        <div className="info-label">Valor</div>
                                        <div className="info-value" style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--success)' }}>GRATIS</div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                                        <button className="btn btn-primary" style={{ flex: 2 }} disabled={!fotoRG || !fotoResidencia || loadingAction} onClick={async () => {
                                            try {
                                                setLoadingAction(true);
                                                const form = new FormData();
                                                if (fotoRG) form.append('foto_rg', fotoRG);
                                                if (fotoResidencia) form.append('foto_residencia', fotoResidencia);
                                                form.append('detalhes', 'Solicitacao via Upgrade');
                                                await api.post('/score/solicitar-verificacao', form, { isMultipart: true });
                                                setMensagem({ tipo: 'sucesso', texto: 'Documentos enviados! Aguarde a analise do administrador.' });
                                                setFotoRG(null); setFotoResidencia(null);
                                                setPassoUpgrade(1);
                                            } catch (e) {
                                                const msg = e?.response?.data?.detail || 'Erro ao enviar documentos.';
                                                setMensagem({ tipo: 'erro', texto: msg });
                                            } finally { setLoadingAction(false); }
                                        }}>
                                            {loadingAction ? <span className="spinner" /> : 'Enviar Documentos (Gratis)'}
                                        </button>
                                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPassoUpgrade(1)}>Voltar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* PASSO 3: CONFIRMAÇÃO E ENVIO */}
            {passoUpgrade === 3 && (
                <div className="animate-fade-in text-center" style={{ padding: '1rem 0' }}>
                    <div style={{ background: 'rgba(var(--success-rgb), 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <CheckCircle2 size={40} color="var(--success)" />
                    </div>
                    <h3 className="mb-1">Tudo Pronto!</h3>
                    <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>
                        {tipoUpgrade === 'score' 
                            ? "Confirme para atualizar seu Score agora mesmo." 
                            : "Nossa equipe analisará seus documentos e sua conta em até 24h úteis."}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
                        <button 
                            className="btn btn-primary" 
                            onClick={tipoUpgrade === 'score' ? () => setMensagem('O score agora cresce com o seu uso da plataforma.') : () => {}}
                            disabled={loadingAction}
                        >
                            {loadingAction ? 'Processando...' : 'Enviar para Análise (Grátis)'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => setPassoUpgrade(2)} disabled={loadingAction}>Revisar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScoreView;
