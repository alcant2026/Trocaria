import React from 'react';
import { Plus, Zap, Gem, CreditCard, Clock, Flag, Eye, Star, Timer, RefreshCw, ShoppingBag, PlusCircle, Rocket } from 'lucide-react';
import RankingSemanal from './RankingSemanal';

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

const MarketplaceView = ({
    usuario, marketplaceTab, setMarketplaceTab, selectedCategory, setSelectedCategory,
    selectedCity, setSelectedCity,
    marketplaceLinks, meusLinksMarketplace, loadingMarket, hasMoreExplorar, hasMoreMeusLinks,
    carregarExplorar, carregarMeusLinksMarketplace, handleDenunciar, handleAvaliar,
    setShowAssinarModal, handleSolicitarResgate,
    setActiveView,
    setSelectedAdDetails,
    setBoostTarget, setShowBoostModal, setPixDestaque, showModal, api, setMensagem
}) => {
    return (
        <div className="marketplace-container animate-fade-in">
            <div className="marketplace-header mb-1" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <div className="marketplace-tabs" style={{ flex: 1 }}>
                    <button className={`m-tab ${marketplaceTab === 'explorar' ? 'active' : ''}`} onClick={() => setMarketplaceTab('explorar')}>Explorar</button>
                    <button className={`m-tab ${marketplaceTab === 'meus' ? 'active' : ''}`} onClick={() => setMarketplaceTab('meus')}>Meus Anúncios</button>
                    <button className={`m-tab ${marketplaceTab === 'ranking' ? 'active' : ''}`} onClick={() => setMarketplaceTab('ranking')}>Ranking</button>
                    <button className={`m-tab ${marketplaceTab === 'config' ? 'active' : ''}`} onClick={() => setMarketplaceTab('config')}>Configurações</button>
                </div>
                
                {marketplaceTab === 'explorar' && (
                    <div className="filter-bar">
                        <div className="m-filter-pills">
                            {CATEGORIAS_MARKETPLACE.map(cat => (
                                <button
                                    key={cat}
                                    className={`m-filter-pill ${selectedCategory === cat ? 'active' : ''}`}
                                    onClick={() => setSelectedCategory(cat)}
                                >
                                    {cat === 'Geral' ? 'Todas' : cat}
                                </button>
                            ))}
                        </div>
                        <select 
                            className="input-field m-filter-select"
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                        >
                            <option value="Todas">Todas as Cidades</option>
                            {usuario?.cidade && <option value={usuario.cidade}>{usuario.cidade}</option>}
                        </select>
                    </div>
                )}

                <button className="btn btn-primary btn-sm" onClick={() => setActiveView('novo-anuncio')} style={{ gap: '5px', whiteSpace: 'nowrap', height: '32px', minHeight: 'unset', fontSize: '0.75rem', padding: '0 10px', flexShrink: 0 }}>
                    <Plus size={14} /> Novo Anúncio
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
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Você ganha 1 ponto por cada link aberto. A cada 1.000 pontos = R$ 0,10 de saldo!</p>
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
                        <p>Ganhe de 1 a 5 pontos por clique (aleatório) e converta em dinheiro real! Grátis: 1 ponto fixo.</p>
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
                                                <img src={l.url_imagem} alt={l.nome_produto} loading="lazy" width="180" height="180" />
                                                {l.patrocinado ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'absolute', top: '10px', left: '10px', zIndex: 2 }}>
                                                        <div className="market-badge market-badge--gold" style={{ position: 'static' }}><Zap size={10} /> DESTAQUE</div>
                                                        {usuario.is_subscriber && l.ponto_max > 1 && (
                                                            <div className="market-badge" style={{ position: 'static', background: 'var(--success)', color: '#000', fontWeight: 900, border: 'none' }}>
                                                                + ATÉ {l.ponto_max} PTS
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
                                                {l.valor > 0 && <div className="market-price-tag">R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>}
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
                                                    <span className="market-author">por {l.anunciante}</span>
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
                                <p>Nenhum produto em destaque no momento.</p>
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
                                // Regra OLX: destaque/turbinado não desativa por falta de views, só por tempo
                                const inativo = !l.is_active || expirado || (!l.is_boosted && semViews);

                                return (
                                    <div key={l.id} className={`market-card ${inativo ? 'market-card--inactive' : ''}`} style={{ borderColor: inativo ? 'rgba(255,61,0,0.2)' : 'rgba(var(--primary-rgb), 0.2)' }}>
                                        <div className="market-img-wrapper">
                                            <img src={l.url_imagem} alt={l.nome_produto} width="180" height="180" style={{ opacity: inativo ? 0.4 : 1 }} />
                                            {l.is_boosted ? (
                                                <div className="market-badge market-badge--gold"><Zap size={10} /> PAGO</div>
                                            ) : (
                                                <div className="market-badge market-badge--free"><Clock size={10} /> GRÁTIS</div>
                                            )}
                                            {inativo && (
                                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 3 }}>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '1px' }}>{expirado ? 'Expirado' : 'Sem Views'}</span>
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
                                                    if (!window.confirm('Marcar como vendido? Isso desativará o anúncio.')) return;
                                                    try {
                                                        await api.post(`/comunidade/marcar-vendido/${l.id}`);
                                                        showModal({ title: 'Vendido!', message: 'Anúncio marcado como vendido. +1 venda!', type: 'success' });
                                                        carregarMeusLinksMarketplace();
                                                    } catch(e) { showModal({ title: 'Erro', message: e.message, type: 'danger' }); }
                                                }} style={{ height: '28px', fontSize: '0.65rem', padding: '0 8px', marginTop: '6px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', color: '#25D366' }}>✅ Marcar como Vendido</button>
                                            </>) : (
                                                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', fontStyle: 'italic' }}>Anúncio grátis encerrado</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {hasMoreMeusLinks && (
                            <div className="market-load-more">
                                <button className="btn btn-secondary btn-sm" onClick={() => carregarMeusLinksMarketplace()} disabled={loadingMarket}>
                                    {loadingMarket ? <RefreshCw className="animate-spin" size={14} /> : 'Carregar Mais Meus Links'}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="market-empty">
                        <PlusCircle size={48} />
                        <p>Você ainda não tem anúncios.</p>
                        <button className="btn btn-link" onClick={() => setActiveView('novo-anuncio')}>Postar meu primeiro link</button>
                    </div>
                )
            )}
        </div>
    );
};

export default MarketplaceView;
