import React, { useState, useEffect } from 'react';
import api from '../api';
import { Shield, ShieldAlert, ShieldCheck, Key, Smartphone, Lock, Copy, Check } from 'lucide-react';

const Seguranca = () => {
    const [status2fa, setStatus2fa] = useState(null);
    const [secretData, setSecretData] = useState(null);
    const [codigo, setCodigo] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiado, setCopiado] = useState(false);

    useEffect(() => {
        carregarStatus();
    }, []);

    const carregarStatus = async () => {
        try {
            const res = await api.get('/auth/perfil');
            setStatus2fa(res.two_factor_enabled);
        } catch (err) {
            console.error("Erro ao carregar perfil:", err);
        }
    };

    const gerar2fa = async () => {
        setLoading(true);
        setMensagem('');
        try {
            const res = await api.post('/auth/2fa/gerar');
            setSecretData(res);
            if (res.error) {
                setMensagem(res.error);
            }
        } catch (err) {
            setMensagem(err.message || "Erro ao conectar com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    const copiarChave = () => {
        if (!secretData?.secret) return;
        navigator.clipboard.writeText(secretData.secret);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    const ativar2fa = async () => {
        if (!codigo) return;
        setLoading(true);
        try {
            await api.post(`/auth/2fa/ativar?codigo=${codigo}`);
            setMensagem("2FA ativado com sucesso!");
            setStatus2fa(true);
            setSecretData(null);
            // Atualizar localStorage
            const user = JSON.parse(localStorage.getItem('usuario'));
            user.two_factor_enabled = true;
            localStorage.setItem('usuario', JSON.stringify(user));
        } catch (err) {
            setMensagem(err.message || "Código inválido.");
        }
        setLoading(false);
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
            <div className="text-center mb-1">
                <h1>Segurança da Conta</h1>
                <p>Proteja seus saques com a Autenticação de Dois Fatores (2FA)</p>
            </div>

            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '16px',
                        background: status2fa ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 145, 0, 0.1)',
                        color: status2fa ? 'var(--success)' : 'var(--warning)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        {status2fa ? <ShieldCheck size={32} /> : <ShieldAlert size={32} />}
                    </div>
                    <div>
                        <h3 style={{ margin: 0 }}>Autenticação 2FA (TOTP)</h3>
                        <p style={{ margin: 0, fontSize: '0.9rem' }}>
                            {status2fa ? "Proteção ATIVA" : "Configuração pendente (Obrigatório para saques)"}
                        </p>
                    </div>
                </div>

                {!status2fa && !secretData && (
                    <div className="text-center">
                        <p>Ative o 2FA para garantir que apenas você possa retirar fundos da sua conta.</p>
                        <button className="btn btn-primary" onClick={gerar2fa} disabled={loading}>
                            {loading ? "Processando..." : "Configurar 2FA Agora"}
                        </button>
                    </div>
                )}

                {!status2fa && secretData && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ background: '#fff', padding: '1rem', borderRadius: '12px', display: 'inline-block', marginBottom: '1rem' }}>
                            <img
                                src={secretData.qr_code}
                                alt="QR Code 2FA"
                                style={{ width: '200px', height: '200px', display: 'block' }}
                                onError={(e) => {
                                    e.target.onerror = null;
                                    setMensagem("Dica: Use a chave manual abaixo caso tenha problemas.");
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '8px' }}>Chave Manual:</p>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '12px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)'
                            }}>
                                <code style={{
                                    color: 'var(--primary)',
                                    fontSize: '1.1rem',
                                    fontWeight: 'bold',
                                    letterSpacing: '1px',
                                    wordBreak: 'break-all'
                                }}>
                                    {secretData.secret}
                                </code>
                                <button
                                    onClick={copiarChave}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: copiado ? 'var(--success)' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'var(--transition)'
                                    }}
                                    title="Copiar chave"
                                >
                                    {copiado ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                            {copiado && <p style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '4px' }}>Copiado!</p>}
                        </div>

                        <div style={{ textAlign: 'left', background: 'rgba(255, 214, 0, 0.05)', padding: '1.2rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(255, 214, 0, 0.2)' }}>
                            <p style={{ fontSize: '0.9rem', color: 'var(--warning)', fontWeight: 700, marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Smartphone size={18} /> Recomendações (Sincronização Nuvem + PC)
                            </p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
                                <a href="https://2fas.com/" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#fff', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                    📱 <strong>2FAS (Celular)</strong>
                                </a>
                                <a href="https://2fas.com/browser-extension/" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#fff', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                    💻 <strong>2FAS (PC/Extensão)</strong>
                                </a>
                                <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#fff', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                    🤖 <strong>Google Auth</strong>
                                </a>
                                <a href="https://www.microsoft.com/pt-br/security/mobile-authenticator-app" target="_blank" rel="noreferrer" style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', textDecoration: 'none', color: '#fff', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                    🪟 <strong>Microsoft Auth</strong>
                                </a>
                            </div>

                            <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginBottom: '0.8rem', lineHeight: '1.4' }}>
                                <strong>Dica:</strong> O <strong>2FAS</strong> permite enviar o código do celular pro PC com um clique. A <strong>Chave Manual</strong> acima é o que você cola no app para ativar.
                            </p>
                            
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                                <Key size={16} /> Digite o código de 6 dígitos gerado:
                            </p>
                        </div>

                        <div className="input-group">
                            <input
                                type="text"
                                placeholder="Código de 6 dígitos"
                                className="input-field"
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem', fontWeight: 'bold' }}
                                maxLength={6}
                            />
                        </div>

                        <button className="btn btn-primary" onClick={ativar2fa} disabled={loading || codigo.length < 6}>
                            {loading ? "Validando..." : "Confirmar e Ativar"}
                        </button>
                    </div>
                )}

                {status2fa && (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <div style={{ color: 'var(--success)', marginBottom: '1rem' }}>
                            <Lock size={48} style={{ margin: '0 auto' }} />
                        </div>
                        <p style={{ color: '#fff', fontWeight: 600 }}>Sua conta está totalmente protegida.</p>
                        <p style={{ fontSize: '0.85rem' }}>O código 2FA será solicitado em cada pedido de saque junto com sua senha.</p>
                    </div>
                )}

                {mensagem && (
                    <p className={`text-center mt-1 ${status2fa ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.875rem' }}>
                        {mensagem}
                    </p>
                )}
            </div>
        </div>
    );
};

export default Seguranca;
