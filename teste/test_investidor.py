from decimal import Decimal
from teste.utils import registrar_e_logar
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao

def test_fluxo_investimento_completo(client, db):
    # 1. Tomador solicita
    token_t = registrar_e_logar(client, "tomador_inv@example.com", "444.444.444-44")
    sol_resp = client.post("/emprestimos/solicitar", json={"valor": 200, "taxa_juros": 10, "parcelas": 2}, headers={"Authorization": f"Bearer {token_t}"})
    sol_id = sol_resp.json()["id"]
    
    # 2. Investidor deposita (Admin confirma) e investe
    token_i = registrar_e_logar(client, "investidor_inv@example.com", "555.555.555-55")
    
    # Forçar saldo para o investidor via DB fixture
    investidor = db.query(Usuario).filter(Usuario.email == "investidor_inv@example.com").first()
    investidor.saldo = Decimal("1000.00")
    db.commit()
    
    # Investir
    inv_payload = {"valor": 200, "aceite_risco": True}
    inv_resp = client.post(f"/investidor/investir/{sol_id}", json=inv_payload, headers={"Authorization": f"Bearer {token_i}"})
    assert inv_resp.status_code == 200
    
    # 3. Verificar se status mudou para APROVADO
    solicitacao = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.id == sol_id).first()
    assert solicitacao.status == StatusSolicitacao.APROVADO
    
    # 4. Verificar se tomador recebeu o dinheiro
    tomador = db.query(Usuario).filter(Usuario.email == "tomador_inv@example.com").first()
    assert tomador.saldo == Decimal("200.00")

def test_ver_carteira(client, db):
    token_i = registrar_e_logar(client, "carteira@example.com", "666.666.666-66")
    response = client.get("/investidor/carteira", headers={"Authorization": f"Bearer {token_i}"})
    assert response.status_code == 200
