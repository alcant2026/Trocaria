import React, { useState } from 'react';
import api from '../api';
import { ArrowLeft, Send, CheckCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import Footer from '../componentes/Footer';

const RecuperarSenha = () => {
    const [passo, setPasso] = useState(1); // 1: CPF, 2: Código e Nova Senha
    const [cpf, setCpf] = useState('');
    const [codigo, setCodigo] = useState('');
    const [novaSenha, setNovaSenha] = useState('');
    const [confirmarSenha, setConfirmarSenha] = useState('');
    const [mensagem, setMensagem] = useState({ texto: '', tipo: '' });
    const [emailMascarado, setEmailMascarado] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [showSenha, setShowSenha] = useState(false);
    const [showConfirmSenha, setShowConfirmSenha] = useState(false);

    const maskCPF = (value) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d)/, '$1.$2')
            .replace(/(\d{3})(\d{1,2})/, '$1-$2')
            .replace(/(-\d{2})\d+?$/, '$1');
    };

    const handleSolicitar = async (e) => {
        e.preventDefault();
        setCarregando(true);
        setMensagem({ texto: '', tipo: '' });
        try {
            const res = await api.post('/auth/recuperar-senha/solicitar', { cpf });
            setEmailMascarado(res.email_mascarado);
            setPasso(2);
            setMensagem({ texto: 'Código enviado com sucesso para seu e-mail.', tipo: 'success' });
        } catch (err) {
            setMensagem({ 
                texto: err.response?.data?.detail || 'Erro ao solicitar recuperação. Verifique o CPF.', 
                tipo: 'danger' 
            });
        } finally {
            setCarregando(false);
        }
    };

    const handleRedefinir = async (e) => {
        e.preventDefault();
        if (novaSenha !== confirmarSenha) {
            setMensagem({ texto: 'As senhas não coincidem.', tipo: 'danger' });
            return;
        }

        setCarregando(true);
        setMensagem({ texto: '', tipo: '' });
        try {
            await api.post('/auth/recuperar-senha/redefinir', { 
                cpf, 
                codigo, 
                nova_senha: novaSenha 
            });
            setPasso(3); // Sucesso
        } catch (err) {
            setMensagem({ 
                texto: err.response?.data?.detail || 'Erro ao redefinir senha. Verifique o código.', 
                tipo: 'danger' 
            });
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-overlay"></div>
            <div className="auth-content">
                <div className="text-center mb-1">
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 204, 0, 0.1)', padding: '20px', borderRadius: '50%', marginBottom: '1rem', color: 'var(--primary)', boxShadow: '0 0 40px rgba(255, 204, 0, 0.1)' }}>
                        <ShieldCheck size={32} />
                    </div>
                    <h1 style={{ fontSize: '2rem', letterSpacing: '-1px', marginBottom: '0.5rem' }}>Recuperação de Conta</h1>
                    <p style={{ fontSize: '1rem', opacity: 0.8 }}>Segurança blindada para seus dados.</p>
                </div>

                <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                    {passo === 1 && (
                        <form onSubmit={handleSolicitar}>
                            <p className="mb-1" style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                Informe seu CPF para receber um código de segurança em seu e-mail cadastrado.
                            </p>
                            <div className="input-group">
                                <label htmlFor="cpf">CPF</label>
                                <input 
                                    id="cpf"
                                    type="text" 
                                    placeholder="000.000.000-00" 
                                    value={cpf} 
                                    onChange={(e) => setCpf(maskCPF(e.target.value))} 
                                    className="input-field" 
                                    required 
                                />
                            </div>
                            <button type="submit" className="btn btn-primary mt-1" disabled={carregando}>
                                {carregando ? 'Enviando...' : 'Pedir Código de Segurança'}
                            </button>
                        </form>
                    )}

                    {passo === 2 && (
                        <form onSubmit={handleRedefinir}>
                            <p className="mb-1" style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                Digite o código de 6 dígitos enviado para <strong>{emailMascarado}</strong> e defina sua nova senha.
                            </p>
                            <div className="input-group">
                                <label htmlFor="codigo">Código de Segurança</label>
                                <input 
                                    id="codigo"
                                    type="text" 
                                    maxLength="6"
                                    placeholder="Ex: 123456" 
                                    value={codigo} 
                                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} 
                                    className="input-field" 
                                    required 
                                    style={{ letterSpacing: '8px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}
                                />
                            </div>
                            <div className="input-group">
                                <label htmlFor="novaSenha">Nova Senha</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        id="novaSenha"
                                        type={showSenha ? "text" : "password"} 
                                        placeholder="Mínimo 6 caracteres" 
                                        value={novaSenha} 
                                        onChange={(e) => setNovaSenha(e.target.value)} 
                                        className="input-field" 
                                        style={{ paddingRight: '45px' }}
                                        required 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSenha(!showSenha)}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '4px'
                                        }}
                                    >
                                        {showSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                            <div className="input-group">
                                <label htmlFor="confirmarSenha">Confirmar Nova Senha</label>
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        id="confirmarSenha"
                                        type={showConfirmSenha ? "text" : "password"} 
                                        placeholder="Repita a nova senha" 
                                        value={confirmarSenha} 
                                        onChange={(e) => setConfirmarSenha(e.target.value)} 
                                        className="input-field" 
                                        style={{ paddingRight: '45px' }}
                                        required 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmSenha(!showConfirmSenha)}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '4px'
                                        }}
                                    >
                                        {showConfirmSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary mt-1" disabled={carregando}>
                                {carregando ? 'Redefinindo...' : 'Alterar Senha Agora'}
                            </button>
                            <button type="button" className="btn mt-1" onClick={() => setPasso(1)} style={{ background: 'transparent', color: '#fff' }}>
                                <ArrowLeft size={16} style={{ marginRight: '8px' }} /> Voltar
                            </button>
                        </form>
                    )}

                    {passo === 3 && (
                        <div className="text-center">
                            <div className="mb-1" style={{ color: '#10b981' }}>
                                <CheckCircle size={64} style={{ margin: '0 auto' }} />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Senha Alterada!</h2>
                            <p className="mb-2" style={{ opacity: 0.9 }}>Sua recuperação foi concluída com sucesso. Agora você já pode acessar sua conta.</p>
                            <button className="btn btn-primary" onClick={() => window.location.hash = 'login'}>Ir para o Login</button>
                        </div>
                    )}

                    {mensagem.texto && passo !== 3 && (
                        <div className={`alert alert-${mensagem.tipo} mt-1`}>
                            {mensagem.texto}
                        </div>
                    )}
                </div>

                <p className="text-center mt-1" style={{ fontSize: '0.9rem', color: '#fff' }}>
                    Lembrou a senha? <a href="#" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); window.location.hash = 'login'; }}>Fazer Login</a>
                </p>
                <Footer />
            </div>
        </div>
    );
};

export default RecuperarSenha;
