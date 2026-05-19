import React, { useState, useEffect } from 'react';
import { Search, MapPin, Tag, Zap, Clock, Star, ChevronRight, UserPlus, LogIn, Smartphone, Laptop, Car, Home, Wrench, BookOpen, Gamepad2, Shirt, Sofa, SearchX } from 'lucide-react';
import Logo from './Logo';
import Footer from './Footer';
import api from '../api';

const CATEGORIAS = [
    { nome: 'Celulares', icone: <Smartphone size={24} /> },
    { nome: 'Informatica', icone: <Laptop size={24} /> },
    { nome: 'Eletronicos', icone: <Zap size={24} /> },
    { nome: 'Veiculos', icone: <Car size={24} /> },
    { nome: 'Imoveis', icone: <Home size={24} /> },
    { nome: 'Servicos', icone: <Wrench size={24} /> },
    { nome: 'Cursos', icone: <BookOpen size={24} /> },
    { nome: 'Games', icone: <Gamepad2 size={24} /> },
    { nome: 'Moda', icone: <Shirt size={24} /> },
    { nome: 'Casa', icone: <Sofa size={24} /> },
];

const LandingPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoriaAtiva, setCategoriaAtiva] = useState('Geral');
    const [destaques, setDestaques] = useState([]);
    const [recentes, setRecentes] = useState([]);
    const [loading, setLoading] = useState(true);

    const carregarAnuncios = async (categoria = 'Geral') => {
        setLoading(true);
        try {
            const catParam = categoria !== 'Geral' ? `&categoria=${encodeURIComponent(categoria)}` : '';
            const res = await api.get(`/comunidade/explorar?page=1&limit=24${catParam}`);
            const links = res.links || [];
            setDestaques(links.filter(l => l.patrocinado).slice(0, 8));
            setRecentes(links.filter(l => !l.patrocinado).slice(0, 12));
        } catch (e) {
            console.error('Erro ao carregar anúncios:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarAnuncios(categoriaAtiva);
    }, [categoriaAtiva]);

    const filteredDestaques = destaques.filter(l =>
        l.nome_produto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const filteredRecentes = recentes.filter(l =>
        l.nome_produto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatarValor = (v) => {
        if (!v || v <= 0) return 'Consultar';
        return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const renderCard = (l, idx) => (
        <div key={`${l.id}-${idx}`} className="landing-card" onClick={() => window.location.hash = 'login'}>
            <div className="landing-card-img-wrap">
                <img src={l.url_imagem} alt={l.nome_produto} loading="lazy" />
                {l.patrocinado && (
                    <div className="landing-card-badge landing-card-badge--gold">
                        <Zap size={10} /> DESTAQUE
                    </div>
                )}
            </div>
            <div className="landing-card-body">
                <h4 className="landing-card-title">{l.nome_produto?.length > 45 ? l.nome_produto.substring(0, 45) + '...' : l.nome_produto}</h4>
                <div className="landing-card-price">{formatarValor(l.valor)}</div>
                <div className="landing-card-meta">
                    <span><MapPin size={10} /> {l.anunciante || 'Anônimo'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Star size={10} fill="var(--warning)" color="var(--warning)" /> {l.nota?.toFixed(1) || '0.0'}
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="landing-page">
            {/* Header */}
            <header className="landing-header">
                <div className="landing-header-container">
                    <a href="#home" className="landing-brand" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}>
                        <Logo size={32} />
                    </a>

                    <div className="landing-search-bar">
                        <Search size={18} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Buscar anúncios..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="landing-auth-btns">
                        <a href="#login" className="btn btn-secondary btn-sm" onClick={(e) => { e.preventDefault(); window.location.hash = 'login'; }}>
                            <LogIn size={16} /> Entrar
                        </a>
                        <a href="#registro" className="btn btn-primary btn-sm" onClick={(e) => { e.preventDefault(); window.location.hash = 'registro'; }}>
                            <UserPlus size={16} /> Criar Conta
                        </a>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="landing-hero">
                <div className="landing-hero-content">
                    <h1>Encontre o que você precisa na <span style={{ color: 'var(--primary)' }}>Trocaria</span></h1>
                    <p>O marketplace da comunidade. Anuncie grátis ou destaque seu produto por apenas R$ 5,00.</p>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                        <a href="#registro" className="btn btn-primary" onClick={(e) => { e.preventDefault(); window.location.hash = 'registro'; }} style={{ padding: '0.9rem 1.5rem' }}>
                            <Tag size={18} /> Anunciar Grátis
                        </a>
                        <a href="#comofunciona" className="btn btn-secondary" onClick={(e) => { e.preventDefault(); window.location.hash = 'comofunciona'; }} style={{ padding: '0.9rem 1.5rem' }}>
                            Como Funciona
                        </a>
                    </div>
                </div>
            </section>

            <section style={{ maxWidth: '1100px', margin: '0 auto 2rem', padding: '0 1rem' }}>
                <div style={{ background: 'rgba(255,152,0,0.06)', border: '1px solid rgba(255,152,0,0.15)', padding: '12px 16px', borderRadius: '12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                        ⚠️ <strong style={{ color: '#FF9800' }}>AVISO:</strong> O Trocaria é uma plataforma de conexão entre pessoas. <strong>Não somos banco, instituição financeira ou sociedade de crédito.</strong> Não intermediamos valores. Todo apoio é um acordo direto entre as partes via PIX. Apoiar envolve <strong style={{ color: 'var(--danger)' }}>risco de perda total</strong>. Limite de R$ 5.000 por operação. Leia nossos <a href="#privacidade" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Termos de Uso e Privacidade</a>.
                    </p>
                </div>
            </section>

            {/* Categorias */}
            <section className="landing-section">
                <div className="landing-section-header">
                    <h2><Tag size={20} /> Categorias</h2>
                </div>
                <div className="landing-categorias">
                    <button
                        className={`landing-cat-btn ${categoriaAtiva === 'Geral' ? 'active' : ''}`}
                        onClick={() => setCategoriaAtiva('Geral')}
                    >
                        <div className="landing-cat-icon"><Search size={24} /></div>
                        <span>Todos</span>
                    </button>
                    {CATEGORIAS.map(cat => (
                        <button
                            key={cat.nome}
                            className={`landing-cat-btn ${categoriaAtiva === cat.nome ? 'active' : ''}`}
                            onClick={() => setCategoriaAtiva(cat.nome)}
                        >
                            <div className="landing-cat-icon">{cat.icone}</div>
                            <span>{cat.nome}</span>
                        </button>
                    ))}
                </div>
            </section>

            {/* Destaques */}
            {filteredDestaques.length > 0 && (
                <section className="landing-section">
                    <div className="landing-section-header">
                        <h2><Zap size={20} fill="var(--primary)" /> Anúncios em Destaque</h2>
                        <span className="landing-section-sub">Patrocinados pela comunidade</span>
                    </div>
                    <div className="landing-grid">
                        {filteredDestaques.map((l, i) => renderCard(l, i))}
                    </div>
                </section>
            )}

            {/* Recentes */}
            <section className="landing-section">
                <div className="landing-section-header">
                    <h2><Clock size={20} /> Anúncios Recentes</h2>
                </div>
                {loading ? (
                    <div className="landing-loading">Carregando anúncios...</div>
                ) : filteredRecentes.length === 0 && filteredDestaques.length === 0 ? (
                    <div className="landing-empty">
                        <SearchX size={48} />
                        <p>Nenhum anúncio encontrado.</p>
                        <span>Seja o primeiro a anunciar!</span>
                    </div>
                ) : (
                    <div className="landing-grid">
                        {filteredRecentes.map((l, i) => renderCard(l, i))}
                    </div>
                )}
            </section>

            {/* CTA Final */}
            <section className="landing-cta">
                <div className="landing-cta-content">
                    <h2>Quer vender mais rápido?</h2>
                    <p>Crie sua conta gratuita e comece a anunciar agora. Destaque seu produto por apenas R$ 5,00 e alcance milhares de pessoas.</p>
                    <a href="#registro" className="btn btn-primary" onClick={(e) => { e.preventDefault(); window.location.hash = 'registro'; }} style={{ marginTop: '1rem', padding: '0.9rem 2rem' }}>
                        <UserPlus size={18} /> Criar Conta Grátis
                    </a>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default LandingPage;
