"""
Promover usuario a admin no banco (SQLite local ou Neon producao).
Uso: python scripts/tornar_admin.py [email]
Se nao passar email, usa padrao josiassm701@gmail.com
Para forçar Neon: DATABASE_URL=postgresql://... python scripts/tornar_admin.py email@alvo.com
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

EMAIL = sys.argv[1] if len(sys.argv) > 1 else "josiassm701@gmail.com"

# Tenta Neon primeiro, fallback SQLite
URL = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URL_LOCAL")
if not URL:
    URL = f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'cred_plus.db')}"

from database import normalizar_database_url
URL = normalizar_database_url(URL)
from sqlalchemy import create_engine, text
engine = create_engine(URL, pool_pre_ping=True)

print(f"Conectando em: {URL.split('@')[-1].split('?')[0] if '@' in URL else URL}")
print(f"Alvo: {EMAIL}")

with engine.connect() as conn:
    result = conn.execute(text("SELECT id, nome, is_admin FROM usuarios WHERE email = :e"), {"e": EMAIL})
    row = result.fetchone()
    if not row:
        print(f"ERRO: nenhum usuario com email {EMAIL}")
        sys.exit(1)
    uid, nome, is_admin = row
    if is_admin:
        print(f"{nome} ({EMAIL}) ja eh admin.")
    else:
        conn.execute(text("UPDATE usuarios SET is_admin = TRUE WHERE id = :id"), {"id": uid})
        conn.commit()
        print(f"{nome} ({EMAIL}) agora eh ADMIN!")
