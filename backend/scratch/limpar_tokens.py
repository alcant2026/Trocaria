from database import SessionLocal
from modelos.modelos_db import Usuario, Parceiro

def sincronizar_global():
    db = SessionLocal()
    try:
        # Pega todos os parceiros que têm MP
        parceiros = db.query(Parceiro).filter(Parceiro.mp_access_token != None).all()
        count = 0
        for p in parceiros:
            if p.usuario_id:
                u = db.query(Usuario).filter(Usuario.id == p.usuario_id).first()
                if u:
                    # Garante que o usuário tenha o token do seu registro de parceiro
                    u.mp_access_token = p.mp_access_token
                    u.mp_refresh_token = p.mp_refresh_token
                    u.mp_user_id = p.mp_user_id
                    count += 1
        db.commit()
        print(f"✅ Sincronização concluída! {count} usuários atualizados.")
    finally:
        db.close()

if __name__ == "__main__":
    sincronizar_global()
