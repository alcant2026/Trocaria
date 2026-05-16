import React, { useState } from 'react';
import { ArrowLeft, Lock, Info, AlertTriangle, Send, CheckCircle } from 'lucide-react';

const NovoAnuncioPage = ({ usuario, onVoltar, onSucesso, api, showModal, CATEGORIAS_MARKETPLACE }) => {
    const [dados, setDados] = useState({
        nome_produto: '', descricao: '', categoria: 'Geral',
        url_afiliado: '', url_imagem: '', valor: '', vendas_texto: '', codigo_2fa: ''
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (field, value) => setDados(prev => ({ ...prev, [field]: value }));

    const publicar = async () => {
        if (!dados.nome_produto || !dados.url_afiliado) return;
        setLoading(true);
        try {
            await api.post('/comunidade/postar-link', dados);
            setDados({ nome_produto: '', descricao: '', categoria: 'Geral', url_afiliado: '', url_imagem: '', valor: '', vendas_texto: '', codigo_2fa: '' });
            showModal({ title: 'Sucesso!', message: 'Anúncio publicado!', type: 'success' });
            if (onSucesso) onSucesso();
        } catch (err) {
            showModal({ title: 'Erro', message: err.response?.data?.detail || 'Erro ao publicar', type: 'danger' });
        }
        setLoading(false);
    };

    return (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <button onClick={onVoltar} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                    <ArrowLeft size={20} />
                </button>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Novo Anúncio</h3>
            </div>

            <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Anuncie gratuitamente por 24h. Preencha os dados do seu produto ou serviço.</p>

            <div className="input-group mb-1">
                <label>Nome do Produto / Serviço</label>
                <input className="input-field" placeholder="Ex: Curso de Marketing Digital" value={dados.nome_produto} onChange={(e) => handleChange('nome_produto', e.target.value)} />
            </div>

            <div className="input-group mb-1">
                <label>Descrição</label>
                <textarea className="input-field" rows="3" placeholder="Descreva seu produto ou serviço..." style={{ width: '100%', resize: 'none' }}
                    value={dados.descricao} onChange={(e) => handleChange('descricao', e.target.value)} />
            </div>

            <div className="grid-2" style={{ gap: '10px' }}>
                <div className="input-group mb-1">
                    <label>Valor (R$)</label>
                    <input type="number" className="input-field" placeholder="0,00" value={dados.valor} onChange={(e) => handleChange('valor', e.target.value)} />
                </div>
                <div className="input-group mb-1">
                    <label>Categoria</label>
                    <select className="input-field m-filter-select" style={{ width: '100%' }}
                        value={dados.categoria} onChange={(e) => handleChange('categoria', e.target.value)}>
                        {CATEGORIAS_MARKETPLACE.map(cat => <option key={cat} value={cat}>{cat === 'Geral' ? 'Selecione uma categoria' : cat}</option>)}
                    </select>
                </div>
            </div>

            <div className="input-group mb-1">
                <label>URL da Imagem</label>
                <input className="input-field" placeholder="https://..." value={dados.url_imagem} onChange={(e) => handleChange('url_imagem', e.target.value)} />
            </div>

            <div className="input-group mb-1">
                <label>Link de Afiliado / WhatsApp</label>
                <input className="input-field" placeholder="https://seu-link.com ou 5511999999999"
                    value={dados.url_afiliado} onChange={(e) => handleChange('url_afiliado', e.target.value)} />
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <Info size={14} /> Se inserir só o número do WhatsApp, criamos o link automaticamente.
                </p>
            </div>

            <div className="input-group mb-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700 }}>
                    <Lock size={14} /> Código 2FA (anti-spam)
                </label>
                <input className="input-field" type="text" inputMode="numeric" maxLength={6}
                    placeholder="000000"
                    style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '8px', fontWeight: 800 }}
                    value={dados.codigo_2fa || ''}
                    onChange={(e) => handleChange('codigo_2fa', e.target.value.replace(/\D/g, ''))} />
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>Para evitar spam, ative o 2FA no menu Perfil e informe o código do Google Authenticator.</p>
            </div>

            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                    <AlertTriangle size={14} className="text-warning inline-block mr-1" /> <strong>AVISO LEGAL:</strong> Ao publicar, você declara ser o único responsável pelo produto/serviço. A Psy Pay atua apenas como plataforma de classificados e não se responsabiliza por vícios, defeitos ou falta de entrega.
                </p>
            </div>

            <button className="btn btn-primary mt-1" style={{ width: '100%', padding: '12px' }}
                disabled={!dados.nome_produto || !dados.url_afiliado || loading}
                onClick={publicar}>
                {loading ? 'Publicando...' : 'Publicar Anúncio'}
                {!loading && <Send size={16} style={{ marginLeft: '6px' }} />}
            </button>
        </div>
    );
};

export default NovoAnuncioPage;
