"""
migracao_remover_saldo.py

Script de migracao para remover as colunas saldo e saldo_caixa da tabela usuarios.

Execucao:
    cd backend
    python scripts/migracao_remover_saldo.py

Compatibilidade: SQLite e PostgreSQL
"""

import os
import sys

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
        
        if db_type == "sqlite":
            # SQLite requer recriacao da tabela para remover colunas
            print("SQLite detectado. Recriando tabela sem colunas deprecadas...")
            
            # Colunas que devem ser mantidas (exclui saldo e saldo_caixa)
            colunas_manter = [c for c in colunas if c not in ("saldo", "saldo_caixa")]
            colunas_str = ", ".join(colunas_manter)
            
            db.execute(text("BEGIN TRANSACTION"))
            db.execute(text("ALTER TABLE usuarios RENAME TO usuarios_old"))
            db.execute(text(f"CREATE TABLE usuarios AS SELECT {colunas_str} FROM usuarios_old"))
            
            # Recriar indices e constraints
            db.execute(text("DROP TABLE usuarios_old"))
            db.execute(text("COMMIT"))
            print("Tabela recriada com sucesso (SQLite).")
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
    if len(sys.argv) > 1 and sys.argv[1] == "--force":
        migrar()
    else:
        confirm = input("Tem certeza que deseja executar? (digite 'REMOVER' ou use --force): ")
        if confirm.strip() == "REMOVER":
            migrar()
        else:
            print("Abortado.")
