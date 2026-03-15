import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

# Configurações de E-mail (Resend / SendGrid / Gmail SMTP)
MODO_EMAIL = os.getenv("MODO_EMAIL", "CONSOLE") # CONSOLE ou SMTP
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.resend.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "resend")
SMTP_PASS = os.getenv("SMTP_PASS", "")
EMAIL_REMETENTE = os.getenv("EMAIL_REMETENTE", "nao-responder@peer.com.br")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

def enviar_email_recuperacao(email_destino: str, nome_usuario: str, codigo: str):
    """
    Envia o e-mail de recuperação de conta.
    Suporta modo CONSOLE para custo zero em desenvolvimento e SMTP para produção.
    """
    assunto = f"Código de Recuperação - Peer App"
    
    html_template = f"""
    <html>
        <body style="font-family: 'Inter', sans-serif; background-color: #000000; color: #FFFFFF; padding: 40px 20px; margin: 0;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #0F0F10; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 40px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
                
                <!-- Logo & Wordmark -->
                <div style="margin-bottom: 32px; display: inline-block;">
                    <img src="{FRONTEND_URL}/favicon.svg" alt="P" style="width: 42px; height: 42px; vertical-align: middle; margin-right: -4px;">
                    <span style="color: #FFCC00; font-size: 38px; font-weight: 800; vertical-align: middle; letter-spacing: -2px; font-family: sans-serif;">eer</span>
                </div>

                <h1 style="color: #FFFFFF; font-size: 24px; font-weight: 700; margin-bottom: 16px; letter-spacing: -1px;">Olá, {nome_usuario}</h1>
                
                <p style="color: #8E8E93; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
                    Recebemos uma solicitação de segurança para redefinir sua senha no <strong>Peer App</strong>. 
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
                    <p style="font-size: 12px; color: #FFCC00; font-weight: 600;">Equipe de Segurança • Peer App</p>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 24px; color: #444; font-size: 11px;">
                &copy; 2026 Peer App - Crédito Colaborativo com Segurança Bancária.
            </div>
        </body>
    </html>
    """

    if MODO_EMAIL == "CONSOLE":
        print("\n" + "="*50)
        print(f"SIMULAÇÃO DE E-MAIL (MODO CONSOLE)")
        print(f"Para: {email_destino}")
        print(f"Assunto: {assunto}")
        print(f"Código: {codigo}")
        print("="*50 + "\n")
        return True

    try:
        msg = MIMEMultipart()
        msg['From'] = f"Peer App <{EMAIL_REMETENTE}>"
        msg['To'] = email_destino
        msg['Subject'] = assunto
        
        msg.attach(MIMEText(html_template, 'html'))

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
            
        return True
    except Exception as e:
        print(f"ERRO AO ENVIAR E-MAIL: {e}")
        # Em produção, você logaria isso em um sistema de erro
        return False

def mascarar_email(email: str) -> str:
    """Retorna o e-mail mascarado (ex: jo***@gm***.com) conforme LGPD."""
    try:
        usuario, dominio = email.split('@')
        # Mascarar usuário
        if len(usuario) <= 2:
            usuario_m = usuario + "***"
        else:
            usuario_m = usuario[:2] + "***"
            
        # Mascarar domínio
        partes_dominio = dominio.split('.')
        nome_dominio = partes_dominio[0]
        if len(nome_dominio) <= 2:
            dominio_m = nome_dominio + "***"
        else:
            dominio_m = nome_dominio[:2] + "***"
            
        return f"{usuario_m}@{dominio_m}.{'.'.join(partes_dominio[1:])}"
    except:
        return "****@****.com"
