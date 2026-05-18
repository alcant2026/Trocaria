import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal

# =============================================================================
# CONFIGURACAO DO BANCO DE TESTES (SQLite em memoria)
# =============================================================================
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

# Monkeypatch do database ANTES de importar qualquer modulo do projeto
import database as _db_module
_db_module.SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
_db_module.engine = create_engine(
    _db_module.SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
from sqlalchemy.orm import sessionmaker
_db_module.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_db_module.engine)

# Agora e seguro importar o restante do projeto
from main import app
from fastapi.testclient import TestClient
from modelos.modelos_db import Base, Usuario, SolicitacaoEmprestimo, ContratoMutuo, Transacao, StatusSolicitacao, TipoTransacao
from sqlalchemy.orm import Session
import rotas.rotas_financeiro as _rf

# Contador global para gerar payment_ids unicos entre todos os testes do modulo
_payment_counter = 0


def _mock_payment_create(*args, **kwargs):
    global _payment_counter
    _payment_counter += 1
    payment_id = str(10000 + _payment_counter)
    return {
        "status": 201,
        "response": {
            "id": payment_id,
            "point_of_interaction": {
                "transaction_data": {
                    "qr_code": "pix-qr-code",
                    "qr_code_base64": "base64data"
                }
            }
        }
    }


def _mock_payment_get(payment_id):
    return {
        "status": 200,
        "response": {
            "id": str(payment_id),
            "status": "approved",
            "transaction_amount": 2.00,
            "fee_details": []
        }
    }


# =============================================================================
# FIXTURES
# =============================================================================
@pytest.fixture(scope="module")
def client():
    """Cria tabelas no SQLite em memoria e fornece um TestClient."""
    Base.metadata.create_all(bind=_db_module.engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=_db_module.engine)


@pytest.fixture(scope="module")
def ctx():
    """Dicionario mutavel para compartilhar estado entre os testes do modulo."""
    return {}


@pytest.fixture(scope="module")
def mock_sdk():
    """Mock do SDK do Mercado Pago para evitar chamadas reais."""
    sdk = MagicMock()
    payment = MagicMock()
    payment.create.side_effect = _mock_payment_create
    payment.get.side_effect = _mock_payment_get
    sdk.payment.return_value = payment

    # Substitui a instancia global do SDK usada pelo webhook
    original_sdk = getattr(_rf, "sdk", None)
    _rf.sdk = sdk
    yield sdk
    _rf.sdk = original_sdk


# =============================================================================
# HELPERS
# =============================================================================
def registrar_usuario(client: TestClient, nome: str, email: str, cpf: str, senha: str, chave_pix: str, telefone: str):
    resp = client.post("/api/auth/registrar", json={
        "nome": nome,
        "email": email,
        "cpf": cpf,
        "senha": senha,
        "chave_pix": chave_pix,
        "telefone": telefone,
        "aceite_termos": True
    })
    assert resp.status_code == 200, f"Erro ao registrar usuario: {resp.text}"
    return resp.json()["usuario_id"]


def login(client: TestClient, cpf: str, senha: str) -> str:
    resp = client.post("/api/auth/login", json={"cpf": cpf, "senha": senha})
    assert resp.status_code == 200, f"Erro no login: {resp.text}"
    return resp.json()["access_token"]


def webhook_aprovado(client: TestClient, payment_id: str):
    """Simula o webhook do Mercado Pago aprovando um pagamento."""
    resp = client.post("/api/financeiro/webhook/mercadopago", json={
        "action": "payment.updated",
        "type": "payment",
        "data": {"id": payment_id}
    })
    assert resp.status_code == 200, f"Erro no webhook: {resp.text}"
    return resp.json()


# =============================================================================
# TESTES DE INTEGRACAO P2P
# =============================================================================
@patch("rotas.rotas_financeiro.get_sdk")
def test_01_criar_solicitacao_emprestimo(mock_get_sdk, client, ctx, mock_sdk):
    """
    1. Tomador registra-se e paga a taxa de publicacao.
    2. Webhook aprova o pagamento -> solicitacao e criada automaticamente.
    """
    mock_get_sdk.return_value = mock_sdk

    # --- Criar tomador ---
    cpf_tomador = "52998224725"
    ctx["id_tomador"] = registrar_usuario(
        client, "Joao Silva", "joao@teste.com", cpf_tomador,
        "senha123", "joao@pix.com", "11999999999"
    )
    ctx["token_tomador"] = login(client, cpf_tomador, "senha123")

    # --- Gerar taxa de solicitacao ---
    resp = client.post(
        "/api/emprestimos/gerar-taxa-solicitacao",
        json={
            "valor": 1000,
            "parcelas": 6,
            "taxa_compensacao": 5,
            "aceite_termos": True,
            "aceite_termos_plataforma": True
        },
        headers={"Authorization": f"Bearer {ctx['token_tomador']}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    ctx["transacao_taxa_id"] = data["transacao_id"]
    ctx["payment_id_taxa"] = data["payment_id"]

    # --- Simular pagamento aprovado via webhook ---
    webhook_aprovado(client, ctx["payment_id_taxa"])

    # --- Verificar se a solicitacao foi criada ---
    db: Session = _db_module.SessionLocal()
    try:
        transacao = db.query(Transacao).filter(Transacao.id == ctx["transacao_taxa_id"]).first()
        assert transacao.status == "concluido"

        solicitacao = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.usuario_id == ctx["id_tomador"]
        ).first()
        assert solicitacao is not None
        assert solicitacao.status == StatusSolicitacao.PENDENTE
        assert float(solicitacao.valor) == 1000.0
        ctx["solicitacao_id"] = solicitacao.id
    finally:
        db.close()


@patch("rotas.rotas_financeiro.get_sdk")
def test_02_aceitar_oferta_ciencia_risco(mock_get_sdk, client, ctx, mock_sdk):
    """
    Investidor aceita oferta, passa pela ciencia de risco e paga taxa de match.
    Webhook aprova -> pedido fica APROVADO.
    """
    mock_get_sdk.return_value = mock_sdk

    # --- Criar investidor ---
    cpf_investidor = "11144477735"
    ctx["id_investidor"] = registrar_usuario(
        client, "Maria Souza", "maria@teste.com", cpf_investidor,
        "senha123", "maria@pix.com", "11888888888"
    )
    ctx["token_investidor"] = login(client, cpf_investidor, "senha123")

    # --- Tentar aceitar sem ciencia de risco ---
    resp = client.post(
        f"/api/emprestimos/aceitar-oferta/{ctx['solicitacao_id']}",
        json={"aceite_termos_plataforma": True},
        headers={"Authorization": f"Bearer {ctx['token_investidor']}"}
    )
    assert resp.status_code == 200
    assert resp.json().get("requer_ciencia_risco") is True

    # --- Aceitar ciencia de risco ---
    resp = client.post(
        f"/api/emprestimos/aceitar-ciencia-risco/{ctx['solicitacao_id']}",
        headers={"Authorization": f"Bearer {ctx['token_investidor']}"}
    )
    assert resp.status_code == 200
    assert resp.json().get("contrato_id") is not None
    ctx["contrato_id"] = resp.json()["contrato_id"]

    # --- Aceitar oferta (cria transacao de match pendente) ---
    resp = client.post(
        f"/api/emprestimos/aceitar-oferta/{ctx['solicitacao_id']}",
        json={"aceite_termos_plataforma": True},
        headers={"Authorization": f"Bearer {ctx['token_investidor']}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    ctx["transacao_match_id"] = data["transacao_id"]
    ctx["payment_id_match"] = data["payment_id"]

    # --- Simular pagamento da taxa de match via webhook ---
    webhook_aprovado(client, ctx["payment_id_match"])

    # --- Verificar que pedido esta APROVADO ---
    db: Session = _db_module.SessionLocal()
    try:
        solicitacao = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.id == ctx["solicitacao_id"]
        ).first()
        assert solicitacao.status == StatusSolicitacao.APROVADO
        assert solicitacao.credor_id == ctx["id_investidor"]
    finally:
        db.close()


def test_03_obter_chave_pix_tomador(client, ctx):
    """
    Investidor consulta a chave PIX do tomador para transferencia direta.
    """
    resp = client.get(
        f"/api/emprestimos/chave-pix/{ctx['solicitacao_id']}",
        headers={"Authorization": f"Bearer {ctx['token_investidor']}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["chave_pix"] == "joao@pix.com"
    assert data["pedido_id"] == ctx["solicitacao_id"]


def test_04_registrar_transferencia_investidor(client, ctx):
    """
    Investidor registra que transferiu o dinheiro via PIX direto ao tomador.
    """
    resp = client.post(
        f"/api/emprestimos/registrar-transferencia/{ctx['solicitacao_id']}",
        headers={"Authorization": f"Bearer {ctx['token_investidor']}"}
    )
    assert resp.status_code == 200
    assert "registrada" in resp.json()["message"].lower()

    # Verificar transacao de confirmacao no banco
    db: Session = _db_module.SessionLocal()
    try:
        trans = db.query(Transacao).filter(
            Transacao.detalhes.like(f"%TRANSFERENCIA_REALIZADA:{ctx['solicitacao_id']}%")
        ).first()
        assert trans is not None
        assert trans.tipo == TipoTransacao.CONFIRMACAO_PAGAMENTO
    finally:
        db.close()


def test_05_registrar_recebimento_tomador(client, ctx):
    """
    Tomador confirma que recebeu o valor via PIX direto do investidor.
    """
    resp = client.post(
        f"/api/emprestimos/registrar-recebimento-inicial/{ctx['solicitacao_id']}",
        headers={"Authorization": f"Bearer {ctx['token_tomador']}"}
    )
    assert resp.status_code == 200
    assert "confirmado" in resp.json()["message"].lower()

    # Verificar transacao de confirmacao no banco
    db: Session = _db_module.SessionLocal()
    try:
        trans = db.query(Transacao).filter(
            Transacao.detalhes.like(f"%RECEBIMENTO_CONFIRMADO:{ctx['solicitacao_id']}%")
        ).first()
        assert trans is not None
        assert trans.tipo == TipoTransacao.CONFIRMACAO_RECEBIMENTO
    finally:
        db.close()


def test_06_verificar_contrato_gerado(client, ctx):
    """
    Verifica se o contrato de mutuo foi gerado e persistido no banco.
    """
    db: Session = _db_module.SessionLocal()
    try:
        contrato = db.query(ContratoMutuo).filter(
            ContratoMutuo.solicitacao_emprestimo_id == ctx["solicitacao_id"]
        ).first()
        assert contrato is not None
        assert contrato.termo_risco_aceite is True
        assert contrato.tomador_id == ctx["id_tomador"]
        assert contrato.investidor_id == ctx["id_investidor"]
        assert contrato.hash_integridade is not None
        assert len(contrato.hash_integridade) > 0
    finally:
        db.close()
