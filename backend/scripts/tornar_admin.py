"""
Script para promover um usuário a administrador no banco local (SQLite).

Usa o módulo 'sqlite3' da stdlib — sem dependências extras.

Uso (dentro da pasta backend):
    python scripts/tornar_admin.py
"""

import sqlite3
import os

# Caminho padrão do banco SQLite local (relativo à pasta backend)
CAMINHO_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cred_plus.db")
EMAIL_ALVO = "josiassm701@gmail.com"


def tornar_admin(email: str, caminho_db: str):
    if not os.path.exists(caminho_db):
        print(f"[ERRO] Banco de dados não encontrado em: {caminho_db}")
        print("       Verifique se o backend já foi iniciado pelo menos uma vez para criar o banco.")
        return

    conn = sqlite3.connect(caminho_db)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT id, nome, is_admin FROM usuarios WHERE email = ?", (email,))
        resultado = cursor.fetchone()

        if not resultado:
            print(f"[ERRO] Nenhum usuário encontrado com o e-mail: {email}")
            return

        user_id, nome, is_admin = resultado

        if is_admin:
            print(f"[INFO] O usuário '{nome}' ({email}) já é administrador.")
            return

        cursor.execute("UPDATE usuarios SET is_admin = 1 WHERE id = ?", (user_id,))
        conn.commit()
        print(f"[OK] '{nome}' ({email}) agora é ADMINISTRADOR!")

    except sqlite3.Error as e:
        print(f"[ERRO] Falha no banco de dados: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    print(f"=> Conectando ao banco: {CAMINHO_DB}")
    tornar_admin(EMAIL_ALVO, CAMINHO_DB)
