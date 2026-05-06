import os
import json
import urllib.request
import urllib.error
import urllib.parse
from dotenv import load_dotenv

load_dotenv()

# Configurações de E-mail (Resend API)
MODO_EMAIL = os.getenv("MODO_EMAIL", "CONSOLE") # CONSOLE ou SMTP (agora via API)
# O SMTP_PASS agora é usado como a API KEY do Resend
RESEND_API_KEY = os.getenv("SMTP_PASS", "") 
EMAIL_REMETENTE = os.getenv("EMAIL_REMETENTE", "nao-responder@cred30.site")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def enviar_email_recuperacao(email_destino: str, nome_usuario: str, codigo: str):
    """
    Envia o e-mail de recuperação de conta via API HTTP do Resend.
    Porta 443 (HTTPS) é usada para evitar bloqueios de SMTP em servidores cloud.
    """
    assunto = f"Código de Recuperação - PSY PAY App"
    
    html_template = f"""
    <html>
        <body style="font-family: 'Inter', sans-serif; background-color: #000000; color: #FFFFFF; padding: 40px 20px; margin: 0;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #0F0F10; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                <div style="margin-bottom: 32px; display: inline-block;">
                    <img src="{FRONTEND_URL}/favicon.svg" alt="P" style="width: 42px; height: 42px; vertical-align: middle; margin-right: -4px;">
                    <span style="color: #FFCC00; font-size: 38px; font-weight: 800; vertical-align: middle; letter-spacing: -2px; font-family: sans-serif;">eer</span>
                </div>
                <h1 style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin-bottom: 16px; letter-spacing: -1px;">Olá, {nome_usuario}</h1>
                <p style="color: #8E8E93; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
                    Recebemos uma solicitação de segurança para redefinir sua senha no <strong>PSY PAY App</strong>. 
                    Utilize o código abaixo para prosseguir:
                </p>
                <div style="background: rgba(255, 204, 0, 0.05); border: 2px dashed #FFCC00; padding: 20px; border-radius: 16px; margin-bottom: 32px;">
                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FFCC00;">{codigo}</span>
                </div>
                <p style="color: #8E8E93; font-size: 14px; margin-bottom: 32px;">
                    Este código é pessoal, intransferível e expira em <strong>15 minutos</strong>.
                </p>
                <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 24px;">
                    <p style="font-size: 12px; color: #444; margin-bottom: 4px;">Se não foi você, recomendamos trocar sua senha por segurança.</p>
                    <p style="font-size: 12px; color: #FFCC00; font-weight: 600;">Equipe de Segurança • PSY PAY App</p>
                </div>
            </div>
            <div style="text-align: center; margin-top: 24px; color: #444; font-size: 11px;">
                &copy; 2026 PSY PAY App - Crédito Colaborativo com Segurança Bancária.
            </div>
        </body>
    </html>
    """

    
    if MODO_EMAIL == "CONSOLE":
        print("\n" + "="*50)
        print(f"SIMULAÇÃO DE E-MAIL (MODO CONSOLE)")
        print(f"Para: {email_destino}")
        print(f"Código: {codigo}")
        print("="*50 + "\n")
        return True

    # Preparar payload para a API do Resend
    url = "https://api.resend.com/emails"
    payload = {
        "from": f"PSY PAY App <{EMAIL_REMETENTE}>",
        "to": [email_destino],
        "subject": assunto,
        "html": html_template
    }
    
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=15) as response:
            status = response.getcode()
            response_body = response.read().decode("utf-8")
            if status in [200, 201]:
                return True
            else:
                print(f"ERRO API RESEND: Status {status}")
                return False

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"ERRO HTTP RESEND ({e.code}): {error_body}")
        return False
    except Exception as e:
        print(f"ERRO CRÍTICO NA API DE E-MAIL: {str(e)}")
        return False

def mascarar_email(email: str) -> str:
    """Retorna o e-mail mascarado (ex: jo***@gm***.com) conforme LGPD."""
    try:
        usuario, dominio = email.split('@')
        if len(usuario) <= 2:
            usuario_m = usuario + "***"
        else:
            usuario_m = usuario[:2] + "***"
            
        partes_dominio = dominio.split('.')
        nome_dominio = partes_dominio[0]
        if len(nome_dominio) <= 2:
            dominio_m = nome_dominio + "***"
        else:
            dominio_m = nome_dominio[:2] + "***"
            
        return f"{usuario_m}@{dominio_m}.{'.'.join(partes_dominio[1:])}"
    except:
        return "****@****.com"

def enviar_email_verificacao(email_destino: str, nome_usuario: str, codigo: str):
    """
    Envia o e-mail de verificação de conta via API HTTP do Resend.
    """
    assunto = f"Código de Verificação - PSY PAY App"
    
    html_template = f"""
    <html>
        <body style="font-family: 'Inter', sans-serif; background-color: #000000; color: #FFFFFF; padding: 40px 20px; margin: 0;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #0F0F10; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                <div style="margin-bottom: 32px; display: inline-block;">
                    <img src="{FRONTEND_URL}/favicon.svg" alt="P" style="width: 42px; height: 42px; vertical-align: middle; margin-right: -4px;">
                    <span style="color: #FFCC00; font-size: 38px; font-weight: 800; vertical-align: middle; letter-spacing: -2px; font-family: sans-serif;">eer</span>
                </div>
                <h1 style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin-bottom: 16px; letter-spacing: -1px;">Olá, {nome_usuario}</h1>
                <p style="color: #8E8E93; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
                    Para garantir a segurança da sua conta no <strong>PSY PAY App</strong>, 
                    utilize o código abaixo para verificar seu e-mail:
                </p>
                <div style="background: rgba(255, 204, 0, 0.05); border: 2px dashed #FFCC00; padding: 20px; border-radius: 16px; margin-bottom: 32px;">
                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #FFCC00;">{codigo}</span>
                </div>
                <p style="color: #8E8E93; font-size: 14px; margin-bottom: 32px;">
                    Este código é pessoal, intransferível e expira em <strong>15 minutos</strong>.
                </p>
                <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 24px;">
                    <p style="font-size: 12px; color: #444; margin-bottom: 4px;">Se não foi você, ignore este e-mail.</p>
                    <p style="font-size: 12px; color: #FFCC00; font-weight: 600;">Equipe de Segurança • PSY PAY App</p>
                </div>
            </div>
            <div style="text-align: center; margin-top: 24px; color: #444; font-size: 11px;">
                &copy; 2026 PSY PAY App - Crédito Colaborativo com Segurança Bancária.
            </div>
        </body>
    </html>
    """
    
    if MODO_EMAIL == "CONSOLE":
        print("\n" + "="*50)
        print(f"SIMULAÇÃO DE E-MAIL DE VERIFICAÇÃO (MODO CONSOLE)")
        print(f"Para: {email_destino}")
        print(f"Código: {codigo}")
        print("="*50 + "\n")
        return True

    url = "https://api.resend.com/emails"
    payload = {
        "from": f"PSY PAY App <{EMAIL_REMETENTE}>",
        "to": [email_destino],
        "subject": assunto,
        "html": html_template
    }
    
    headers = {
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        
        with urllib.request.urlopen(req, timeout=15) as response:
            status = response.getcode()
            if status in [200, 201]:
                return True
            else:
                print(f"ERRO API RESEND: Status {status}")
                return False

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"ERRO HTTP RESEND ({e.code}): {error_body}")
        return False
    except Exception as e:
        print(f"ERRO CRÍTICO NA API DE E-MAIL: {str(e)}")
        return False

def enviar_whatsapp_gratis(numero_telefone: str, mensagem: str) -> bool:
    """
    Envia mensagem WhatsApp GRÁTIS via CallMeBot API.
    O usuário precisa ter iniciado o chat com o bot primeiro (enviar 'I allow callmebot to send me messages'
    para o número +34 603 21 43 25 no WhatsApp).
    
    Documentação: https://www.callmebot.com/blog/free-api-whatsapp-messages/
    """
    # Limpar número: remover tudo exceto dígitos
    numero_limpo = "".join(filter(str.isdigit, numero_telefone))
    
    # Se não tiver 55 no início, adicionar
    if not numero_limpo.startswith("55"):
        numero_limpo = "55" + numero_limpo
    
    # No modo CONSOLE, só imprime
    if MODO_EMAIL == "CONSOLE":
        print("\n" + "="*60)
        print(f"SIMULAÇÃO DE WHATSAPP (MODO CONSOLE)")
        print(f"Para: +{numero_limpo}")
        print(f"Mensagem: {mensagem}")
        print("="*60 + "\n")
        print("⚠️  Para enviar de verdade no WhatsApp:")
        print("   1. Envie 'I allow callmebot to send me messages'")
        print("      para +34 603 21 43 25 no WhatsApp")
        print("   2. Defina MODO_EMAIL=API no .env")
        print("="*60 + "\n")
        return True
    
    # Tentar CallMeBot API (grátis)
    try:
        texto_codificado = urllib.parse.quote(mensagem)
        url = f"https://api.callmebot.com/whatsapp.php?phone={numero_limpo}&text={texto_codificado}&apikey=123456"  # apikey é opcional/free
        
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=15) as response:
            status = response.getcode()
            body = response.read().decode("utf-8")
            if status == 200 and "success" in body.lower():
                print(f"✅ WhatsApp enviado para +{numero_limpo}")
                return True
            else:
                print(f"⚠️ CallMeBot respondeu: {body}")
                return False
                
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"⚠️ CallMeBot HTTP {e.code}: {error_body}")
        return False
    except Exception as e:
        print(f"⚠️ Erro CallMeBot: {e}")
        return False


def mascarar_cpf(cpf: str) -> str:
    """Retorna o CPF mascarado (ex: 123.***.***-99) conforme LGPD."""
    try:
        # Garante que o CPF tenha apenas números para o mascaramento
        cpf_limpo = "".join(filter(str.isdigit, cpf))
        if len(cpf_limpo) != 11:
            return "***.***.***-**"
        
        return f"{cpf_limpo[:3]}.***.***-{cpf_limpo[-2:]}"
    except:
        return "***.***.***-**"
