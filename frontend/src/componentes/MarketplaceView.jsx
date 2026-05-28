import React, { useState, useEffect } from 'react';
import { Plus, Zap, Gem, CreditCard, Clock, Flag, Eye, Star, Timer, RefreshCw, ShoppingBag, PlusCircle, Rocket, Search, ShieldCheck, CheckCircle, AlertCircle, Repeat, BadgeCheck as BadgeCheckIcon, Crown as CrownIcon } from 'lucide-react';
import RankingSemanal from './RankingSemanal';
import SeloConfianca from './SeloConfianca';
import { BACKEND_URL } from '../api';

const CATEGORIAS_MARKETPLACE = [
    "Geral", "Celulares", "Informatica", "Eletronicos", "Veiculos",
    "Imoveis", "Servicos", "Cursos", "Games", "Moda", "Casa", "Saude", "Alimentacao"
];

const MarketTimer = ({ expiresAt }) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - new Date();
    if (diff <= 0) return <span className="market-timer market-timer--expired">Expirado</span>;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h % 24;
        return <span className="market-timer">{d}d{rh > 0 ? ` ${rh}h` : ''}</span>;
    }
    return <span className="market-timer">{`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}</span>;
};

const normalizarImagem = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BACKEND_URL}${url}`;
};

const MarketplaceView = ({
    usuario, marketplaceTab, setMarketplaceTab, selectedCategory, setSelectedCategory,
    selectedCity, setSelectedCity,
    marketplaceLinks, meusLinksMarketplace, loadingMarket, hasMoreExplorar, hasMoreMeusLinks,
    carregarExplorar, carregarMeusLinksMarketplace, handleDenunciar, handleAvaliar,
    setShowAssinarModal, handleSolicitarResgate,
    setActiveView,
    setSelectedAdDetails,
    setBoostTarget, setShowBoostModal, setPixDestaque, showModal, api, setMensagem,
    onVerPerfilVendedor
}) => {
    const [busca, setBusca] = useState('');
    const [precoMin, setPrecoMin] = useState('');
    const [precoMax, setPrecoMax] = useState('');
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [vendasPendentes, setVendasPendentes] = useState({ como_vendedor: [], como_comprador: [] });
    const [loadingVendas, setLoadingVendas] = useState(false);
    const [trocas, setTrocas] = useState({ propostas_enviadas: [], propostas_recebidas: [] });
    const [loadingTrocas, setLoadingTrocas] = useState(false);

    const carregarVendasPendentes = async () => {
        setLoadingVendas(true);
        try {
            const res = await api.get('/comunidade/minhas-vendas-pendentes');
            setVendasPendentes(res);
        } catch (err) {
            console.error('Erro ao carregar vendas:', err);
        }
        setLoadingVendas(false);
    };

    const carregarTrocas = async () => {
        setLoadingTrocas(true);
        try {
            const res = await api.get('/comunidade/minhas-trocas');
            setTrocas(res);
        } catch (err) {
            console.error('Erro ao carregar trocas:', err);
        }
        setLoadingTrocas(false);
    };

    useEffect(() => {
        if (marketplaceTab === 'vendas') {
            carregarVendasPendentes();
        }
        if (marketplaceTab === 'trocas') {
            carregarTrocas();
        }
    }, [marketplaceTab]);

    const handleBuscar = () => {
        carregarExplorar(busca || undefined, precoMin || undefined, precoMax || undefined);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleBuscar();
    };

    const getImagemPrincipal = (l) => {
        if (l.imagens && l.imagens.length > 0) return normalizarImagem(l.imagens[0]);
        return normalizarImagem(l.url_imagem);
    };

    return (
        <div className="marketplace-container animate-fade-in">
            <div className="marketplace-header mb-1" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div className="marketplace-tabs" style={{ flex: 1 }}>
                    <button className={`m-tab ${marketplaceTab === 'explorar' ? 'active' : ''}`} onClick={() => setMarketplaceTab('explorar')}>Explorar</button>
                    <button className={`m-tab ${marketplaceTab === 'meus' ? 'active' : ''}`} onClick={() => setMarketplaceTab('meus')}>Meus Anuncios</button>
                    <button className={`m-tab ${marketplaceTab === 'vendas' ? 'active' : ''}`} onClick={() => setMarketplaceTab('vendas')}>Vendas</button>
                    <button className={`m-tab ${marketplaceTab === 'trocas' ? 'active' : ''}`} onClick={() => setMarketplaceTab('trocas')}>Trocas</button>
                    <button className={`m-tab ${marketplaceTab === 'ranking' ? 'active' : ''}`} onClick={() => setMarketplaceTab('ranking')}>Ranking</button>
                    <button className={`m-tab ${marketplaceTab === 'config' ? 'active' : ''}`} onClick={() => setMarketplaceTab('config')}>Configuracoes</button>
                </div>
                
                {marketplaceTab === 'explorar' && (
                    <div className="filter-bar" style={{ width: '100%' }}>
                        {/* BUSCA TEXTUAL */}
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                                <input 
                                    className="input-field" 
                                    placeholder="Buscar produtos..." 
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    style={{ paddingLeft: '32px' }}
                                />
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={handleBuscar} style={{ height: '36px', minWidth: '70px' }}>Buscar</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setMostrarFiltros(!mostrarFiltros)} style={{ height: '36px', minWidth: '40px' }}>
                                {mostrarFiltros ? '✕' : '⚙'}
                            </button>
                        </div>
                        
                        {/* FILTROS AVANCADOS */}
                        {mostrarFiltros && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                <select 
                                    className="input-field m-filter-select"
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    style={{ flex: 1, minWidth: '120px' }}
                                >
                                    {CATEGORIAS_MARKETPLACE.map(cat => <option key={cat} value={cat}>{cat === 'Geral' ? 'Todas Categorias' : cat}</option>)}
                                </select>
                                <select 
                                    className="input-field m-filter-select"
                                    value={selectedCity}
                                    onChange={(e) => setSelectedCity(e.target.value)}
                                    style={{ flex: 1, minWidth: '120px' }}
                                >
                                    <option value="Todas">Todas Cidades</option>
                                    {usuario?.cidade && <option value={usuario.cidade}>{usuario.cidade} (sua)</option>}
                                </select>
                                <input 
                                    className="input-field" 
                                    placeholder="Preco min" 
                                    type="number" 
                                    value={precoMin}
                                    onChange={(e) => setPrecoMin(e.target.value)}
                                    style={{ width: '90px' }}
                                />
                                <input 
                                    className="input-field" 
                                    placeholder="Preco max" 
                                    type="number" 
                                    value={precoMax}
                                    onChange={(e) => setPrecoMax(e.target.value)}
                                    style={{ width: '90px' }}
                                />
                            </div>
                        )}
                    </div>
                )}

                <button className="btn btn-primary btn-sm" onClick={() => setActiveView('novo-anuncio')} style={{ gap: '5px', whiteSpace: 'nowrap', height: '32px', minHeight: 'unset', fontSize: '0.75rem', padding: '0 10px', flexShrink: 0 }}>
                    <Plus size={14} /> Novo Anuncio
                </button>
            </div>

            {/* BANNER PREMIUM / PONTOS */}
            {usuario.is_subscriber ? (
                <div style={{ 
                    background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.2) 0%, rgba(0,0,0,0.4) 100%)', 
                    padding: '15px', 
                    borderRadius: '16px', 
                    marginBottom: '1.5rem', 
                    border: '1px solid rgba(var(--primary-rgb), 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                            <Zap size={18} fill="var(--primary)" /> MEMBRO PREMIUM ATIVO
                        </h4>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Voce ganha 1 ponto por cada link aberto. A cada 1.000 pontos = R$ 0,10 de premio! (pago via PIX direto)</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Seus Pontos</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>{usuario.pontos_marketplace || 0} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>pts</span></div>
                        {(usuario.pontos_marketplace || 0) >= 1000 && (
                            <button className="btn btn-sm btn-primary mt-0-5" style={{ fontSize: '0.65rem', padding: '4px 8px' }} onClick={handleSolicitarResgate}>
                                Solicitar Resgate
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="premium-banner">
                    <div className="premium-icon-wrap">
                        <Zap size={24} color="#FFD600" fill="#FFD600" />
                    </div>
                    <div className="premium-text-wrap">
                        <h4>Seja um Membro Premium Marketplace</h4>
                        <p>Ganhe de 1 a 5 pontos por clique (aleatorio) e converta em dinheiro real! Gratis: 1 ponto fixo.</p>
                    </div>
                    <button 
                        className="btn btn-primary btn-sm premium-btn" 
                        onClick={() => setShowAssinarModal(true)}
                    >
                        <Gem size={14} /> ASSINAR PREMIUM
                    </button>
                </div>
            )}

            {marketplaceTab === 'ranking' && (
                <div className="animate-fade-in">
                    <RankingSemanal usuario={usuario} />
                </div>
            )}

            {marketplaceTab === 'config' && (
                <div className="animate-fade-in" style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    padding: '20px', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '2rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '10px', borderRadius: '12px' }}>
                            <CreditCard size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Links de Afiliados</h3>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Compartilhe links de produtos e servicos. Ao clicar, o usuario e redirecionado diretamente para o site do anunciante. Nao processamos pagamentos — apenas conectamos pessoas.</p>
                        </div>
                    </div>
                </div>
            )}

            {marketplaceTab === 'explorar' && (
                <div className="market-explorar-layout">
                    <div className="market-explorar-main">
                        {loadingMarket && marketplaceLinks.length === 0 ? (
                            <div className="marketplace-grid">
                                {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton-loading" style={{ height: '180px', borderRadius: '12px' }}></div>)}
                            </div>
                        ) : marketplaceLinks.length > 0 ? (
                            <>
                                <div className="marketplace-grid">
                                    {marketplaceLinks.map(l => (
                                        <div key={l.id} className={`market-card ${l.patrocinado ? 'market-card--boosted' : 'market-card--free'}`}>
                                            <div className="market-img-wrapper">
                                                {getImagemPrincipal(l) ? (
                                                    <img src={getImagemPrincipal(l)} alt={l.nome_produto} loading="lazy" width="180" height="180" />
                                                ) : (
                                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}>
                                                        <span style={{ fontSize: '0.65rem' }}>Sem foto</span>
                                                    </div>
                                                )}
                                                {l.total_imagens > 1 && (
                                                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px' }}>
                                                        📷 {l.total_imagens}
                                                    </div>
                                                )}
                                                {l.patrocinado ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'absolute', top: '10px', left: '10px', zIndex: 2 }}>
                                                        <div className="market-badge market-badge--gold" style={{ position: 'static' }}><Zap size={10} /> DESTAQUE</div>
                                                        {usuario.is_subscriber && l.ponto_max > 1 && (
                                                            <div className="market-badge" style={{ position: 'static', background: 'var(--success)', color: '#000', fontWeight: 900, border: 'none' }}>
                                                                + ATE {l.ponto_max} PTS
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="market-badge market-badge--free"><Clock size={10} /> 24H</div>
                                                )}
                                                <button 
                                                    className="market-report-btn" 
                                                    title="Denunciar" 
                                                    onClick={(e) => { 
                                                        e.preventDefault(); 
                                                        e.stopPropagation(); 
                                                        handleDenunciar(l); 
                                                    }}
                                                >
                                                    <Flag size={12} />
                                                </button>
                                                <div className="market-price-tag">R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                                {l.nivel_confianca && (
                                                    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2 }}>
                                                        <SeloConfianca
                                                            nivel={l.nivel_confianca}
                                                            label={l.label_confianca}
                                                            cor={l.cor_confianca}
                                                            icone={l.icone_confianca}
                                                            tamanho="xs"
                                                            vendas={l.anunciante_vendas}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="market-info">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                    <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                                        {l.categoria || 'Geral'}
                                                    </span>
                                                    {l.cidade && (
                                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                            📍 {l.cidade}{l.estado ? `/${l.estado}` : ''}
                                                        </span>
                                                    )}
                                                    <span className="market-views"><Eye size={11} /> {l.views_totais || 0}</span>
                                                </div>
                                                <h3 className="market-title" style={{ marginBottom: '4px' }}>{l.nome_produto?.length > 60 ? l.nome_produto.substring(0, 60) + '...' : l.nome_produto}</h3>
                                                <div className="market-meta" style={{ marginTop: '4px', borderTop: 'none', paddingTop: 0 }}>
                                                    <span className="market-author" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onVerPerfilVendedor?.(l.usuario_id); }}>
                                                        por {l.anunciante}
                                                        {l.anunciante_selfie && <span title="Selfie Verificada" style={{ display: 'inline-flex', marginLeft: '4px', color: 'var(--success)', verticalAlign: 'middle' }}><BadgeCheckIcon size={12} /></span>}
                                                        {l.anunciante_badges?.includes('top_seller') && <span title="Top Seller" style={{ display: 'inline-flex', marginLeft: '2px', color: '#FFD600', verticalAlign: 'middle' }}><CrownIcon size={12} /></span>}
                                                    </span>
                                                    <div className="market-stars">
                                                        {[1, 2, 3, 4, 5].map((s) => {
                                                            const isDono = l.usuario_id === usuario?.id;
                                                            return (
                                                                <Star 
                                                                    key={s} 
                                                                    size={10} 
                                                                    fill={s <= (l.nota || 0) ? "var(--warning)" : "transparent"} 
                                                                    color={s <= (l.nota || 0) ? "var(--warning)" : "var(--text-muted)"} 
                                                                    style={{ opacity: s <= (l.nota || 0) ? 1 : 0.4, cursor: isDono ? 'default' : 'pointer' }} 
                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDono) handleAvaliar(l.id, s); }} 
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                    <span className="market-sales-count">{l.nota ? Number(l.nota).toFixed(1) : '0.0'} ({l.total_avaliacoes || 0})</span>
                                                </div>
                                                {!l.patrocinado && l.expires_at && <div className="market-timer-row"><Timer size={11} /><MarketTimer expiresAt={l.expires_at} /></div>}
                                                <button className="btn btn-primary btn-sm market-cta" onClick={async () => {
                                                    try {
                                                        api.post('/comunidade/registrar-view', { link_id: l.id }).catch(() => {});
                                                    } catch(e) {}
                                                    setSelectedAdDetails(l);
                                                    setActiveView('detalhes-produto');
                                                }}>Ver Produto</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {hasMoreExplorar && (
                                    <div className="market-load-more">
                                        <button className="btn btn-secondary btn-sm" onClick={() => carregarExplorar()} disabled={loadingMarket}>
                                            {loadingMarket ? <RefreshCw className="animate-spin" size={14} /> : 'Carregar Mais Produtos'}
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="market-empty">
                                <ShoppingBag size={48} />
                                <p>Nenhum produto encontrado.</p>
                                <button className="btn btn-link" onClick={() => setActiveView('novo-anuncio')}>Seja o primeiro a anunciar!</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {marketplaceTab === 'meus' && (
                loadingMarket && meusLinksMarketplace.length === 0 ? (
                    <div className="marketplace-grid">
                        {[1,2,3].map(i => <div key={i} className="skeleton-loading" style={{ height: '180px', borderRadius: '12px' }}></div>)}
                    </div>
                ) : meusLinksMarketplace.length > 0 ? (
                    <>
                        <div className="marketplace-grid">
                            {meusLinksMarketplace.map(l => {
                                const expirado = l.expires_at && new Date(l.expires_at) < new Date();
                                const semViews = (l.views_restantes || 0) <= 0;
                                const inativo = !l.is_active || expirado || (!l.is_boosted && semViews);
                                const imagemPrincipal = l.imagens && l.imagens.length > 0 ? normalizarImagem(l.imagens[0]) : normalizarImagem(l.url_imagem);
                                const vendaPendente = l.venda_pendente;

                                return (
                                    <div key={l.id} className={`market-card ${inativo ? 'market-card--inactive' : ''}`} style={{ borderColor: inativo ? 'rgba(255,61,0,0.2)' : 'rgba(var(--primary-rgb), 0.2)' }}>
                                        <div className="market-img-wrapper">
                                            {imagemPrincipal ? (
                                                <img src={imagemPrincipal} alt={l.nome_produto} width="180" height="180" style={{ opacity: inativo ? 0.4 : 1 }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', opacity: inativo ? 0.4 : 1 }}>
                                                    <span style={{ fontSize: '0.65rem' }}>Sem foto</span>
                                                </div>
                                            )}
                                            {l.is_boosted ? (
                                                <div className="market-badge market-badge--gold"><Zap size={10} /> PAGO</div>
                                            ) : (
                                                <div className="market-badge market-badge--free"><Clock size={10} /> GRATIS</div>
                                            )}
                                            {inativo && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 3 }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '1px' }}>{expirado ? 'Expirado' : 'Sem Views'}</span>
                                                </div>
                                            )}
                                            {vendaPendente && (
                                                <div style={{ position: 'absolute', top: '8px', right: '8px', background: 'var(--primary)', color: '#fff', fontSize: '0.55rem', padding: '3px 6px', borderRadius: '4px', fontWeight: 700, zIndex: 4 }}>
                                                    Venda pendente
                                                </div>
                                            )}
                                        </div>
                                        <div className="market-info">
                                            <h4 className="market-title">{l.nome_produto?.length > 60 ? l.nome_produto.substring(0, 60) + '...' : l.nome_produto}</h4>
                                            <div className="market-rating-row" style={{ marginTop: '-4px', marginBottom: '8px', justifyContent: 'center' }}>
                                                <div className="market-stars">
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <Star key={star} size={10} fill={star <= (l.nota || 0) ? "var(--warning)" : "transparent"} color={star <= (l.nota || 0) ? "var(--warning)" : "var(--text-muted)"} />
                                                    ))}
                                                </div>
                                                {l.vendas_texto && <span className="market-sales-count">{l.vendas_texto}</span>}
                                            </div>
                                            <div className="market-stats-row">
                                                <div className="market-stat"><span className="market-stat-value">{l.views_restantes || 0}</span><span className="market-stat-label">RESTANTES</span></div>
                                                <div className="market-stat-divider"></div>
                                                <div className="market-stat"><span className="market-stat-value">{l.views_totais || 0}</span><span className="market-stat-label">CLIQUES</span></div>
                                                <div className="market-stat-divider"></div>
                                                <div className="market-stat"><span className="market-stat-value" style={{ color: expirado ? 'var(--danger)' : 'inherit' }}>{l.expires_at ? new Date(l.expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}</span><span className="market-stat-label">EXPIRA</span></div>
                                            </div>
                                            {inativo && l.is_boosted ? (
                                                <button className="btn btn-primary w-full gap-1" onClick={() => { setBoostTarget(l); setShowBoostModal(true); }} style={{ height: '36px', fontSize: '0.75rem', marginTop: 'auto' }}><Rocket size={14} /> Reativar com Views</button>
                                            ) : !inativo ? (<>
                                                <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                                                    <button className="btn btn-primary w-full gap-1" onClick={async () => {
                                                        try {
                                                            const res = await api.post('/comunidade/gerar-pix-destaque', { link_id: l.id });
                                                            if (res.payment_id && res.qr_code) {
                                                                setPixDestaque(res);
                                                            } else {
                                                                showModal({ title: 'Erro', message: 'Erro ao gerar PIX.', type: 'danger' });
                                                            }
                                                        } catch (e) {
                                                            showModal({ title: 'Erro', message: e.message || 'Erro ao gerar PIX.', type: 'danger' });
                                                        }
                                                    }} style={{ height: '32px', fontSize: '0.7rem', padding: '0 8px', flex: 1 }}><Star size={12} /> Destacar R$5</button>
                                                    <button className="btn btn-secondary w-full gap-1" onClick={() => { setBoostTarget(l); setShowBoostModal(true); }} style={{ height: '32px', fontSize: '0.7rem', padding: '0 8px', flex: 1 }}><Zap size={12} /> Turbinar</button>
                                                </div>
                                                <button className="btn btn-success w-full" onClick={async () => {
                                                    try {
                                                        const res = await api.post(`/comunidade/marcar-vendido/${l.id}`);
                                                        showModal({
                                                            title: 'Venda Iniciada!',
                                                            message: `Codigo de confirmacao: ${res.codigo_confirmacao}\n\nEnvie este codigo ao comprador. Ele tem 48h para confirmar o recebimento.`,
                                                            type: 'success',
                                                            confirmText: 'Entendi'
                                                        });
                                                        carregarMeusLinksMarketplace();
                                                    } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                }} style={{ height: '28px', fontSize: '0.65rem', padding: '0 8px', marginTop: '6px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }}>
                                                    Marcar como Vendido
                                                </button>
                                            </>
                                            )
                                            : null
                                        }
                                    </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="market-empty">
                        <PlusCircle size={48} />
                        <p>Voce ainda nao tem anuncios.</p>
                        <button className="btn btn-link" onClick={() => setActiveView('novo-anuncio')}>Postar meu primeiro link</button>
                    </div>
                )
            )}

            {marketplaceTab === 'vendas' && (
                <div className="animate-fade-in">
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={18} color="var(--primary)" />
                        Confirmacoes de Venda
                    </h3>
                    
                    {/* VENDAS COMO VENDEDOR */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle size={14} color="#25D366" /> Vendas Iniciadas (aguardando comprador)
                        </h4>
                        {loadingVendas ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
                        ) : vendasPendentes.como_vendedor.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {vendasPendentes.como_vendedor.map(v => (
                                    <div key={v.id} style={{ 
                                        background: v.comprador_confirmou ? 'rgba(37,211,102,0.05)' : 'rgba(255,214,0,0.05)', 
                                        padding: '12px', 
                                        borderRadius: '10px', 
                                        border: `1px solid ${v.comprador_confirmou ? 'rgba(37,211,102,0.2)' : 'rgba(255,214,0,0.2)'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{v.produto}</span>
                                            {v.comprador_confirmou ? (
                                                <span style={{ fontSize: '0.6rem', background: 'var(--success)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>CONFIRMADA</span>
                                            ) : (
                                                <span style={{ fontSize: '0.6rem', background: 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>PENDENTE</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Codigo: #{v.id}</span>
                                            <span>Expira: {new Date(v.expira_em).toLocaleDateString('pt-BR')} {new Date(v.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {v.comprador_confirmou && (
                                            <div style={{ marginTop: '8px', fontSize: '0.7rem', color: 'var(--success)' }}>
                                                Avaliacao do comprador: {'★'.repeat(v.avaliacao_comprador || 0)}{'☆'.repeat(5 - (v.avaliacao_comprador || 0))}
                                                {!v.avaliacao_vendedor && (
                                                    <button 
                                                        className="btn btn-sm btn-secondary" 
                                                        style={{ marginLeft: '8px', fontSize: '0.6rem', padding: '2px 6px' }}
                                                        onClick={async () => {
                                                            const nota = prompt('Avalie o comprador (1-5):');
                                                            if (nota && nota >= 1 && nota <= 5) {
                                                                try {
                                                                    await api.post('/comunidade/avaliar-venda', { confirmacao_id: v.id, avaliacao: parseInt(nota) });
                                                                    carregarVendasPendentes();
                                                                } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                            }
                                                        }}
                                                    >
                                                        Avaliar comprador
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nenhuma venda pendente.</div>
                        )}
                    </div>

                    {/* VENDAS COMO COMPRADOR */}
                    <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} color="#8A2BE2" /> Compras para Confirmar
                        </h4>
                        {loadingVendas ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
                        ) : vendasPendentes.como_comprador.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {vendasPendentes.como_comprador.map(v => (
                                    <div key={v.id} style={{ 
                                        background: v.status === 'confirmada' ? 'rgba(37,211,102,0.05)' : 'rgba(138,43,226,0.05)', 
                                        padding: '12px', 
                                        borderRadius: '10px', 
                                        border: `1px solid ${v.status === 'confirmada' ? 'rgba(37,211,102,0.2)' : 'rgba(138,43,226,0.2)'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{v.produto}</span>
                                            {v.status === 'confirmada' ? (
                                                <span style={{ fontSize: '0.6rem', background: 'var(--success)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>CONFIRMADA</span>
                                            ) : (
                                                <span style={{ fontSize: '0.6rem', background: '#8A2BE2', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>AGUARDANDO</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Codigo: #{v.id}</span>
                                            <span>Expira: {new Date(v.expira_em).toLocaleDateString('pt-BR')} {new Date(v.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nenhuma compra pendente.</div>
                        )}
                    </div>
                </div>
            )}

            {marketplaceTab === 'trocas' && (
                <div className="animate-fade-in">
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Repeat size={18} color="var(--primary)" />
                        Minhas Trocas
                    </h3>
                    
                    {/* PROPOSTAS RECEBIDAS */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle size={14} color="var(--success)" /> Propostas Recebidas (Aguarde sua resposta)
                        </h4>
                        {loadingTrocas ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
                        ) : trocas.propostas_recebidas.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {trocas.propostas_recebidas.map(t => (
                                    <div key={t.id} style={{ 
                                        background: t.status === 'aceita' ? 'rgba(255,204,0,0.05)' : 'rgba(255,255,255,0.03)', 
                                        padding: '12px', 
                                        borderRadius: '10px', 
                                        border: `1px solid ${t.status === 'aceita' ? 'rgba(255,204,0,0.2)' : 'rgba(255,255,255,0.1)'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Trocar: {t.meu_anuncio} ↔ {t.outro_anuncio}</span>
                                            <span style={{ fontSize: '0.6rem', background: t.status === 'aceita' ? 'var(--primary)' : 'var(--text-muted)', color: t.status === 'aceita' ? '#000' : '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.status}</span>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span>Expira: {new Date(t.expira_em).toLocaleDateString('pt-BR')} {new Date(t.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {t.status === 'pendente' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button className="btn btn-success btn-sm" onClick={async () => {
                                                    try {
                                                        await api.post('/comunidade/aceitar-troca', { acordo_id: t.id });
                                                        carregarTrocas();
                                                    } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                }} style={{ flex: 1 }}>Aceitar Troca</button>
                                                <button className="btn btn-secondary btn-sm" onClick={async () => {
                                                    try {
                                                        await api.post('/comunidade/recusar-troca', { acordo_id: t.id });
                                                        carregarTrocas();
                                                    } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                }}>Recusar</button>
                                            </div>
                                        )}
                                        {t.status === 'aceita' && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(255,204,0,0.1)', padding: '8px', borderRadius: '6px' }}>
                                                ✅ Troca aceita! Combine a entrega via WhatsApp. Após entregar, clique em "Confirmar Etapa".
                                                <button className="btn btn-primary btn-sm" style={{ marginTop: '6px', width: '100%' }} onClick={async () => {
                                                    try {
                                                        await api.post('/comunidade/confirmar-etapa-troca', { acordo_id: t.id });
                                                        carregarTrocas();
                                                    } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                }}>Confirmar que Entreguei meu Item</button>
                                            </div>
                                        )}
                                        {t.status === 'em_andamento' && !t.etapa_b_recebeu_entregou && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--success)', background: 'rgba(0,230,118,0.1)', padding: '8px', borderRadius: '6px' }}>
                                                📦 O outro usuario entregou! Confirme que recebeu E que entregou o seu item.
                                                <button className="btn btn-success btn-sm" style={{ marginTop: '6px', width: '100%' }} onClick={async () => {
                                                    try {
                                                        await api.post('/comunidade/confirmar-etapa-troca', { acordo_id: t.id });
                                                        carregarTrocas();
                                                    } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                }}>Confirmar Recebimento e Entrega</button>
                                            </div>
                                        )}
                                        {t.status === 'em_andamento' && t.etapa_b_recebeu_entregou && !t.etapa_a_recebeu && (
                                            <div style={{ fontSize: '0.7rem', color: '#8A2BE2', background: 'rgba(138,43,226,0.1)', padding: '8px', borderRadius: '6px' }}>
                                                🎁 O outro usuario confirmou tudo! Confirme que recebeu o item dele para concluir.
                                                <button className="btn btn-sm" style={{ marginTop: '6px', width: '100%', background: '#8A2BE2', color: '#fff', border: 'none' }} onClick={async () => {
                                                    try {
                                                        await api.post('/comunidade/confirmar-etapa-troca', { acordo_id: t.id });
                                                        carregarTrocas();
                                                    } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                }}>Confirmar Recebimento Final</button>
                                            </div>
                                        )}
                                        {t.status === 'concluida' && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--success)', textAlign: 'center', fontWeight: 700 }}>
                                                 Troca Concluida! +5 Score para ambos.
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nenhuma proposta recebida.</div>
                        )}
                    </div>

                    {/* PROPOSTAS ENVIADAS */}
                    <div>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertCircle size={14} color="var(--warning)" /> Propostas Enviadas (Aguardando resposta)
                        </h4>
                        {loadingTrocas ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
                        ) : trocas.propostas_enviadas.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {trocas.propostas_enviadas.map(t => (
                                    <div key={t.id} style={{ 
                                        background: t.status === 'concluida' ? 'rgba(37,211,102,0.05)' : 'rgba(255,255,255,0.03)', 
                                        padding: '12px', 
                                        borderRadius: '10px', 
                                        border: `1px solid ${t.status === 'concluida' ? 'rgba(37,211,102,0.2)' : 'rgba(255,255,255,0.1)'}`
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Trocar: {t.meu_anuncio} ↔ {t.outro_anuncio}</span>
                                            <span style={{ fontSize: '0.6rem', background: t.status === 'concluida' ? 'var(--success)' : 'var(--warning)', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>{t.status}</span>
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Expira: {new Date(t.expira_em).toLocaleDateString('pt-BR')} {new Date(t.expira_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {t.status === 'concluida' && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--success)', textAlign: 'center', fontWeight: 700, marginTop: '6px' }}>
                                                🎉 Troca Concluida! +5 Score para ambos.
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nenhuma proposta enviada.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketplaceView;
