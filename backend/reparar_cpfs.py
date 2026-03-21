from sqlalchemy import text
import re
import sys
import os

# Adiciona o diretório backend ao path para permitir imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine

def normalizar_cpfs_existentes():
    print("🔍 Iniciando normalização de CPFs no banco de dados...")
    print(f"📂 Diretório atual: {os.getcwd()}")
    print(f"🔗 Database URL: {engine.url}")
    
    try:
        db = SessionLocal()
        print("🗄️ Sessão do banco de dados aberta.")
        
        # Busca todos os usuários
        from modelos.modelos_db import Usuario
        print("👥 Buscando usuários...")
        usuarios = db.query(Usuario).all()
        print(f"📦 Encontrados {len(usuarios)} usuários.")
        
        count = 0
        for usuario in usuarios:
            cpf_original = usuario.cpf
            cpf_limpo = re.sub(r'[^0-9]', '', cpf_original)
            
            if cpf_original != cpf_limpo:
                print(f"🔨 Corrigindo CPF: {cpf_original} -> {cpf_limpo} (Usuário: {usuario.nome})")
                usuario.cpf = cpf_limpo
                count += 1
        
        if count > 0:
            print(f"💾 Tentando commit de {count} alterações...")
            db.commit()
            print(f"✅ Sucesso! {count} usuários foram corrigidos.")
        else:
            print("✨ Nenhum CPF precisava de correção.")
            
    except Exception as e:
        print(f"❌ Erro ao normalizar CPFs: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    normalizar_cpfs_existentes()
