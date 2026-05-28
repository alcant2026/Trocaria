import React, { useState, useEffect, useRef } from 'react';
import api, { BASE_URL, BACKEND_URL } from '../api';
import { ShieldAlert, ShieldCheck, Lock, Copy, Check, User, Mail, Phone, Key, ArrowLeft, Camera, BadgeCheck, Upload } from 'lucide-react';

const Perfil = () => {
    const [status2fa, setStatus2fa] = useState(null);
    const [secretData, setSecretData] = useState(null);
    const [codigo, setCodigo] = useState('');
    const [mensagem, setMensagem] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiado, setCopiado] = useState(false);
    const [senhaParaDesativar, setSenhaParaDesativar] = useState('');
    const [codigoParaDesativar, setCodigoParaDesativar] = useState('');
    const [showDesativarForm, setShowDesativarForm] = useState(false);
    const [showSenha, setShowSenha] = useState(false);
    const [codigoIndicacao, setCodigoIndicacao] = useState('');
    const [usuario, setUsuario] = useState(null);
    const [editEmail, setEditEmail] = useState('');
    const [editTelefone, setEditTelefone] = useState('');
    const [editChavePix, setEditChavePix] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [uploadingFoto, setUploadingFoto] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        carregarStatus();
        carregarPerfil();
    }, []);

    const carregarStatus = async () => {
        try {
            const res = await api.get('/auth/perfil');
            setStatus2fa(res.two_factor_enabled);
            setUsuario(res);
        } catch (err) {
            console.error("Erro ao carregar perfil:", err);
        }
    };

    const carregarPerfil = async () => {
        try {
            const res = await api.get('/auth/perfil');
            setUsuario(res);
            setEditEmail(res.email || '');
            setEditTelefone(res.telefone || '');
            setEditChavePix(res.chave_pix || '');
        } catch (err) {
            console.error("Erro ao carregar perfil:", err);
        }
    };

    const gerar2fa = async () => {
        setLoading(true);
        setMensagem('');
        try {
            const res = await api.post('/auth/2fa/gerar');
            setSecretData(res);
            if (res.error) {
                setMensagem(res.error);
            }
        } catch (err) {
            setMensagem(err.message || "Erro ao conectar com o servidor.");
        } finally {
            setLoading(false);
        }
    };

    const copiarChave = () => {
        if (!secretData?.secret) return;
        navigator.clipboard.writeText(secretData.secret);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
    };

    const ativar2fa = async () => {
        if (!codigo) return;
        setLoading(true);
        try {
            await api.post(`/auth/2fa/ativar?codigo=${codigo}`);
            setMensagem("2FA ativado com sucesso!");
            setStatus2fa(true);
            setSecretData(null);
            const user = JSON.parse(localStorage.getItem('usuario')) || {};
            user.two_factor_enabled = true;
            localStorage.setItem('usuario', JSON.stringify(user));
        } catch (err) {
            setMensagem(err.response?.data?.detail || "Codigo invalido.");
        }
        setLoading(false);
    };

    const desativar2fa = async () => {
        if (!senhaParaDesativar || !codigoParaDesativar) return;
        setLoading(true);
        try {
            await api.post(`/auth/2fa/desativar?senha=${senhaParaDesativar}&codigo=${codigoParaDesativar}`);
            setMensagem("2FA desativado com sucesso.");
            setStatus2fa(false);
            setSenhaParaDesativar('');
            setCodigoParaDesativar('');
            setShowDesativarForm(false);
            const user = JSON.parse(localStorage.getItem('usuario')) || {};
            user.two_factor_enabled = false;
            localStorage.setItem('usuario', JSON.stringify(user));
        } catch (err) {
            setMensagem(err.response?.data?.detail || "Senha ou codigo incorretos.");
        }
        setLoading(false);
    };

    const salvarDados = async () => {
        const campos = {};
        if (editEmail !== usuario?.email && editEmail.trim()) campos.email = editEmail.trim();
        if (editTelefone !== usuario?.telefone && editTelefone.trim()) campos.telefone = editTelefone.trim();
        if (editChavePix !== usuario?.chave_pix && editChavePix.trim()) campos.chave_pix = editChavePix.trim();
        if (Object.keys(campos).length === 0) { setMensagem('Nenhum campo alterado.'); return; }
        setSalvando(true);
        try {
            const res = await api.put('/auth/perfil', campos);
            setMensagem(res.message);
            carregarPerfil();
        } catch (e) {
            setMensagem(e?.response?.data?.detail || 'Erro ao salvar.');
        }
        setSalvando(false);
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                <button onClick={() => window.location.hash = 'cliente'} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--primary)', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Voltar para o início">
                    <ArrowLeft size={20} />
                </button>
                <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>Perfil</h2>
            </div>
            {/* DADOS DO PERFIL */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(var(--primary-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative', flexShrink: 0, border: 'none' }} aria-label="Alterar foto de perfil">
                        {usuario?.foto_url ? (
                            <img src={`${BASE_URL}${usuario.foto_url}`} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <User size={28} color="var(--primary)" />
                        )}
                        {uploadingFoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" /></div>}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" hidden onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { setMensagem('Arquivo muito grande. Maximo 2MB.'); return; }
                        const form = new FormData();
                        form.append('foto', file);
                        setUploadingFoto(true);
                        try {
                            const res = await api.post('/auth/upload-foto', form, { isMultipart: true });
                            setMensagem(res.message);
                            carregarPerfil();
                        } catch (e) { setMensagem(e.message || 'Erro ao enviar foto.'); }
                        setUploadingFoto(false);
                    }} />
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{usuario?.nome || 'Carregando...'}</h2>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{usuario?.cpf || ''}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label htmlFor="email_perfil" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Mail size={12} /> Email
                            {usuario?.email_verificado ? (
                                <span style={{ fontSize: '0.65rem', color: 'var(--success)', background: 'rgba(var(--success-rgb), 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <ShieldCheck size={10} /> Verificado
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.65rem', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }} onClick={() => window.location.hash = 'verificar-conta'}>
                                    <ShieldAlert size={10} /> Não verificado
                                </span>
                            )}
                        </label>
                        <input id="email_perfil" type="email" className="input-field" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Seu email" />
                    </div>
                    <div>
                        <label htmlFor="telefone_perfil" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={12} /> WhatsApp
                            {usuario?.telefone_verificado ? (
                                <span style={{ fontSize: '0.65rem', color: 'var(--success)', background: 'rgba(var(--success-rgb), 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <ShieldCheck size={10} /> Verificado
                                </span>
                            ) : (
                                <span style={{ fontSize: '0.65rem', color: 'var(--warning)', background: 'rgba(var(--warning-rgb), 0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }} onClick={() => window.location.hash = 'verificar-conta'}>
                                    <ShieldAlert size={10} /> Não verificado
                                </span>
                            )}
                        </label>
                        <input id="telefone_perfil" type="tel" className="input-field" value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} placeholder="(DDD) 9xxxx-xxxx" />
                    </div>
                    <div>
                        <label htmlFor="pix_perfil" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}><Key size={12} /> Chave PIX</label>
                        <input id="pix_perfil" type="text" className="input-field" value={editChavePix} onChange={(e) => setEditChavePix(e.target.value)} placeholder="Sua chave PIX" />
                    </div>
                    <button className="btn btn-primary w-full" onClick={salvarDados} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Salvar Alteracoes'}
                    </button>
                </div>
            </div>

            {/* USAR CODIGO DE INDICACAO */}
            {!usuario?.indicado_por && (
                <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', borderColor: 'rgba(var(--success-rgb), 0.3)' }}>
                    <h4 style={{ fontSize: '0.75rem', color: 'var(--success)', textTransform: 'uppercase', marginBottom: '10px' }}>Tem um codigo de amigo?</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Digite o codigo e ganhe <strong style={{ color: 'var(--success)' }}>5 pontos</strong> de boas-vindas!
                    </p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <input
                            type="text"
                            placeholder="Ex: ABC12345"
                            value={codigoIndicacao}
                            onChange={(e) => setCodigoIndicacao(e.target.value.toUpperCase())}
                            className="input-field"
                            style={{ textTransform: 'uppercase', maxWidth: '150px', textAlign: 'center' }}
                            maxLength={8}
                        />
                        <button className="btn btn-success btn-sm" onClick={async () => {
                            if (!codigoIndicacao.trim()) return;
                            try {
                                const res = await api.post('/auth/usar-codigo-indicacao', { codigo_indicacao: codigoIndicacao });
                                setUsuario({ ...usuario, indicado_por: true, pontos_marketplace: (usuario.pontos_marketplace || 0) + res.bonus_indicado });
                                setMensagem(res.message);
                                setCodigoIndicacao('');
                            } catch (err) {
                                setMensagem(err.message || 'Codigo invalido ou ja utilizado.');
                            }
                        }}>Aplicar</button>
                    </div>
                </div>
            )}

            {usuario?.indicado_por && (
                <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', background: 'rgba(var(--success-rgb), 0.05)' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--success)', margin: 0 }}>
                        Voce foi indicado por <strong>{usuario.nome_indicado_por || 'um amigo'}</strong>!
                    </p>
                </div>
            )}

            {/* CODIGO DE CONVITE */}
            <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Convide um Amigo</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Compartilhe seu codigo e ganhe <strong style={{ color: 'var(--success)' }}>10 pontos</strong> por cada amigo que se cadastrar!
                </p>
                {usuario?.codigo_indicacao ? (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '10px', marginBottom: '8px' }}>
                            <code style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '2px' }}>{usuario.codigo_indicacao}</code>
                            <button onClick={() => { navigator.clipboard.writeText(usuario.codigo_indicacao); setMensagem('Codigo copiado!'); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px' }}>
                                <Copy size={18} />
                            </button>
                        </div>
                        <button className="btn btn-outline btn-sm" onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?ref=${usuario.codigo_indicacao}`;
                            navigator.clipboard.writeText(url);
                            setMensagem('Link de convite copiado!');
                        }} style={{ fontSize: '0.75rem' }}>Copiar Link de Convite</button>
                    </>
                ) : (
                    <button className="btn btn-primary btn-sm" onClick={async () => {
                        try {
                            const res = await api.post('/auth/gerar-codigo-indicacao');
                            setUsuario({ ...usuario, codigo_indicacao: res.codigo_indicacao });
                            setMensagem('Codigo gerado com sucesso!');
                        } catch (err) {
                            setMensagem('Erro ao gerar codigo.');
                        }
                    }}>Gerar Meu Codigo de Indicacao</button>
                )}
            </div>

            {/* SELFIE VERIFICATION */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: usuario?.selfie_verificada ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 145, 0, 0.1)', color: usuario?.selfie_verificada ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {usuario?.selfie_verificada ? <BadgeCheck size={24} /> : <Camera size={24} />}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>Selfie de Verificação</h3>
                        <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {usuario?.selfie_verificada ? 'Selfie verificada' : usuario?.selfie_url ? 'Aguardando aprovação' : 'Opcional — ganhe um badge no perfil'}
                        </p>
                    </div>
                </div>
                {usuario?.selfie_verificada && usuario?.selfie_url && (
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                        <img src={`${BACKEND_URL}${usuario.selfie_url}`} alt="Selfie" style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--success)' }} />
                    </div>
                )}
                {!usuario?.selfie_verificada && (
                    <div style={{ textAlign: 'center' }}>
                        <input type="file" accept="image/*" hidden id="selfie-input" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) { setMensagem('Arquivo muito grande. Maximo 5MB.'); return; }
                            const form = new FormData();
                            form.append('arquivo', file);
                            try {
                                const res = await api.post('/auth/enviar-selfie', form, { isMultipart: true });
                                setMensagem(res.message);
                                carregarPerfil();
                            } catch (err) {
                                setMensagem(err.message || 'Erro ao enviar selfie.');
                            }
                        }} />
                        <label htmlFor="selfie-input" className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Upload size={16} /> {usuario?.selfie_url ? 'Reenviar Selfie' : 'Enviar Selfie'}
                        </label>
                    </div>
                )}
            </div>

            {/* SEGURANCA 2FA */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', background: status2fa ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 145, 0, 0.1)', color: status2fa ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {status2fa ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>Autenticacao 2FA (TOTP)</h3>
                        <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                            {status2fa ? "Protecao ATIVA" : "Protecao sua conta com 2FA"}
                        </p>
                    </div>
                </div>

                {!status2fa && !secretData && (
                    <div className="text-center">
                        <button className="btn btn-primary" onClick={gerar2fa} disabled={loading}>
                            {loading ? "Processando..." : "Configurar 2FA Agora"}
                        </button>
                    </div>
                )}

                {!status2fa && secretData && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ background: 'rgba(255, 255, 255, 0.9)', padding: '1.2rem', borderRadius: '24px', display: 'inline-block', marginBottom: '1.5rem' }}>
                            <img src={secretData.qr_code} alt="QR Code 2FA" style={{ width: '180px', height: '180px', display: 'block', borderRadius: '12px' }} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <p style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px' }}>Chave Manual:</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px' }}>
                                <code style={{ color: 'var(--primary)', fontSize: '1rem', fontWeight: 'bold', letterSpacing: '1px', wordBreak: 'break-all' }}>{secretData.secret}</code>
                                <button onClick={copiarChave} style={{ background: 'none', border: 'none', color: copiado ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                    {copiado ? <Check size={18} /> : <Copy size={18} />}
                                </button>
                            </div>
                            {copiado && <p style={{ fontSize: '0.7rem', color: 'var(--success)' }}>Copiado!</p>}
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginBottom: '1rem' }}>Guarde a chave em local seguro.</p>
                        <div className="input-group" style={{ marginBottom: '10px' }}>
                            <input type="text" placeholder="Codigo de 6 digitos" className="input-field" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={6} style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.2rem' }} />
                        </div>
                        <button className="btn btn-primary" onClick={ativar2fa} disabled={loading || codigo.length < 6}>
                            {loading ? "Validando..." : "Confirmar e Ativar"}
                        </button>
                    </div>
                )}

                {status2fa && (
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: 'var(--success)', marginBottom: '0.8rem' }}><Lock size={36} /></div>
                        <p style={{ fontWeight: 600, marginBottom: '1rem' }}>Sua conta esta protegida com 2FA.</p>
                        {!showDesativarForm ? (
                            <button className="btn btn-outline" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setShowDesativarForm(true)}>Desativar 2FA</button>
                        ) : (
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', textAlign: 'left' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginBottom: '1rem' }}>A desativacao reduz a seguranca da sua conta.</p>
                                <input type={showSenha ? "text" : "password"} placeholder="Sua senha" className="input-field" value={senhaParaDesativar} onChange={(e) => setSenhaParaDesativar(e.target.value)} style={{ marginBottom: '8px' }} />
                                <input type="text" placeholder="Codigo 2FA" className="input-field" value={codigoParaDesativar} onChange={(e) => setCodigoParaDesativar(e.target.value)} maxLength={6} style={{ marginBottom: '10px' }} />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={desativar2fa} disabled={loading}>{loading ? "Desativando..." : "Desativar"}</button>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowDesativarForm(false)}>Cancelar</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {mensagem && (
                    <div className={`alert mt-1 ${mensagem.includes('sucesso') || mensagem.includes('ativo') ? 'alert-success' : 'alert-danger'}`}>
                        {mensagem}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Perfil;
