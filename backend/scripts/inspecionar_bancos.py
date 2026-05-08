"""
🦅 PSY PAY — Inspetor de Banco de Dados
Roda localmente para ver o que tem no banco (SQLite ou Neon).
Para usar com o Neon: defina DATABASE_URL no .env antes de rodar.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from sqlalchemy import text

def separador(titulo=""):
    print(f"\n{'='*55}")
    if titulo: print(f"  {titulo}")
    print('='*55)

def q(db, sql):
    try:
        result = db.execute(text(sql))
        return result.fetchall()
    except Exception as e:
        return [("ERRO:", str(e))]

db = SessionLocal()

separador("👤 USUÁRIOS")
usuarios = q(db, "SELECT id, nome, email, is_admin, is_verified, saldo, saldo_caixa, score FROM usuarios")
print(f"{'ID':<8} {'Nome':<25} {'Admin':<6} {'Verif':<6} {'Saldo':>10} {'Pool':>10} {'Score':>6}")
print("-"*75)
for u in usuarios:
    print(f"{str(u[0]):<8} {str(u[1]):<25} {str(u[3]):<6} {str(u[4]):<6} {float(u[5] or 0):>10.2f} {float(u[6] or 0):>10.2f} {float(u[7] or 0):>6.1f}")

separador("💸 TRANSAÇÕES (últimas 10)")
trans = q(db, "SELECT id, usuario_id, tipo, valor, status, data_criacao FROM transacoes ORDER BY id DESC LIMIT 10")
print(f"{'ID':<6} {'Usuário':<8} {'Tipo':<25} {'Valor':>10} {'Status':<12}")
print("-"*65)
for t in trans:
    print(f"{t[0]:<6} {str(t[1]):<8} {str(t[2]):<25} {float(t[3] or 0):>10.2f} {str(t[4]):<12}")

total_trans = q(db, "SELECT COUNT(*), SUM(valor) FROM transacoes WHERE status='concluido'")
print(f"\n→ Total concluídas: {total_trans[0][0]} | Volume: R$ {float(total_trans[0][1] or 0):.2f}")

separador("🏦 EMPRÉSTIMOS")
emp = q(db, "SELECT id, usuario_id, valor, status, taxa_mensal FROM solicitacoes_emprestimo ORDER BY id DESC LIMIT 10")
print(f"{'ID':<6} {'Usuário':<8} {'Valor':>10} {'Taxa%':>6} {'Status':<15}")
print("-"*50)
for e in emp:
    print(f"{e[0]:<6} {str(e[1]):<8} {float(e[2] or 0):>10.2f} {float(e[4] or 0):>6.1f} {str(e[3]):<15}")

total_emp = q(db, "SELECT COUNT(*), SUM(valor) FROM solicitacoes_emprestimo WHERE status IN ('aprovado','concluido')")
print(f"\n→ Aprovados/Concluídos: {total_emp[0][0]} | Volume: R$ {float(total_emp[0][1] or 0):.2f}")

separador("🏪 PARCEIROS")
parceiros = q(db, "SELECT id, nome, is_active FROM parceiros")
print(f"{'ID':<5} {'Nome':<20} {'Ativo':<6}")
print("-"*60)
for p in parceiros:
    print(f"{p[0]:<5} {p[1][:20]:<20} {'Sim' if p[2] else 'Nao':<6}")
for p in parceiros:
    print(f"{p[0]:<5} {str(p[1]):<20} {str(p[2]):<6} {str(p[3]):<6} {float(p[4] or 0):>10.2f} {float(p[5] or 0):>10.2f}")

separador("🛍️ LINKS AFILIADOS (Comunidade)")
links = q(db, "SELECT COUNT(*), SUM(visualizacoes_totais) FROM links_afiliados WHERE is_active=1 OR is_active=TRUE")
print(f"→ Links ativos: {links[0][0]} | Views totais: {links[0][1] or 0}")

separador("📊 RESUMO FINANCEIRO GERAL")
saldos = q(db, "SELECT SUM(saldo), SUM(saldo_caixa) FROM usuarios")
depositos = q(db, "SELECT SUM(valor) FROM transacoes WHERE tipo='deposito' AND status='concluido'")
saques = q(db, "SELECT SUM(valor) FROM transacoes WHERE tipo='saque' AND status='concluido'")
lucro_mp = q(db, "SELECT SUM(valor) FROM transacoes WHERE tipo IN ('taxa_intermediacao','taxa_saque','taxa_postagem') AND status='concluido'")

print(f"  Saldo total usuários:  R$ {float(saldos[0][0] or 0):>12.2f}")
print(f"  Saldo total pool:      R$ {float(saldos[0][1] or 0):>12.2f}")
print(f"  Depósitos totais:      R$ {float(depositos[0][0] or 0):>12.2f}")
print(f"  Saques totais:         R$ {float(saques[0][0] or 0):>12.2f}")
print(f"  Taxas/Lucro plataforma:R$ {float(lucro_mp[0][0] or 0):>12.2f}")

separador("✅ FIM DA INSPEÇÃO")
db.close()
