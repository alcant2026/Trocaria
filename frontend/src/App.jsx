import React, { useState, useEffect, useCallback, lazy, Suspense, startTransition } from 'react';
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
  ShoppingBag,
  Download,
  Coins
} from 'lucide-react';
import api, { BASE_URL } from './api';
import Login from './paginas/Login';
import Registro from './paginas/Registro';
import Perfil from './paginas/Perfil';
import RecuperarSenha from './paginas/RecuperarSenha';
import VerificacaoConta from './paginas/VerificacaoConta';
import Logo from './componentes/Logo';
import Footer from './componentes/Footer';
import BannerCookies from './componentes/BannerCookies';
import TemporizadorInatividade from './componentes/TemporizadorInatividade';
import LoadingScreen from './componentes/LoadingScreen';

// Lazy load paginas pesadas (code splitting)
const DashboardCliente = lazy(() => import('./paginas/DashboardCliente'));
const AdminDashboard = lazy(() => import('./paginas/AdminDashboard'));
const PoliticaPrivacidade = lazy(() => import('./paginas/PoliticaPrivacidade'));
const ComoFunciona = lazy(() => import('./paginas/ComoFunciona'));
const MarketplaceCallback = lazy(() => import('./paginas/MarketplaceCallback'));
const LandingPage = lazy(() => import('./componentes/LandingPage'));

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
        localStorage.setItem('usuario', JSON.stringify(userData));
        setIsAuthenticated(true);
        window.location.hash = 'cliente';
    };

    const onVerificado = () => {
        setUser(prev => prev ? { ...prev, email_verificado: true } : prev);
        localStorage.setItem('usuario', JSON.stringify({ ...user, email_verificado: true }));
        window.location.hash = 'cliente';
    };

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        setUser(null);
        window.location.hash = '';
    }, []);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '') || '';
            startTransition(() => {
                setPage(hash);
            });
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

            const token = localStorage.getItem('token');
            if (token) {
                await fetch(`${BASE_URL}/__warmup`, { signal: AbortSignal.timeout(8000) }).catch(() => {});
                try {
                    const data = await api.get('/auth/perfil');
                    if (data && data.nome) {
                        setUser(data);
                        localStorage.setItem('usuario', JSON.stringify(data));
                        setIsAuthenticated(true);
                    } else {
                        localStorage.removeItem('token');
                        localStorage.removeItem('usuario');
                    }
                } catch (err) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('usuario');
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
        window.addEventListener('trocaria_unauthorized', handleUnauthorized);
        return () => window.removeEventListener('trocaria_unauthorized', handleUnauthorized);
    }, [logout]);

    const baixarDadosLGPD = async () => {
        try {
            const blob = await api.getBlob('/compliance/lgpd/acesso');
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `meus-dados-trocaria-${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Erro ao baixar dados: ' + (err.message || 'Tente novamente.'));
        }
    };

    if (loading) return <LoadingScreen message="Carregando..." />;


    if (!isAuthenticated) {
        if (page === 'login') return (
            <>
                <Login onLogin={onLogin} />
                <BannerCookies usuario={null} />
            </>
        );
        if (page === 'registro') return <Registro />;
        if (page === 'privacidade') return <PoliticaPrivacidade onVoltar={() => window.location.hash = ''} />;
        if (page === 'comofunciona') return <ComoFunciona />;
        if (page === 'recuperar-senha') return <RecuperarSenha />;
        return (
            <Suspense fallback={<LoadingScreen message="Carregando..." />}>
                <LandingPage />
                <BannerCookies usuario={null} />
            </Suspense>
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
                        <a href="#marketplace" className={`nav-item ${page === 'marketplace' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <ShoppingBag size={20} /> Marketplace
                        </a>
                        {user.is_admin && (
                            <a href="#admin" className={`nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                                <Settings size={20} /> Admin
                            </a>
                        )}
                        <a href="#perfil" className={`nav-item ${page === 'perfil' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <Shield size={20} color={user.two_factor_enabled ? 'var(--success)' : 'var(--warning)'} /> Perfil
                        </a>
                        <a href="#meus-pontos" className={`nav-item ${page === 'meus-pontos' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <Coins size={20} /> Meus Pontos
                        </a>
                        <button className="nav-item" onClick={() => { setMenuAberto(false); baixarDadosLGPD(); }} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}>
                            <Download size={20} /> Baixar meus dados (LGPD)
                        </button>
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
            </main>
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>}>
                {(page === 'cliente' || page === 'tomador') && <DashboardCliente />}
                {page === 'pool' && <DashboardCliente initialView="pool" />}
                {page === 'marketplace' && <DashboardCliente initialView="marketplace" />}
                {page === 'meus-pontos' && <DashboardCliente initialView="meus-pontos" />}
                {page === 'vincular-mp' && <MarketplaceCallback />}
                {page === 'admin' && <AdminDashboard />}
                {page === 'perfil' && <Perfil />}
                {page === 'verificar-conta' && <VerificacaoConta onVerificado={onVerificado} />}
                {page === 'comofunciona' && <ComoFunciona />}
                {page === 'privacidade' && <PoliticaPrivacidade onVoltar={() => window.location.hash = 'cliente'} />}
                {(!['cliente', 'tomador', 'pool', 'admin', 'login', 'perfil', 'comofunciona', 'marketplace', 'privacidade'].includes(page)) && <DashboardCliente />}
            </Suspense>

            {!user && (
                <div style={{ textAlign: 'center', padding: '1rem', fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
                    <a href="#comofunciona" style={{ color: 'var(--text-muted)', textDecoration: 'underline', marginRight: '15px' }}>Como Funciona</a>
                    <a href="#privacidade" style={{ color: 'var(--text-muted)', textDecoration: 'underline', marginRight: '15px' }}>Politica de Privacidade</a>
                    <span>© 2026 Trocaria</span>
                </div>
            )}

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
                                    await api.delete('/compliance/lgpd/exclusao');
                                    logout();
                                } catch (err) {
                                    alert('Erro ao excluir conta: ' + (err.message || 'Tente novamente.'));
                                }
                            }}>Sim, Excluir Agora</button>
                            <button className="btn btn-secondary" onClick={() => setModalExcluir(false)}>Manter Minha Conta</button>
                        </div>
                    </div>
                </div>
            )}
            <Footer />
            <TemporizadorInatividade aoDeslogar={logout} />
            <BannerCookies usuario={user} onUpdate={atualizarPerfil} />
        </div>
    );
};

export default App;
