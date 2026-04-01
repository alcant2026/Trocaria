import sys
import os

# Adiciona o diretório pai ao path para importar modelos e database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal
from modelos.modelos_db import SolicitacaoEmprestimo, Transacao, TipoTransacao, StatusSolicitacao

def corrigir_historico():
    db = SessionLocal()
    try:
        print("🔍 Iniciando busca por empréstimos sem registro de recebimento...")
        
        # Busca todas as solicitações que já foram aprovadas ou concluídas (arrecadadas)
        solicitacoes = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.status.in_([StatusSolicitacao.APROVADO, StatusSolicitacao.CONCLUIDO])
        ).all()
        
        corrigidos = 0
        pular = 0
        
        for s in solicitacoes:
            # Verifica se já existe uma transação de RECEBIMENTO para este empréstimo no histórico do tomador
            # Detalhe padrão: "Recebimento de empréstimo (Meta Atingida) - ID #ID"
            ja_existe = db.query(Transacao).filter(
                Transacao.usuario_id == s.usuario_id,
                Transacao.tipo == TipoTransacao.RECEBIMENTO,
                Transacao.valor == s.valor,
                Transacao.detalhes.like(f"%ID #{s.id}%")
            ).first()
            
            if not ja_existe:
                print(f"✅ Corrigindo: Empréstimo #{s.id} (Tomador: {s.usuario.nome})")
                nova_transacao = Transacao(
                    usuario_id=s.usuario_id,
                    valor=s.valor,
                    tipo=TipoTransacao.RECEBIMENTO,
                    status="concluido",
                    detalhes=f"Recebimento de empréstimo (Meta Atingida) - ID #{s.id}",
                    data_criacao=s.data_criacao # Tenta aproximar a data original
                )
                db.add(nova_transacao)
                corrigidos += 1
            else:
                pular += 1
        
        db.commit()
        print(f"\n✨ Sincronização Concluída!")
        print(f"📊 Corrigidos: {corrigidos}")
        print(f"⏭️  Já estavam corretos: {pular}")
        
    except Exception as e:
        print(f"❌ Erro na sincronização: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    corrigir_historico()
