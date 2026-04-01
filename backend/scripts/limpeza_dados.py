import sys
import os
import datetime

# Adicionar o diretório backend ao sys.path para permitir importações dos modelos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Transacao, RegistroAuditoria

def realizar_limpeza():
    db = SessionLocal()
    try:
        agora = datetime.datetime.utcnow()
        
        # 1. Limpar Solicitações PENDENTES expiradas há mais de 30 dias
        limite_solicitacoes = agora - datetime.timedelta(days=30)
        solicitacoes_antigas = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
            SolicitacaoEmprestimo.data_criacao < limite_solicitacoes
        ).all()
        
        count_solicitacoes = len(solicitacoes_antigas)
        for s in solicitacoes_antigas:
            db.delete(s)
            
        # 2. Limpar Transações com status "falhou" há mais de 90 dias
        limite_transacoes = agora - datetime.timedelta(days=90)
        transacoes_falhas = db.query(Transacao).filter(
            Transacao.status == "falhou",
            Transacao.data_criacao < limite_transacoes
        ).all()
        
        count_transacoes = len(transacoes_falhas)
        for t in transacoes_falhas:
            db.delete(t)

        # 3. Limpar Registros de Auditoria órfãos (opcional, pesado se houver muitos)
        # Por simplicidade e performance, vamos focar nos dados principais primeiro.
        
        db.commit()
        print(f"Limpeza concluída com sucesso:")
        print(f" - {count_solicitacoes} solicitações pendentes e expiradas removidas.")
        print(f" - {count_transacoes} transações falhas antigas removidas.")
        
    except Exception as e:
        db.rollback()
        print(f"Erro durante a limpeza: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    realizar_limpeza()
