import sys
import os
sys.path.append(os.path.join(os.getcwd()))
from database import SessionLocal
from modelos.modelos_db import Parceiro

db = SessionLocal()
parceiros = db.query(Parceiro).all()

print(f"{'ID':<5} {'Nome':<20} {'MP Conectado':<15} {'Ativo':<10}")
print("-" * 50)
for p in parceiros:
    mp_status = "SIM" if p.mp_access_token else "NÃO"
    print(f"{p.id:<5} {p.nome:<20} {mp_status:<15} {p.is_active:<10}")

db.close()
