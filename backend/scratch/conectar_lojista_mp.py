import sys
import os
sys.path.append(os.path.join(os.getcwd()))
from database import SessionLocal
from modelos.modelos_db import Parceiro
from dotenv import load_dotenv

load_dotenv()
mp_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")

if not mp_token:
    print("❌ Erro: MERCADOPAGO_ACCESS_TOKEN não encontrado no .env")
    sys.exit(1)

db = SessionLocal()
# Pega o primeiro parceiro ativo
p = db.query(Parceiro).filter(Parceiro.is_active == True).first()

if p:
    p.mp_access_token = mp_token
    p.mp_user_id = "TEST_USER_ID" # Simulado
    db.commit()
    print(f"✅ Sucesso: Lojista '{p.nome}' (ID: {p.id}) agora está conectado ao Mercado Pago para testes.")
else:
    print("❌ Erro: Nenhum lojista ativo encontrado no banco de dados.")

db.close()
