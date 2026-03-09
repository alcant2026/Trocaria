from database import SessionLocal
from modelos.modelos_db import Usuario
from decimal import Decimal

def check_plataforma():
    db = SessionLocal()
    try:
        u = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if u:
            print(f"PLATA: id={u.id}, saldo={u.saldo}, caixa={u.saldo_caixa}")
        else:
            print("PLATA: Não encontrado!")
            
        a = db.query(Usuario).filter(Usuario.id == "367MD").first()
        if a:
            print(f"ADMIN: id={a.id}, saldo={a.saldo}, caixa={a.saldo_caixa}")
        else:
            print("ADMIN: Não encontrado!")
    finally:
        db.close()

if __name__ == "__main__":
    check_plataforma()
