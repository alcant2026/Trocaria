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
            <div className="landing-footer-bottom">
                <span>© 2026 Psy Pay. Todos os direitos reservados.</span>
            </div>
        </footer>
    );
};

export default Footer;
