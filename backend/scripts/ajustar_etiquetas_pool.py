import sys
import os

# Adiciona o diretório pai ao path para importar os módulos do backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import SessionLocal
from modelos.modelos_db import Transacao, TipoTransacao
from sqlalchemy import or_

def ajustar_etiquetas():
    db = SessionLocal()
    try:
        # Buscar transações que contenham a etiqueta errada
        transacoes = db.query(Transacao).filter(
            Transacao.tipo == TipoTransacao.INVESTIMENTO,
            Transacao.detalhes.like("%INVESTIMENTO INSTITUCIONAL (LUCRO)%")
        ).all()

        if not transacoes:
            print("Nenhuma transação com etiqueta (LUCRO) encontrada.")
            return

        print(f"Encontradas {len(transacoes)} transações para ajuste.")
        
        for t in transacoes:
            antigo = t.detalhes
            novo = antigo.replace("(LUCRO)", "(POOL)")
            print(f"Ajustando ID {t.id}:")
            print(f"  DE: {antigo}")
            print(f"  PARA: {novo}")
            t.detalhes = novo

        db.commit()
        print("\nSucesso! Todas as etiquetas foram atualizadas.")
        print("O lucro da plataforma no Dashboard Admin deve agora refletir os valores corretos.")

    except Exception as e:
        db.rollback()
        print(f"Erro ao ajustar etiquetas: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    ajustar_etiquetas()
