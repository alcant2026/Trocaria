from database import SessionLocal
from modelos.modelos_db import Transacao, Usuario
from sqlalchemy import func
from decimal import Decimal

db = SessionLocal()

# 1. Somar Liquidez do Pool (O que deveria estar no banco)
total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")

# 2. Somar Depósitos PIX Concluídos
total_pix_concluido = db.query(func.sum(Transacao.valor)).filter(
    Transacao.tipo == "deposito",
    Transacao.metodo == "pix",
    Transacao.status == "concluido"
).scalar() or Decimal("0.00")

print(f"--- RECONCILIAÇÃO ---")
print(f"Total Liquidez Pool (Virtual): R$ {total_pool}")
print(f"Total PIX Recebido (Bruto): R$ {total_pix_concluido}")

# Se o saldo real for R$ 1.00 (como informado pelo user), o prejuízo é (Pool - 1.00)
saldo_real_estimado = Decimal("1.00")
prejuizo_retencao = total_pool - saldo_real_estimado

print(f"Custo de Retenção (Dívida MP): R$ {prejuizo_retencao}")

db.close()
