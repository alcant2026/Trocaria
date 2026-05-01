import sys
import os

# Adiciona o diretório pai ao path para importar o database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import SessionLocal
from modelos.modelos_db import Usuario, DocumentoVerificacao
from datetime import datetime, timezone

def fix_kyc():
    db = SessionLocal()
    try:
        # Localizar o Josias Silva
        usuario = db.query(Usuario).filter(Usuario.nome.like("%Josias Silva%")).first()
        if not usuario:
            print("[ERRO] Usuário Josias Silva não encontrado.")
            return

        print(f"[FIX] Ativando verificação para {usuario.nome} (ID: {usuario.id})")
        
        # 1. Ativar o selo no perfil
        usuario.is_verified = True
        
        # 2. Localizar e aprovar os documentos se houver algum pendente
        docs = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == usuario.id).all()
        for d in docs:
            if d.status == "pendente":
                d.status = "aprovado"
                d.data_analise = datetime.now(timezone.utc)
        
        db.commit()
        print("[OK] Perfil verificado e documentos aprovados com sucesso!")
        
    except Exception as e:
        print(f"[ERRO] Falha ao corrigir KYC: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_kyc()
