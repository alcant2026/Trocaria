import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

load_dotenv()

# Caminho absoluto para o banco SQLite local
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_URL = f"sqlite:///{os.path.join(BASE_DIR, 'cred_plus.db')}"

# DETECÇÃO AUTOMÁTICA DE AMBIENTE
# No Render, a variável de ambiente 'RENDER' é sempre 'true'.
IS_PRODUCTION = os.getenv("RENDER") == "true" or os.getenv("ENVIRONMENT") == "production"

if IS_PRODUCTION:
    # Em produção, exigimos a DATABASE_URL do Neon/Postgres
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
    if not SQLALCHEMY_DATABASE_URL:
        # Fallback de segurança caso a variável não esteja setada na nuvem
        SQLALCHEMY_DATABASE_URL = DEFAULT_DB_URL
    print(f"🌐 AMBIENTE: Produção (Nuvem) - Usando: {SQLALCHEMY_DATABASE_URL.split('@')[-1] if '@' in SQLALCHEMY_DATABASE_URL else 'DB Cloud'}")
else:
    # Localmente, priorizamos o SQLite para não afetar os dados reais
    # Mas permitimos sobrescrever via DATABASE_URL_LOCAL se preferir Postgres local
    SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL_LOCAL", DEFAULT_DB_URL)
    print(f"🏠 AMBIENTE: Local (Desenvolvimento) - Usando: {SQLALCHEMY_DATABASE_URL}")

def normalizar_database_url(url: str) -> str:
    # Ajuste de compatibilidade Heroku/Render.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    if "neon.tech" not in url:
        return url

    parsed = urlsplit(url)
    params = parse_qsl(parsed.query, keep_blank_values=True)

    # Remove parâmetros problemáticos/duplicados e força sslmode único.
    params_filtrados = [(k, v) for k, v in params if k not in {"channel_binding", "sslmode"}]
    params_filtrados.append(("sslmode", "require"))

    nova_query = urlencode(params_filtrados)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, nova_query, parsed.fragment))

# Ajuste para Heroku/Render/Neon.
if SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = normalizar_database_url(SQLALCHEMY_DATABASE_URL)

# Configuração do Engine
is_sqlite = "sqlite" in SQLALCHEMY_DATABASE_URL
is_neon = "neon.tech" in SQLALCHEMY_DATABASE_URL

# Configurações leves para o plano Free do Render/Neon (evita estourar conexões e memória)
pool_args = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}
engine_args = {}

if not is_sqlite:
    pool_args["pool_size"] = 2
    pool_args["max_overflow"] = 3
else:
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    **pool_args,
    **engine_args
)

# Ativar suporte a Foreign Keys no SQLite (necessário para CASCADE DELETE)
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    from sqlalchemy import event
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependência para ser usada nas rotas
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
