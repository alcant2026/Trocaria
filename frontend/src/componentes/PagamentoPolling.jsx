import React, { useState, useEffect } from 'react';
import { CheckCircle, Clock, X } from 'lucide-react';
import api from '../api';

const PagamentoPolling = ({ transacaoId, onConfirmado }) => {
    const [status, setStatus] = useState('aguardando');
    const [erro, setErro] = useState(null);

    useEffect(() => {
        if (!transacaoId) return;
        let ativo = true;

        const verificar = async () => {
            try {
                const res = await api.get('/emprestimos/verificar-transacao/' + transacaoId);
                if (!ativo) return;
                if (res.status === 'concluido' || res.status === 'pago') {
                    setStatus('confirmado');
                    setTimeout(onConfirmado, 1500);
                } else if (res.status === 'cancelado') {
                    setStatus('cancelado');
                } else {
                    setStatus('aguardando');
                }
            } catch (e) {
                if (ativo) setErro(e.message);
            }
        };

        verificar();
        const id = setInterval(verificar, 5000);
        return () => { ativo = false; clearInterval(id); };
    }, [transacaoId]);

    if (status === 'confirmado') {
        return (
            <div style={{ padding: '15px', background: 'rgba(var(--success-rgb), 0.1)', borderRadius: '12px', border: '1px solid rgba(var(--success-rgb), 0.2)', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                    <CheckCircle size={24} color="var(--success)" />
                    <strong style={{ color: 'var(--success)' }}>Pagamento Confirmado!</strong>
                </div>
            </div>
        );
    }

    if (status === 'cancelado') {
        return (
            <div style={{ padding: '15px', background: 'rgba(255,61,0,0.1)', borderRadius: '12px', border: '1px solid rgba(255,61,0,0.2)', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                    <X size={24} color="var(--danger)" />
                    <strong style={{ color: 'var(--danger)' }}>Pagamento cancelado ou expirado.</strong>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '15px', background: 'rgba(var(--primary-rgb), 0.05)', borderRadius: '12px', border: '1px solid rgba(var(--primary-rgb), 0.1)', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                <Clock size={20} color="var(--primary)" className="animate-pulse" />
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Aguardando pagamento...</span>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                Escaneie o QR Code ou copie o codigo PIX para pagar. O pedido sera publicado automaticamente apos a confirmacao.
            </p>
        </div>
    );
};

export default PagamentoPolling;
