import sys
import os
from decimal import Decimal

# Adiciona o diretório pai ao path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import SessionLocal
from modelos.modelos_db import Transacao, TipoTransacao, Usuario
from sqlalchemy import func

def diagnostico_lucro():
    db = SessionLocal()
    try:
        print("--- DIAGNÓSTICO DE LUCRO ---")
        
        # 1. Total de Receita (Taxas)
        tipos_receita = [
            TipoTransacao.COMPRA_SCORE, 
            TipoTransacao.DESBLOQUEIO_DADOS, 
            TipoTransacao.TAXA_SAQUE, 
            TipoTransacao.TAXA_INTERMEDIACAO,
            TipoTransacao.APORTE_CAPITAL,
            TipoTransacao.TAXA_POSTAGEM,
            TipoTransacao.RETORNO_INVESTIMENTO
        ]
        
        receitas = db.query(Transacao).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido"
        ).all()
        
        total_receita = sum(t.valor for t in receitas)
        print(f"Total Receita: R$ {total_receita:.2f} ({len(receitas)} transações)")
        for r in receitas:
            print(f"  - ID {r.id}: {r.tipo.name} | R$ {r.valor:.2f} | {r.detalhes}")

        # 2. Total Sacado Lucro
        saques_lucro = db.query(Transacao).filter(
            Transacao.tipo == TipoTransacao.SAQUE,
            Transacao.detalhes.like("RESGATE DE LUCRO %"),
            Transacao.status == "concluido"
        ).all()
        total_saque = sum(s.valor for s in saques_lucro)
        print(f"\nTotal Saque Lucro: R$ {total_saque:.2f} ({len(saques_lucro)} transações)")
        for s in saques_lucro:
            print(f"  - ID {s.id}: R$ {s.valor:.2f} | {s.detalhes}")

        # 3. Total Investido Institucional (O PROBLEMA)
        investimentos_inst = db.query(Transacao).filter(
            Transacao.tipo == TipoTransacao.INVESTIMENTO,
            Transacao.detalhes.like("%LUCRO%"),
            Transacao.status == "concluido"
        ).all()
        total_investido = sum(i.valor for i in investimentos_inst)
        print(f"\nTotal Investido (Subtraído do Lucro): R$ {total_investido:.2f} ({len(investimentos_inst)} transações)")
        for i in investimentos_inst:
            print(f"  - ID {i.id}: R$ {i.valor:.2f} | {i.detalhes}")

        disponivel = total_receita - total_saque - total_investido
        print(f"\n---")
        print(f"TOTAL DISPONÍVEL CALCULADO: R$ {disponivel:.2f}")

    except Exception as e:
        print(f"Erro no diagnóstico: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    diagnostico_lucro()
