import React from 'react';
import { Shield, Lock, EyeOff, Scale, UserCheck, ShoppingBag } from 'lucide-react';

const PoliticaPrivacidade = ({ onVoltar }) => {
    return (
        <div className="animate-fade-in" style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto', color: 'var(--text-color)', lineHeight: '1.8' }}>
            <div className="text-center mb-2">
                <ShoppingBag size={48} color="var(--primary)" className="mb-1" />
                <h1 style={{ fontSize: '2rem' }}>Política de Privacidade</h1>
                <p className="text-muted">Compromisso TROCARIA com a LGPD</p>
            </div>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <EyeOff size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>1. Dados Coletados</h3>
                </div>
                <p>A TROCARIA coleta dados estritamente necessários para o funcionamento da plataforma de classificados:</p>
                <ul>
                    <li><strong>Identificação:</strong> Nome completo, CPF, e-mail e telefone para criação e autenticação da conta.</li>
                    <li><strong>Anúncios:</strong> Fotos, descrições, valores e categorias dos produtos que você anuncia.</li>
                    <li><strong>Interações:</strong> Avaliações, denúncias e histórico de negociações para composição do Score de Confiança.</li>
                    <li><strong>Segurança:</strong> Endereço IP e metadados de dispositivo para prevenção a fraudes.</li>
                </ul>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <Lock size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>2. Segurança da Informação</h3>
                </div>
                <p>Implementamos padrões de segurança para proteger suas informações. Utilizamos criptografia em repouso e em trânsito, autenticação multifator (2FA) e algoritmos de hash para armazenamento de credenciais.</p>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <Scale size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>3. Seus Direitos (LGPD)</h3>
                </div>
                <p>Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018), asseguramos seus direitos:</p>
                <ul>
                    <li><strong>Acesso e Correção:</strong> Consulte e atualize seus dados a qualquer momento no perfil.</li>
                    <li><strong>Eliminação:</strong> Solicite a exclusão da sua conta a qualquer momento, ressalvadas obrigações legais de retenção.</li>
                </ul>
            </section>

            <section className="card mb-1">
                <div className="flex items-center gap-2 mb-1">
                    <UserCheck size={20} color="var(--primary)" />
                    <h3 style={{ margin: 0 }}>4. Compartilhamento</h3>
                </div>
                <p>A TROCARIA <strong>não comercializa</strong> seus dados pessoais. Informações são compartilhadas apenas quando necessário para cumprimento de obrigações legais ou mediante sua autorização explícita.</p>
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
