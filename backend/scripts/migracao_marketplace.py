"""
Migração Trocaria: P2P Lending -> Marketplace
Remove todas as tabelas e colunas P2P do banco de dados.
Uso: python scripts/migracao_marketplace.py
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import engine, SessionLocal
from sqlalchemy import text

TABELAS_P2P = [
    "solicitacoes_emprestimo",
    "contratos_mutuo",
    "disputas",
    "parceiros",
]

COLUNAS_P2P_USUARIOS = [
    "saldo",
    "saldo_caixa",
    "credito_virtual",
    "valor_emprestado",
    "inadimplente",
    "qtd_calotes",
    "emprestimos_ativos",
    "emprestimos_concluidos",
    "ultima_solicitacao",
    "solicitacoes_hoje",
    "limite_credito_personalizado",
    "total_dividendos_ganhos",
]

def migrar():
    db = SessionLocal()
    try:
        # 1. Remover colunas P2P da tabela usuarios
        for coluna in COLUNAS_P2P_USUARIOS:
            try:
                db.execute(text(f"ALTER TABLE usuarios DROP COLUMN {coluna}"))
                print(f"  - Coluna '{coluna}' removida de usuarios")
            except Exception as e:
                if "duplicate column" in str(e).lower() or "no such column" in str(e).lower():
                    print(f"  - Coluna '{coluna}' ja foi removida")
                else:
                    print(f"  - AVISO: {e}")

        # 2. Remover coluna parceiro_id de transacoes
        try:
            db.execute(text("ALTER TABLE transacoes DROP COLUMN parceiro_id"))
            print("  - Coluna 'parceiro_id' removida de transacoes")
        except Exception as e:
            print(f"  - AVISO parceiro_id transacoes: {e}")

        # 3. Remover tabelas P2P
        for tabela in TABELAS_P2P:
            try:
                db.execute(text(f"DROP TABLE IF EXISTS {tabela} CASCADE"))
                print(f"  - Tabela '{tabela}' removida")
            except Exception as e:
                print(f"  - AVISO tabela {tabela}: {e}")

        db.commit()
        print("\nMigração concluída com sucesso!")
        print("AVISO: Backup recomendado antes de rodar em produção.")
    except Exception as e:
        db.rollback()
        print(f"Erro na migração: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    print("Migrando banco de dados: removendo P2P e colunas financeiras...")
    confirm = input("Tem certeza? (s/N): ")
    if confirm.lower() == "s":
        migrar()
    else:
        print("Cancelado.")
