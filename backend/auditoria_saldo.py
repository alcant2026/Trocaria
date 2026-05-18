# =============================================================================
# DEPRECATED
# =============================================================================
# Este script esta DEPRECATED porque a Psy Pay nao e instituicao financeira
# e nao segura mais dinheiro de usuarios (Lei 12.865/2013, art. 8o).
# Campos saldo/saldo_caixa nao devem mais ser consultados nem manipulados.
# =============================================================================

from database import SessionLocal
from modelos.modelos_db import Transacao, Usuario
from sqlalchemy import func
from decimal import Decimal

db = SessionLocal()

print("[DEPRECATED] Este script foi descontinuado.")
print("A Psy Pay nao segura dinheiro de usuarios. Nenhum saldo foi consultado.")

# CODIGO LEGADO COMENTADO — consultava saldo_caixa (pool) e depositos PIX
# total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")
# total_pix_concluido = db.query(func.sum(Transacao.valor)).filter(
#     Transacao.tipo == "deposito",
#     Transacao.metodo == "pix",
#     Transacao.status == "concluido"
# ).scalar() or Decimal("0.00")
# print(f"--- RECONCILIAÇÃO ---")
# print(f"Total Liquidez Pool (Virtual): R$ {total_pool}")
# print(f"Total PIX Recebido (Bruto): R$ {total_pix_concluido}")
# saldo_real_estimado = Decimal("1.00")
# prejuizo_retencao = total_pool - saldo_real_estimado
# print(f"Custo de Retenção (Dívida MP): R$ {prejuizo_retencao}")

db.close()
