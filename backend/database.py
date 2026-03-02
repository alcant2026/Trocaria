import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

load_dotenv()

DEFAULT_DB_URL = "sqlite:///./cred_plus.db"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

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

engine_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine_args["connect_args"] = {"check_same_thread": False}

# pool_pre_ping=True ajuda a evitar erros de "EOF detected" e conexões inativas
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependência para ser usada nas rotas
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
