from database import SessionLocal
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from decimal import Decimal

def compensar():
    db = SessionLocal()
    try:
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if not plataforma:
            print("Plataforma não encontrada.")
            return

        # Busca todos os aportes de capital que foram injetados antes da atualização de hoje.
        # Eles atualmente estão inflacionando o saldo (caixa livre) ao invés de estarem no saldo_caixa (Pool).
        aportes = db.query(Transacao).filter(
            Transacao.tipo == TipoTransacao.APORTE_CAPITAL,
            Transacao.detalhes.like("%APORTE EXTERNO%")
        ).all()

        total_compensar = sum([t.valor for t in aportes])
        
        if total_compensar > 0:
            print(f"Encontramos R$ {total_compensar} em aportes institucionais no caixa livre.")
            plataforma.saldo -= total_compensar
            plataforma.saldo_caixa += total_compensar
            
            # Atualiza os detalhes para refletir que migrou
            for t in aportes:
                t.detalhes = t.detalhes.replace("APORTE EXTERNO", "APORTE (MIGRADO P/ POOL)")
            
            db.commit()
            print("✅ Correção aplicada. R$ movido para o Pool com sucesso.")
        else:
            print("Nenhum aporte antigo encontrado para corrigir.")
    finally:
        db.close()

if __name__ == "__main__":
    compensar()
