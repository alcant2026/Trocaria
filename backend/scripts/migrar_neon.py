"""Sincroniza o schema do Neon DB com os modelos atuais.
Remove tabelas/colunas que foram deletadas do modelos_db.py.
Uso: python scripts/migrar_neon.py

 conecta via DATABASE_URL do .env"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from database import normalizar_database_url

URL = os.getenv("DATABASE_URL")
if not URL:
    print("ERRO: DATABASE_URL nao encontrada no .env")
    sys.exit(1)

URL = normalizar_database_url(URL)
engine = create_engine(URL, pool_pre_ping=True)

print(f"Conectando em: {URL.split('@')[-1].split('?')[0]}...")

with engine.connect() as conn:
    conn.execution_options(isolation_level="AUTOCOMMIT")

    # 1. Remove tabela investimentos
    print("Removendo tabela investimentos...")
    conn.execute(text("DROP TABLE IF EXISTS investimentos CASCADE"))

    # 2. Remove colunas removidas do usuario
    for col in ["chave_pix_publica", "total_receber"]:
        print(f"Removendo coluna usuarios.{col}...")
        try:
            conn.execute(text(f"ALTER TABLE usuarios DROP COLUMN IF EXISTS {col}"))
        except Exception as e:
            print(f"  Aviso: {e}")

    # 3. Remove coluna removida de transacoes
    print("Removendo coluna transacoes.data_liquidacao...")
    try:
        conn.execute(text("ALTER TABLE transacoes DROP COLUMN IF EXISTS data_liquidacao"))
    except Exception as e:
        print(f"  Aviso: {e}")

    conn.commit()

print("Schema atualizado! Rodando sincronizar_esquema...")

from utils_db import sincronizar_esquema
from database import Base
sincronizar_esquema(Base, engine)

print("\nPronto! BD sincronizado com os modelos atuais.")
