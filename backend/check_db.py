from modelos.modelos_db import SessionLocal, Transacao, Usuario
from sqlalchemy import desc

def check_transactions():
    db = SessionLocal()
    try:
        # Pega as últimas 5 transações
        transacoes = db.query(Transacao).order_by(desc(Transacao.id)).limit(5).all()
        print("--- ÚLTIMAS TRANSAÇÕES ---")
        for t in transacoes:
            print(f"ID: {t.id} | Usuário: {t.usuario_id} | Valor: {t.valor} | Tipo: {t.tipo} | Status: {t.status} | Detalhes: {t.detalhes}")
            
        # Pega o usuário 367MD (mencionado nos logs anteriores) ou o último que fez transação
        if transacoes:
            uid = transacoes[0].usuario_id
            user = db.query(Usuario).filter(Usuario.id == uid).first()
            if user:
                print(f"\n--- USUÁRIO {uid} ---")
                print(f"Nome: {user.nome} | Saldo: {user.saldo} | Score: {user.score}")
    finally:
        db.close()

if __name__ == "__main__":
    check_transactions()
