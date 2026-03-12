import React, { useState, useEffect } from 'react';
import Login from './paginas/Login';
import Registro from './paginas/Registro';
import DashboardTomador from './paginas/DashboardTomador';
import DashboardInvestidor from './paginas/DashboardInvestidor';
import AdminDashboard from './paginas/AdminDashboard';
import Seguranca from './paginas/Seguranca';
import { Wallet, Settings, LogOut, ArrowDownUp, TrendingUp, User, Menu, X, MessageCircle, Shield, ShoppingBag } from 'lucide-react';
import './index.css';
import TemporizadorInatividade from './componentes/TemporizadorInatividade';

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
            className="whatsapp-float"
            title="Falar no WhatsApp"
        >
            <MessageCircle size={32} fill="currentColor" />
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
                <div className="navbar-container">
                    <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); window.location.hash = 'tomador'; }}>
                        <img src="/favicon.svg" alt="P Logo" style={{ width: '32px', height: '32px' }} />
                        <span>eer</span>
                    </a>

                    <div className="nav-controls">
                        <div className="avatar-trigger hide-on-mobile" onClick={() => setMenuAberto(true)}>
                            <div className="avatar-circle">
                                {user.nome[0].toUpperCase()}
                            </div>
                            <span className="user-firstname">{user.nome.split(' ')[0]}</span>
                        </div>

                        <button className="mobile-menu-btn" onClick={() => setMenuAberto(!menuAberto)} aria-label="Abrir Menu">
                            {menuAberto ? <X size={26} /> : <Menu size={26} />}
                        </button>
                    </div>
                </div>


                <div className={`mobile-overlay ${menuAberto ? 'open' : ''}`} onClick={() => setMenuAberto(false)}></div>

                <div className={`mobile-drawer ${menuAberto ? 'open' : ''}`}>
                    <div className="nav-links">
                        <div style={{ padding: '0 0.5rem', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Menu</h2>
                        </div>
                        <a href="#tomador" className={`nav-item ${page === 'tomador' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <ArrowDownUp size={20} /> Início
                        </a>
                        <a href="#investidor" className={`nav-item ${page === 'investidor' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <TrendingUp size={20} /> Investimentos
                        </a>
                        <a href="#loja" className={`nav-item ${page === 'loja' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <ShoppingBag size={20} /> Loja
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
                    <div className="drawer-footer">
                        <div className="footer-user-info">
                            <div className="footer-avatar">
                                {user.nome[0].toUpperCase()}
                            </div>
                            <div className="footer-texts">
                                <span className="footer-name">{user.nome.split(' ')[0]}</span>
                                <span className="footer-sub">Perfil Ativo</span>
                            </div>
                        </div>

                        <div className="footer-actions">
                            <button className="btn-logout" onClick={logout}>
                                <LogOut size={18} />
                                <span>Sair</span>
                            </button>
                            <button
                                className="btn-delete-account"
                                onClick={() => {
                                    setMenuAberto(false);
                                    setModalExcluir(true);
                                }}
                            >
                                Excluir Conta (LGPD)
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="main-content">
                {page === 'login' && <div className="card text-center"><h2>Você está logado.</h2><button className="btn btn-primary" onClick={() => window.location.hash = 'tomador'}>Ir para o Início</button></div>}
                {page === 'tomador' && <DashboardTomador />}
                {page === 'investidor' && <DashboardInvestidor />}
                {page === 'loja' && <DashboardTomador initialView="loja" />}
                {page === 'admin' && <AdminDashboard />}
                {page === 'seguranca' && <Seguranca />}
                {(!['tomador', 'investidor', 'admin', 'login', 'seguranca', 'loja'].includes(page)) && <DashboardTomador />}
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

                        <div className="flex-center-column mt-2" style={{ gap: '15px' }}>
                            <button className="btn btn-danger" onClick={async () => {
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
            <TemporizadorInatividade aoDeslogar={logout} />
        </div>
    );
};

export default App;
