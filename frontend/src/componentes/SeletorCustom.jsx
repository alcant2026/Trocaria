import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const SeletorCustom = ({ label, options, value, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

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

    const selectedOption = options.find(opt => (opt.sigla || opt.nome) === value);
    const displayValue = selectedOption ? (selectedOption.sigla || selectedOption.nome) : placeholder;

    return (
        <div className="custom-select-container" ref={containerRef} style={{ opacity: disabled ? 0.6 : 1 }}>
            <label className="custom-select-label">{label}</label>
            <div
                className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <span>{displayValue}</span>
                <ChevronDown size={18} className={`chevron ${isOpen ? 'rotate' : ''}`} />
            </div>

            {isOpen && (
                <div className="custom-select-options">
                    {options.length === 0 ? (
                        <div className="custom-select-no-data">Nenhum dado encontrado</div>
                    ) : (
                        options.map((opt, index) => {
                            const val = opt.sigla || opt.nome;
                            return (
                                <div
                                    key={index}
                                    className={`custom-select-option ${val === value ? 'selected' : ''}`}
                                    onClick={() => handleSelect(val)}
                                >
                                    {val}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default SeletorCustom;
