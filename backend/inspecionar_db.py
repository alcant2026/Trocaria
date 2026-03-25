import sqlite3
import os

# Caminho absoluto do banco (sempre relativo à pasta backend)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "cred_plus.db")

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT id, nome, cpf, senha_hash FROM usuarios")
rows = cursor.fetchall()

print(f"--- DATABASE: {db_path} ---")
for row in rows:
    uid, nome, cpf, shash = row
    print(f"ID: [{uid}] | Nome: [{nome}] | CPF: [{cpf}] | Hash: [{shash[:10]}...]")

conn.close()
