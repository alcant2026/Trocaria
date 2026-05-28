import React from 'react';

const TermosUso = ({ onConfirm }) => {
    return (
        <div style={{ padding: '1rem', color: 'var(--text-color)', lineHeight: '1.6', fontSize: '0.9rem', maxHeight: '70vh', overflowY: 'auto' }}>
            <h2 className="mb-1" style={{ color: 'var(--primary)' }}>Termos de Uso — Trocaria</h2>

            <p className="mb-1"><strong>1. Natureza da Plataforma:</strong> O Trocaria é uma <strong>plataforma de classificados</strong> que conecta pessoas para compra, venda e troca de produtos e serviços. <strong>Não somos banco, fintech regulada ou instituição financeira.</strong> A plataforma <strong>não participa</strong> das transações financeiras entre os usuários, não segura valores e não é responsável por acordos firmados entre as partes.</p>

            <p className="mb-1"><strong>2. Anúncios:</strong> Os anúncios publicados são de <strong>responsabilidade exclusiva do anunciante</strong>. A plataforma não verifica a veracidade, qualidade ou legalidade dos produtos e serviços anunciados. Anúncios com conteúdo proibido (armas, drogas, conteúdo ilegal) serão removidos e o usuário poderá ser banido.</p>

            <p className="mb-1"><strong>3. Transações entre Usuários:</strong> Toda negociação (compra, venda, troca) é realizada <strong>diretamente entre os usuários</strong>. A plataforma não intervém, não garante pagamentos e não se responsabiliza por inadimplência, produtos danificados, extravios ou quaisquer prejuízos decorrentes das negociações.</p>

            <p className="mb-1"><strong>4. Score de Confiança:</strong> O score de confiança reflete o histórico de interações do usuário na plataforma. Ele é um <strong>indicador de reputação</strong>, não uma garantia de idoneidade. A plataforma não garante a precisão das avaliações ou a veracidade das informações dos perfis.</p>

            <p className="mb-1"><strong>5. Conduta do Usuário:</strong> É proibido publicar anúncios falsos, enganosos, duplicados ou que violem direitos de terceiros. Denúncias serão analisadas e podem resultar em banimento da conta e perda dos pontos acumulados.</p>

            <p className="mb-1"><strong>6. Privacidade e Dados:</strong> Seus dados são tratados conforme a LGPD (Lei 13.709/2018). Consulte nossa Política de Privacidade para detalhes sobre coleta, armazenamento e compartilhamento de informações.</p>

            <p className="mb-1"><strong>7. Limitação de Responsabilidade:</strong> A plataforma <strong>não se responsabiliza</strong> por danos diretos ou indiretos decorrentes do uso do serviço, incluindo negociações mal-sucedidas, produtos defeituosos ou fraudes entre usuários. Use o bom senso e verifique a reputação da contraparte antes de negociar.</p>

            <div className="mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ao aceitar, você confirma que leu, entendeu e concorda integralmente com estes Termos de Uso, regidos pelas leis da República Federativa do Brasil. Foro da Comarca de São Paulo/SP para dirimir quaisquer questões.</p>
            </div>

            {onConfirm && (
                <button className="btn btn-primary mt-1 w-100" onClick={onConfirm}>Li e Aceito os Termos</button>
            )}
        </div>
    );
};

export default TermosUso;
