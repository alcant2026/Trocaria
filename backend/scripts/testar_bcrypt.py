import bcrypt

senha = "teste123"
senha_bytes = senha.encode("utf-8")

# Fluxo de Registro
salt = bcrypt.gensalt()
hash_orig = bcrypt.hashpw(senha_bytes, salt)
hash_str = hash_orig.decode("utf-8")

print(f"Senha original: {senha}")
print(f"Hash gerado (str): {hash_str}")

# Fluxo de Login
hash_bytes_login = hash_str.encode("utf-8")
valido = bcrypt.checkpw(senha_bytes, hash_bytes_login)

print(f"Verificação no Login: {'SUCESSO' if valido else 'FALHA'}")

if not valido:
    print("⚠️ ALERTA: O hashing está inconsistente no ambiente!")
