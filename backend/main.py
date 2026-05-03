from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import uvicorn
import os
from database import engine, SessionLocal, Base
from sqlalchemy import text
from utils_db import sincronizar_esquema, executar_limpeza_banco
from rotas import rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro, rotas_snapshot, rotas_parceiros_caixa, rotas_comunidade, rotas_relatorio, rotas_admin_fiscal, rotas_dividendos, rotas_marketplace

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

import time
from collections import defaultdict

# Middleware CORS global (garante headers mesmo em erros)
@app.middleware("http")
async def cors_global(request: Request, call_next):
    response = await call_next(request)
    origin = request.headers.get("origin", "")
    if origin and any(origin.startswith(allowed) for allowed in ["http://localhost", "https://cred30", "https://cred320", "https://psy-pay", "https://peer"]):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

RATE_LIMIT_MUTATION = 20
RATE_LIMIT_WINDOW = 60
mutex_count = defaultdict(list)

@app.middleware("http")
async def rate_limit_mutation(request: Request, call_next):
    if request.method in ("POST", "PUT", "DELETE", "PATCH"):
        client_ip = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for") or request.client.host or "unknown"
        now = time.time()
        window = RATE_LIMIT_WINDOW
        limits = mutex_count[client_ip]
        limits[:] = [t for t in limits if now - t < window]
        if len(limits) >= RATE_LIMIT_MUTATION:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=429, content={"detail": "Muitas requisições. Aguarde e tente novamente."})
        limits.append(now)
    response = await call_next(request)
    return response

CLOUDFLARE_IPS_V4 = [
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22",
    "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
    "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
]
import ipaddress
CLOUDFLARE_NETS = [ipaddress.ip_network(cidr) for cidr in CLOUDFLARE_IPS_V4]

ALLOWED_HOSTS = {"cred30.site", "www.cred30.site", "cred320.site", "www.cred320.site",
                 "psy-pay-front.onrender.com", "psy-pay.onrender.com",
                 "peer-5gq5.onrender.com", "peer-front.onrender.com", "peer.onrender.com",
                 "localhost", "127.0.0.1"}

@app.middleware("http")
async def validate_host(request: Request, call_next):
    if not os.getenv("RENDER"):
        return await call_next(request)
    path = request.url.path
    if path in ("/", "/p", "/__warmup", "/api", "/api/"):
        return await call_next(request)
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    host_clean = host.split(":")[0].lower()
    if host_clean not in ALLOWED_HOSTS:
        return JSONResponse(status_code=403, content={"detail": "Host nao permitido."})
    response = await call_next(request)
    return response

FILE_UPLOAD_MAX_SIZE = 5 * 1024 * 1024

@app.middleware("http")
async def limit_file_upload(request: Request, call_next):
    if request.url.path.startswith("/api/score/") and request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > FILE_UPLOAD_MAX_SIZE:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=413, content={"detail": "Arquivo muito grande. Máximo permitido: 5MB."})
    response = await call_next(request)
    return response

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
            if not db.query(Usuario).filter(Usuario.is_admin == True).first():
                import secrets
                admin_id = "ADM01"
                admin = Usuario(
                    id=admin_id, nome="Admin Psy Pay", email="admin@psypay.com.br",
                    cpf="00000000001", senha_hash=secrets.token_hex(16), chave_pix="admin@psypay.com.br",
                    is_admin=True, is_active=True
                )
                db.add(admin)
                db.commit()
                print("✅ Conta admin criada (ID: ADM01)")
    except Exception as e:
        print(f"⚠️ ERRO no startup_db_setup: {e}")

    # Criar pasta de uploads se não existir
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
        print("📁 Pasta 'uploads' criada com sucesso!")
        
    print("✅ SISTEMA: Pronto para receber tráfego!")

# Cadastro dos roteadores com e sem prefixo /api para compatibilidade
for router_module in [rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro, rotas_snapshot, rotas_parceiros_caixa, rotas_comunidade, rotas_relatorio, rotas_admin_fiscal, rotas_dividendos, rotas_marketplace]:
    app.include_router(router_module.router, prefix="/api")

# Também registra rotas sem /api pra compatibilidade com frontend legado
for router_module in [rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro, rotas_snapshot, rotas_parceiros_caixa, rotas_comunidade, rotas_relatorio, rotas_admin_fiscal, rotas_dividendos, rotas_marketplace]:
    app.include_router(router_module.router)

@app.get("/__warmup")
@app.get("/api/__warmup")
async def warmup():
    return {"status": "ready"}

@app.get("/p")
def ping_curto():
    return {"msg": "servidor_ativo_13h04"}

@app.get("/")
async def root():
    return {"status": "online", "message": "Psy Pay API"}

@app.get("/api")
async def api_root():
    return {"status": "online", "message": "Psy Pay API Gateway"}

# Pasta de uploads servida apenas via rota /api/admin/view-doc (protegida por auth)
# NÃO usar StaticFiles para evitar acesso público a documentos de usuários

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
