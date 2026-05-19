import React from 'react';
import { ArrowLeft, Search, Camera, MessageCircle, Handshake, ShieldCheck, Star, Gem, Award, BadgeCheck, Sprout, AlertTriangle, Crown, ShoppingBag, PlusCircle, RefreshCw } from 'lucide-react';

const ComoFunciona = () => {
    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
                <button onClick={() => window.location.hash = 'cliente'} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 800 }}>Como Funciona a Trocaria</h1>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>O que e a Trocaria?</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Trocaria e um <strong style={{ color: 'var(--text-main)' }}>classificados gratuito</strong> com sistema de confianca entre usuarios. 
                    Aqui voce pode <strong style={{ color: 'var(--text-main)' }}>comprar, vender e trocar</strong> produtos diretamente com outras pessoas, 
                    sem intermediarios. A plataforma nunca segura seu dinheiro — a negociacao e <strong style={{ color: 'var(--text-main)' }}>100% direta</strong> entre as partes.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Passo a Passo</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <PlusCircle size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>1. Crie sua conta</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Cadastre-se gratuitamente com CPF, email e telefone. Sua conta ja vem com um score de confianca inicial de 500 pontos.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--success-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <Camera size={24} color="var(--success)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>2. Anuncie seu produto</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Tire fotos (maximo 6, ate 500KB cada), descreva seu produto e defina o valor. 
                                Em poucos segundos seu anuncio vai ao ar — gratis, sem taxa de publicacao.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <Search size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>3. Explore e encontre</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Navegue pelos anuncios em "Explorar". Filtre por categoria, veja fotos, precos e 
                                o <strong style={{ color: 'var(--text-main)' }}>selo de confianca</strong> do vendedor antes de decidir.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--success-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <MessageCircle size={24} color="var(--success)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>4. Combine pelo WhatsApp</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Clique em "Falar com Vendedor" para ser redirecionado ao WhatsApp dele. 
                                Combine detalhes, precos e forma de entrega diretamente com a pessoa.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--warning-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <Handshake size={24} color="var(--warning)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>5. Pague direto (PIX) ou Troque</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                O pagamento e combinado e feito <strong style={{ color: 'var(--text-main)' }}>diretamente entre as partes via PIX</strong> — 
                                a plataforma nunca segura o dinheiro. Ou proponha uma <strong style={{ color: 'var(--text-main)' }}>troca</strong> 
                                de produtos, com confirmacao bilateral em 3 etapas.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <ShieldCheck size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>6. Confirme o recebimento</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Apos receber o produto, confirme o recebimento usando o codigo enviado pelo vendedor. 
                                Voces se avaliam mutuamente e ambos ganham pontos no score de confianca.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Sistema de Trocas</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Quer trocar produtos em vez de vender? A Trocaria tem um sistema de trocas em <strong style={{ color: 'var(--text-main)' }}>3 etapas</strong>:
                </p>
                <ol style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '2', paddingLeft: '1.2rem' }}>
                    <li>Voce propoe a troca e envia seu produto</li>
                    <li>A outra parte confirma o recebimento e envia o produto dela</li>
                    <li>Voce confirma o recebimento do produto da troca</li>
                </ol>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '0.5rem' }}>
                    Ao final, <strong style={{ color: 'var(--text-main)' }}>ambos ganham +5 pontos</strong> no score de confianca. 
                    O sistema bilateral impede que uma das partes fique sem o produto combinado.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Score de Confianca (0 a 1000)</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Cada usuario tem um <strong style={{ color: 'var(--text-main)' }}>score de confianca</strong> que reflete seu historico na plataforma. 
                    Quanto maior o score, mais confiavel o usuario e.
                </p>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={14} color="var(--danger)" style={{ flexShrink: 0 }} /> <strong style={{ color: 'var(--danger)' }}>Menos de 300</strong> — Risco: usuario novo ou com historico negativo</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Sprout size={14} color="var(--warning)" style={{ flexShrink: 0 }} /> <strong style={{ color: 'var(--warning)' }}>300 a 699</strong> — Iniciante: construindo reputacao</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><BadgeCheck size={14} color="var(--primary)" style={{ flexShrink: 0 }} /> <strong style={{ color: 'var(--primary)' }}>700 a 899</strong> — Confiavel: usuario verificado</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Gem size={14} color="#8B5CF6" style={{ flexShrink: 0 }} /> <strong style={{ color: '#8B5CF6' }}>900+</strong> — Elite: alta credibilidade</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Crown size={14} color="#FFD700" style={{ flexShrink: 0 }} /> <strong style={{ color: '#FFD700' }}>Top 10</strong> — Lenda: os melhores da plataforma</div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', marginTop: '0.8rem' }}>
                    Vendas confirmadas aumentam o score (+3 vendedor, +2 comprador). 
                    Trocas concluidas adicionam +5 para ambos. Denuncias podem reduzir o score.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Destaque e Turbina</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Quer vender mais rapido? Use os recursos de impulsionamento:
                </p>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '2', paddingLeft: '1.2rem' }}>
                    <li><strong style={{ color: 'var(--text-main)' }}>Destacar (R$ 5)</strong> — Seu anuncio aparece com destaque na pagina principal</li>
                    <li><strong style={{ color: 'var(--text-main)' }}>Turbinar</strong> — Adiciona visualizacoes extras ao seu anuncio para alcancar mais pessoas</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Seguranca e Transparencia</h2>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '2', paddingLeft: '1.2rem' }}>
                    <li>Score de confianca baseado em historico de vendas, trocas e avaliacoes</li>
                    <li>Sistema de confirmacao bilateral de recebimento (codigo unico por venda)</li>
                    <li>Trocas em 3 etapas com confirmacao de ambas as partes</li>
                    <li>Denuncie usuarios e produtos que violam as regras</li>
                    <li>Bloqueie usuarios indesejados</li>
                    <li>Termos de uso claros — a plataforma apenas conecta pessoas, nao participa das negociacoes</li>
                    <li>LGPD — voce pode excluir sua conta e dados a qualquer momento</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <ShoppingBag size={32} color="var(--primary)" style={{ marginBottom: '0.8rem' }} />
                <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>Pronto para anunciar?</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Crie sua conta gratis e comeca a comprar, vender e trocar hoje mesmo.
                </p>
                <button className="btn btn-primary" style={{ padding: '12px 30px', fontSize: '0.9rem' }} onClick={() => window.location.hash = 'registro'}>
                    Criar Conta Gratuita
                </button>
            </div>
        </div>
    );
};

export default ComoFunciona;
