import React, { useState } from 'react';
import { Sparkles, HelpCircle, Gift } from 'lucide-react';
import api from '../api';

const SolicitarApoioComunitario = ({ usuario, onSucesso, aoVoltar }) => {
    const [titulo, setTitulo] = useState('');
    const [descricao, setDescricao] = useState('');
    const [pontos, setPontos] = useState('50');
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!titulo.trim() || !descricao.trim()) {
            setErro('Preencha todos os campos obrigatórios.');
            return;
        }
        const pts = parseInt(pontos);
        if (isNaN(pts) || pts <= 0) {
            setErro('Informe um valor de pontos válido.');
            return;
        }
        if (usuario.pontos_marketplace < pts) {
            setErro(`Você não possui saldo de pontos suficiente. Saldo atual: ${usuario.pontos_marketplace} pts.`);
            return;
        }

        setLoading(false);
        setErro('');
        setLoading(true);
        try {
            // Criação do anúncio de serviço/apoio colaborativo
            await api.post('/comunidade/links', {
                nome_produto: titulo.trim(),
                descricao: descricao.trim(),
                categoria: 'Servicos',
                url_afiliado: `https://wa.me/${usuario.telefone}?text=Olá,%20vi%20seu%20pedido%20de%20apoio%20"${encodeURIComponent(titulo)}"%20no%20Trocaria%20e%20gostaria%20de%20ajudar.`,
                valor: 0.00, // Doação/Apoio livre de dinheiro real
                ponto_min: pts,
                ponto_max: pts,
                cidade: usuario.cidade || 'Geral',
                estado: usuario.estado || 'Geral'
            });
            onSucesso();
        } catch (err) {
            setErro(err.response?.data?.detail || 'Erro ao publicar seu pedido de apoio.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
            <div className="text-center mb-1">
                <HelpCircle size={40} color="var(--primary)" style={{ marginBottom: '8px' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Pedir Apoio Comunitário</h3>
                <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                    Ofereça pontos comunitários para outros membros ajudarem você em tarefas, favores ou permutas de serviços!
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="input-group">
                    <label htmlFor="titulo_apoio" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Título do Pedido *</label>
                    <input
                        id="titulo_apoio"
                        type="text"
                        className="input-field"
                        placeholder="Ex: Preciso de carona para o hospital / Aulas de Inglês"
                        value={titulo}
                        onChange={(e) => setTitulo(e.target.value)}
                        required
                        maxLength={90}
                    />
                </div>

                <div className="input-group">
                    <label htmlFor="descricao_apoio" style={{ fontWeight: 700, fontSize: '0.8rem' }}>O que você precisa? (Descrição) *</label>
                    <textarea
                        id="descricao_apoio"
                        className="input-field"
                        placeholder="Descreva detalhadamente o apoio que precisa e como a pessoa pode lhe ajudar..."
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        required
                        rows={4}
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                        maxLength={1000}
                    />
                </div>

                <div className="input-group">
                    <label htmlFor="recompensa_pontos" style={{ fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Gift size={14} color="var(--warning)" /> Recompensa em Pontos
                    </label>
                    <select
                        id="recompensa_pontos"
                        className="input-field"
                        value={pontos}
                        onChange={(e) => setPontos(e.target.value)}
                        style={{ fontWeight: 700 }}
                    >
                        <option value="20">20 pontos (Pequeno favor)</option>
                        <option value="50">50 pontos (Médio esforço)</option>
                        <option value="100">100 pontos (Tarefa importante)</option>
                        <option value="200">200 pontos (Grande favor/Habilidade técnica)</option>
                    </select>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Seu saldo atual: <strong style={{ color: 'var(--primary)' }}>{usuario.pontos_marketplace?.toLocaleString('pt-BR')} pts</strong>. Os pontos serão descontados apenas ao confirmar a conclusão do apoio bilateral.
                    </p>
                </div>

                {erro && (
                    <div className="alert alert-danger mt-1 animate-shake" style={{ fontSize: '0.8rem' }}>
                        {erro}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '1.5rem' }}>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ flex: 2, height: '48px' }}
                        disabled={loading}
                    >
                        {loading ? 'Publicando...' : <><Sparkles size={16} /> Publicar Pedido</>}
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ flex: 1, height: '48px', border: 'none' }}
                        onClick={aoVoltar}
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SolicitarApoioComunitario;
