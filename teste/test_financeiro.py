from decimal import Decimal
from teste.utils import registrar_e_logar, ativar_2fa_para_usuario
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, StatusSolicitacao
import pyotp

def test_solicitar_saque_com_2fa(client, db):
    email = "saque@example.com"
    token = registrar_e_logar(client, email, "777.777.777-77")
    
    # Dar saldo
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    usuario.saldo = Decimal("500.00")
    db.commit()
    
    # Ativar 2FA
    secret = ativar_2fa_para_usuario(client, token)
    totp = pyotp.TOTP(secret)
    
    # Solicitar Saque
    payload = {
        "valor": 100,
        "chave_pix": email,
        "senha": "password123",
        "codigo_2fa": totp.now()
    }
    response = client.post("/financeiro/solicitar-saque", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "Solicitação de saque registrada" in response.json()["message"]
    
    # Verificar se saldo foi deduzido
    db.refresh(usuario)
    assert usuario.saldo == Decimal("400.00")

def test_admin_confirmar_deposito(client, db):
    # 1. Usuário notifica depósito
    token_u = registrar_e_logar(client, "deposito@example.com", "888.888.888-88")
    client.post("/financeiro/notificar-deposito", json={"valor": 300}, headers={"Authorization": f"Bearer {token_u}"})
    
    transacao = db.query(Transacao).filter(Transacao.tipo == TipoTransacao.DEPOSITO, Transacao.status == "pendente").first()
    assert transacao is not None
    
    # 2. Login Admin
    token_a = registrar_e_logar(client, "admin@peer.com.br", "000.000.000-00")
    admin = db.query(Usuario).filter(Usuario.email == "admin@peer.com.br").first()
    admin.is_admin = True
    db.commit()
    
    # 3. Confirmar
    conf_resp = client.post(f"/financeiro/admin/confirmar/{transacao.id}", headers={"Authorization": f"Bearer {token_a}"})
    assert conf_resp.status_code == 200
    
    # 4. Verificar saldo do usuário
    usuario = db.query(Usuario).filter(Usuario.email == "deposito@example.com").first()
    assert usuario.saldo == Decimal("300.00")


def test_admin_criar_parceiro_exige_cnpj_ativo(client, db):
    token_admin = registrar_e_logar(client, "admin-parceiro@example.com", "123.123.123-12")
    admin = db.query(Usuario).filter(Usuario.email == "admin-parceiro@example.com").first()
    admin.is_admin = True
    db.commit()

    response = client.post(
        "/financeiro/admin/parceiros",
        json={
            "nome": "Loja Centro",
            "razao_social": "Loja Centro LTDA",
            "cnpj": "11.222.333/0001-81",
            "cnpj_status": "baixada",
            "endereco": "Rua A, 10"
        },
        headers={"Authorization": f"Bearer {token_admin}"}
    )
    assert response.status_code == 400
    assert "CNPJ em situação ATIVA" in response.json()["detail"]
