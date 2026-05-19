# =============================================================================
# DEPRECATED
# =============================================================================
# Este script esta DEPRECATED porque a Trocaria nao e instituicao financeira
# e nao segura mais dinheiro de usuarios (Lei 12.865/2013, art. 8o).
# Campos saldo/saldo_caixa nao devem mais ser manipulados.
# =============================================================================

from database import SessionLocal
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from decimal import Decimal

def compensar():
    print("[DEPRECATED] Este script foi descontinuado.")
    print("A Trocaria nao segura dinheiro de usuarios. Nenhum saldo foi alterado.")
    return

    # CODIGO LEGADO COMENTADO — manipulava saldo/saldo_caixa da plataforma
    # db = SessionLocal()
    # try:
    #     plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    #     if not plataforma:
    #         print("Plataforma não encontrada.")
    #         return
    #
    #     aportes = db.query(Transacao).filter(
    #         Transacao.tipo == TipoTransacao.APORTE_CAPITAL,
    #         Transacao.detalhes.like("%APORTE EXTERNO%")
    #     ).all()
    #
    #     total_compensar = sum([t.valor for t in aportes])
    #     
    #     if total_compensar > 0:
    #         print(f"Encontramos R$ {total_compensar} em aportes institucionais no caixa livre.")
    #         # REMOVIDO: manipulacao de saldo descontinuada
    #         # plataforma.saldo -= total_compensar
    #         # plataforma.saldo_caixa += total_compensar
    #         for t in aportes:
    #             t.detalhes = t.detalhes.replace("APORTE EXTERNO", "APORTE (MIGRADO P/ POOL)")
    #         db.commit()
    #         print("✅ Correção aplicada. R$ movido para o Pool com sucesso.")
    #     else:
    #         print("Nenhum aporte antigo encontrado para corrigir.")
    # finally:
    #     db.close()

if __name__ == "__main__":
    compensar()
