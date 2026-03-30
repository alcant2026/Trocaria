from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from rotas import rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro, rotas_snapshot, rotas_parceiros_caixa, rotas_comunidade
from database import engine, SessionLocal, Base
from sqlalchemy import text
from utils_db import sincronizar_esquema

app = FastAPI(title="PSY PAY API P2P")

# Configuração de CORS - Aceita Front de Produção, Local e Mobile (Capacitor)
frontend_url = os.getenv("FRONTEND_URL", "")
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://localhost",        # Capacitor Android
    "capacitor://localhost",   # Capacitor iOS
    "https://cred30.site",
    "https://www.cred30.site",
    "https://cred320.site",
    "https://www.cred320.site",
    "https://psy-pay-front.onrender.com",
    "https://psy-pay.onrender.com",
    "https://peer-5gq5.onrender.com",
    "https://peer-front.onrender.com",
    "https://peer.onrender.com",
]

if frontend_url:
    for url in frontend_url.split(","):
        clean_url = url.strip().rstrip("/")
        if clean_url:
            origins.append(clean_url)

origins = list(dict.fromkeys(origins))
print(f"🚀 CORS ORIGINS: {origins}")

from limitador import limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Middleware de Segurança (Simplificado para evitar conflitos de CORS)
# Os headers de segurança podem ser habilitados via Proxy ou em Produção Final.

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependência do DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def startup_db_setup():
    print("🚀 SISTEMA: Iniciando processo de boot...")
    os.makedirs("uploads", exist_ok=True)
    
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"ESTRUTURA DB: Aviso na criação de tabelas (race condition): {e}")

    try:
        sincronizar_esquema(Base, engine)
        
        if "sqlite" not in str(engine.url):
            from modelos.modelos_db import TipoTransacao, StatusSolicitacao
            with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                for enum_class, type_names in [(TipoTransacao, ["tipo_transacao", "tipotransacao"]), 
                                             (StatusSolicitacao, ["status_solicitacao", "statussolicitacao"])]:
                    for type_name in type_names:
                        for member in enum_class:
                            try:
                                conn.execute(text(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{member.value}'"))
                            except Exception: pass

        from modelos.modelos_db import Usuario
        with SessionLocal() as db:
            if not db.query(Usuario).filter(Usuario.id == "000PL").first():
                print("ESTRUTURA DB: Criando usuário de sistema 000PL...")
                novo_sistema = Usuario(
                    id="000PL", nome="PSY PAY Plataforma (Sistema)", email="sistema@psypay.com.br",
                    cpf="00000000000", senha_hash="SISTEMA_VIRTUAL", chave_pix="sistema",
                    is_admin=True, is_active=True, saldo=0, saldo_caixa=0
                )
                db.add(novo_sistema)
                db.commit()
    except Exception as e:
        print(f"ERRO NO BOOT DE DB: {e}")

    # Criar pasta de uploads se não existir
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
        print("📁 Pasta 'uploads' criada com sucesso!")
        
    print("✅ SISTEMA: Pronto para receber tráfego!")

# Incluir Rotas
app.include_router(rotas_auth.router)
app.include_router(rotas_emprestimo.router)
app.include_router(rotas_score.router)
app.include_router(rotas_financeiro.router)
app.include_router(rotas_snapshot.router)
app.include_router(rotas_parceiros_caixa.router)
app.include_router(rotas_comunidade.router)

@app.get("/p")
def ping_curto():
    return {"msg": "servidor_ativo_13h04"}

@app.get("/")
def home():
    return {"status": "online", "message": "PSY PAY API ATIVA - 13:04"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
