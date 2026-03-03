"""
Script para resetar os dados do banco local (SQLite).

MODO PADRÃO (sem flags):
  - Apaga transações, empréstimos, investimentos
  - Zera saldo e score dos usuários
  - PRESERVA as contas de usuários

MODO COMPLETO (--completo):
  - Deleta o arquivo .db inteiro
  - Aguarda o backend recriar tudo do zero
  - NÃO preserva nada

Uso:
    cd backend
    python3 scripts/resetar_dados.py
    python3 scripts/resetar_dados.py --completo
"""

import sqlite3
import os
import sys

CAMINHO_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cred_plus.db")
MODO_COMPLETO = "--completo" in sys.argv


def listar_tabelas(cursor):
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in cursor.fetchall()]


def resetar_financeiro(caminho_db: str):
    print(f"\n{'='*55}")
    print("  ⚠️  RESET FINANCEIRO DO BANCO LOCAL  ⚠️")
    print(f"{'='*55}")
    print(f"  Banco: {caminho_db}")
    print(f"\n  Será apagado:")
    print("    - Todas as transações")
    print("    - Todos os empréstimos e solicitações")
    print("    - Todos os investimentos")
    print("    - Saldo e score de todos os usuários")
    print(f"\n  Contas de usuários serão MANTIDAS.")
    print(f"{'='*55}\n")

    conf = input("  Digite CONFIRMAR para prosseguir: ").strip()
    if conf != "CONFIRMAR":
        print("\n[CANCELADO] Nenhuma alteração foi feita.")
        return

    conn = sqlite3.connect(caminho_db)
    cursor = conn.cursor()
    try:
        tabelas = listar_tabelas(cursor)
        print()

        for tabela in ["transacoes", "investimentos_usuarios", "solicitacoes_emprestimo"]:
            if tabela in tabelas:
                cursor.execute(f"DELETE FROM {tabela}")
                print(f"  [OK] '{tabela}' limpa — {cursor.rowcount} registro(s) removido(s)")
            else:
                print(f"  [AVISO] Tabela '{tabela}' não encontrada, pulando...")

        cursor.execute(
            "UPDATE usuarios SET saldo = 0, score = 0, solicitacoes_hoje = 0, ultima_solicitacao = NULL"
        )
        print(f"  [OK] Saldo e score de {cursor.rowcount} usuário(s) zerados")

        conn.commit()
        print(f"\n  ✅ Reset financeiro concluído!\n")
    except sqlite3.Error as e:
        conn.rollback()
        print(f"\n[ERRO] {e}")
    finally:
        conn.close()


def resetar_completo(caminho_db: str):
    print(f"\n{'='*55}")
    print("  🔥  RESET COMPLETO DO BANCO LOCAL  🔥")
    print(f"{'='*55}")
    print(f"  Banco: {caminho_db}")
    print(f"\n  ATENÇÃO: isto deleta o arquivo do banco inteiro.")
    print("  TODOS os dados serão perdidos, incluindo usuários.")
    print("  O banco será recriado vazio ao iniciar o backend.")
    print(f"{'='*55}\n")

    conf = input("  Digite APAGAR TUDO para confirmar: ").strip()
    if conf != "APAGAR TUDO":
        print("\n[CANCELADO] Nenhuma alteração foi feita.")
        return

    try:
        os.remove(caminho_db)
        print(f"\n  ✅ Banco deletado com sucesso!")
        print("  ➡️  Inicie o backend para recriar as tabelas vazias.\n")
    except FileNotFoundError:
        print(f"\n[AVISO] Arquivo não encontrado: {caminho_db}")
    except Exception as e:
        print(f"\n[ERRO] {e}")


if __name__ == "__main__":
    if not os.path.exists(CAMINHO_DB) and not MODO_COMPLETO:
        print(f"[ERRO] Banco não encontrado em: {CAMINHO_DB}")
        print("       Inicie o backend ao menos uma vez para criar o banco.")
        sys.exit(1)

    if MODO_COMPLETO:
        resetar_completo(CAMINHO_DB)
    else:
        resetar_financeiro(CAMINHO_DB)
