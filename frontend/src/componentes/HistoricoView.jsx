import React from 'react';
import { History, ArrowUpCircle, ArrowDownCircle, AlertCircle, CheckCircle, X, XCircle, QrCode, Info } from 'lucide-react';

const TIPOS_LABEL = {
    deposito: 'Depósito', recebimento: 'Recebimento', desbloqueio_dados: 'Verificação',
    taxa_servico: 'Taxa de Serviço', taxa_plataforma: 'Taxa da Plataforma', taxa_match: 'Taxa de Match',
    taxa_solicitacao: 'Taxa de Publicação', confirmacao_pagamento: 'Pagamento Pendente',
    confirmacao_recebimento: 'Recebimento Confirmado', pagamento_parcela: 'Pagamento',
    comissao_parceiro: 'Comissão', assinatura: 'Assinatura Premium', bonus: 'Bônus',
};
const TIPOS_ENTRADA = new Set(['deposito', 'recebimento', 'comissao_parceiro', 'bonus', 'confirmacao_recebimento']);
const TIPOS_SAIDA = new Set(['desbloqueio_dados', 'taxa_servico', 'taxa_plataforma', 'taxa_match', 'taxa_solicitacao', 'pagamento_parcela', 'assinatura', 'confirmacao_pagamento']);
const TIPOS_NEGATIVO = new Set(['desbloqueio_dados', 'taxa_servico', 'taxa_plataforma', 'taxa_match', 'taxa_solicitacao', 'pagamento_parcela', 'assinatura']);

const formatarTipo = (tipo, detalhes) => {
    if (tipo === 'desbloqueio_dados') {
        if (detalhes?.toLowerCase().includes('empr')) return 'Taxa de Solicitação';
        return 'Taxa de Verificação';
    }
    return TIPOS_LABEL[tipo] || tipo?.replace(/_/g, ' ').toUpperCase() || 'TRANSAÇÃO';
};
const prefixoValor = (tipo) => TIPOS_ENTRADA.has(tipo) ? '+' : '-';
const corValor = (tipo) => TIPOS_SAIDA.has(tipo) || tipo === 'saque' ? 'var(--danger)' : TIPOS_ENTRADA.has(tipo) ? 'var(--success)' : 'var(--text-main)';

const HistoricoView = ({ historico, isFirstLoad, loadingAction, paginaHist, setPaginaHist, handleReverPix, handleCancelarPendente, handleConfirmarRecebimento }) => {
    const ITENS_POR_PAGINA = 5;

    return (
        <div className="card animate-fade-in">
            <div className="flex-end mb-1">
                <div style={{ display: 'flex', gap: '8px' }}>
                    <History size={18} color="var(--text-muted)" />
                </div>
            </div>
            {isFirstLoad ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {[1,2,3,4,5].map(i => <div key={i} className="skeleton-loading skeleton-card"></div>)}
                </div>
            ) : historico.length === 0 ? (
                <p className="text-muted text-center" style={{ fontSize: '0.85rem' }}>Nenhuma movimentação recente.</p>
            ) : (
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {historico.slice((paginaHist - 1) * ITENS_POR_PAGINA, paginaHist * ITENS_POR_PAGINA).map(h => (
                            <div key={h.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', borderLeft: `3px solid ${h.status === 'falhou' ? 'var(--danger)' : h.status === 'pendente' ? 'var(--warning)' : (TIPOS_NEGATIVO.has(h.tipo) || h.tipo === 'saque' || h.tipo === 'investimento') ? 'var(--danger)' : 'var(--success)'}` }}>
                                <div className="flex-between">
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '0.9rem', textTransform: 'uppercase' }}>{formatarTipo(h.tipo, h.detalhes)}</p>
                                        <p className="text-muted" style={{ fontSize: '0.7rem' }}>{h.data ? new Date(h.data).toLocaleString('pt-BR') : '-'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p style={{ fontWeight: 800, color: corValor(h.tipo) }}>
                                            {prefixoValor(h.tipo)} {h.tipo === 'bonus' ? `${h.valor} pts` : `R$ ${h.valor?.toLocaleString('pt-BR')}`}
                                        </p>
                                        {(!TIPOS_NEGATIVO.has(h.tipo) || h.status !== 'concluido') && (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: h.status === 'concluido' ? 'var(--success)' : h.status === 'pendente' ? 'var(--warning)' : h.status === 'cancelado' ? 'var(--text-muted)' : 'var(--danger)' }}>
                                                {h.status === 'concluido' ? 'Sucesso' : h.status === 'pendente' ? 'Pendente' : h.status === 'cancelado' ? 'Cancelado' : h.status === 'falhou' ? 'Falhou' : (h.status?.toUpperCase() || '-')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {h.status === 'falhou' && h.detalhes && (
                                    <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(255, 61, 0, 0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255, 61, 0, 0.1)' }}>
                                        <AlertCircle size={14} color="var(--danger)" />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 600 }}>{h.detalhes}</p>
                                    </div>
                                )}

                                {/* BOTÃO PARA REVER PIX (Depósitos Pendentes) */}
                                {h.tipo === 'deposito' && h.metodo === 'pix' && h.status === 'pendente' && (
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <button 
                                            className="btn btn-outline" 
                                            style={{ width: '100%', fontSize: '0.75rem', padding: '8px', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                                            onClick={() => handleReverPix(h.id)}
                                            disabled={loadingAction}
                                        >
                                            <QrCode size={14} /> Pagar Agora
                                        </button>
                                    </div>
                                )}

                                {/* BOTÃO CANCELAR (Taxas Pendentes) */}
                                {h.status === 'pendente' && (h.tipo === 'taxa_solicitacao' || h.tipo === 'desbloqueio_dados' || h.tipo === 'assinatura') && (
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <button 
                                            className="btn btn-outline" 
                                            style={{ width: '100%', fontSize: '0.75rem', padding: '8px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                            onClick={() => handleCancelarPendente(h.id)}
                                            disabled={loadingAction}
                                        >
                                            <X size={14} /> Cancelar
                                        </button>
                                    </div>
                                )}

                                {/* BOTÃO DE CONFIRMAÇÃO DE RECEBIMENTO (Saques Concluídos) */}
                                {h.tipo === 'saque' && h.status === 'concluido' && (
                                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        {h.confirmado_cliente ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 700 }}>
                                                <CheckCircle size={16} /> Você confirmou o recebimento em {new Date(h.data_confirmacao_cliente).toLocaleDateString('pt-BR')} às {new Date(h.data_confirmacao_cliente).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        ) : (
                                            <div className="alert alert-info animate-slide-down" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div className="alert-icon">
                                                        <Info size={20} />
                                                    </div>
                                                    <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                                                        Deseja confirmar que recebeu o PIX deste saque corretamente na sua conta?
                                                    </p>
                                                </div>
                                                <button 
                                                    className="btn btn-primary" 
                                                    style={{ width: '100%', fontSize: '0.75rem', padding: '10px' }}
                                                    onClick={() => handleConfirmarRecebimento(h.id)}
                                                >
                                                    <CheckCircle size={16} /> Confirmei o Recebimento
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {historico.length > ITENS_POR_PAGINA && (
                        <div className="flex-between mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                            <button
                                className="btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: paginaHist === 1 ? 0.3 : 1, width: 'auto' }}
                                disabled={paginaHist === 1}
                                onClick={() => setPaginaHist(p => p - 1)}
                            >
                                Anterior
                            </button>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Página {paginaHist} de {Math.ceil(historico.length / ITENS_POR_PAGINA)}</span>
                            <button
                                className="btn-outline"
                                style={{ padding: '4px 10px', fontSize: '0.7rem', opacity: (paginaHist * ITENS_POR_PAGINA) >= historico.length ? 0.3 : 1, width: 'auto' }}
                                disabled={(paginaHist * ITENS_POR_PAGINA) >= historico.length}
                                onClick={() => setPaginaHist(p => p + 1)}
                            >
                                Próxima
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default HistoricoView;
