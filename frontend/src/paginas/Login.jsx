import React, { useState } from 'react';
import api from '../api';

import { Wallet, Eye, EyeOff } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [cpf, setCpf] = useState('');
    const [senha, setSenha] = useState('');
    const [showSenha, setShowSenha] = useState(false);
    const [mensagem, setMensagem] = useState('');

    const maskCPF = (value) => {
        return value
            .replace(/\D/g, '') // Remove tudo que não é dígito
            .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto após os 3 primeiros dígitos
            .replace(/(\d{3})(\d)/, '$1.$2') // Coloca ponto após os 6 primeiros dígitos
            .replace(/(\d{3})(\d{1,2})/, '$1-$2') // Coloca hífen após os 9 primeiros dígitos
            .replace(/(-\d{2})\d+?$/, '$1'); // Limita o CPF a 11 dígitos
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', { cpf, senha });
            api.setToken(res.access_token);
            localStorage.setItem('usuario', JSON.stringify(res.usuario));
            onLogin(res.usuario);
        } catch (err) {
            setMensagem('CPF ou senha incorretos.');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-overlay"></div>
            <div className="auth-content">
                <div className="text-center mb-1">
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 204, 0, 0.1)', padding: '24px', borderRadius: '50%', marginBottom: '1.5rem', color: 'var(--primary)', boxShadow: '0 0 40px rgba(255, 204, 0, 0.15)' }}>
                        <img src="/favicon.svg" alt="P Logo" style={{ width: '48px', height: '48px' }} />
                    </div>
                    <h1 style={{ fontSize: '2.5rem', letterSpacing: '-1px', marginBottom: '0.5rem' }}>Bem-vindo ao Peer</h1>
                    <p style={{ fontSize: '1.1rem', opacity: 0.8 }}>Crédito Colaborativo: Fortalecendo nossa Comunidade</p>
                </div>

                <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label htmlFor="cpf">CPF</label>
                            <input 
                                id="cpf"
                                name="cpf"
                                type="text" 
                                autoComplete="username"
                                placeholder="Seu CPF (000.000.000-00)" 
                                value={cpf} 
                                onChange={(e) => setCpf(maskCPF(e.target.value))} 
                                className="input-field" 
                                required 
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="senha">Senha</label>
                            <div style={{ position: 'relative' }}>
                                <input 
                                    id="senha"
                                    name="senha"
                                    type={showSenha ? "text" : "password"} 
                                    autoComplete="current-password"
                                    placeholder="Sua senha secreta" 
                                    value={senha} 
                                    onChange={(e) => setSenha(e.target.value)} 
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
                                    aria-label={showSenha ? "Esconder senha" : "Mostrar senha"}
                                >
                                    {showSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary mt-1">Entrar</button>

                        <div className="text-center mt-1" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <a 
                                href="#recuperar-senha" 
                                style={{ color: '#fff', fontSize: '0.85rem', opacity: 0.8, textDecoration: 'none' }}
                                onClick={(e) => { e.preventDefault(); window.location.hash = 'recuperar-senha'; }}
                            >
                                Esqueci minha senha
                            </a>
                            <a 
                                href="https://wa.me/5591980177874?text=Olá,%20esqueci%20meus%20dados%20de%20acesso%20(CPF/Email)%20no%20Peer%20e%20gostaria%20de%20recuperá-los." 
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--primary)', fontSize: '0.85rem', opacity: 0.9, textDecoration: 'none', fontWeight: 500 }}
                            >
                                Esqueci meu CPF ou E-mail
                            </a>
                        </div>

                        {mensagem && (
                             <div className="alert alert-danger mt-1">
                                 {mensagem}
                             </div>
                        )}
                    </form>
                </div>

                <p className="text-center mt-1" style={{ fontSize: '0.9rem', color: '#fff' }}>
                    Não tem uma conta? <a href="#" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); window.location.hash = 'registro'; }}>Cadastre-se agora</a>
                </p>
            </div>
        </div>
    );
};

export default Login;
