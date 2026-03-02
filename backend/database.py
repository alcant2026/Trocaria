import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()

DEFAULT_DB_URL = "sqlite:///./cred_plus.db"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# Ajuste para Heroku/Render e Neon (SSL e prefixo)
if SQLALCHEMY_DATABASE_URL:
    # SQLAlchemy exige 'postgresql://' ao invés de 'postgres://'
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Limpeza para Neon: Remover channel_binding se presente e garantir sslmode=require
    if "neon.tech" in SQLALCHEMY_DATABASE_URL:
        if "channel_binding=require" in SQLALCHEMY_DATABASE_URL:
            SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("channel_binding=require", "sslmode=require")
        elif "sslmode=" not in SQLALCHEMY_DATABASE_URL:
            separator = "&" if "?" in SQLALCHEMY_DATABASE_URL else "?"
            SQLALCHEMY_DATABASE_URL += f"{separator}sslmode=require"

engine_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(SQLALCHEMY_DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependência para ser usada nas rotas
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
