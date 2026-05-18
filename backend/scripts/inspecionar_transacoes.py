# =============================================================================
# DEPRECATED
# =============================================================================
# Este script esta DEPRECATED porque a Psy Pay nao e instituicao financeira
# e nao segura mais dinheiro de usuarios (Lei 12.865/2013, art. 8o).
# Campos saldo/saldo_caixa nao devem mais ser exibidos nem manipulados.
# =============================================================================

import os
import sys
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

# Adicionar o diretório pai ao path para importar os módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modelos.modelos_db import Usuario, Transacao, TipoTransacao, engine

def inspecionar_transacoes():
    with Session(engine) as db:
        print(f"--- Inspeção de Transações (Agora é {datetime.now()}) ---")
        print("[AVISO] A Psy Pay nao segura saldo de usuarios. Exibindo apenas registros de transacoes.")
        
        # Todas as transações de Assinatura
        assinaturas = db.query(Transacao).filter(Transacao.tipo == TipoTransacao.ASSINATURA).all()
        print(f"\nTotal de transações de ASSINATURA: {len(assinaturas)}")
        for t in assinaturas:
            print(f"ID: {t.id}, Valor: {t.valor}, Data: {t.data_criacao}, Status: {t.status}")

        # Todas as transações concluídas hoje e no mês
        agora = datetime.now(timezone.utc)
        primeiro_dia_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        receitas_mes = db.query(Transacao).filter(
            Transacao.status == "concluido",
            Transacao.data_criacao >= primeiro_dia_mes
        ).all()
        
        print(f"\nTotal de receitas CONCLUÍDAS no mês (desde {primeiro_dia_mes}): {len(receitas_mes)}")
        for t in receitas_mes:
            print(f"ID: {t.id}, Tipo: {t.tipo}, Valor: {t.valor}, Data: {t.data_criacao}")

        # REMOVIDO: leitura de saldo/saldo_caixa descontinuada
        # plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        # if plataforma:
        #     print(f"\nSaldo da Plataforma (000PL): R$ {plataforma.saldo}")
        #     print(f"Saldo Pool da Plataforma: R$ {plataforma.saldo_caixa}")

if __name__ == "__main__":
    inspecionar_transacoes()
