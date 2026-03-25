import React from 'react';
import { Shield, Lock, EyeOff, Scale, UserCheck } from 'lucide-react';

const PoliticaPrivacidade = ({ onVoltar }) => {
    return (
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-color)', lineHeight: '1.8' }}>
            <div className="text-center mb-2">
                <Shield size={48} color="var(--primary)" className="mb-1" />
                <h1 style={{ fontSize: '2rem' }}>Política de Privacidade</h1>
                <p className="text-muted">Compromisso PSY PAY com a sua segurança e LGPD</p>
            </div>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <EyeOff size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>1. Coleta de Dados</h3>
                </div>
                <p>Coletamos apenas os dados estritamente necessários para a operação financeira P2P:</p>
                <ul>
                    <li><strong>Dados Identificatórios:</strong> Nome, CPF e E-mail para validação de identidade.</li>
                    <li><strong>Dados Financeiros:</strong> Chave PIX para liquidação de empréstimos e aportes.</li>
                    <li><strong>Dados Digitais:</strong> Endereço IP, tipo de dispositivo e localização estimada (para prevenção de fraudes).</li>
                </ul>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <Lock size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>2. Proteção e Segurança</h3>
                </div>
                <p>Seus dados são protegidos por criptografia de ponta a ponta. Senhas são armazenadas utilizando algoritmos de Hash (Bcrypt) irreversíveis. Utilizamos autenticação de dois fatores (2FA) para garantir que apenas você acesse sua conta.</p>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <Scale size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>3. Seus Direitos (LGPD)</h3>
                </div>
                <p>Conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018), você possui o direito de:</p>
                <ul>
                    <li>Acessar seus dados a qualquer momento.</li>
                    <li>Solicitar a correção de dados incompletos ou inexatos.</li>
                    <li><strong>Direito ao Esquecimento:</strong> Solicitar a exclusão/anonimização de sua conta (desde que não haja débitos ativos na plataforma).</li>
                </ul>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <UserCheck size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>4. Compartilhamento</h3>
                </div>
                <p>A PSY PAY **não comercializa** seus dados com terceiros. O compartilhamento ocorre apenas entre Tomadores e Investidores durante a formalização do contrato de mútuo civil, conforme exigido pelo Código Civil Brasileiro.</p>
            </section>

            <div className="text-center mt-2">
                <button className="btn btn-primary" onClick={onVoltar}>Voltar</button>
            </div>
            
            <p className="text-center text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>
        </div>
    );
};

export default PoliticaPrivacidade;
