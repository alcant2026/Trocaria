import React, { useState, useEffect } from 'react';
import Login from './paginas/Login';
import Registro from './paginas/Registro';
import DashboardTomador from './paginas/DashboardTomador';
import DashboardInvestidor from './paginas/DashboardInvestidor';
import AdminDashboard from './paginas/AdminDashboard';
import Seguranca from './paginas/Seguranca';
import { Wallet, Settings, LogOut, ArrowDownUp, TrendingUp, User, Menu, X, MessageCircle, Shield } from 'lucide-react';
import './index.css';

const App = () => {
    const whatsappLink = 'https://wa.me/5591980177874';
    const [page, setPage] = useState('login');
    const [user, setUser] = useState(null);
    const [menuAberto, setMenuAberto] = useState(false);
    const [modalExcluir, setModalExcluir] = useState(false);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '') || 'login';
            setPage(hash);
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();

        // Verificar se já está logado
        const savedUser = localStorage.getItem('usuario');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const onLogin = (userData) => {
        setUser(userData);
        window.location.hash = 'tomador'; // Default
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        setUser(null);
        window.location.hash = 'login';
    };

    const botaoWhatsapp = (
        <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            aria-label="Falar no WhatsApp"
            style={{
                position: 'fixed',
                right: '20px',
                bottom: '20px',
                zIndex: 1200,
                background: '#25D366',
                color: '#fff',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 20px rgba(0, 0, 0, 0.25)'
            }}
            title="Falar no WhatsApp"
        >
            <MessageCircle size={28} />
        </a>
    );

    if (!user) {
        if (page === 'registro') {
            return (
                <>
                    <Registro />
                    {botaoWhatsapp}
                </>
            );
        }
        return (
            <>
                <Login onLogin={onLogin} />
                {botaoWhatsapp}
            </>
        );
    }

    return (
        <div className="app-container">
            <nav className="navbar">
                <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); window.location.hash = 'tomador'; }}>
                    <img src="/favicon.svg" alt="P Logo" style={{ width: '32px', height: '32px' }} />
                    <span>eer</span>
                </a>

                <div className="nav-links-desktop">
                    <a href="#tomador" className={`nav-item ${page === 'tomador' ? 'active' : ''}`}>
                        <ArrowDownUp size={18} /> Início
                    </a>
                    <a href="#investidor" className={`nav-item ${page === 'investidor' ? 'active' : ''}`}>
                        <TrendingUp size={18} /> Investimentos
                    </a>
                    {user.is_admin && (
                        <a href="#admin" className={`nav-item ${page === 'admin' ? 'active' : ''}`}>
                            <Settings size={18} /> Admin
                        </a>
                    )}
                    <a href="#seguranca" className={`nav-item ${page === 'seguranca' ? 'active' : ''}`} style={{ color: user.two_factor_enabled ? 'var(--success)' : 'var(--warning)' }}>
                        <Shield size={18} /> Segurança
                    </a>
                </div>

                <button className="mobile-menu-btn" onClick={() => setMenuAberto(!menuAberto)}>
                    {menuAberto ? <X size={28} /> : <Menu size={28} />}
                </button>

                <div className={`mobile-overlay ${menuAberto ? 'open' : ''}`} onClick={() => setMenuAberto(false)}></div>

                <div className={`mobile-drawer ${menuAberto ? 'open' : ''}`}>
                    <div className="nav-links">
                        <a href="#tomador" className={`nav-item ${page === 'tomador' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <ArrowDownUp size={20} /> Início
                        </a>
                        <a href="#investidor" className={`nav-item ${page === 'investidor' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <TrendingUp size={20} /> Investimentos
                        </a>
                        {user.is_admin && (
                            <a href="#admin" className={`nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                                <Settings size={20} /> Admin
                            </a>
                        )}
                        <a href="#seguranca" className={`nav-item ${page === 'seguranca' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <Shield size={20} color={user.two_factor_enabled ? 'var(--success)' : 'var(--warning)'} /> Segurança
                        </a>
                    </div>
                    <div className="drawer-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: 'auto', padding: '1.5rem 0' }}>
                        <div className="flex-between mb-1" style={{ gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {user.nome[0].toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>{user.nome.split(' ')[0]}</span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Perfil Ativo</span>
                                </div>
                            </div>
                            <button className="btn btn-outline" style={{ width: 'auto', height: '40px', padding: '0 12px', borderRadius: '10px' }} onClick={logout} title="Sair da Conta">
                                <LogOut size={18} />
                                <span style={{ fontSize: '0.8rem' }}>Sair</span>
                            </button>
                        </div>

                        <button
                            style={{
                                background: 'rgba(255, 61, 0, 0.05)',
                                border: '1px solid rgba(255, 61, 0, 0.1)',
                                color: 'var(--danger)',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                textAlign: 'center',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                width: '100%',
                                marginTop: '10px',
                                fontWeight: 600,
                                transition: 'var(--transition)'
                            }}
                            className="btn-delete-account"
                            onClick={() => {
                                setMenuAberto(false);
                                setModalExcluir(true);
                            }}
                        >
                            Excluir minha conta e dados (LGPD)
                        </button>
                    </div>
                </div>
            </nav>

            <main className="main-content">
                {page === 'login' && <div className="card text-center"><h2>Você está logado.</h2><button className="btn btn-primary" onClick={() => window.location.hash = 'tomador'}>Ir para o Início</button></div>}
                {page === 'tomador' && <DashboardTomador />}
                {page === 'investidor' && <DashboardInvestidor />}
                {page === 'admin' && <AdminDashboard />}
                {page === 'seguranca' && <Seguranca />}
                {(!['tomador', 'investidor', 'admin', 'login', 'seguranca'].includes(page)) && <DashboardTomador />}
            </main>
            {/* Modal de Exclusão Crítica */}
            {modalExcluir && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ borderColor: 'var(--danger)' }}>
                        <div className="modal-icon" style={{ background: 'rgba(255, 61, 0, 0.1)', color: 'var(--danger)' }}>
                            <X size={32} />
                        </div>
                        <h2 style={{ color: 'var(--danger)' }}>Excluir Conta?</h2>
                        <p>Esta ação é <strong>irreversível</strong>. Seus dados serão anonimizados seguindo as regras da <strong>LGPD</strong>.</p>
                        <p style={{ fontSize: '0.8rem' }}>Você perderá acesso imediato à plataforma.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2rem' }}>
                            <button className="btn btn-danger" style={{ background: 'var(--danger)', color: '#fff' }} onClick={async () => {
                                setModalExcluir(false);
                                try {
                                    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/auth/excluir-conta`, {
                                        method: 'DELETE',
                                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                    });
                                    const data = await res.json();
                                    if (res.ok) {
                                        logout();
                                    } else {
                                        alert(data.detail || 'Erro ao excluir conta.');
                                    }
                                } catch (err) {
                                    alert('Erro de conexão.');
                                }
                            }}>Sim, Excluir Agora</button>
                            <button className="btn btn-secondary" onClick={() => setModalExcluir(false)}>Manter Minha Conta</button>
                        </div>
                    </div>
                </div>
            )}
            {botaoWhatsapp}
        </div>
    );
};

export default App;
