from sqlalchemy.orm import Session
from database import SessionLocal
from modelos.modelos_db import Usuario, Parceiro

def sincronizar_tokens():
    db = SessionLocal()
    try:
        parceiros = db.query(Parceiro).all()
        atualizados = 0
        for p in parceiros:
            if p.usuario_id:
                u = db.query(Usuario).filter(Usuario.id == p.usuario_id).first()
                if u and u.mp_access_token:
                    p.mp_access_token = u.mp_access_token
                    p.mp_refresh_token = u.mp_refresh_token
                    p.mp_user_id = u.mp_user_id
                    p.mp_token_expires_at = u.mp_token_expires_at
                    atualizados += 1
        db.commit()
        print(f"✅ Sincronização concluída! {atualizados} parceiros atualizados com tokens do Mercado Pago.")
    finally:
        db.close()

if __name__ == "__main__":
    sincronizar_tokens()
