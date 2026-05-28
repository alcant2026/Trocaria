import sys
import os
import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from modelos.modelos_db import Transacao

def realizar_limpeza():
    db = SessionLocal()
    try:
        agora = datetime.datetime.now(datetime.timezone.utc)

        limite_transacoes = agora - datetime.timedelta(days=90)
        transacoes_falhas = db.query(Transacao).filter(
            Transacao.status == "falhou",
            Transacao.data_criacao < limite_transacoes
        ).all()

        count_transacoes = len(transacoes_falhas)
        for t in transacoes_falhas:
            db.delete(t)

        db.commit()
        print(f"Limpeza concluída com sucesso:")
        print(f" - {count_transacoes} transações falhas antigas removidas.")

    except Exception as e:
        db.rollback()
        print(f"Erro durante a limpeza: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    realizar_limpeza()
