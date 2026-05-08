import os
import json
import threading
import time
import urllib.request
import urllib.parse
import datetime
from database import SessionLocal
from modelos.modelos_db import Usuario

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

_verificacoes_telegram = {}

def registrar_codigo_telegram(user_id: str, codigo: str, expira_minutos: int = 15):
    from datetime import datetime, timezone
    _verificacoes_telegram[codigo] = {
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + datetime.timedelta(minutes=expira_minutos)
    }

def _enviar_mensagem(chat_id: int, texto: str):
    try:
        texto_codificado = urllib.parse.quote(texto)
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage?chat_id={chat_id}&text={texto_codificado}"
        urllib.request.urlopen(url, timeout=10)
    except Exception as e:
        print(f"Telegram send error: {e}")

def _processar_update(update: dict):
    message = update.get("message", {})
    texto = message.get("text", "").strip()
    chat_id = message.get("chat", {}).get("id")
    primeiro_nome = message.get("from", {}).get("first_name", "Usuário")

    if not texto or not chat_id:
        return

    if texto == "/start":
        _enviar_mensagem(chat_id,
            f"Olá {primeiro_nome}! Bem-vindo ao PSY PAY Bot.\n\n"
            "Para verificar seu telefone:\n"
            "1. No app PSY PAY, vá em Verificar Conta > Telefone\n"
            "2. Clique em 'Gerar Código'\n"
            "3. Envie o código de 6 dígitos aqui\n\n"
            "Pronto! Seu telefone será verificado automaticamente."
        )
        return

    if texto.isdigit() and len(texto) == 6:
        pendente = _verificacoes_telegram.get(texto)
        if not pendente:
            _enviar_mensagem(chat_id, "Código inválido ou expirado. Gere um novo código no app.")
            return

        from datetime import datetime, timezone
        if datetime.now(timezone.utc) > pendente["expires_at"]:
            _verificacoes_telegram.pop(texto, None)
            _enviar_mensagem(chat_id, "Código expirado. Gere um novo código no app.")
            return

        user_id = pendente["user_id"]
        db = SessionLocal()
        try:
            usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
            if usuario:
                usuario.telefone_verificado = True
                db.commit()
                _enviar_mensagem(chat_id, "Telefone verificado com sucesso! Volte ao app e clique em Confirmar.")
            else:
                _enviar_mensagem(chat_id, "Usuário não encontrado no sistema.")
        finally:
            db.close()
            _verificacoes_telegram.pop(texto, None)
        return

    _enviar_mensagem(chat_id,
        "Envie o código de 6 dígitos gerado no app PSY PAY para verificar seu telefone.\n\n"
        "Se ainda não gerou o código, vá no app em Verificar Conta > Telefone > Gerar Código."
    )

def iniciar_bot_telegram():
    if not TELEGRAM_BOT_TOKEN:
        print("TELEGRAM_BOT_TOKEN não configurado. Bot Telegram desativado.")
        return

    last_update_id = 0

    def poll():
        nonlocal last_update_id
        erro_count = 0
        while True:
            try:
                url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates?offset={last_update_id + 1}&timeout=30"
                req = urllib.request.Request(url)
                with urllib.request.urlopen(req, timeout=35) as resp:
                    data = json.loads(resp.read())
                    if data.get("ok"):
                        erro_count = 0
                        for update in data["result"]:
                            last_update_id = update["update_id"]
                            try:
                                _processar_update(update)
                            except Exception as e:
                                print(f"Telegram process error: {e}")
                    else:
                        erro_count += 1
            except urllib.error.URLError:
                erro_count += 1
                time.sleep(min(erro_count * 2, 30))
            except Exception as e:
                erro_count += 1
                print(f"Telegram poll error: {e}")
                time.sleep(min(erro_count * 2, 30))

    thread = threading.Thread(target=poll, daemon=True)
    thread.start()
    print("Bot Telegram iniciado (polling)")
