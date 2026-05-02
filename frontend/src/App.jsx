import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { 
  ArrowDownUp, 
  TrendingUp, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Shield,
  ShoppingBag
} from 'lucide-react';
import api, { BASE_URL } from './api';
import DashboardCliente from './paginas/DashboardCliente';
import AdminDashboard from './paginas/AdminDashboard';
import Login from './paginas/Login';
import Registro from './paginas/Registro';
import Seguranca from './paginas/Seguranca';
import PoliticaPrivacidade from './paginas/PoliticaPrivacidade';
import RecuperarSenha from './paginas/RecuperarSenha';
import Logo from './componentes/Logo';
import BannerCookies from './componentes/BannerCookies';
import TemporizadorInatividade from './componentes/TemporizadorInatividade';
import LoadingScreen from './componentes/LoadingScreen';
import MarketplaceCallback from './paginas/MarketplaceCallback';

const App = () => {
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [menuAberto, setMenuAberto] = useState(false);
    const [page, setPage] = useState('login');
    const [modalExcluir, setModalExcluir] = useState(false);

    const atualizarPerfil = useCallback(async () => {
        try {
            const data = await api.get('/auth/perfil');
            setUser(data);
        } catch (err) {
            console.error('Erro ao atualizar perfil:', err);
        }
    }, []);

    const onLogin = (userData) => {
        setUser(userData);
        setIsAuthenticated(true);
        window.location.hash = 'cliente';
    };

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
        window.location.hash = 'login';
    }, []);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '') || 'login';
            setPage(hash);
        };
        window.addEventListener('hashchange', handleHashChange);
        handleHashChange();
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        const init = async () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('code') && params.get('state')) {
                setPage('vincular-mp');
                setLoading(false);
                return;
            }

            const maxRetries = 3;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    if (attempt > 0) setLoading(true);
                    const resp = await fetch(`${BASE_URL}/__warmup`, { signal: AbortSignal.timeout(15000) });
                    if (resp.ok) break;
                } catch {
                    if (attempt < maxRetries - 1) {
                        await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
                    }
                }
            }

            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const data = await api.get('/auth/perfil');
                    if (data && data.nome) {
                        setUser(data);
                        setIsAuthenticated(true);
                    } else {
                        localStorage.removeItem('token');
                    }
                } catch (err) {
                    localStorage.removeItem('token');
                }
            }
            const isCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
            if (isCapacitor) {
                try {
                    await StatusBar.setBackgroundColor({ color: '#000000' });
                    await StatusBar.setStyle({ style: Style.Dark });
                    await SplashScreen.hide();
                } catch (e) { console.warn('Plugins nativos não disponíveis.'); }
            }
            setLoading(false);
        };
        init();
        
        const handleUnauthorized = () => logout();
        window.addEventListener('psypay_unauthorized', handleUnauthorized);
        return () => window.removeEventListener('psypay_unauthorized', handleUnauthorized);
    }, [logout]);

    if (loading) return <LoadingScreen message="Inicializando Psy Pay..." />;


    if (!isAuthenticated) {
        if (page === 'registro') return <Registro />;
        if (page === 'privacidade') return <PoliticaPrivacidade onVoltar={() => window.location.hash = 'login'} />;
        if (page === 'recuperar-senha') return <RecuperarSenha />;
        return (
            <>
                <Login onLogin={onLogin} />
                <BannerCookies usuario={null} />
            </>
        );
    }

    return (
        <div className="app-container">
            <nav className="navbar">
                <div className="navbar-container">
                    <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); window.location.hash = 'cliente'; }}>
                        <Logo size={28} />
                    </a>

                    <div className="nav-user-preview">
                        <div className="user-info">
                            <div className="user-avatar">{user.nome[0].toUpperCase()}</div>
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
                        <a href="#cliente" className={`nav-item ${['cliente', 'tomador'].includes(page) ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <ArrowDownUp size={20} /> Início
                        </a>
                        <a href="#grupo" className={`nav-item ${page === 'grupo' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <TrendingUp size={20} /> Grupo de Apoio
                        </a>
                        <a href="#marketplace" className={`nav-item ${page === 'marketplace' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <ShoppingBag size={20} /> Marketplace
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
                            <div className="footer-avatar">{user.nome[0].toUpperCase()}</div>
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
                            <button className="btn-delete-account" onClick={() => { setMenuAberto(false); setModalExcluir(true); }}>
                                Excluir Conta (LGPD)
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="main-content">
                {page === 'login' && (
                    <div className="card text-center">
                        <h2>Você está logado.</h2>
                        <button className="btn btn-primary" onClick={() => window.location.hash = 'cliente'}>Ir para o Início</button>
                    </div>
                )}
                {(page === 'cliente' || page === 'tomador') && <DashboardCliente />}
                {page === 'pool' && <DashboardCliente initialView="pool" />}
                {page === 'marketplace' && <DashboardCliente initialView="marketplace" />}
                {page === 'vincular-mp' && <MarketplaceCallback />}
                {page === 'admin' && <AdminDashboard />}
                {page === 'seguranca' && <Seguranca />}
                {page === 'privacidade' && <PoliticaPrivacidade onVoltar={() => window.location.hash = 'cliente'} />}
                {(!['cliente', 'tomador', 'pool', 'admin', 'login', 'seguranca', 'marketplace', 'privacidade'].includes(page)) && <DashboardCliente />}
            </main>

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
                                    const res = await fetch(`${import.meta.env.VITE_API_URL || 'https://peer-5gq5.onrender.com/api'}/auth/excluir-conta`, {
                                        method: 'DELETE',
                                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                                    });
                                    if (res.ok) logout();
                                    else alert('Erro ao excluir conta.');
                                } catch (err) { alert('Erro de conexão.'); }
                            }}>Sim, Excluir Agora</button>
                            <button className="btn btn-secondary" onClick={() => setModalExcluir(false)}>Manter Minha Conta</button>
                        </div>
                    </div>
                </div>
            )}
            <footer className="api-footer">
                <p>PSY PAY - Plataforma experimental de tecnologia para crédito digital. Atuamos como facilitador de crédito cooperativo em fase beta. O uso do serviço implica no aceite total dos Termos de Uso e Política de Privacidade. © 2024-2026 PSY PAY.</p>
            </footer>
            <TemporizadorInatividade aoDeslogar={logout} />
            <BannerCookies usuario={user} onUpdate={atualizarPerfil} />
        </div>
    );
};

export default App;
