import React, { useState } from 'react';
import api from '../api';

import { Wallet } from 'lucide-react';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [mensagem, setMensagem] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', { email, senha });
            api.setToken(res.access_token);
            localStorage.setItem('usuario', JSON.stringify(res.usuario));
            onLogin(res.usuario);
        } catch (err) {
            setMensagem('E-mail ou senha incorretos.');
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', width: '100%', maxWidth: '400px', margin: '0 auto' }}>
            <div className="text-center mb-1">
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 204, 0, 0.1)', padding: '20px', borderRadius: '50%', marginBottom: '1.5rem', color: 'var(--primary)' }}>
                    <img src="/favicon.svg" alt="P Logo" style={{ width: '40px', height: '40px' }} />
                </div>
                <h1>Bem-vindo ao Peer</h1>
                <p>Acesse sua conta para continuar</p>
            </div>

            <div className="card" style={{ width: '100%' }}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>E-mail</label>
                        <input type="email" placeholder="Seu e-mail cadastrado" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" required />
                    </div>

                    <div className="input-group">
                        <label>Senha</label>
                        <input type="password" placeholder="Sua senha secreta" value={senha} onChange={(e) => setSenha(e.target.value)} className="input-field" required />
                    </div>

                    <button type="submit" className="btn btn-primary mt-1">Entrar</button>

                    {mensagem && <p className="text-danger text-center mt-1" style={{ fontSize: '0.875rem' }}>{mensagem}</p>}
                </form>
            </div>

            <p className="text-center" style={{ fontSize: '0.9rem' }}>
                Não tem uma conta? <a href="#" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); window.location.hash = 'registro'; }}>Cadastre-se agora</a>
            </p>
        </div>
    );
};

export default Login;
