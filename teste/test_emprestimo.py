from decimal import Decimal
from modelos.modelos_db import SolicitacaoEmprestimo, Usuario
from teste.utils import registrar_e_logar

def test_solicitar_emprestimo(client):
    token = registrar_e_logar(client, "tomador@example.com", "111.111.111-11")
    
    payload = {
        "valor": 500.00,
        "taxa_juros": 5.0,
        "parcelas": 6
    }
    response = client.post("/emprestimos/solicitar", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "Solicitação criada!" in response.json()["message"]

def test_listar_oportunidades(client):
    # Criar um pedido primeiro
    token_t = registrar_e_logar(client, "tomador2@example.com", "222.222.222-22")
    client.post("/emprestimos/solicitar", json={"valor": 1000, "taxa_juros": 10, "parcelas": 12}, headers={"Authorization": f"Bearer {token_t}"})
    
    # Listar como outro usuário (investidor)
    token_i = registrar_e_logar(client, "investidor@example.com", "333.333.333-33")
    response = client.get("/emprestimos/listar", headers={"Authorization": f"Bearer {token_i}"})
    assert response.status_code == 200
    assert len(response.json()) > 0
    assert response.json()[0]["valor"] == 1000

def test_pagamento_avulso(client, db):
    # 1. Setup: Tomador com empréstimo aprovado
    token_t = registrar_e_logar(client, "avulso@example.com", "000.111.222-33")
    db.query(Usuario).filter(Usuario.email == "avulso@example.com").update({"saldo": Decimal("500.00")})
    db.commit()
    
    sol_resp = client.post("/emprestimos/solicitar", json={"valor": 200, "taxa_juros": 10, "parcelas": 2}, headers={"Authorization": f"Bearer {token_t}"})
    sol_id = sol_resp.json()["id"]
    
    # 2. Investidor investe tudo para aprovar
    token_i = registrar_e_logar(client, "inv_avulso@example.com", "999.888.777-11")
    db.query(Usuario).filter(Usuario.email == "inv_avulso@example.com").update({"saldo": Decimal("200.00")})
    db.commit()
    client.post(f"/investidor/investir/{sol_id}", json={"valor": 200, "aceite_risco": True}, headers={"Authorization": f"Bearer {token_i}"})
    
    # 3. Pagamento Avulso de R$ 50
    pagto_resp = client.post(f"/emprestimos/pagamento-avulso/{sol_id}", json={"valor_pagamento": 50}, headers={"Authorization": f"Bearer {token_t}"})
    assert pagto_resp.status_code == 200
    assert "Taxa de conveniência de R$ 1,50" in pagto_resp.json()["message"]
    
    # 4. Verificar se a dívida restante reflete a amortização + taxa
    # Valor Total inicial: 200 * (1 + 0.1 * 2) = 240
    # Pago: 50
    # Taxa: 1.5
    # Restante: 240 - 50 + 1.5 = 191.5
    meus_resp = client.get("/emprestimos/meus-emprestimos", headers={"Authorization": f"Bearer {token_t}"})
    emprestimo = next(e for e in meus_resp.json() if e["id"] == sol_id)
    assert float(emprestimo["valor_total_restante"]) == 191.5
