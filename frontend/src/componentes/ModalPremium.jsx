import React from 'react';
import {
    X,
    CheckCircle2,
    AlertCircle,
    ShieldAlert,
    Info,
    TrendingUp,
    HandCoins,
    AlertTriangle
} from 'lucide-react';

/**
 * ModalPremium - Componente de Modal padronizado para a plataforma.
 * 
 * @param {boolean} isOpen - Controla se o modal está visível.
 * @param {function} onClose - Função disparada ao fechar ou cancelar.
 * @param {string} title - Título do modal.
 * @param {string} message - Texto descritivo principal.
 * @param {string} type - Tipo visual: 'success', 'error', 'warning', 'info', 'pool', 'finance'.
 * @param {function} onConfirm - Se presente, exibe botão de confirmação e executa esta função.
 * @param {string} confirmText - Texto do botão de confirmação (default: 'Confirmar').
 * @param {string} cancelText - Texto do botão de cancelamento (default: 'Cancelar').
 * @param {boolean} loading - Estado de carregamento do botão de confirmação.
 * @param {React.ReactNode} children - Conteúdo extra opcional no corpo do modal.
 */
const ModalPremium = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    onConfirm,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    loading = false,
    children
}) => {
    if (!isOpen) return null;

    const getTheme = () => {
        switch (type) {
            case 'success':
                return {
                    color: 'var(--success)',
                    icon: <CheckCircle2 size={32} />,
                    border: 'rgba(var(--success-rgb), 0.3)',
                    bgIcon: 'rgba(var(--success-rgb), 0.1)'
                };
            case 'error':
                return {
                    color: 'var(--danger)',
                    icon: <ShieldAlert size={32} />,
                    border: 'rgba(var(--danger-rgb), 0.3)',
                    bgIcon: 'rgba(var(--danger-rgb), 0.1)'
                };
            case 'warning':
                return {
                    color: 'var(--warning)',
                    icon: <AlertTriangle size={32} />,
                    border: 'rgba(var(--warning-rgb), 0.3)',
                    bgIcon: 'rgba(var(--warning-rgb), 0.1)'
                };
            case 'pool':
                return {
                    color: 'var(--primary)',
                    icon: <TrendingUp size={32} />,
                    border: 'rgba(var(--primary-rgb), 0.3)',
                    bgIcon: 'rgba(var(--primary-rgb), 0.1)'
                };
            case 'finance':
                return {
                    color: 'var(--success)',
                    icon: <HandCoins size={32} />,
                    border: 'rgba(var(--success-rgb), 0.3)',
                    bgIcon: 'rgba(var(--success-rgb), 0.1)'
                };
            default:
                return {
                    color: 'var(--primary)',
                    icon: <Info size={32} />,
                    border: 'rgba(var(--primary-rgb), 0.3)',
                    bgIcon: 'rgba(var(--primary-rgb), 0.1)'
                };
        }
    };

    const theme = getTheme();

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
            <div
                className="modal-card animate-scale-up"
                onClick={e => e.stopPropagation()}
                style={{
                    border: `1px solid ${theme.border}`,
                    maxWidth: '420px',
                    textAlign: 'center'
                }}
            >
                <button
                    onClick={onClose}
                    className="modal-close"
                    style={{ position: 'absolute', top: '15px', right: '15px', color: 'var(--text-muted)' }}
                >
                    <X size={20} />
                </button>

                <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '20px',
                    background: theme.bgIcon,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    color: theme.color,
                    boxShadow: `0 8px 20px -5px ${theme.bgIcon}`
                }}>
                    {theme.icon}
                </div>

                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                    {title}
                </h2>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>
                    {message}
                </p>

                {children && <div style={{ marginBottom: '1.5rem' }}>{children}</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {onConfirm && (
                        <button
                            className="btn btn-primary"
                            style={{
                                background: theme.color,
                                borderColor: theme.color,
                                color: type === 'warning' ? '#111' : '#fff'
                            }}
                            onClick={onConfirm}
                            disabled={loading}
                        >
                            {loading ? 'Processando...' : confirmText}
                        </button>
                    )}
                    <button
                        className="btn btn-secondary"
                        onClick={onClose}
                        disabled={loading}
                        style={{ border: 'none', color: 'var(--text-muted)' }}
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalPremium;
