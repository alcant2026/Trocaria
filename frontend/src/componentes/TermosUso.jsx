import React from 'react';

const TermosUso = ({ onConfirm }) => {
    return (
        <div style={{ padding: '1rem', color: 'var(--text-color)', lineHeight: '1.6', fontSize: '0.9rem' }}>
            <h2 className="mb-1" style={{ color: 'var(--primary)' }}>Termos de Uso e Intermediação</h2>
            <p className="mb-1"><strong>1. Natureza do Serviço:</strong> A plataforma atua exclusivamente como provedora de tecnologia SaaS (Software as a Service) para intermediação de contratos civis bilaterais entre pessoas físicas (Peer-to-Peer). <strong>NÃO somos uma instituição financeira, banco ou administradora de consórcios.</strong></p>

            <p className="mb-1"><strong>2. Intermediação Tecnológica:</strong> A ferramenta provê infraestrutura para registro de intenções, verificação de identidade (KYC) e formalização de contratos de mútuo civil, conforme previsto no Código Civil Brasileiro.</p>

            <p className="mb-1"><strong>3. Riscos e Responsabilidades:</strong> O usuário compreende que a plataforma não garante o pagamento das obrigações assumidas por terceiros e não assume o risco de crédito. O risco é integralmente assumido pelas partes contratantes.</p>

            <p className="mb-1"><strong>4. Privacidade e Dados (LGPD):</strong> Ao utilizar a plataforma, você autoriza o tratamento de seus dados para fins de verificação de score e segurança antifraude, conforme nossa Política de Privacidade.</p>

            <p className="mb-1"><strong>5. Taxas de Serviço:</strong> As taxas cobradas referem-se estritamente à utilização dos serviços tecnológicos, processamento de dados e manutenção da infraestrutura, não configurando juros bancários.</p>

            <div className="mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ao clicar em concordar, você ratifica estar ciente de que esta é uma plataforma de tecnologia e não uma entidade bancária regulada.</p>
            </div>

            {onConfirm && (
                <button className="btn btn-primary mt-1 w-100" onClick={onConfirm}>Concordar e Fechar</button>
            )}
        </div>
    );
};

export default TermosUso;
