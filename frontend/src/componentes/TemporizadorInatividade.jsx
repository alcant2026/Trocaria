import React, { useEffect, useRef } from 'react';

const TemporizadorInatividade = ({ aoDeslogar }) => {
    const tempoInatividade = 7 * 60 * 1000; // 7 minutos em milissegundos
    const timerRef = useRef(null);

    const reiniciarTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            aoDeslogar();
        }, tempoInatividade);
    };

    useEffect(() => {
        const eventos = [
            'mousedown',
            'keydown',
            'scroll',
            'touchstart',
            'mousemove',
            'click'
        ];

        // Iniciar o timer na montagem
        reiniciarTimer();

        // Adicionar ouvintes de eventos para reiniciar o timer em qualquer interação
        eventos.forEach(evento => {
            window.addEventListener(evento, reiniciarTimer);
        });

        // Limpeza ao desmontar
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            eventos.forEach(evento => {
                window.removeEventListener(evento, reiniciarTimer);
            });
        };
    }, [aoDeslogar]);

    return null; // Este componente não renderiza nada visualmente
};

export default TemporizadorInatividade;
