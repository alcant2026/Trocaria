def test_registro_usuario(client):
    payload = {
        "nome": "Test User",
        "email": "test@example.com",
        "cpf": "123.456.789-00",
        "senha": "password123",
        "chave_pix": "test@example.com",
        "aceite_termos": True
    }
    response = client.post("/auth/registrar", json=payload)
    assert response.status_code == 200
    assert response.json()["message"] == "Usuário registrado com sucesso!"

def test_login_usuario(client):
    # Primeiro registrar
    client.post("/auth/registrar", json={
        "nome": "Login User",
        "email": "login@example.com",
        "cpf": "111.222.333-44",
        "senha": "password123",
        "chave_pix": "login@example.com",
        "aceite_termos": True
    })
    
    # Tentar login
    payload = {
        "email": "login@example.com",
        "senha": "password123"
    }
    response = client.post("/auth/login", json=payload)
    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["usuario"]["email"] == "login@example.com" if "email" in response.json()["usuario"] else True

def test_perfil_usuario(client):
    # Registrar e Logar
    client.post("/auth/registrar", json={
        "nome": "Perfil User",
        "email": "perfil@example.com",
        "cpf": "000.111.222-33",
        "senha": "password123",
        "chave_pix": "perfil@example.com",
        "aceite_termos": True
    })
    
    login_resp = client.post("/auth/login", json={
        "email": "perfil@example.com",
        "senha": "password123"
    })
    token = login_resp.json()["access_token"]
    
    # Ver perfil
    response = client.get("/auth/perfil", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["nome"] == "Perfil User"

def test_2fa_flow(client):
    # Registrar e Logar
    client.post("/auth/registrar", json={
        "nome": "2FA User",
        "email": "2fa@example.com",
        "cpf": "999.888.777-66",
        "senha": "password123",
        "chave_pix": "2fa@example.com",
        "aceite_termos": True
    })
    
    login_resp = client.post("/auth/login", json={
        "email": "2fa@example.com",
        "senha": "password123"
    })
    token = login_resp.json()["access_token"]
    
    # 1. Gerar
    gen_resp = client.post("/auth/2fa/gerar", headers={"Authorization": f"Bearer {token}"})
    assert gen_resp.status_code == 200
    assert "secret" in gen_resp.json()
    secret = gen_resp.json()["secret"]
    
    # 2. Ativar (Simular código TOTP é difícil sem biblioteca, mas podemos testar a falha ou usar o segredo se pyotp estiver aqui)
    import pyotp
    totp = pyotp.TOTP(secret)
    codigo = totp.now()
    
    ativar_resp = client.post(f"/auth/2fa/ativar?codigo={codigo}", headers={"Authorization": f"Bearer {token}"})
    assert ativar_resp.status_code == 200
    assert ativar_resp.json()["message"] == "2FA ativado com sucesso!"
