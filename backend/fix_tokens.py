import sys
import os
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
from database import SessionLocal
from modelos.modelos_db import Usuario, Parceiro

db = SessionLocal()
parceiros = db.query(Parceiro).all()
for p in parceiros:
    if p.usuario_id:
        user = db.query(Usuario).filter(Usuario.id == p.usuario_id).first()
        if user and user.mp_access_token:
            p.mp_access_token = user.mp_access_token
            p.mp_refresh_token = user.mp_refresh_token
            p.mp_user_id = user.mp_user_id
            p.mp_token_expires_at = user.mp_token_expires_at
            print(f"Token sincronizado para Lojista: {p.nome}")
db.commit()
print("Sincronização concluída.")
