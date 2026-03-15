from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from rotas import rotas_auth, rotas_emprestimo, rotas_score, rotas_investidor, rotas_financeiro, rotas_snapshot, rotas_parceiros_caixa
from database import engine, SessionLocal, Base
from sqlalchemy import text
from utils_db import sincronizar_esquema

app = FastAPI(title="Peer API P2P")

# Configuração de CORS - Aceita Front de Produção ou Local
frontend_url = os.getenv("FRONTEND_URL", "")
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "https://cred30.site",
    "https://www.cred30.site",
    "https://peer-front.onrender.com",
]

if frontend_url:
    # Suporte a múltiplas URLs separadas por vírgula
    for url in frontend_url.split(","):
        clean_url = url.strip().rstrip("/")
        if clean_url:
            origins.append(clean_url)

# Remover duplicatas mantendo a ordem
origins = list(dict.fromkeys(origins))

from limitador import limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Middleware de Segurança "Gratuito" (Security Headers)
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # CSP atualizado para incluir cred30.site e domínios do Render
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self' http://localhost:3000 http://localhost:5173 "
        "https://cred30.site https://www.cred30.site "
        "https://peer-front.onrender.com https://peer-api.onrender.com https://peer-5gq5.onrender.com;"
    )
    return response

# CORSMiddleware deve vir DEPOIS de outras middlewares que injetam headers
# para garantir que os headers de CORS não sejam sobrescritos ou removidos.
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
    
    # 1. Garante que tabelas novas sejam criadas (Rápido)
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"ESTRUTURA DB: Aviso na criação de tabelas (race condition): {e}")

    # 2. Sincroniza esquema e enums (Só se necessário)
    try:
        # Sincronia de colunas e índices
        sincronizar_esquema(Base, engine)
        
        # Sincronia de Enums (Postgres)
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

        # 3. Usuário de Sistema
        from modelos.modelos_db import Usuario
        with SessionLocal() as db:
            if not db.query(Usuario).filter(Usuario.id == "000PL").first():
                print("ESTRUTURA DB: Criando usuário de sistema 000PL...")
                novo_sistema = Usuario(
                    id="000PL", nome="Peer Plataforma (Sistema)", email="sistema@peer.com.br",
                    cpf="000.000.000-00", senha_hash="SISTEMA_VIRTUAL", chave_pix="sistema",
                    is_admin=True, is_active=True, saldo=0, saldo_caixa=0
                )
                db.add(novo_sistema)
                db.commit()
    except Exception as e:
        print(f"ERRO NO BOOT DE DB: {e}")

    print("✅ SISTEMA: Pronto para receber tráfego!")

# Incluir Rotas
app.include_router(rotas_auth.router)
app.include_router(rotas_emprestimo.router)
app.include_router(rotas_score.router)
app.include_router(rotas_investidor.router)
app.include_router(rotas_financeiro.router)
app.include_router(rotas_snapshot.router)
app.include_router(rotas_parceiros_caixa.router)

@app.get("/")
def home():
    return {"status": "online", "message": "Peer API ativa"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
