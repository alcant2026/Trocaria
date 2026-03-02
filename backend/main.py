from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from rotas import rotas_auth, rotas_emprestimo, rotas_score, rotas_investidor, rotas_financeiro
from database import engine, SessionLocal, Base
from utils_db import sincronizar_esquema

# Criar tabelas iniciais
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Peer API P2P")

# Configuração de CORS - Aceita Front de Produção ou Local
origins = [
    "https://peer-front.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173", # Vite default
    "http://127.0.0.1:3000",
]

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
def startup_db_setup():
    # 1. Garante que tabelas novas sejam criadas
    Base.metadata.create_all(bind=engine)
    
    # 2. Sincroniza colunas novas automaticamente (Auto-Sync)
    try:
        sincronizar_esquema(Base, engine)
    except Exception as e:
        print(f"ERRO CRÍTICO NA SINCRONIA DE DB: {e}")

    print("ESTRUTURA DB: Sincronização automática finalizada.")

# Incluir Rotas
app.include_router(rotas_auth.router)
app.include_router(rotas_emprestimo.router)
app.include_router(rotas_score.router)
app.include_router(rotas_investidor.router)
app.include_router(rotas_financeiro.router)

@app.get("/")
def home():
    return {"message": "Bem-vindo ao Peer API!", "docs": "/docs"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
