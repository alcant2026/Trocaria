import os
import json
import firebase_admin
from firebase_admin import auth, credentials

_FIREBASE_INITIALIZED = False

def _inicializar():
    global _FIREBASE_INITIALIZED
    if _FIREBASE_INITIALIZED:
        return
    
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    
    cred_dict = None
    
    if service_account_json:
        try:
            cred_dict = json.loads(service_account_json)
        except Exception as e:
            print(f"⚠️ Erro ao parsear FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
    
    if not cred_dict and service_account_path and os.path.exists(service_account_path):
        try:
            with open(service_account_path, "r") as f:
                cred_dict = json.load(f)
        except Exception as e:
            print(f"⚠️ Erro ao ler arquivo de service account: {e}")
    
    if not cred_dict:
        print("⚠️ Firebase service account não configurado. Firebase Admin SDK não inicializado.")
        return
    
    try:
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
        _FIREBASE_INITIALIZED = True
        print("✅ Firebase Admin SDK inicializado.")
    except Exception as e:
        print(f"⚠️ Erro ao inicializar Firebase Admin SDK: {e}")

def garantir_usuario_firebase(email: str, display_name: str = None, phone_number: str = None):
    """Garante que um usuário exista no Firebase Auth. Retorna o UID."""
    _inicializar()
    if not _FIREBASE_INITIALIZED:
        return None
    try:
        user = auth.get_user_by_email(email)
        return user.uid
    except auth.UserNotFoundError:
        user = auth.create_user(
            email=email,
            display_name=display_name,
            phone_number=phone_number,
            email_verified=False
        )
        return user.uid
    except Exception as e:
        print(f"⚠️ Erro ao garantir usuário Firebase: {e}")
        return None

def gerar_link_verificacao_email(email: str, frontend_url: str = None):
    """Gera um link de verificação de email do Firebase."""
    _inicializar()
    if not _FIREBASE_INITIALIZED:
        return None
    try:
        link = auth.generate_email_verification_link(email)
        return link
    except Exception as e:
        print(f"⚠️ Erro ao gerar link de verificação: {e}")
        return None

def verificar_id_token(id_token: str):
    """Verifica um ID token do Firebase. Retorna os claims ou None."""
    _inicializar()
    if not _FIREBASE_INITIALIZED:
        return None
    try:
        decoded = auth.verify_id_token(id_token, clock_skew_seconds=60)
        return decoded
    except Exception as e:
        print(f"⚠️ Erro ao verificar ID token: {e}")
        return None

def verificar_status_email(email: str):
    """Verifica se o email foi verificado no Firebase."""
    _inicializar()
    if not _FIREBASE_INITIALIZED:
        return False
    try:
        user = auth.get_user_by_email(email)
        return user.email_verified
    except Exception as e:
        print(f"⚠️ Erro ao verificar status do email: {e}")
        return False
