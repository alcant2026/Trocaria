import React, { useState, useEffect } from 'react';
import api from '../api';
import Logo from '../componentes/Logo';
import Footer from '../componentes/Footer';
import { Mail, ArrowLeft, ShieldCheck, Send, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

const VerificacaoConta = ({ onVerificado }) => {
    const [mensagem, setMensagem] = useState('');
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);
    const [enviado, setEnviado] = useState(false);
    const [userData, setUserData] = useState(null);
    const [contador, setContador] = useState(0);
    const [linkVerificacao, setLinkVerificacao] = useState('');
    const [verificado, setVerificado] = useState(false);

    useEffect(() => {
        const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
        setUserData(usuario);
        if (usuario.email_verificado) setVerificado(true);
    }, []);

    useEffect(() => {
        let timer;
        if (contador > 0) timer = setTimeout(() => setContador(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [contador]);

    const limparMsgs = () => { setErro(''); setMensagem(''); };

    const solicitarLinkEmail = async () => {
        setLoading(true); limparMsgs();
        try {
            const res = await api.post('/auth/verificar-email/solicitar');
            setLinkVerificacao(res.link || '');
            setMensagem('Link de verificação gerado!');
            setEnviado(true); setContador(60);
        } catch (err) {
            setErro(err.response?.data?.detail || 'Erro ao gerar link.');
        }
        setLoading(false);
    };

    const confirmarEmailVerificado = async () => {
        setLoading(true); limparMsgs();
        try {
            const res = await api.post('/auth/verificar-email/confirmar');
            setMensagem(res.message);
            const u = JSON.parse(localStorage.getItem('usuario') || '{}');
            u.email_verificado = true;
            localStorage.setItem('usuario', JSON.stringify(u));
            setUserData(u); setVerificado(true);
        } catch (err) {
            setErro(err.response?.data?.detail || 'E-mail ainda não verificado. Clique no link primeiro.');
        }
        setLoading(false);
    };

    return (
        <div className="landing-page">
            <header className="landing-header"><div className="landing-header-container">
                <a href="#" className="landing-brand" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}><Logo size={32} /></a>
            </div></header>
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
                            <ShieldCheck size={32} color="#FFCC00" /></div>
                        <h1 style={{ fontSize: '1.8rem', letterSpacing: '-0.5px' }}>Verifique sua Conta</h1>
                    </div>

                    <div className="card" style={{ width: '100%' }}>
                        {!verificado ? (<>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                                <Mail size={20} color="var(--primary)" />
                                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Verificar E-mail</h3>
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                Verificação para: <strong>{userData?.email}</strong>
                            </p>
                            {!enviado ? (
                                <button className="btn btn-primary mt-1" onClick={solicitarLinkEmail} disabled={loading} style={{ width: '100%' }}>
                                    {loading ? 'Gerando...' : 'Gerar Link de Verificação'}{!loading && <Send size={16} style={{ marginLeft: '6px' }} />}
                                </button>
                            ) : (<>
                                {linkVerificacao && (<div style={{ marginBottom: '1rem' }}>
                                    <a href={linkVerificacao} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textDecoration: 'none' }}>
                                        <ExternalLink size={16} /> Abrir Link de Verificação
                                    </a>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', wordBreak: 'break-all' }}>
                                        {linkVerificacao}
                                    </p>
                                </div>)}
                                <button className="btn btn-primary mt-1" onClick={confirmarEmailVerificado} disabled={loading} style={{ width: '100%' }}>
                                    {loading ? 'Verificando...' : 'Já Verifiquei'}{!loading && <CheckCircle size={16} style={{ marginLeft: '6px' }} />}
                                </button>
                                <button className="btn btn-secondary mt-1" onClick={solicitarLinkEmail} disabled={loading || contador > 0} style={{ width: '100%', fontSize: '0.85rem' }}>
                                    <Send size={14} style={{ marginRight: '6px' }} />{contador > 0 ? `Gerar novo em ${contador}s` : 'Gerar Novo Link'}
                                </button>
                            </>)}
                        </>) : (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '70px', height: '70px', background: 'rgba(var(--success-rgb), 0.1)', borderRadius: '50%', marginBottom: '1rem' }}>
                                    <CheckCircle size={36} color="var(--success)" /></div>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>E-mail verificado!</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                    Telefone é opcional e pode ser atualizado no perfil.
                                </p>
                                <button className="btn btn-primary" onClick={() => { if (onVerificado) onVerificado(); }} style={{ width: '100%', padding: '1.1rem' }}>
                                    <ShieldCheck size={20} /> Acessar Plataforma
                                </button>
                            </div>
                        )}

                        {erro && (<div className="alert alert-danger animate-shake mt-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={18} />{erro}</div>)}
                        {mensagem && (<div className="alert alert-success mt-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={18} />{mensagem}</div>)}
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
};

export default VerificacaoConta;
