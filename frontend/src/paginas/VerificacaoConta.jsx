import React, { useState, useEffect } from 'react';
import api from '../api';
import Logo from '../componentes/Logo';
import Footer from '../componentes/Footer';
import { Mail, Phone, ArrowLeft, ShieldCheck, Send, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';

const VerificacaoConta = ({ onVerificado }) => {
    const [step, setStep] = useState(1); // 1=email, 2=telefone, 3=pronto
    const [code, setCode] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [userData, setUserData] = useState(null);
    const [contador, setContador] = useState(0);

    useEffect(() => {
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        setUserData(usuario);
        // Se já verificou email, pula pro telefone
        if (usuario.email_verificado && !usuario.telefone_verificado) {
            setStep(2);
        } else if (usuario.email_verificado && usuario.telefone_verificado) {
            setStep(3);
        }
    }, []);

    useEffect(() => {
        let timer;
        if (contador > 0) {
            timer = setTimeout(() => setContador(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [contador]);

    const limparMsgs = () => {
        setErro('');
        setMensagem('');
    };

    // PASSO 1: EMAIL
    const solicitarCodigoEmail = async () => {
        setLoading(true);
        limparMsgs();
        try {
            const res = await api.post('/auth/verificar-email/solicitar');
            setMensagem(`Código enviado para ${res.email_mascarado}`);
            setEnviado(true);
            setContador(60);
        } catch (err) {
            setErro(err.response?.data?.detail || 'Erro ao enviar código.');
        }
        setLoading(false);
    };

    const confirmarEmail = async () => {
        if (!code || code.length !== 6) {
            setErro('Digite o código de 6 dígitos.');
            return;
        }
        setLoading(true);
        limparMsgs();
        try {
            const res = await api.post('/auth/verificar-email/confirmar', { codigo: code });
            setMensagem(res.message);
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            usuario.email_verificado = true;
            localStorage.setItem('usuario', JSON.stringify(usuario));
            setUserData(usuario);
            setCode('');
            setEnviado(false);
            // Vai pro próximo passo depois de 1s
            setTimeout(() => {
                setStep(2);
                limparMsgs();
            }, 1000);
        } catch (err) {
            setErro(err.response?.data?.detail || 'Código inválido.');
        }
        setLoading(false);
    };

    // PASSO 2: TELEFONE
    const solicitarCodigoTelefone = async () => {
        setLoading(true);
        limparMsgs();
        try {
            const res = await api.post('/auth/verificar-telefone/solicitar');
            setMensagem(res.message || 'Código enviado para seu WhatsApp!');
            setEnviado(true);
            setContador(60);
        } catch (err) {
            setErro(err.response?.data?.detail || 'Erro ao enviar código. Verifique se autorizou o CallMeBot no WhatsApp (+34 603 21 43 25).');
        }
        setLoading(false);
    };

    const confirmarTelefone = async () => {
        if (!code || code.length !== 6) {
            setErro('Digite o código de 6 dígitos.');
            return;
        }
        setLoading(true);
        limparMsgs();
        try {
            const res = await api.post('/auth/verificar-telefone/confirmar', { codigo: code });
            setMensagem(res.message);
            const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
            usuario.telefone_verificado = true;
            localStorage.setItem('usuario', JSON.stringify(usuario));
            setUserData(usuario);
            setCode('');
            setEnviado(false);
            setTimeout(() => {
                setStep(3);
                limparMsgs();
            }, 1000);
        } catch (err) {
            setErro(err.response?.data?.detail || 'Código inválido.');
        }
        setLoading(false);
    };

    const renderStepIndicator = () => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem' }}>
            <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: step >= 1 ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 'bold'
            }}>1</div>
            <div style={{ width: '30px', height: '2px', background: step >= 2 ? 'var(--success)' : 'rgba(255,255,255,0.1)' }} />
            <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: step >= 2 ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 'bold'
            }}>2</div>
            <div style={{ width: '30px', height: '2px', background: step >= 3 ? 'var(--success)' : 'rgba(255,255,255,0.1)' }} />
            <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: step >= 3 ? 'var(--success)' : 'rgba(255,255,255,0.1)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.85rem', fontWeight: 'bold'
            }}>
                {step >= 3 ? <CheckCircle size={16} /> : '3'}
            </div>
        </div>
    );

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
                <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 2 }}>
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
                    </div>

                    {renderStepIndicator()}

                    <div className="card" style={{ width: '100%' }}>
                        {/* PASSO 1 - EMAIL */}
                        {step === 1 && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                    <Mail size={20} color="var(--primary)" />
                                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Passo 1: Verificar E-mail</h3>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                    Enviamos um código para <strong>{userData?.email}</strong>
                                </p>
                                <div className="input-group">
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="input-field"
                                        style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary mt-1"
                                    onClick={confirmarEmail}
                                    disabled={loading || code.length !== 6}
                                    style={{ width: '100%' }}
                                >
                                    {loading ? 'Verificando...' : 'Confirmar E-mail'}
                                    {!loading && <ArrowRight size={16} style={{ marginLeft: '6px' }} />}
                                </button>
                                <button
                                    className="btn btn-secondary mt-1"
                                    onClick={solicitarCodigoEmail}
                                    disabled={loading || contador > 0}
                                    style={{ width: '100%', fontSize: '0.85rem' }}
                                >
                                    <Send size={14} style={{ marginRight: '6px' }} />
                                    {enviado
                                        ? (contador > 0 ? `Reenviar em ${contador}s` : 'Reenviar Código')
                                        : 'Enviar Código'
                                    }
                                </button>
                            </>
                        )}

                        {/* PASSO 2 - TELEFONE */}
                        {step === 2 && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                    <Phone size={20} color="var(--primary)" />
                                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Passo 2: Verificar Telefone</h3>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                    {userData?.telefone
                                        ? `Código para: ${userData.telefone}`
                                        : 'Sem telefone cadastrado.'
                                    }
                                </p>

                                {/* Mostra código quando WhatsApp falha */}
                                <div className="input-group">
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        className="input-field"
                                        style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem', fontWeight: 'bold' }}
                                        disabled={!userData?.telefone}
                                    />
                                </div>
                                <button
                                    className="btn btn-primary mt-1"
                                    onClick={confirmarTelefone}
                                    disabled={loading || code.length !== 6 || !userData?.telefone}
                                    style={{ width: '100%' }}
                                >
                                    {loading ? 'Verificando...' : 'Confirmar Telefone'}
                                    {!loading && <ArrowRight size={16} style={{ marginLeft: '6px' }} />}
                                </button>
                                <button
                                    className="btn btn-secondary mt-1"
                                    onClick={solicitarCodigoTelefone}
                                    disabled={loading || contador > 0 || !userData?.telefone}
                                    style={{ width: '100%', fontSize: '0.85rem' }}
                                >
                                    <Send size={14} style={{ marginRight: '6px' }} />
                                    {enviado
                                        ? (contador > 0 ? `Reenviar em ${contador}s` : 'Reenviar Código')
                                        : 'Gerar Código'
                                    }
                                </button>
                                {!enviado && (
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                                        Primeira vez? Envie "I allow callmebot to send me messages" para +34 603 21 43 25 no WhatsApp
                                    </p>
                                )}
                            </>
                        )}

                        {/* PASSO 3 - PRONTO */}
                        {step === 3 && (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '70px', height: '70px', background: 'rgba(var(--success-rgb), 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
                                    <CheckCircle size={36} color="var(--success)" />
                                </div>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Tudo certo!</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                    E-mail e telefone verificados com sucesso.
                                </p>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { if (onVerificado) onVerificado(); }}
                                    style={{ width: '100%', padding: '1.1rem' }}
                                >
                                    <ShieldCheck size={20} /> Acessar Plataforma
                                </button>
                            </div>
                        )}

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
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default VerificacaoConta;