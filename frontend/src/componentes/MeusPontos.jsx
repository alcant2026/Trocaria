import React, { useState, useEffect } from 'react';
import { History, Coins, ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react';
import api from '../api';

const TIPO_LABELS = {
  view_anuncio: 'Visualizou anúncio',
  conversa: 'Conversa com vendedor',
  indicacao: 'Indicou amigo',
  postagem: 'Postou anúncio',
  kyc: 'Verificação KYC',
  cashback_taxa_publicacao: 'Cashback - Publicação',
  cashback_taxa_match: 'Cashback - Match',
  cashback_taxa_destaque: 'Cashback - Destaque',
  cashback_taxa_boost: 'Cashback - Boost',
  cashback_assinatura: 'Cashback - Assinatura',
  cashback_kyc_pago: 'Cashback - KYC',
  bonus_venda: 'Bônus por venda',
  gasto_venda: 'Pontos usados na compra',
  resgate_produto: 'Resgate de produto',
};

const MeusPontos = ({ usuario }) => {
  const [saldo, setSaldo] = useState(null);
  const [entradas, setEntradas] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [loading, setLoading] = useState(true);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [saldoRes, extratoRes] = await Promise.all([
        api.get('/pontos/saldo'),
        api.get('/pontos/extrato'),
      ]);
      setSaldo(saldoRes);
      setEntradas(extratoRes.entradas || []);
      setSaidas(extratoRes.saidas || []);
    } catch (err) {
      console.error('Erro ao carregar pontos:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const formatarData = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading && !saldo) {
    return (
      <div className="text-center p-4" style={{ color: 'var(--text-muted)' }}>
        <div className="skeleton-loading skeleton-card" style={{ height: '160px', marginBottom: '12px' }}></div>
        <div className="skeleton-loading skeleton-card" style={{ height: '100px' }}></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(var(--primary-rgb), 0.2) 0%, rgba(0,0,0,0.4) 100%)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        border: '1px solid rgba(var(--primary-rgb), 0.3)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <Coins size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Seu saldo de pontos
        </div>
        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '4px' }}>
          {saldo?.pontos?.toLocaleString('pt-BR') || 0}
        </div>
        <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
          ≈ R$ {saldo?.valor_equivalente?.toFixed(2) || '0,00'}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          1.000 pts = R$ 1,00
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>
        <h3 style={{ fontSize: '0.85rem', padding: '12px 16px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <History size={14} /> Extrato
        </h3>
        {entradas.length === 0 && saidas.length === 0 ? (
          <div className="text-center p-4 text-muted" style={{ fontSize: '0.85rem' }}>
            <Clock size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>Nenhum movimento ainda.</p>
            <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Ganhe pontos visualizando anúncios, indicando amigos e mais!</p>
          </div>
        ) : (
          <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
            {entradas.map((item) => (
              <div key={`ent-${item.id}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <ArrowUpCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {TIPO_LABELS[item.tipo] || item.tipo}
                    </div>
                    {item.detalhes && (
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.detalhes}
                      </div>
                    )}
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{formatarData(item.data)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--success)', whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 0 }}>
                  +{item.pontos} pts
                </div>
              </div>
            ))}
            {saidas.map((item) => (
              <div key={`sai-${item.id}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                  <ArrowDownCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.tipo === 'resgate_produto' ? 'Resgate de produto' : item.detalhes || item.tipo}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{formatarData(item.data)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--danger)', whiteSpace: 'nowrap', marginLeft: '8px', flexShrink: 0 }}>
                  -{item.pontos} pts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeusPontos;
