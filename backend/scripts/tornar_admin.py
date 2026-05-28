"""
Script para tornar um usuário administrador no banco Neon (nuvem).
USO: python scripts/tornar_admin.py <email ou cpf ou id>
     python scripts/tornar_admin.py --list
"""
import sys
import os

# NÃO importar database.py (carregaria SQLite local)
# Conectar diretamente no Neon
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker, declarative_base

NEON_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://neondb_owner:npg_R7qJxsDw1INV@ep-red-glitter-ap0sy5tv-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"
)

# Normalizar URL (postgres -> postgresql)
if NEON_URL.startswith("postgres://"):
    NEON_URL = NEON_URL.replace("postgres://", "postgresql://", 1)

engine = sa.create_engine(NEON_URL, pool_pre_ping=True, pool_size=1, max_overflow=2)
Session = sessionmaker(bind=engine)

# Modelo local (apenas o necessário)
Base = declarative_base()

class Usuario(Base):
    __tablename__ = "usuarios"
    id = sa.Column(sa.String(5), primary_key=True)
    nome = sa.Column(sa.String(255))
    email = sa.Column(sa.String(255))
    cpf = sa.Column(sa.String(14))
    is_admin = sa.Column(sa.Boolean, default=False)
    is_active = sa.Column(sa.Boolean, default=True)
    data_aceite = sa.Column(sa.DateTime, nullable=True)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("USO: python scripts/tornar_admin.py <email ou cpf ou id>")
        print("     python scripts/tornar_admin.py --list")
        sys.exit(1)

    db = Session()
    try:
        arg = sys.argv[1].strip()

        if arg == "--list":
            usuarios = db.query(Usuario).order_by(Usuario.data_aceite.desc().nullslast()).limit(30).all()
            if not usuarios:
                print("Nenhum usuario encontrado no Neon.")
            else:
                print(f"{'ID':<6} {'Nome':<25} {'CPF':<15} {'Email':<35} {'Admin':<6}")
                print("-" * 90)
                for u in usuarios:
                    print(f"{u.id:<6} {u.nome[:24]:<25} {u.cpf:<15} {(u.email or ''):<35} {'SIM' if u.is_admin else 'nao':<6}")
            sys.exit(0)

        usuario = (
            db.query(Usuario)
            .filter((Usuario.email == arg) | (Usuario.cpf == arg) | (Usuario.id == arg))
            .first()
        )

        if not usuario:
            print(f"Usuario nao encontrado: {arg}")
            print("Use --list para ver os usuarios disponiveis.")
            sys.exit(1)

        if usuario.is_admin:
            print(f"{usuario.nome} ({usuario.email}) ja e administrador.")
        else:
            usuario.is_admin = True
            db.commit()
            print(f"{usuario.nome} ({usuario.email}) agora e administrador!")

    finally:
        db.close()
