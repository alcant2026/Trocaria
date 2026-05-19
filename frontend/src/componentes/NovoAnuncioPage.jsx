import React, { useState, useRef } from 'react';
import { ArrowLeft, Lock, Info, AlertTriangle, Send, CheckCircle, Upload, X, Image as ImageIcon } from 'lucide-react';
import { BACKEND_URL } from '../api';

const MAX_IMAGENS = 6;
const LIMITE_TITULO = 90;
const LIMITE_DESCRICAO = 6000;

const NovoAnuncioPage = ({ usuario, onVoltar, onSucesso, api, showModal, CATEGORIAS_MARKETPLACE }) => {
    const [dados, setDados] = useState({
        nome_produto: '', descricao: '', categoria: 'Geral',
        url_afiliado: '', valor: '', vendas_texto: '', codigo_2fa: ''
    });
    const [imagens, setImagens] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef(null);

    const handleChange = (field, value) => setDados(prev => ({ ...prev, [field]: value }));

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (imagens.length + files.length > MAX_IMAGENS) {
            showModal({ title: 'Limite atingido', message: `Maximo de ${MAX_IMAGENS} imagens por anuncio.`, type: 'danger' });
            return;
        }
        setUploading(true);
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                showModal({ title: 'Arquivo grande', message: `${file.name} excede 5MB.`, type: 'danger' });
                continue;
            }
            const localUrl = URL.createObjectURL(file);
            const novaImagem = { preview: localUrl, url: null, file };
            setImagens(prev => [...prev, novaImagem]);
            try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await api.post('/comunidade/upload-imagem', formData);
                setImagens(prev => prev.map(img => img.preview === localUrl ? { ...img, url: res.url_imagem } : img));
            } catch (err) {
                showModal({ title: 'Erro', message: err.response?.data?.detail || 'Erro ao enviar imagem.', type: 'danger' });
                setImagens(prev => prev.filter(img => img.preview !== localUrl));
                URL.revokeObjectURL(localUrl);
            }
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removerImagem = (idx) => {
        setImagens(prev => {
            const img = prev[idx];
            if (img && img.preview && img.preview.startsWith('blob:')) URL.revokeObjectURL(img.preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const publicar = async () => {
        if (!dados.nome_produto || !dados.url_afiliado) return;
        if (!dados.valor || parseFloat(dados.valor) <= 0) {
            showModal({ title: 'Preco obrigatoria', message: 'Informe um valor maior que zero.', type: 'danger' });
            return;
        }
        const imagensValidas = imagens.filter(img => img.url);
        if (imagensValidas.length === 0) {
            showModal({ title: 'Imagem obrigatoria', message: 'Adicione pelo menos 1 foto do produto.', type: 'danger' });
            return;
        }
        setLoading(true);
        try {
            const payload = {
                nome_produto: dados.nome_produto,
                descricao: dados.descricao,
                categoria: dados.categoria,
                url_afiliado: dados.url_afiliado,
                valor: parseFloat(dados.valor),
                codigo_2fa: dados.codigo_2fa
            };
            const res = await api.post('/comunidade/postar-link', payload);
            
            for (const img of imagensValidas) {
                try {
                    await api.post('/comunidade/adicionar-imagem', { link_id: res.id, url_imagem: img.url });
                } catch(e) { /* ignora erros de imagem individual */ }
            }
            
            imagens.forEach(img => { if (img.preview) URL.revokeObjectURL(img.preview); });
            setDados({ nome_produto: '', descricao: '', categoria: 'Geral', url_afiliado: '', valor: '', vendas_texto: '', codigo_2fa: '' });
            setImagens([]);
            showModal({ title: 'Sucesso!', message: 'Anuncio publicado!', type: 'success' });
            if (onSucesso) onSucesso();
        } catch (err) {
            showModal({ title: 'Erro', message: err.response?.data?.detail || 'Erro ao publicar', type: 'danger' });
        }
        setLoading(false);
    };

    const getImagemSrc = (img) => {
        if (img.url) return img.url.startsWith('http') ? img.url : `${BACKEND_URL}${img.url}`;
        return img.preview;
    };

    return (
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <button onClick={onVoltar} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                    <ArrowLeft size={20} />
                </button>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Novo Anuncio</h3>
            </div>

            <p className="text-muted mb-1" style={{ fontSize: '0.8rem' }}>Anuncie gratuitamente por 24h. Preencha os dados do seu produto ou servico.</p>

            <div className="input-group mb-1">
                <label>Nome do Produto / Servico</label>
                <input className="input-field" placeholder="Ex: iPhone 13 Semi Novo" value={dados.nome_produto} maxLength={LIMITE_TITULO}
                    onChange={(e) => handleChange('nome_produto', e.target.value)} />
                <p style={{ fontSize: '0.65rem', color: dados.nome_produto.length > LIMITE_TITULO * 0.9 ? 'var(--warning)' : 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                    {dados.nome_produto.length}/{LIMITE_TITULO}
                </p>
            </div>

            <div className="input-group mb-1">
                <label>Descricao</label>
                <textarea className="input-field" rows="4" maxLength={LIMITE_DESCRICAO} placeholder="Descreva estado, detalhes, condicoes..." style={{ width: '100%', resize: 'none' }}
                    value={dados.descricao} onChange={(e) => handleChange('descricao', e.target.value)} />
                <p style={{ fontSize: '0.65rem', color: dados.descricao.length > LIMITE_DESCRICAO * 0.9 ? 'var(--warning)' : 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                    {dados.descricao.length}/{LIMITE_DESCRICAO}
                </p>
            </div>

            <div className="grid-2" style={{ gap: '10px' }}>
                <div className="input-group mb-1">
                    <label>Valor (R$) *</label>
                    <input type="number" className="input-field" placeholder="0,00" min="0.01" step="0.01" value={dados.valor} onChange={(e) => handleChange('valor', e.target.value)} />
                </div>
                <div className="input-group mb-1">
                    <label>Categoria</label>
                    <select className="input-field m-filter-select" style={{ width: '100%' }}
                        value={dados.categoria} onChange={(e) => handleChange('categoria', e.target.value)}>
                        {CATEGORIAS_MARKETPLACE.map(cat => <option key={cat} value={cat}>{cat === 'Geral' ? 'Selecione' : cat}</option>)}
                    </select>
                </div>
            </div>

            {/* UPLOAD DE IMAGENS */}
            <div className="input-group mb-1">
                <label>Fotos do Produto * (max {MAX_IMAGENS})</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                    {imagens.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden' }}>
                            <img src={getImagemSrc(img)} alt={`Foto ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={() => removerImagem(idx)} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', padding: 0 }}>
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                    {imagens.length < MAX_IMAGENS && (
                        <div onClick={() => fileInputRef.current?.click()} style={{ width: '80px', height: '80px', borderRadius: '8px', border: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)', gap: '4px' }}>
                            <Upload size={18} />
                            <span style={{ fontSize: '0.55rem' }}>{imagens.length === 0 ? 'Adicionar' : `+${MAX_IMAGENS - imagens.length}`}</span>
                        </div>
                    )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} style={{ display: 'none' }} />
                {uploading && <p style={{ fontSize: '0.65rem', color: 'var(--primary)', marginTop: '4px' }}>Enviando imagens...</p>}
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <ImageIcon size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }} />
                    JPG ou PNG, max 5MB cada. Imagens sao comprimidas automaticamente.
                </p>
            </div>

            <div className="input-group mb-1">
                <label>WhatsApp ou Link de Contato</label>
                <input className="input-field" placeholder="5511999999999 ou https://seu-link.com"
                    value={dados.url_afiliado} onChange={(e) => handleChange('url_afiliado', e.target.value)} />
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <Info size={14} /> Se inserir so o numero do WhatsApp, criamos o link automaticamente.
                </p>
            </div>

            <div className="input-group mb-1" style={{ background: 'rgba(var(--primary-rgb), 0.05)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(var(--primary-rgb), 0.15)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontWeight: 700 }}>
                    <Lock size={14} /> Codigo 2FA (anti-spam)
                </label>
                <input className="input-field" type="text" inputMode="numeric" maxLength={6}
                    placeholder="000000"
                    style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '8px', fontWeight: 800 }}
                    value={dados.codigo_2fa || ''}
                    onChange={(e) => handleChange('codigo_2fa', e.target.value.replace(/\D/g, ''))} />
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>Para evitar spam, ative o 2FA no menu Perfil e informe o codigo do Google Authenticator.</p>
            </div>

            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.3' }}>
                    <AlertTriangle size={14} className="text-warning inline-block mr-1" /> <strong>AVISO LEGAL:</strong> Ao publicar, voce declara ser o unico responsavel pelo produto/servico. A Trocaria atua apenas como plataforma de classificados e nao se responsabiliza por vicios, defeitos ou falta de entrega.
                </p>
            </div>

            <button className="btn btn-primary mt-1" style={{ width: '100%', padding: '12px' }}
                disabled={!dados.nome_produto || !dados.url_afiliado || imagens.filter(i => i.url).length === 0 || loading}
                onClick={publicar}>
                {loading ? 'Publicando...' : 'Publicar Anuncio'}
                {!loading && <Send size={16} style={{ marginLeft: '6px' }} />}
            </button>
        </div>
    );
};

export default NovoAnuncioPage;
