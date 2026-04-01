from decimal import Decimal
from teste.utils import registrar_e_logar
from modelos.modelos_db import Usuario, Transacao, TipoTransacao

def test_comprar_score(client, db):
    email = "score@example.com"
    token = registrar_e_logar(client, email, "999.000.111-22")
    
    # Dar saldo
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    usuario.saldo = Decimal("100.00")
    db.commit()
    
    # Comprar score
    response = client.post("/score/comprar", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["score"] == 1.5
    
    # Verificar saldo deduzido
    db.refresh(usuario)
    assert usuario.saldo == Decimal("65.00")

def test_solicitar_verificacao(client, db):
    email = "kyc@example.com"
    token = registrar_e_logar(client, email, "888.111.999-00")
    
    # Dar saldo
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    usuario.saldo = Decimal("50.00")
    db.commit()
    
    # Solicitar
    payload = {"detalhes": "Documentos enviados"}
    response = client.post("/score/solicitar-verificacao", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "Solicitação enviada" in response.json()["message"]
    
    # Verificar transação pendente
    transacao = db.query(Transacao).filter(Transacao.usuario_id == usuario.id, Transacao.status == "pendente").first()
    assert transacao is not None
