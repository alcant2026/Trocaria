from database import SessionLocal
from modelos.modelos_db import Usuario, Parceiro

db = SessionLocal()
try:
    print("--- USUÁRIOS COM MP ---")
    usuarios = db.query(Usuario).filter(Usuario.mp_access_token != None).all()
    for u in usuarios:
        print(f"ID: {u.id}, Nome: {u.nome}, MP: {u.mp_access_token[:10]}...")
    
    print("\n--- PARCEIROS CADASTRADOS ---")
    parceiros = db.query(Parceiro).all()
    for p in parceiros:
        print(f"ID: {p.id}, Nome: {p.nome}, UsuarioID: {p.usuario_id}, MP Conectado: {bool(p.mp_access_token)}")
finally:
    db.close()
