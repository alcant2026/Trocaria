import React, { useState, useEffect } from 'react';
import { Wallet, History, Gift, AlertCircle, ChevronRight, Copy, CheckCircle, Coins } from 'lucide-react';
import api from '../api';

const TIPO_LABELS = {
  view_anuncio: 'Visualizou anuncio',
  conversa: 'Conversa com vendedor',
  indicacao: 'Indicou amigo',
  postagem: 'Postou anuncio',
  kyc: 'Verificacao KYC',
  cashback_taxa_publicacao: 'Cashback - Publicacao',
  cashback_taxa_match: 'Cashback - Match',
  cashback_taxa_destaque: 'Cashback - Destaque',
  cashback_taxa_boost: 'Cashback - Boost',
  cashback_assinatura: 'Cashback - Assinatura',
  cashback_kyc_pago: 'Cashback - KYC',
  resgate: 'Resgate de pontos',
};

const MeusPontos = ({ usuario }) => {
  const [saldo, setSaldo] = useState(null);
  const [extrato, setExtrato] = useState([]);
  const [resgates, setResgates] = useState([]);
  const [chavePix, setChavePix] = useState('');
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('saldo');

  const carregarDados = async () => {
    try {
      const [saldoRes, extratoRes, resgatesRes] = await Promise.all([
        api.get('/resgate/saldo'),
        api.get('/resgate/extrato'),
        api.get('/resgate/meus-resgates'),
      ]);
      setSaldo(saldoRes);
      setExtrato(extratoRes.extrato || []);
      setResgates(resgatesRes.resgates || []);
    } catch (err) {
      console.error('Erro ao carregar pontos:', err);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const handleResgatar = async () => {
    if (!chavePix.trim()) {
      setMensagem('Digite sua chave PIX.');
      return;
    }
    setLoading(true);
    setMensagem('');
    try {
      const res = await api.post('/resgate/solicitar', { chave_pix: chavePix.trim() });
      setMensagem(res.mensagem);
      setChavePix('');
      carregarDados();
    } catch (err) {
      setMensagem(err.response?.data?.detail || 'Erro ao solicitar resgate.');
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const calcularPontosHoje = () => {
    const hoje = new Date().toISOString().split('T')[0];
    return extrato
      .filter(item => item.data?.startsWith(hoje) && item.pontos > 0)
      .reduce((acc, item) => acc + item.pontos, 0);
  };

  if (!saldo) return <div className="text-center p-4 text-muted">Carregando...</div>;

  return (
    <div className="meus-pontos-container" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      {/* HEADER COM SALDO */}
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
          {saldo.saldo_pontos?.toLocaleString('pt-BR')}
        </div>
        <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
          = R$ {saldo.saldo_reais?.toFixed(2)}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
          1.000 pts = R$ 1,00 | Minimo para resgatar: {saldo.minimo_pontos?.toLocaleString('pt-BR')} pts (R$ {saldo.minimo_reais?.toFixed(2)} incl. taxa)
        </div>
        {saldo.taxa_resgate > 0 && (
          <div style={{ fontSize: '0.7rem', color: 'var(--warning)', marginTop: '4px' }}>
            Taxa de resgate: R$ {saldo.taxa_resgate?.toFixed(2)} por saque
          </div>
        )}
        {calcularPontosHoje() > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '6px' }}>
            +{calcularPontosHoje().toLocaleString('pt-BR')} pts hoje
          </div>
        )}
      </div>

      {/* ABAS */}
      <div className="tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button className={`tab ${abaAtiva === 'saldo' ? 'active' : ''}`} onClick={() => setAbaAtiva('saldo')}>
          <Wallet size={14} /> Resgatar
        </button>
        <button className={`tab ${abaAtiva === 'extrato' ? 'active' : ''}`} onClick={() => setAbaAtiva('extrato')}>
          <History size={14} /> Extrato
        </button>
        <button className={`tab ${abaAtiva === 'resgates' ? 'active' : ''}`} onClick={() => setAbaAtiva('resgates')}>
          <Gift size={14} /> Meus Resgates
        </button>
      </div>

      {/* ABA: RESGATAR */}
      {abaAtiva === 'saldo' && (
        <div className="card" style={{ padding: '20px' }}>
          {saldo.pode_resgatar ? (
            <>
              <h4 style={{ marginBottom: '12px', fontSize: '1rem' }}>Resgatar via PIX</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Voce vai resgatar <strong>R$ {saldo.saldo_reais_bruto?.toFixed(2)}</strong> ({saldo.saldo_pontos?.toLocaleString('pt-BR')} pts).
                <br />Taxa de resgate: <strong style={{ color: 'var(--danger)' }}>R$ {saldo.taxa_resgate?.toFixed(2)}</strong>
                <br />Valor a receber: <strong style={{ color: 'var(--success)' }}>R$ {saldo.saldo_reais_liquido?.toFixed(2)}</strong>
              </p>
              <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginBottom: '12px', padding: '8px', background: 'rgba(234,179,8,0.1)', borderRadius: '6px' }}>
                <strong>Aviso:</strong> Ao confirmar, seus pontos serao debitados imediatamente.
                Sera descontada uma taxa de R$ {saldo.taxa_resgate?.toFixed(2)} por saque.
                O pagamento via PIX sera processado em ate 48h.
              </div>
              <input
                type="text"
                className="input-field"
                placeholder="Sua chave PIX (email, CPF, telefone ou chave aleatoria)"
                value={chavePix}
                onChange={(e) => setChavePix(e.target.value)}
                style={{ marginBottom: '12px' }}
              />
              <button
                className="btn btn-primary"
                onClick={handleResgatar}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? 'Processando...' : `Resgatar R$ ${saldo.saldo_reais?.toFixed(2)}`}
              </button>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <AlertCircle size={40} style={{ color: 'var(--warning)', marginBottom: '12px' }} />
              <h4 style={{ marginBottom: '8px' }}>Ainda nao pode resgatar</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Voce precisa de <strong>20.000 pts</strong> (R$ 20,00) para resgatar.
                <br />Faltam <strong>{saldo.falta_pontos?.toLocaleString('pt-BR')} pts</strong>.
              </p>
              <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <strong>Como ganhar pontos:</strong>
                <ul style={{ textAlign: 'left', marginTop: '8px', paddingLeft: '20px' }}>
                  <li>Abrir anuncios (+1 pt)</li>
                  <li>Conversar com vendedores (+5 pts)</li>
                  <li>Indicar amigos (+10 pts)</li>
                  <li>Postar anuncios (+20 pts)</li>
                  <li>Verificar conta (+50 pts)</li>
                  <li>Cashback de compras (+10-15%)</li>
                </ul>
              </div>
            </div>
          )}
          {mensagem && (
            <div className={`alert ${mensagem.includes('sucesso') ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '12px', fontSize: '0.8rem' }}>
              {mensagem}
            </div>
          )}
        </div>
      )}

      {/* ABA: EXTRATO */}
      {abaAtiva === 'extrato' && (
        <div className="card" style={{ padding: '0' }}>
          {extrato.length === 0 ? (
            <div className="text-center p-4 text-muted">Nenhum registro ainda.</div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {extrato.map((item) => (
                <div key={item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                      {TIPO_LABELS[item.tipo] || item.tipo}
                    </div>
                    {item.detalhes && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.detalhes.length > 60 ? item.detalhes.substring(0, 60) + '...' : item.detalhes}
                      </div>
                    )}
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatarData(item.data)}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    color: item.pontos > 0 ? 'var(--success)' : 'var(--danger)',
                    whiteSpace: 'nowrap',
                    marginLeft: '12px',
                  }}>
                    {item.pontos > 0 ? '+' : ''}{item.pontos} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABA: MEUS RESGATES */}
      {abaAtiva === 'resgates' && (
        <div className="card" style={{ padding: '0' }}>
          {resgates.length === 0 ? (
            <div className="text-center p-4 text-muted">Nenhum resgate ainda.</div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {resgates.map((r) => (
                <div key={r.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                      Resgate #{r.id} - R$ {r.valor?.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Chave PIX: {r.chave_pix}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Solicitado em: {formatarData(r.data_solicitacao)}
                    </div>
                  </div>
                  <span className={`badge badge-${r.status}`} style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    background: r.status === 'pago' ? 'rgba(34,197,94,0.2)' : r.status === 'falhou' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                    color: r.status === 'pago' ? '#22c55e' : r.status === 'falhou' ? '#ef4444' : '#eab308',
                  }}>
                    {r.status === 'pago' ? 'Pago' : r.status === 'falhou' ? 'Falhou' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MeusPontos;
