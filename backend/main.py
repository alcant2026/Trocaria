from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from rotas import rotas_auth, rotas_emprestimo, rotas_score, rotas_investidor, rotas_financeiro, rotas_snapshot
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
]

if frontend_url:
    # Suporte a múltiplas URLs separadas por vírgula
    for url in frontend_url.split(","):
        clean_url = url.strip().rstrip("/")
        if clean_url:
            origins.append(clean_url)

# Remover duplicatas mantendo a ordem
origins = list(dict.fromkeys(origins))

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

# Dependência do DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def startup_db_setup():
    # 1. Garante que tabelas novas sejam criadas
    Base.metadata.create_all(bind=engine)
    
    # 2. Sincroniza colunas novas automaticamente (Auto-Sync)
    try:
        sincronizar_esquema(Base, engine)
        
        # 3. Garantir que os tipos ENUM no Postgres tenham os novos valores
        if "sqlite" not in str(engine.url):
            from modelos.modelos_db import TipoTransacao, StatusSolicitacao
            with engine.connect() as conn:
                for enum_class, type_name in [(TipoTransacao, "tipotransacao"), (StatusSolicitacao, "statussolicitacao")]:
                    for member in enum_class:
                        try:
                            # Tenta adicionar o valor minúsculo (padrão do código)
                            conn.execute(text(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{member.value}'"))
                            # Tenta adicionar o valor maiúsculo (legado/segurança)
                            conn.execute(text(f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{member.name}'"))
                            conn.commit()
                        except Exception:
                            pass
    except Exception as e:
        print(f"ERRO CRÍTICO NA SINCRONIA DE DB: {e}")

    print("ESTRUTURA DB: Sincronização automática finalizada.")

# Incluir Rotas
app.include_router(rotas_auth.router)
app.include_router(rotas_emprestimo.router)
app.include_router(rotas_score.router)
app.include_router(rotas_investidor.router)
app.include_router(rotas_financeiro.router)
app.include_router(rotas_snapshot.router)

@app.get("/")
def home():
    return {"message": "Bem-vindo ao Peer API!", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
