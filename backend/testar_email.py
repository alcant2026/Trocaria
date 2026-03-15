import os
import sys
from dotenv import load_dotenv

# Adiciona o diretório atual ao path para importar utils_email
sys.path.append(os.getcwd())

from utils_email import enviar_email_recuperacao

load_dotenv()

# Pegar e-mail de teste do argumento ou usar um padrão
email_teste = sys.argv[1] if len(sys.argv) > 1 else "contato@peer.com.br"
print(f"Tentando enviar e-mail para {email_teste}...")

sucesso = enviar_email_recuperacao(email_teste, "Usuário de Teste", "123456")

if sucesso:
    print("Sucesso: O script reportou que o e-mail foi enviado.")
else:
    print("Falha: Houve um erro ao enviar o e-mail. Verifique os logs acima.")
