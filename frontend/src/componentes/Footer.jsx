import React from 'react';
import Logo from './Logo';

const Footer = () => {
    return (
        <footer className="landing-footer">
            <div className="landing-footer-grid">
                <div>
                    <Logo size={28} />
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Classificados gratuitos com sistema de confiança. Compre, venda e troque direto com as pessoas.
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
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    O Trocaria é uma <strong>plataforma de classificados</strong> que conecta pessoas para compra, venda e troca de produtos.
                    Não somos banco, instituição financeira ou sociedade de crédito. A plataforma não participa das transações financeiras entre os usuários.
                    Todas as negociações são realizadas <strong>diretamente entre as partes</strong>. Verifique a reputação do vendedor antes de negociar.
                    Ao utilizar esta plataforma, você declara ter lido, entendido e aceito os <a href="#privacidade" style={{ color: 'var(--primary)' }}>Termos de Uso</a> e a <a href="#privacidade" style={{ color: 'var(--primary)' }}>Política de Privacidade</a>.
                </p>
            </div>
            <div className="landing-footer-bottom">
                <span>© 2026 Trocaria. Todos os direitos reservados. Termos de Uso • Privacidade • LGPD</span>
            </div>
        </footer>
    );
};

export default Footer;
