import sys
import os

# Adiciona o diretório-pai ao path para importar database e modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import SessionLocal
from modelos.modelos_db import Transacao, TipoTransacao

def migrar_tipos():
    db = SessionLocal()
    try:
        print("🔍 Iniciando migração de tipos de transação...")
        
        # 1. Identificar transações de Aporte/Resgate antigas
        transacoes = db.query(Transacao).filter(
            Transacao.tipo.in_([TipoTransacao.APORTE_CAIXA, TipoTransacao.RESGATE_CAIXA])
        ).all()
        
        alteradas = 0
        for t in transacoes:
            detalhes = (t.detalhes or "").upper()
            
            # Lógica para Aporte
            if t.tipo == TipoTransacao.APORTE_CAIXA:
                if "POOL" in detalhes or "COLETIVO" in detalhes:
                    t.tipo = TipoTransacao.APORTE_POOL
                    alteradas += 1
                elif "ABERTURA" in detalhes or "GAVETA" in detalhes:
                    t.tipo = TipoTransacao.ABERTURA_GAVETA
                    alteradas += 1
            
            # Lógica para Resgate
            elif t.tipo == TipoTransacao.RESGATE_CAIXA:
                if "POOL" in detalhes or "COLETIVO" in detalhes:
                    t.tipo = TipoTransacao.RESGATE_POOL
                    alteradas += 1
                elif "ENCERRADO" in detalhes or "FECHAMENTO" in detalhes or "GAVETA" in detalhes:
                    t.tipo = TipoTransacao.FECHAMENTO_GAVETA
                    alteradas += 1
        
        if alteradas > 0:
            db.commit()
            print(f"✅ Sucesso! {alteradas} transações foram re-classificadas corretamente.")
        else:
            print("ℹ️ Nenhuma transação legada precisou de migração.")
            
    except Exception as e:
        print(f"❌ Erro durante a migração: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrar_tipos()
