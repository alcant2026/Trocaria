import React from 'react';
import { ArrowLeft, ShieldCheck, UserPlus, Search, Handshake, QrCode, Star, Trophy, Smartphone } from 'lucide-react';

const ComoFunciona = () => {
    return (
        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
                <button onClick={() => window.location.hash = 'cliente'} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{ fontSize: '1.3rem', margin: 0, fontWeight: 800 }}>Como Funciona a Psy Pay</h1>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>O que e a Psy Pay?</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Psy Pay e uma <strong style={{ color: 'var(--text-main)' }}>Rede de Apoio entre Pares</strong> (Peer-to-Peer). 
                    Conectamos pessoas que precisam de apoio financeiro com pessoas dispostas a ajudar. 
                    Diferente de bancos ou financeiras, <strong style={{ color: 'var(--text-main)' }}>nao emprestamos dinheiro</strong> — 
                    apenas <strong style={{ color: 'var(--text-main)' }}>conectamos pessoas</strong>. 
                    O pagamento e feito <strong style={{ color: 'var(--text-main)' }}>diretamente entre as partes via PIX</strong>, 
                    sem que o dinheiro passe pela plataforma.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Passo a Passo</h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <UserPlus size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>1. Crie sua conta</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Cadastre-se com CPF, email e telefone. A ativacao do 2FA (Google Authenticator) e recomendada para maior seguranca.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--success-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <ShieldCheck size={24} color="var(--success)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>2. Verifique sua conta (KYC)</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Envie selfie segurando o documento + foto do RG ou CNH para ganhar o selo de verificacao e +10 pontos no score. 
                                A verificacao e <strong style={{ color: 'var(--success)' }}>gratuita</strong>.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <Search size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>3. Peca ou encontre apoio</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Precisa de apoio? Crie um pedido informando valor, parcelas e taxa de compensacao. 
                                Quer ajudar? Navegue pelos pedidos disponiveis em "Ver Pedidos" e escolha quem apoiar.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--success-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <Handshake size={24} color="var(--success)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>4. Match entre as partes</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                Quando alguem aceita seu pedido, ambas as partes pagam uma taxa de servico via PIX (R$ 2 para publicar, 
                                2% de taxa de match). O dinheiro do apoio e transferido <strong style={{ color: 'var(--text-main)' }}>direto via PIX</strong> entre as pessoas.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--warning-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <QrCode size={24} color="var(--warning)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>5. Pagamento via PIX</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                O apoiador envia o valor combinado diretamente via PIX para a chave do tomador. 
                                A plataforma nunca segura o dinheiro — a transacao e <strong style={{ color: 'var(--text-main)' }}>100% direta</strong> entre as partes.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-start' }}>
                        <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', padding: '12px', borderRadius: '12px', flexShrink: 0 }}>
                            <Star size={24} color="var(--primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>6. Score e reputacao</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                A cada pagamento em dia, seu score aumenta (+5 pontos). Se atrasar, perde pontos (-10). 
                                Calote zera o score. Quanto maior seu score, mais credibilidade voce tem na plataforma.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Marketplace de Produtos</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Alem do apoio financeiro, a Psy Pay tem um <strong style={{ color: 'var(--text-main)' }}>marketplace de classificados</strong> 
                    onde voce pode anunciar produtos e servicos. Cada clique em seu anuncio rende pontos que podem ser convertidos em dinheiro. 
                    Usuarios Premium ganham de 1 a 5 pontos por clique (aleatorio), enquanto usuarios gratis ganham 1 ponto fixo.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Campeonato Semanal</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Todo sabado as 18h, o <strong style={{ color: 'var(--text-main)' }}>ranking semanal</strong> e pago e resetado. 
                    Os <strong style={{ color: 'var(--text-main)' }}>20 primeiros colocados</strong> levam premio em dinheiro proporcional aos pontos acumulados. 
                    Cada ponto vale R$ 0,001 (1000 pontos = R$ 1,00).
                </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Assinatura Premium</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.7' }}>
                    Por apenas <strong style={{ color: 'var(--text-main)' }}>R$ 19,99/mes</strong> ou <strong style={{ color: 'var(--text-main)' }}>R$ 199,99/ano</strong>, 
                    o plano Premium oferece: pontos de 1 a 5 por clique (vs 1 fixo do gratis), 
                    destaque nos anuncios, selo VIP e bonus de score ao assinar.
                </p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--primary)' }}>Seguranca e Transparencia</h2>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '2', paddingLeft: '1.2rem' }}>
                    <li>Autenticacao de Dois Fatores (2FA) via Google Authenticator</li>
                    <li>Verificacao de identidade com selfie + documento (KYC)</li>
                    <li>Score de reputacao baseado em historico de pagamentos</li>
                    <li>Termos de uso claros com isencao de responsabilidade sobre acordos entre usuarios</li>
                    <li>LGPD — voce pode excluir sua conta e dados a qualquer momento</li>
                    <li>Nenhum dado bancario compartilhado com terceiros</li>
                </ul>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <Smartphone size={32} color="var(--primary)" style={{ marginBottom: '0.8rem' }} />
                <h2 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--primary)' }}>Pronto para comecar?</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Cadastre-se gratis e faca parte da maior Rede de Apoio entre Pares do Brasil.
                </p>
                <button className="btn btn-primary" style={{ padding: '12px 30px', fontSize: '0.9rem' }} onClick={() => window.location.hash = 'registro'}>
                    Criar Conta Gratuita
                </button>
            </div>
        </div>
    );
};

export default ComoFunciona;
