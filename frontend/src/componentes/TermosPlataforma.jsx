import React from 'react';

const TermosPlataforma = ({ onAceitar, onVoltar, tipo }) => {
    return (
        <div style={{ padding: '10px 0' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                {tipo === 'criar' ? 'Regras para Pedir Apoio' : 'Regras para Apoiar'}
            </h3>

            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '15px', fontSize: '0.78rem', lineHeight: '1.6', color: 'var(--text-muted)', maxHeight: '55vh', overflowY: 'auto' }}>
                
                <p><strong style={{ color: 'var(--text-main)' }}>1. Responsabilidade dos Usuarios</strong><br />
                O Psy Pay e apenas uma plataforma de conexao entre pessoas. Nao participamos, garantimos ou nos responsabilizamos pelos acordos firmados entre os usuarios. Cada usuario e integralmente responsavel por suas escolhas e pelo cumprimento dos compromissos assumidos.</p>

                <p><strong style={{ color: 'var(--text-main)' }}>2. Due Diligence</strong><br />
                Antes de firmar qualquer acordo, recomendamos que voce verifique as informacoes da outra parte. A plataforma exibe dados como score de reputacao e status de verificacao, mas nao realiza verificacao completa de identidade ou capacidade financeira.</p>

                {tipo === 'criar' && (
                    <p><strong style={{ color: 'var(--text-main)' }}>3. Taxa de Publicacao</strong><br />
                    A taxa de R$ 2,00 (ou outro valor definido) e destinada a cobrir custos operacionais da plataforma. Esta taxa <strong>nao e reembolsavel</strong>, mesmo que o pedido nao seja aceito por nenhum apoiador.</p>
                )}

                {tipo === 'apoiar' && (
                    <p><strong style={{ color: 'var(--text-main)' }}>3. Taxa de Match</strong><br />
                    A taxa de match de 2% (minimo R$ 2, maximo R$ 20) sera adicionada ao valor combinado e paga pelo tomador. Esta taxa cobre o servico de conexao entre as partes e <strong>nao e reembolsavel</strong> apos a confirmacao.</p>
                )}

                <p><strong style={{ color: 'var(--text-main)' }}>4. Nao Garantia de Pagamento</strong><br />
                    A plataforma nao garante o pagamento das parcelas combinadas. O calote e uma possibilidade inerente a acordos entre pessoas fisicas. A plataforma pode, a seu criterio, aplicar penalidades de score a usuarios inadimplentes, mas nao se responsabiliza por perdas financeiras.</p>

                <p><strong style={{ color: 'var(--text-main)' }}>5. Conduta e Boa-fe</strong><br />
                    E proibido usar a plataforma para fraudes, adulteracao de informacoes, criacao de contas falsas ou qualquer atividade ilegal. Usuarios que violarem estas regras terao suas contas suspensas e os dados encaminhados as autoridades competentes.</p>

                <p><strong style={{ color: 'var(--text-main)' }}>6. Isencao de Responsabilidade</strong><br />
                    Ao utilizar a plataforma, voce isenta o Psy Pay de qualquer responsabilidade por danos diretos ou indiretos decorrentes dos acordos firmados entre usuarios, incluindo, mas nao se limitando a, inadimplencia, divergencias contratuais ou prejuizos financeiros.</p>

                <p style={{ fontSize: '0.7rem', color: 'var(--warning)', marginTop: '15px', textAlign: 'center' }}>
                    Ao clicar em "Aceitar e Continuar", voce confirma que leu, entendeu e concorda com estas regras.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginTop: '15px', position: 'sticky', bottom: 0, marginLeft: '-15px', marginRight: '-15px', padding: '10px 15px' }}>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={onAceitar}>
                        Aceitar e Continuar
                    </button>
                    {onVoltar && (
                        <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onVoltar}>
                            Voltar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TermosPlataforma;
