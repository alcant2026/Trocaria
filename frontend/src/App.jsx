import React, { useState, useEffect, useCallback, lazy, Suspense, startTransition } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { 
  ArrowDownUp, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Shield,
  Download,
  Sun,
  Moon,
  Search
} from 'lucide-react';
import api, { BASE_URL } from './api';
import Login from './paginas/Login';
import Registro from './paginas/Registro';
import Perfil from './paginas/Perfil';
import RecuperarSenha from './paginas/RecuperarSenha';
import VerificacaoConta from './paginas/VerificacaoConta';
import Logo from './componentes/Logo';
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
    const [isSubView, setIsSubView] = useState(false);
    const [modalExcluir, setModalExcluir] = useState(false);
    const [tema, setTema] = useState(() => localStorage.getItem('trocaria_tema') || 'dark');

    const toggleTema = useCallback(() => {
        setTema(prev => {
            const novo = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('trocaria_tema', novo);
            return novo;
        });
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', tema);
    }, [tema]);

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
            <nav className="navbar" style={{ display: isSubView ? 'none' : undefined }}>
                <div className="navbar-container">
                    <a href="#" className="nav-brand" onClick={(e) => { e.preventDefault(); window.location.hash = 'cliente'; }}>
                        <Logo size={24} />
                        <span className="nav-brand-name">Trocaria</span>
                    </a>

                    <div className="nav-right">
                        <button className="nav-icon-btn" onClick={toggleTema} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
                            {tema === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        </button>
                        <div className="user-avatar-sm">{user.nome[0].toUpperCase()}</div>
                        <button className="mobile-menu-btn" onClick={() => setMenuAberto(!menuAberto)} aria-label="Abrir Menu">
                            {menuAberto ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>

                <div className={`mobile-overlay ${menuAberto ? 'open' : ''}`} onClick={() => setMenuAberto(false)}></div>
                <div className={`mobile-drawer ${menuAberto ? 'open' : ''}`}>
                    <div className="nav-links">
                        <div className="drawer-header">
                            <h2>Menu</h2>
                            <button className="nav-icon-btn" onClick={toggleTema} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
                                {tema === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            </button>
                        </div>
                        <a href="#cliente" className={`nav-item ${page === 'cliente' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <ArrowDownUp size={20} /> Início
                        </a>
                        {user.is_admin && (
                            <a href="#admin" className={`nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                                <Settings size={20} /> Admin
                            </a>
                        )}
                        <a href="#perfil" className={`nav-item ${page === 'perfil' ? 'active' : ''}`} onClick={() => setMenuAberto(false)}>
                            <Shield size={20} /> Perfil
                        </a>
                        <div className="drawer-theme-row">
                            <span className="nav-item" style={{ cursor: 'default' }}>
                                {tema === 'dark' ? <Moon size={20} /> : <Sun size={20} />} {tema === 'dark' ? 'Escuro' : 'Claro'}
                            </span>
                            <label className="theme-switch">
                                <input type="checkbox" checked={tema === 'light'} onChange={toggleTema} />
                                <span className="theme-slider"></span>
                            </label>
                        </div>
                    </div>
                    <div className="drawer-footer">
                        <div className="footer-user-info">
                            <div className="footer-avatar">{user.nome[0].toUpperCase()}</div>
                            <div className="footer-texts">
                                <span className="footer-name">{user.nome.split(' ')[0]}</span>
                                <span className="footer-sub">{user.email || 'Perfil Ativo'}</span>
                            </div>
                        </div>
                        <div className="footer-actions">
                            <button className="btn-logout" onClick={logout}>
                                <LogOut size={18} />
                                <span>Sair</span>
                            </button>
                            <button className="btn-delete-account" onClick={() => { setMenuAberto(false); setModalExcluir(true); }}>
                                Excluir Conta
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
                {page === 'cliente' && <DashboardCliente isSubView={isSubView} setIsSubView={setIsSubView} />}
                {page === 'marketplace' && <DashboardCliente initialView="marketplace" />}
                {page === 'meus-pontos' && <DashboardCliente initialView="meus-pontos" />}
                {page === 'vincular-mp' && <MarketplaceCallback />}
                {page === 'admin' && <AdminDashboard />}
                {page === 'perfil' && <Perfil />}
                {page === 'verificar-conta' && <VerificacaoConta onVerificado={onVerificado} />}
                {page === 'comofunciona' && <ComoFunciona />}
                {page === 'privacidade' && <PoliticaPrivacidade onVoltar={() => window.location.hash = 'cliente'} />}
                {(!['cliente', 'admin', 'login', 'perfil', 'comofunciona', 'marketplace', 'privacidade', 'meus-pontos', 'vincular-mp', 'verificar-conta'].includes(page)) && <DashboardCliente />}
            </Suspense>

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
            <TemporizadorInatividade aoDeslogar={logout} />
            <BannerCookies usuario={user} onUpdate={atualizarPerfil} />
        </div>
    );
};

export default App;
