import sqlite3
import re
import os

# Caminho absoluto do banco (sempre relativo à pasta backend)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(BASE_DIR, "cred_plus.db")

print(f"📂 Usando banco: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, nome, cpf FROM usuarios")
    usuarios = cursor.fetchall()
    print(f"📦 Encontrados {len(usuarios)} usuários.")
    
    count = 0
    for row in usuarios:
        user_id, nome, cpf = row
        cpf_limpo = re.sub(r'[^0-9]', '', cpf)
        
        if cpf != cpf_limpo:
            print(f"🔨 Corrigindo CPF de {nome}: {cpf} -> {cpf_limpo}")
            cursor.execute("UPDATE usuarios SET cpf = ? WHERE id = ?", (cpf_limpo, user_id))
            count += 1
            
    if count > 0:
        conn.commit()
        print(f"✅ {count} CPFs corrigidos.")
    else:
        print("✨ Nada a corrigir.")
    
    conn.close()
except Exception as e:
    print(f"❌ Erro: {e}")
