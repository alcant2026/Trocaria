"""
migracao_remover_saldo.py

Script de migracao para remover as colunas saldo e saldo_caixa da tabela usuarios.

IMPORTANTE: Este script DEVE ser executado ANTES de remover as colunas do modelo SQLAlchemy,
pois o SQLAlchemy precisa mapear as colunas existentes durante a execucao.

Execucao:
    cd backend
    python scripts/migracao_remover_saldo.py

Compatibilidade: SQLite e PostgreSQL
"""

import os
import sys

# Adiciona o diretorio pai ao path para importar os modulos do backend
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from database import engine, SessionLocal
from sqlalchemy import text, inspect

def migrar():
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        colunas = [c['name'] for c in inspector.get_columns('usuarios')]
        
        db_type = "sqlite" if "sqlite" in str(engine.url) else "postgresql"
        print(f"Detectado banco: {db_type}")
        
        if "saldo" not in colunas and "saldo_caixa" not in colunas:
            print("Colunas saldo e saldo_caixa ja foram removidas. Nada a fazer.")
            return
        
        # 1. Zera todos os saldos antes de remover (limpeza juridica)
        print("Zerando saldos existentes...")
        db.execute(text("UPDATE usuarios SET saldo = 0, saldo_caixa = 0"))
        db.commit()
        print("Saldos zerados.")
        
        # 2. Remove as colunas
        if db_type == "sqlite":
            # SQLite nao suporta DROP COLUMN diretamente em versoes antigas.
            # Usamos a estrategia de recriar a tabela (ALTER TABLE ... RENAME TO ...)
            print("SQLite detectado. Recriando tabela sem as colunas deprecadas...")
            # Nota: em producao com SQLite, recomenda-se usar sqlite3 diretamente ou
            # bibliotecas como sqlite-utils. Aqui vamos apenas instruir.
            print("AVISO: Para SQLite, execute manualmente via sqlite3:")
            print("  .schema usuarios")
            print("  ALTER TABLE usuarios RENAME TO usuarios_old;")
            print("  CREATE TABLE usuarios AS SELECT <colunas exceto saldo/saldo_caixa> FROM usuarios_old;")
            print("  DROP TABLE usuarios_old;")
            print("Pule esta etapa se o banco for SQLite.")
        else:
            # PostgreSQL: DROP COLUMN direto
            if "saldo" in colunas:
                db.execute(text("ALTER TABLE usuarios DROP COLUMN IF EXISTS saldo"))
                print("Coluna 'saldo' removida.")
            if "saldo_caixa" in colunas:
                db.execute(text("ALTER TABLE usuarios DROP COLUMN IF EXISTS saldo_caixa"))
                print("Coluna 'saldo_caixa' removida.")
            db.commit()
        
        print("\nMigracao concluida.")
        print("IMPORTANTE: Agora voce pode remover as linhas 'saldo' e 'saldo_caixa' do modelo Usuario em modelos_db.py")
        
    except Exception as e:
        db.rollback()
        print(f"ERRO na migracao: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("MIGRACAO: Remover colunas saldo/saldo_caixa")
    print("=" * 60)
    confirm = input("Tem certeza que deseja executar? (digite 'REMOVER'): ")
    if confirm.strip() == "REMOVER":
        migrar()
    else:
        print("Abortado.")
