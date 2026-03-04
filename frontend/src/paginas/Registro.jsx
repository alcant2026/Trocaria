import React, { useState } from 'react';
import api from '../api';
import TermosUso from '../componentes/TermosUso';
import SeletorCustom from '../componentes/SeletorCustom';

const Registro = () => {
    const [formData, setFormData] = useState({
        nome: '',
        email: '',
        cpf: '',
        chave_pix: '',
        senha: '',
        cidade: '',
        estado: ''
    });
    const [estados, setEstados] = useState([]);
    const [cidades, setCidades] = useState([]);
    const [aceiteTermos, setAceiteTermos] = useState(false);
    const [showTermos, setShowTermos] = useState(false);
    const [mensagem, setMensagem] = useState('');
    const [sucesso, setSucesso] = useState(false);

    // Carregar estados do IBGE
    React.useEffect(() => {
        fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
            .then(res => res.json())
            .then(data => setEstados(data))
            .catch(err => console.error("Erro ao carregar estados:", err));
    }, []);

    // Carregar cidades quando o estado mudar
    React.useEffect(() => {
        if (formData.estado) {
            fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.estado}/municipios?orderBy=nome`)
                .then(res => res.json())
                .then(data => setCidades(data))
                .catch(err => console.error("Erro ao carregar cidades:", err));
        } else {
            setCidades([]);
        }
    }, [formData.estado]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'estado') {
            setFormData({ ...formData, [name]: value, cidade: '' });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!aceiteTermos) {
            setMensagem('Você precisa aceitar os Termos de Uso.');
            return;
        }
        try {
            await api.post('/auth/registrar', { ...formData });
            setMensagem('Conta criada com sucesso! Redirecionando...');
            setSucesso(true);
            setTimeout(() => window.location.hash = 'login', 2000);
        } catch (err) {
            setMensagem(err.message || 'Erro ao criar conta. Verifique os dados.');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-overlay"></div>
            <div className="auth-content" style={{ maxWidth: '450px' }}>
                <div className="text-center mb-1">
                    <h1>Começar jornada</h1>
                    <p>Crie sua conta em segundos</p>
                </div>

                <div className="card" style={{ width: '100%' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label>Nome Completo</label>
                            <input name="nome" placeholder="Como quer ser chamado?" onChange={handleChange} className="input-field" required />
                        </div>

                        <div className="input-group">
                            <label>E-mail</label>
                            <input name="email" type="email" placeholder="seu@email.com" onChange={handleChange} className="input-field" required />
                        </div>

                        <div className="input-row input-row-2">
                            <div className="input-group">
                                <label>CPF</label>
                                <input name="cpf" placeholder="000.000.000-00" onChange={handleChange} className="input-field" required />
                            </div>
                            <div className="input-group">
                                <label>Chave PIX</label>
                                <input name="chave_pix" placeholder="CPF ou E-mail" onChange={handleChange} className="input-field" required />
                            </div>
                        </div>

                        <div className="input-row input-row-state-city">
                            <SeletorCustom
                                label="UF"
                                options={estados}
                                value={formData.estado}
                                onChange={handleChange}
                                placeholder="UF"
                            />
                            <SeletorCustom
                                label="Cidade"
                                options={cidades}
                                value={formData.cidade}
                                onChange={handleChange}
                                placeholder="Selecione a cidade"
                                disabled={!formData.estado}
                            />
                        </div>

                        <div className="input-group">
                            <label>Senha</label>
                            <input name="senha" type="password" placeholder="Mínimo 6 caracteres" onChange={handleChange} className="input-field" required />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '1.5rem' }}>
                            <input
                                type="checkbox"
                                id="aceite"
                                checked={aceiteTermos}
                                onChange={(e) => setAceiteTermos(e.target.checked)}
                                style={{ marginTop: '4px', cursor: 'pointer' }}
                            />
                            <label htmlFor="aceite" style={{ fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                                Concordo com os <button type="button" onClick={() => setShowTermos(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', padding: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit' }}>Termos de Uso</button> e a política de intermediação tecnológica.
                            </label>
                        </div>

                        <button type="submit" className={`btn ${sucesso ? 'btn-secondary' : 'btn-primary'}`} disabled={sucesso}>
                            {sucesso ? 'Conta Criada!' : 'Criar minha conta'}
                        </button>

                        {mensagem && (
                            <p className={`text-center mt-1 ${sucesso ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.875rem' }}>
                                {mensagem}
                            </p>
                        )}
                    </form>
                </div>

                {showTermos && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                        <div className="card slide-up" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
                            <button onClick={() => setShowTermos(false)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                            <TermosUso onConfirm={() => { setAceiteTermos(true); setShowTermos(false); }} />
                        </div>
                    </div>
                )}

                <p className="text-center mt-1" style={{ fontSize: '0.9rem', color: '#fff' }}>
                    Já tem conta? <a href="#" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); window.location.hash = 'login'; }}>Fazer login</a>
                </p>
            </div>
        </div>
    );
};

export default Registro;
