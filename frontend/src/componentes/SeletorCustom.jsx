import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const SeletorCustom = ({ label, options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const triggerId = `select-trigger-${label.toLowerCase().replace(/\s+/g, '-')}`;

    // Fechar ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue) => {
        onChange({ target: { name: label.toLowerCase() === 'uf' ? 'estado' : 'cidade', value: optionValue } });
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const selectedOption = options.find(opt => (opt.sigla || opt.nome) === value);
    const displayValue = selectedOption ? (selectedOption.sigla || selectedOption.nome) : placeholder;

    return (
        <div className="custom-select-container" ref={containerRef} style={{ opacity: disabled ? 0.6 : 1 }}>
            <label id={`${triggerId}-label`} htmlFor={triggerId} className="custom-select-label">
                {label}
            </label>
            <button
                id={triggerId}
                type="button"
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-labelledby={`${triggerId}-label`}
                className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '16px'
                }}
            >
                <span>{displayValue}</span>
                <ChevronDown size={18} className={`chevron ${isOpen ? 'rotate' : ''}`} style={{ transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {isOpen && (
                <ul
                    role="listbox"
                    aria-labelledby={`${triggerId}-label`}
                    className="custom-select-options"
                    style={{
                        listStyle: 'none',
                        margin: 0,
                        padding: '4px',
                        background: '#161618',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        position: 'absolute',
                        width: '100%',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        marginTop: '4px',
                        boxShadow: 'var(--shadow)'
                    }}
                >
                    {options.length === 0 ? (
                        <li className="custom-select-no-data" style={{ padding: '10px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                            Nenhum dado encontrado
                        </li>
                    ) : (
                        options.map((opt, index) => {
                            const val = opt.sigla || opt.nome;
                            const isSelected = val === value;
                            return (
                                <li
                                    key={index}
                                    role="option"
                                    aria-selected={isSelected}
                                    tabIndex={0}
                                    className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelect(val)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleSelect(val);
                                        }
                                    }}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        fontSize: '0.85rem',
                                        color: isSelected ? '#000' : 'var(--text-main)',
                                        background: isSelected ? 'var(--primary)' : 'transparent',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        marginBottom: '2px',
                                        transition: 'background 0.2s ease'
                                    }}
                                >
                                    {val}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
};

export default SeletorCustom;
