import React from 'react';

const TermosUso = ({ onConfirm }) => {
    return (
        <div style={{ padding: '1rem', color: 'var(--text-color)', lineHeight: '1.6', fontSize: '0.9rem', maxHeight: '70vh', overflowY: 'auto' }}>
            <h2 className="mb-1" style={{ color: 'var(--primary)' }}>Contrato de Intermediação Digital (SaaS)</h2>

            <p className="mb-1"><strong>1. Objeto:</strong> A plataforma é uma ferramenta de tecnologia que facilita a formalização de mútuos civis entre particulares. <strong>O usuário declara estar ciente que este sistema não é um Banco, não capta recursos do público e não é regulado como instituição financeira.</strong></p>

            <p className="mb-1"><strong>2. Taxas de Intermediação:</strong> As taxas de postagem (R$ 4,00), desbloqueio (R$ 15,00) e performance (10%) remuneram a licença de uso do software e o processamento de dados. <strong>Tais valores são integrais e não reembolsáveis, independente do pagamento do empréstimo pelo tomador.</strong></p>

            <p className="mb-1"><strong>3. Mútuo Civil (P2P):</strong> Os contratos aqui gerados são regidos pelo Código Civil (Art. 586 a 592). A plataforma não garante a solvência dos tomadores e não assume responsabilidade por inadimplência (calotes).</p>

            <p className="mb-1"><strong>4. Rastreabilidade e Auditoria:</strong> Para segurança jurídica, toda operação registra o IP, CPF e carimbo de data/hora (Timestamp) do usuário, servindo como prova digital de aceite deste contrato.</p>

            <p className="mb-1"><strong>5. Penalidades:</strong> O atraso no pagamento gera multa de 2% e juros de mora de 0,1% ao dia, calculados automaticamente pelo sistema.</p>

            <div className="mt-1" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ao concordar, você ratifica plenamente estes termos sob as leis brasileiras.</p>
            </div>

            {onConfirm && (
                <button className="btn btn-primary mt-1 w-100" onClick={onConfirm}>Aceitar e Continuar</button>
            )}
        </div>
    );
};

export default TermosUso;
