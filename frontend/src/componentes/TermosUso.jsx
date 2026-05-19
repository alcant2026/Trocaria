import React from 'react';

const TermosUso = ({ onConfirm }) => {
    return (
        <div style={{ padding: '1rem', color: 'var(--text-color)', lineHeight: '1.6', fontSize: '0.9rem', maxHeight: '70vh', overflowY: 'auto' }}>
            <h2 className="mb-1" style={{ color: 'var(--primary)' }}>Termos de Uso — Plataforma de Conexão P2P</h2>

            <p className="mb-1"><strong>1. Natureza da Plataforma:</strong> O Trocaria é uma <strong>plataforma de tecnologia</strong> (SaaS) que conecta pessoas para acordos de apoio mútuo direto. <strong>Não somos banco, fintech regulada, instituição financeira ou sociedade de crédito.</strong> Não captamos recursos do público, não intermediamos valores e não somos regulados pelo BACEN, CVM ou qualquer órgão regulador financeiro. Todo valor transacionado ocorre diretamente entre os usuários via PIX, sem passar pela plataforma.</p>

            <p className="mb-1"><strong>2. Taxas de Uso do Software:</strong> As taxas cobradas (publicação, match, destaque, verificação) remuneram exclusivamente a <strong>licença de uso da plataforma</strong> e o processamento de dados. São valores integrais e <strong>não reembolsáveis</strong>, independentemente do resultado do acordo entre as partes.</p>

            <p className="mb-1"><strong>3. Acordo Direto entre Particulares:</strong> Os acordos firmados na plataforma constituem <strong>mútuo civil</strong> regido pelo Código Civil Brasileiro (Art. 586 a 592). A plataforma <strong>não é parte</strong> do contrato, <strong>não garante</strong> pagamentos e <strong>não se responsabiliza</strong> por inadimplência, calotes ou quaisquer prejuízos financeiros decorrentes dos acordos entre usuários.</p>

            <p className="mb-1"><strong>4. Limites Operacionais:</strong> Cada solicitação de apoio está limitada a <strong>R$ 5.000,00</strong> (cinco mil reais). A plataforma se reserva o direito de ajustar este limite a qualquer momento.</p>

            <p className="mb-1"><strong>5. Rastreabilidade e Prova Digital:</strong> Toda operação registra IP, CPF, carimbo de data/hora e aceite explícito dos termos, servindo como <strong>prova digital</strong> válida para fins jurídicos, conforme Marco Civil da Internet (Lei 12.965/2014) e LGPD (Lei 13.709/2018).</p>

            <p className="mb-1"><strong>6. Responsabilidade do Usuário:</strong> O usuário é <strong>único responsável</strong> por verificar a idoneidade da contraparte, avaliar os riscos do acordo e decidir sobre sua participação. A plataforma recomenda fortemente a verificação de identidade (KYC) como medida de segurança adicional, mas <strong>não garante</strong> a precisão ou veracidade das informações fornecidas pelos usuários.</p>

            <p className="mb-1"><strong>7. Risco de Perda:</strong> <strong style={{ color: 'var(--danger)' }}>ATENÇÃO:</strong> Apoiar financeiramente outros usuários envolve <strong>risco real de perda total</strong> do valor aportado. Não apoie com valores que você não pode perder. A plataforma não oferece qualquer garantia de retorno ou reembolso.</p>

            <p className="mb-1"><strong>8. Penalidades por Atraso:</strong> O atraso no cumprimento do acordo gera multa de 2% e juros de mora de 0,1% ao dia sobre o valor devido, calculados automaticamente.</p>

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
