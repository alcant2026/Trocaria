from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
import uvicorn
import os
from database import engine, SessionLocal, Base
from sqlalchemy import text
from utils_db import sincronizar_esquema
from rotas import (
    rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro, 
    rotas_snapshot, rotas_comunidade, rotas_admin_fiscal, 
    rotas_marketplace, rotas_storage, rotas_compliance, rotas_disputas,
    rotas_resgate
)

app = FastAPI(title="TROCARIA API P2P")

# Configuração de Pastas
os.makedirs("uploads", exist_ok=True)
os.makedirs("static", exist_ok=True)

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
    "https://trocaria-front.onrender.com",
    "https://trocaria.onrender.com",
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

# Compressão GZIP - reduz banda de rede no Render (essencial para free tier)
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5)

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

RATE_LIMIT_MUTATION = 20
RATE_LIMIT_WINDOW = 60
mutex_count = defaultdict(list)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(self)"
    if not request.url.path.startswith("/api/"):
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://peer-5gq5.onrender.com http://localhost:*"
    return response

@app.middleware("http")
async def block_suspicious_ips(request: Request, call_next):
    """Bloqueia IPs suspeitos e requisições de países sancionados."""
    from utils_seguranca import verificar_ip_suspeito
    client_ip = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for") or request.client.host or "unknown"
    resultado = verificar_ip_suspeito(client_ip)
    if resultado["bloqueado"]:
        return JSONResponse(
            status_code=403,
            content={"detail": f"Acesso negado: {resultado['motivo']}. Contate suporte@trocaria.com.br se acredita que isto é um erro."}
        )
    return await call_next(request)

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
                 "trocaria-front.onrender.com", "trocaria.onrender.com",
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

FILE_UPLOAD_MAX_SIZE = 2 * 1024 * 1024

@app.middleware("http")
async def limit_file_upload(request: Request, call_next):
    if request.url.path.startswith("/api/score/") and request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > FILE_UPLOAD_MAX_SIZE:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=413, content={"detail": "Arquivo muito grande. Máximo permitido: 5MB."})
    response = await call_next(request)
    return response

# Middleware para Log de Plataforma (silencioso em producao)
@app.middleware("http")
async def log_plataforma(request: Request, call_next):
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
    db_type = "SQLite" if "sqlite" in SQLALCHEMY_DATABASE_URL else "Postgres"
    is_render = os.getenv("RENDER") == "true"
    
    # No Render Free, logs consomem recursos - manter apenas essenciais
    print(f"🚀 Boot [{db_type}] {'[Render]' if is_render else '[Local]'}")
    os.makedirs("uploads", exist_ok=True)
    
    try:
        Base.metadata.create_all(bind=engine)
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
            # REMOVIDO: Conta 000PL nao e mais criada automaticamente.
            # A Trocaria nao segura dinheiro de usuarios (Lei 12.865/2013).
            # Taxas sao recebidas diretamente na conta bancaria da empresa (CNPJ).
            if not db.query(Usuario).filter(Usuario.is_admin == True).first():
                import secrets
                admin = Usuario(
                    id="ADM01", nome="Admin Trocaria", email="admin@trocaria.com.br",
                    cpf="00000000001", senha_hash=secrets.token_hex(16), chave_pix="admin@trocaria.com.br",
                    is_admin=True, is_active=True
                )
                db.add(admin)
                db.commit()
                print("✅ Conta admin criada")
    except Exception as e:
        print(f"⚠️ Boot erro: {e}")

    # Rotina de limpeza automática (a cada 7 dias, em background)
    import asyncio
    async def rotina_limpeza_storage():
        await asyncio.sleep(120)  # Espera o servidor estabilizar
        while True:
            try:
                from database import SessionLocal
                from utils_storage import limpar_storage_global
                from concurrent.futures import ThreadPoolExecutor
                def _cleanup():
                    db = SessionLocal()
                    try:
                        economia = limpar_storage_global(db)
                        if economia > 0:
                            print(f"🧹 Limpeza: {economia:.2f} MB liberados")
                    finally:
                        db.close()
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, _cleanup)
            except Exception:
                pass
            await asyncio.sleep(604800)  # 7 dias
    
    if is_render:
        asyncio.create_task(rotina_limpeza_storage())
    
    from utils_ranking import rotina_reset_ranking
    asyncio.create_task(rotina_reset_ranking())
    print("✅ Online")

# Cadastro dos roteadores com e sem prefixo /api para compatibilidade
ROUTER_MODULES = [
    rotas_auth, rotas_emprestimo, rotas_score, rotas_financeiro,
    rotas_snapshot, rotas_comunidade, rotas_admin_fiscal,
    rotas_marketplace, rotas_storage, rotas_compliance, rotas_disputas,
    rotas_resgate
]
for module in ROUTER_MODULES:
    app.include_router(module.router, prefix="/api")
for module in ROUTER_MODULES:
    app.include_router(module.router)

@app.get("/__warmup")
@app.get("/api/__warmup")
async def warmup():
    return {"status": "ready"}

@app.get("/p")
def ping_curto():
    return {"msg": "servidor_ativo_13h04"}

@app.get("/")
async def root():
    return {"status": "online", "message": "Trocaria API"}

@app.get("/api")
async def api_root():
    return {"status": "online", "message": "Trocaria API Gateway"}

@app.get("/robots.txt")
async def robots():
    return PlainTextResponse("User-agent: *\nAllow: /\nSitemap: https://peer-5gq5.onrender.com/sitemap.xml\n")

@app.get("/sitemap.xml")
async def sitemap():
    from fastapi.responses import Response
    xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://peer-5gq5.onrender.com/</loc><lastmod>2026-05-03</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>'
    return Response(content=xml, media_type="application/xml")

# Pasta de uploads servida apenas via rota /api/admin/view-doc (protegida por auth)
# NÃO usar StaticFiles para evitar acesso público a documentos de usuários

# Imagens de anuncios sao publicas (estilo OLX)
from fastapi.responses import FileResponse
import mimetypes

@app.get("/uploads/anuncios/{filename}")
async def servir_imagem_anuncio(filename: str):
    caminho = os.path.join("uploads", "anuncios", filename)
    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="Imagem nao encontrada.")
    content_type, _ = mimetypes.guess_type(caminho)
    return FileResponse(caminho, media_type=content_type or "image/jpeg")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
