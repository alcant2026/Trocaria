import sqlite3
import os

db_path = 'cred_plus.db'
if not os.path.exists(db_path):
    print("Banco de dados não encontrado.")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Adicionar colunas se não existirem
    try:
        cursor.execute("ALTER TABLE links_afiliados ADD COLUMN ponto_min INTEGER DEFAULT 1")
        print("Coluna ponto_min adicionada.")
    except sqlite3.OperationalError:
        print("Coluna ponto_min já existe ou erro ao adicionar.")

    try:
        cursor.execute("ALTER TABLE links_afiliados ADD COLUMN ponto_max INTEGER DEFAULT 1")
        print("Coluna ponto_max adicionada.")
    except sqlite3.OperationalError:
        print("Coluna ponto_max já existe ou erro ao adicionar.")
        
    conn.commit()
    conn.close()
