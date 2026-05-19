import React from 'react';
import { BadgeCheck, Sprout, AlertTriangle, Gem, Crown } from 'lucide-react';

const ICON_MAP = {
    BadgeCheck,
    Sprout,
    AlertTriangle,
    Gem,
    Crown
};

const SeloConfianca = ({ score, nivel, label, cor, icone, tamanho = 'sm', vendas, rankingPosicao }) => {
    const Icone = ICON_MAP[icone] || BadgeCheck;
    
    const tamanhos = {
        xs: { icon: 10, text: '0.55rem', padding: '2px 4px' },
        sm: { icon: 12, text: '0.6rem', padding: '3px 6px' },
        md: { icon: 16, text: '0.75rem', padding: '4px 8px' },
        lg: { icon: 20, text: '0.85rem', padding: '6px 10px' }
    };
    
    const t = tamanhos[tamanho] || tamanhos.sm;
    
    const isElite = nivel === 'elite';
    const isLenda = icone === 'Crown';
    const isRisco = nivel === 'risco';
    
    return (
        <span
            className={`selo-confianca ${isElite ? 'selo-elite' : ''} ${isLenda ? 'selo-lenda' : ''} ${isRisco ? 'selo-risco' : ''}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: t.padding,
                borderRadius: '6px',
                fontSize: t.text,
                fontWeight: 700,
                border: `1px solid ${cor || 'transparent'}`,
                background: `${cor || 'transparent'}15`,
                color: cor || 'inherit',
                whiteSpace: 'nowrap'
            }}
            title={`${label} (Score: ${score || 0}${vendas ? ` | ${vendas} vendas` : ''}${rankingPosicao ? ` | Ranking #${rankingPosicao}` : ''})`}
        >
            <Icone size={t.icon} color={cor} fill={isElite || isLenda ? `${cor}40` : 'none'} />
            {label}
        </span>
    );
};

export default SeloConfianca;
