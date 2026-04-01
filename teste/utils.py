import pyotp

def registrar_e_logar(client, email="user@example.com", cpf="123.123.123-11", is_admin=False):
    # Registrar
    client.post("/auth/registrar", json={
        "nome": "Test User",
        "email": email,
        "cpf": cpf,
        "senha": "password123",
        "chave_pix": email,
        "aceite_termos": True
    })
    
    # Login
    login_resp = client.post("/auth/login", json={
        "email": email,
        "senha": "password123"
    })
    
    # Se precisar ser admin, vamos forçar no banco via fixture se necessário, 
    # ou podemos usar uma conta que sabemos ser admin se o sistema permitir. 
    # Como as fixtures isolam, podemos manipular o objeto 'db' se tivermos acesso.
    
    return login_resp.json()["access_token"]

def ativar_2fa_para_usuario(client, token):
    gen_resp = client.post("/auth/2fa/gerar", headers={"Authorization": f"Bearer {token}"})
    secret = gen_resp.json()["secret"]
    totp = pyotp.TOTP(secret)
    codigo = totp.now()
    client.post(f"/auth/2fa/ativar?codigo={codigo}", headers={"Authorization": f"Bearer {token}"})
    return secret
