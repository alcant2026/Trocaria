import React from 'react';
import { HandCoins, PlusCircle, History, LayoutDashboard, ShieldCheck, ShoppingBag, Clock, ArrowUpCircle, ArrowDownCircle, Gift as GiftIcon, BadgeCheck as BadgeCheckIcon } from 'lucide-react';

// DEPRECATED: deposito e saque removidos. A Trocaria nao segura dinheiro de usuarios.
const TIPOS_ENTRADA = new Set(['recebimento', 'comissao_parceiro', 'bonus', 'confirmacao_recebimento']);
const TIPOS_SAIDA = new Set(['desbloqueio_dados', 'taxa_servico', 'taxa_plataforma', 'taxa_match', 'taxa_solicitacao', 'pagamento_parcela', 'assinatura', 'confirmacao_pagamento']);

const TIPOS_LABEL = {
    recebimento: 'Recebimento',
    desbloqueio_dados: 'Verificação',
    taxa_servico: 'Taxa de Serviço',
    taxa_plataforma: 'Taxa da Plataforma',
    taxa_match: 'Taxa de Match',
    taxa_solicitacao: 'Taxa de Publicação',
    taxa_anuncio: 'Taxa de Anúncio',
    confirmacao_pagamento: 'Pagamento Pendente',
    confirmacao_recebimento: 'Recebimento Confirmado',
    pagamento_parcela: 'Pagamento',
    comissao_parceiro: 'Comissão',
    assinatura: 'Assinatura Premium',
    bonus: 'Bônus',
};

const formatarTipo = (tipo, detalhes) => {
    if (tipo === 'desbloqueio_dados') {
        if (detalhes?.toLowerCase().includes('empr')) return 'Taxa de Solicitação';
        return 'Taxa de Verificação';
    }
    return TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';
};

const prefixoValor = (tipo) => TIPOS_ENTRADA.has(tipo) ? '+' : '-';
const corValor = (tipo) => TIPOS_SAIDA.has(tipo) ? 'var(--danger)' : TIPOS_ENTRADA.has(tipo) ? 'var(--success)' : 'var(--text-main)';

const HomeView = ({ usuario, historico, isFirstLoad, isOffline, mostrarAlertaRejeicao, fecharAlertaRejeicao, setActiveView, carregarMeusLinksMarketplace }) => {
    return (
        <div className="animate-fade-in">
            {/* Alerta de Rejeição Recente */}
            {mostrarAlertaRejeicao && historico.some(h => h.status === 'falhou') && (
                <div className="alert alert-danger mb-1" style={{ maxWidth: '100%', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', position: 'relative' }}>
                    <button
                        onClick={fecharAlertaRejeicao}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                        <strong style={{ fontSize: '0.9rem' }}>Atenção: Você tem solicitações rejeitadas</strong>
                    </div>
                    <p style={{ margin: '8px 0 0 28px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                        Verifique o motivo no histórico abaixo ou no detalhe da atividade.
                    </p>
                </div>
            )}

            <div className="action-grid animate-fade-in" role="group" aria-label="Painel de Ações">
                <button className="action-btn" onClick={() => { setActiveView('marketplace'); carregarMeusLinksMarketplace(); }} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }} aria-label="Ir para o Marketplace de Trocas">
                    <ShoppingBag size={28} color="var(--primary)" />
                    <span>Marketplace</span>
                </button>
                <button className="action-btn" onClick={() => setActiveView('novo-anuncio')} style={{ background: 'none', border: '1px solid rgba(var(--success-rgb), 0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }} aria-label="Anunciar um produto ou serviço para troca">
                    <PlusCircle size={28} color="var(--success)" />
                    <span style={{ color: 'var(--success)', fontWeight: 800 }}>Anunciar</span>
                </button>
                <button className="action-btn" onClick={() => setActiveView('meus-pontos')} style={{ background: 'none', border: '1px solid rgba(255, 145, 0, 0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }} aria-label="Ver meus pontos acumulados e resgatar">
                    <HandCoins size={28} color="var(--warning)" />
                    <span style={{ color: 'var(--warning)', fontWeight: 800 }}>Meus Pontos</span>
                </button>
                <button className="action-btn" onClick={() => setActiveView('resgate-produtos')} style={{ background: 'none', border: '1px solid rgba(var(--success-rgb), 0.3)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                    <GiftIcon size={28} color="var(--success)" />
                    <span style={{ color: 'var(--success)', fontWeight: 800 }}>Prêmios Top 20</span>
                </button>
                <button className="action-btn" onClick={() => setActiveView('score')} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }} aria-label="Ver badges e upgrades do perfil">
                    <BadgeCheckIcon size={28} />
                    <span>Badges</span>
                </button>
            </div>
            
            <h3 className="section-title">Últimas Atividades</h3>
            <div className="activity-list">
                {isFirstLoad ? (
                    [1,2,3].map(i => <div key={i} className="skeleton-loading skeleton-card"></div>)
                ) : historico.length === 0 ? (
                    <div className="empty-state">
                        <Clock size={32} />
                        <p>Nenhuma atividade recente.</p>
                    </div>
                ) : (
                    historico.slice(0, 5).map((h) => (
                        <div key={h.id} className="activity-item">
                            <div className="activity-icon">
                                {TIPOS_ENTRADA.has(h.tipo) ? <ArrowUpCircle size={20} color="var(--success)" /> : <ArrowDownCircle size={20} color="var(--danger)" />}
                            </div>
                            <div className="activity-info">
                                <span className="activity-title">{formatarTipo(h.tipo, h.detalhes)}</span>
                                <span className="activity-date">{new Date(h.data).toLocaleDateString()}</span>
                            </div>
                            <div className="activity-right">
                                <span className="activity-value" style={{ color: corValor(h.tipo) }}>
                                    {prefixoValor(h.tipo)} {h.tipo === 'bonus' ? `${h.valor} pts` : `R$ ${h.valor.toLocaleString('pt-BR')}`}
                                </span>
                                <span className="activity-status" style={{ color: h.status === 'concluido' ? 'var(--success)' : h.status === 'pendente' ? 'var(--warning)' : h.status === 'cancelado' ? 'var(--text-muted)' : 'var(--danger)' }}>
                                    {h.status === 'concluido' ? 'OK' : h.status === 'pendente' ? 'Pend' : h.status === 'cancelado' ? 'Canc' : h.status === 'falhou' ? 'Falhou' : h.status || ''}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default HomeView;
