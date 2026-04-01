import sys
import os

# Adiciona o diretório pai ao path para importar o database
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import SessionLocal
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, DocumentoVerificacao
from datetime import datetime
import decimal

def criar_teste_kyc():
    db = SessionLocal()
    try:
        # 1. Criar Usuário
        uid = "ANDRE"
        usuario = db.query(Usuario).filter(Usuario.id == uid).first()
        if not usuario:
            usuario = Usuario(
                id=uid,
                nome="André Teste KYC",
                email="andre@teste.com",
                cpf="111.222.333-44",
                senha_hash="hash_fake",
                chave_pix="andre@pix.com",
                score=500,
                is_verified=False
            )
            db.add(usuario)
            db.flush()

        # 2. Criar Transação de KYC Pendente
        transacao = Transacao(
            usuario_id=uid,
            valor=decimal.Decimal("0.00"),
            tipo=TipoTransacao.DESBLOQUEIO_DADOS,
            status="pendente",
            detalhes="Solicitação de Verificação Grátis"
        )
        db.add(transacao)

        # 3. Criar Registros de Documentos (Caminhos fakes para aparecer o botão)
        # Usamos caminhos que o backend consiga "simular" se existem
        doc = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == uid).first()
        if not doc:
            doc = DocumentoVerificacao(
                usuario_id=uid,
                caminho_rg="/tmp/fake_rg.jpg",
                caminho_renda="/tmp/fake_renda.jpg",
                caminho_residencia="/tmp/fake_res.jpg",
                status="pendente"
            )
            db.add(doc)
        else:
            doc.status = "pendente"
            doc.caminho_rg = "/tmp/fake_rg.jpg"

        db.commit()
        print(f"[OK] Usuário '{usuario.nome}' criado com sucesso para teste!")
        print("Agora atualize seu Dashboard Admin e veja a mágica!")
        
    except Exception as e:
        print(f"[ERRO] Falha ao criar teste: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    criar_teste_kyc()
