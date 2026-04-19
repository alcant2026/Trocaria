from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
from rotas import rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro, rotas_snapshot, rotas_parceiros_caixa, rotas_comunidade, rotas_relatorio, rotas_admin_fiscal, rotas_dividendos, rotas_marketplace
from database import engine, SessionLocal, Base
from sqlalchemy import text
from utils_db import sincronizar_esquema, executar_limpeza_banco

app = FastAPI(title="PSY PAY API P2P")

# Configuração de Pastas
os.makedirs("uploads", exist_ok=True)

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

# Configuração de CORS - Deve vir DEPOIS de outros middlewares para executar PRIMEIRO na requisição
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from limitador import limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Middleware para Log de Plataforma (Apenas Log, sem Banco)
@app.middleware("http")
async def log_plataforma(request: Request, call_next):
    plataforma = request.headers.get("X-Platform", "web").upper()
    print(f"📡 [{plataforma}] {request.method} {request.url.path}")
    response = await call_next(request)
    return response

# Dependência do DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def startup_db_setup():
    from database import SQLALCHEMY_DATABASE_URL
    db_type = "SQLite Local" if "sqlite" in SQLALCHEMY_DATABASE_URL else "Postgres Nuvem (Neon)"
    print(f"🚀 SISTEMA: Iniciando processo de boot... [DB: {db_type}]")
    os.makedirs("uploads", exist_ok=True)
    
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"ESTRUTURA DB: Aviso na criação de tabelas (race condition): {e}")

    try:
        sincronizar_esquema(Base, engine)
        executar_limpeza_banco(engine)
        
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
    except Exception:
        pass

    # Criar pasta de uploads se não existir
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
        print("📁 Pasta 'uploads' criada com sucesso!")
        
    print("✅ SISTEMA: Pronto para receber tráfego!")

# Cadastro dos roteadores com e sem prefixo /api para compatibilidade
for router_module in [rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro, rotas_snapshot, rotas_parceiros_caixa, rotas_comunidade, rotas_relatorio, rotas_admin_fiscal, rotas_dividendos, rotas_marketplace]:
    app.include_router(router_module.router, prefix="/api")
    app.include_router(router_module.router)

@app.get("/p")
def ping_curto():
    return {"msg": "servidor_ativo_13h04"}

@app.get("/")
async def root():
    return {"status": "online", "message": "Psy Pay API"}

@app.get("/api")
async def api_root():
    return {"status": "online", "message": "Psy Pay API Gateway"}

# Segurança: Pasta de uploads protegida via rota /api/admin/view-doc
# app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
