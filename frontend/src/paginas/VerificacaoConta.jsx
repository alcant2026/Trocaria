import React, { useState, useEffect } from 'react';
import api from '../api';
import Logo from '../componentes/Logo';
import Footer from '../componentes/Footer';
import { Mail, Phone, ArrowLeft, ShieldCheck, Send, CheckCircle, AlertCircle } from 'lucide-react';

const VerificacaoConta = ({ onVerificado }) => {
    const [emailCode, setEmailCode] = useState('');
    const [phoneCode, setPhoneCode] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [erro, setErro] = useState('');
    const [loadingEmail, setLoadingEmail] = useState(false);
    const [loadingPhone, setLoadingPhone] = useState(false);
    const [emailEnviado, setEmailEnviado] = useState(false);
    const [phoneEnviado, setPhoneEnviado] = useState(false);
    const [emailVerificado, setEmailVerificado] = useState(false);
    const [phoneVerificado, setPhoneVerificado] = useState(false);
    const [userData, setUserData] = useState(null);
    const [contadorEmail, setContadorEmail] = useState(0);
    const [contadorPhone, setContadorPhone] = useState(0);

    useEffect(() => {
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        setUserData(usuario);
        if (usuario.email_verificado) setEmailVerificado(true);
        if (usuario.telefone_verificado) setPhoneVerificado(true);
    }, []);

    useEffect(() => {
        let timer;
        if (contadorEmail > 0) {
            timer = setTimeout(() => setContadorEmail(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [contadorEmail]);

    useEffect(() => {
        let timer;
        if (contadorPhone > 0) {
            timer = setTimeout(() => setContadorPhone(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [contadorPhone]);

    const solicitarCodigoEmail = async () => {
        setLoadingEmail(true);
        setErro('');
        setMensagem('');
        try {
            const res = await api.post('/auth/verificar-email/solicitar');
            setMensagem(res.message);
            setEmailEnviado(true);
            setContadorEmail(60);
        } catch (err) {
            setErro(err.response?.data?.detail || 'Erro ao enviar código.');
        }
        setLoadingEmail(false);
    };

    const confirmarEmail = async () => {
        if (!emailCode || emailCode.length !== 6) {
            setErro('Digite o código de 6 dígitos.');
            return;
        }
        setLoadingEmail(true);
        setErro('');
        setMensagem('');
        try {
            const res = await api.post('/auth/verificar-email/confirmar', { codigo: emailCode });
            setMensagem(res.message);
            setEmailVerificado(true);
            setEmailCode('');
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            usuario.email_verificado = true;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        } catch (err) {
            setErro(err.response?.data?.detail || 'Código inválido.');
        }
        setLoadingEmail(false);
    };

    const solicitarCodigoTelefone = async () => {
        setLoadingPhone(true);
        setErro('');
        setMensagem('');
        try {
            const res = await api.post('/auth/verificar-telefone/solicitar');
            setMensagem(res.message);
            setPhoneEnviado(true);
            setContadorPhone(60);
        } catch (err) {
            setErro(err.response?.data?.detail || 'Erro ao enviar código.');
        }
        setLoadingPhone(false);
    };

    const confirmarTelefone = async () => {
        if (!phoneCode || phoneCode.length !== 6) {
            setErro('Digite o código de 6 dígitos.');
            return;
        }
        setLoadingPhone(true);
        setErro('');
        setMensagem('');
        try {
            const res = await api.post('/auth/verificar-telefone/confirmar', { codigo: phoneCode });
            setMensagem(res.message);
            setPhoneVerificado(true);
            setPhoneCode('');
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            usuario.telefone_verificado = true;
            localStorage.setItem('usuario', JSON.stringify(usuario));
        } catch (err) {
            setErro(err.response?.data?.detail || 'Código inválido.');
        }
        setLoadingPhone(false);
    };

    const podeProsseguir = emailVerificado && phoneVerificado;

    return (
        <div className="landing-page">
            <header className="landing-header">
                <div className="landing-header-container">
                    <a href="#" className="landing-brand" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}>
                        <Logo size={32} />
                    </a>
                </div>
            </header>

            <div className="auth-page" style={{ minHeight: 'calc(100vh - 64px)', marginTop: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
                <div className="auth-overlay" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.92), rgba(0,0,0,0.6))', zIndex: 1 }}></div>
                <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 2 }}>
                    <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
                        <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = 'login'; }} style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <ArrowLeft size={14} /> Voltar para o login
                        </a>
                    </div>

                    <div className="text-center mb-1">
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', background: 'rgba(255,204,0,0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
                            <ShieldCheck size={32} color="#FFCC00" />
                        </div>
                        <h1 style={{ fontSize: '1.8rem', letterSpacing: '-0.5px' }}>Verifique sua Conta</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            Para sua segurança, confirme seu e-mail e telefone.
                        </p>
                    </div>

                    <div className="card" style={{ width: '100%' }}>
                        {/* Verificação de E-mail */}
                        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <Mail size={20} color={emailVerificado ? 'var(--success)' : 'var(--primary)'} />
                                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Verificação de E-mail</h3>
                                {emailVerificado && <CheckCircle size={18} color="var(--success)" />}
                            </div>

                            {!emailVerificado ? (
                                <>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        Enviamos um código para <strong>{userData?.email}</strong>. Digite abaixo:
                                    </p>
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            placeholder="000000"
                                            maxLength={6}
                                            value={emailCode}
                                            onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="input-field"
                                            style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-primary mt-1"
                                        onClick={confirmarEmail}
                                        disabled={loadingEmail || emailCode.length !== 6}
                                        style={{ width: '100%' }}
                                    >
                                        {loadingEmail ? 'Verificando...' : 'Confirmar E-mail'}
                                    </button>
                                    <button
                                        className="btn btn-secondary mt-1"
                                        onClick={solicitarCodigoEmail}
                                        disabled={loadingEmail || contadorEmail > 0}
                                        style={{ width: '100%', fontSize: '0.85rem' }}
                                    >
                                        <Send size={14} style={{ marginRight: '6px' }} />
                                        {emailEnviado
                                            ? (contadorEmail > 0 ? `Reenviar em ${contadorEmail}s` : 'Reenviar Código')
                                            : 'Enviar Código'
                                        }
                                    </button>
                                </>
                            ) : (
                                <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle size={18} />
                                    E-mail verificado com sucesso!
                                </div>
                            )}
                        </div>

                        {/* Verificação de Telefone */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <Phone size={20} color={phoneVerificado ? 'var(--success)' : 'var(--primary)'} />
                                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Verificação de Telefone</h3>
                                {phoneVerificado && <CheckCircle size={18} color="var(--success)" />}
                            </div>

                            {!phoneVerificado ? (
                                <>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                        {userData?.telefone
                                            ? `Enviamos um código para ${userData.telefone} via WhatsApp (GRÁTIS).`
                                            : 'Você não tem telefone cadastrado. Atualize seu perfil primeiro.'
                                        }
                                    </p>

                                    {/* Instruções de ativação WhatsApp grátis */}
                                    <div style={{ background: 'rgba(37, 211, 102, 0.08)', border: '1px solid rgba(37, 211, 102, 0.2)', borderRadius: '12px', padding: '14px', marginBottom: '1rem' }}>
                                        <p style={{ fontSize: '0.8rem', color: '#25D366', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                            Como receber código no WhatsApp (GRÁTIS)
                                        </p>
                                        <ol style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '16px', lineHeight: '1.6' }}>
                                            <li>Salve o número <strong>+34 603 21 43 25</strong> nos seus contatos</li>
                                            <li>Abra o WhatsApp e envie esta mensagem exata para ele:</li>
                                        </ol>
                                        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', margin: '8px 0', textAlign: 'center' }}>
                                            <code style={{ fontSize: '0.75rem', color: '#fff', wordBreak: 'break-all' }}>I allow callmebot to send me messages</code>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText('I allow callmebot to send me messages'); setMensagem('Mensagem copiada! Cole no WhatsApp.'); }}
                                                style={{ background: 'none', border: 'none', color: '#25D366', cursor: 'pointer', marginLeft: '8px', fontSize: '0.7rem' }}
                                            >
                                                Copiar
                                            </button>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
                                            <strong>3.</strong> Pronto! Agora é só clicar em "Enviar Código" abaixo que você receberá no WhatsApp.
                                        </p>
                                    </div>

                                    <div className="input-group">
                                        <input
                                            type="text"
                                            placeholder="000000"
                                            maxLength={6}
                                            value={phoneCode}
                                            onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            className="input-field"
                                            style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}
                                            disabled={!userData?.telefone}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-primary mt-1"
                                        onClick={confirmarTelefone}
                                        disabled={loadingPhone || phoneCode.length !== 6 || !userData?.telefone}
                                        style={{ width: '100%' }}
                                    >
                                        {loadingPhone ? 'Verificando...' : 'Confirmar Telefone'}
                                    </button>
                                    <button
                                        className="btn btn-secondary mt-1"
                                        onClick={solicitarCodigoTelefone}
                                        disabled={loadingPhone || contadorPhone > 0 || !userData?.telefone}
                                        style={{ width: '100%', fontSize: '0.85rem' }}
                                    >
                                        <Send size={14} style={{ marginRight: '6px' }} />
                                        {phoneEnviado
                                            ? (contadorPhone > 0 ? `Reenviar em ${contadorPhone}s` : 'Reenviar Código')
                                            : 'Enviar Código'
                                        }
                                    </button>
                                </>
                            ) : (
                                <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <CheckCircle size={18} />
                                    Telefone verificado com sucesso!
                                </div>
                            )}
                        </div>

                        {erro && (
                            <div className="alert alert-danger animate-shake mt-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <AlertCircle size={18} />
                                {erro}
                            </div>
                        )}

                        {mensagem && (
                            <div className="alert alert-success mt-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle size={18} />
                                {mensagem}
                            </div>
                        )}

                        {podeProsseguir && (
                            <button
                                className="btn btn-primary mt-2"
                                onClick={() => { if (onVerificado) onVerificado(); }}
                                style={{ width: '100%', padding: '1.1rem' }}
                            >
                                <ShieldCheck size={20} /> Acessar Plataforma
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default VerificacaoConta;