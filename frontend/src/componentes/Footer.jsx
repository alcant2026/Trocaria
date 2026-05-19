import React from 'react';
import Logo from './Logo';

const Footer = () => {
    return (
        <footer className="landing-footer">
            <div className="landing-footer-grid">
                <div>
                    <Logo size={28} />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Rede de Apoio entre Pares. Conectamos pessoas que querem apoiar umas às outras.
                    </p>
                </div>
                <div>
                    <h4>Links Úteis</h4>
                    <a href="#comofunciona" onClick={(e) => { e.preventDefault(); window.location.hash = 'comofunciona'; }}>Como Funciona</a>
                    <a href="#privacidade" onClick={(e) => { e.preventDefault(); window.location.hash = 'privacidade'; }}>Política de Privacidade</a>
                </div>
                <div>
                    <h4>Conta</h4>
                    <a href="#login" onClick={(e) => { e.preventDefault(); window.location.hash = 'login'; }}>Entrar</a>
                    <a href="#registro" onClick={(e) => { e.preventDefault(); window.location.hash = 'registro'; }}>Cadastrar</a>
                </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 0', marginTop: '15px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 6px 0' }}>
                    <strong style={{ color: 'var(--danger)' }}>AVISO LEGAL:</strong> O Trocaria é uma plataforma de tecnologia (SaaS) que conecta pessoas para acordos de apoio mútuo direto.
                    <strong> Não somos banco, instituição financeira, sociedade de crédito ou entidade regulada pelo BACEN, CVM ou qualquer órgão regulador.</strong>
                    Não intermediamos, custodiamos ou garantimos valores. Todo apoio financeiro é um acordo direto entre as partes via PIX.
                </p>
                <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
                    As taxas cobradas referem-se exclusivamente à licença de uso do software e processamento de dados, sendo não reembolsáveis. 
                    Apoiar financeiramente outros usuários envolve <strong style={{ color: 'var(--danger)' }}>risco real de perda total</strong> do valor.
                    Ao utilizar esta plataforma, você declara ter lido, entendido e aceito os Termos de Uso e a Política de Privacidade.
                    Trocaria é um produto independente desenvolvido no Brasil. CNPJ: em fase de abertura.
                </p>
            </div>
            <div className="landing-footer-bottom">
                <span>© 2026 Trocaria. Todos os direitos reservados. Termos de Uso • Privacidade • LGPD</span>
            </div>
        </footer>
    );
};

export default Footer;
