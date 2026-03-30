import React from 'react';
import { Shield, Lock, EyeOff, Scale, UserCheck, Landmark } from 'lucide-react';

const PoliticaPrivacidade = ({ onVoltar }) => {
    return (
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-color)', lineHeight: '1.8' }}>
            <div className="text-center mb-2">
                <Landmark size={48} color="var(--primary)" className="mb-1" />
                <h1 style={{ fontSize: '2rem' }}>Política de Privacidade</h1>
                <p className="text-muted">Compromisso PSY PAY com a Governança e LGPD</p>
            </div>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <EyeOff size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>1. Digital Credit Hub</h3>
                </div>
                <p>A PSY PAY opera como um Hub de Crédito Digital. Coletamos dados estritamente necessários para viabilizar operações de crédito e análise de risco:</p>
                <ul>
                    <li><strong>Identificação Institucional:</strong> Nome completo, CPF, e-mail e dados de contato para autenticação de conta única.</li>
                    <li><strong>Dados de Crédito:</strong> Chaves PIX para liquidação e movimentação, além de histórico de pagamentos para composição do Score de Fidelidade.</li>
                    <li><strong>Monitoramento de Segurança:</strong> Endereço IP, geolocalização aproximada e metadados de dispositivo para compliance e prevenção a fraudes bancárias.</li>
                </ul>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <Lock size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>2. Blindagem e Sigilo Financeiro</h3>
                </div>
                <p>Implementamos padrões internacionais de segurança. Suas informações são protegidas por criptografia em repouso e em trânsito. Utilizamos autenticação multifator (MFA/2FA) e algoritmos de hash irreversíveis para o armazenamento de credenciais, garantindo o sigilo das operações.</p>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <Scale size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>3. Transparência e LGPD</h3>
                </div>
                <p>Em total conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), asseguramos seus direitos fundamentais:</p>
                <ul>
                    <li><strong>Acesso e Correção:</strong> Liberdade total para consultar e atualizar seus dados no perfil.</li>
                    <li><strong>Eliminação de Dados:</strong> Você pode solicitar a anonimização de sua conta (Direito ao Esquecimento), ressalvadas as obrigações legais de guarda de registros financeiros e ausência de débitos ativos.</li>
                </ul>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <UserCheck size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>4. Compartilhamento Restrito</h3>
                </div>
                <p>Diferente de modelos abertos, a PSY PAY **não comercializa e não compartilha** seus dados para fins publicitários. O processamento de dados é exclusivo para a análise de crédito interna e cumprimento de normativas de segurança do ecossistema financeiro digital.</p>
            </section>

            <div className="text-center mt-2">
                <button className="btn btn-primary" onClick={onVoltar}>Voltar</button>
            </div>
            
            <p className="text-center text-muted mt-2" style={{ fontSize: '0.75rem' }}>
                Última atualização institucional: {new Date().toLocaleDateString('pt-BR')}
            </p>
        </div>
    );
};

export default PoliticaPrivacidade;
