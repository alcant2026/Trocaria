import React, { useState, useEffect } from 'react';
import { ShoppingBag, ExternalLink, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';

const LojaAfiliados = ({ onMensagem }) => {
    const [itens, setItens] = useState([]);
    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [loading, setLoading] = useState(false);

    const carregarLoja = async (p = 1) => {
        setLoading(true);
        try {
            const data = await api.get(`/financeiro/loja/itens?pagina=${p}`);
            setItens(data.itens);
            setTotalPaginas(data.paginas);
            setPagina(data.pagina_atual);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarLoja(pagina);
    }, [pagina]);

    return (
        <div className="animate-fade-in">
            <div className="flex-between mb-1">
                <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--primary)' }}>
                        <ShoppingBag size={20} /> Loja de Ofertas
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Produtos selecionados da Shopee, Mercado Livre e muito mais!</p>
                </div>
            </div>

            {loading ? (
                <div className="card text-center py-2">Carregando ofertas...</div>
            ) : itens.length === 0 ? (
                <div className="card text-center text-muted py-2">Nenhuma oferta disponível no momento.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {itens.map(item => (
                        <a 
                            key={item.id} 
                            href={item.url_afiliado} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="card card-actionable"
                            style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: '1rem', 
                                textDecoration: 'none',
                                borderColor: 'var(--primary)',
                                background: 'rgba(255, 214, 0, 0.02)'
                            }}
                        >
                            <div style={{ position: 'relative', width: '100%', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.url_imagem ? (
                                    <img src={item.url_imagem} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <ShoppingBag size={48} color="var(--primary)" />
                                )}
                                
                                {/* Banner de Envio Imediato */}
                                <div style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    right: '10px',
                                    background: 'var(--primary)',
                                    color: '#000',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 12px rgba(255, 214, 0, 0.3)'
                                }}>
                                    <Timer size={12} />
                                    Envio Imediato
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, justifyContent: 'space-between' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>{item.nome_produto}</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        Oferta disponível <ExternalLink size={12} />
                                    </p>
                                </div>
                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%' }}
                                >
                                    <ShoppingBag size={18} />
                                    Comprar Agora
                                </button>
                            </div>
                        </a>
                    ))}
                </div>
            )}

            {totalPaginas > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '2rem', padding: '10px' }}>
                    <button 
                        className="btn-outline"
                        disabled={pagina === 1}
                        onClick={(e) => { e.preventDefault(); setPagina(pagina - 1); }}
                        style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: pagina === 1 ? 0.3 : 1 }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{pagina} / {totalPaginas}</span>
                    <button 
                        className="btn-outline"
                        disabled={pagina === totalPaginas}
                        onClick={(e) => { e.preventDefault(); setPagina(pagina + 1); }}
                        style={{ padding: '8px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: pagina === totalPaginas ? 0.3 : 1 }}
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default LojaAfiliados;
