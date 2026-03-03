import pytest
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# Adicionar o diretório backend ao sys.path para as importações funcionarem
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from main import app
from database import Base, get_db

# Banco de dados de teste (SQLite em arquivo separado para não misturar com o real)
SQLALCHEMY_DATABASE_URL = "sqlite:///./teste_cred_plus.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    # Criar tabelas no banco de teste
    Base.metadata.create_all(bind=engine)
    yield
    # Limpar banco de teste após todos os testes (opcional)
    if os.path.exists("./teste_cred_plus.db"):
        os.remove("./teste_cred_plus.db")

@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
