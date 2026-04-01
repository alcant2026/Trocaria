import os
import sys

# Adicionar o diretório pai ao path para importar os módulos do backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal
from modelos.modelos_db import Usuario, Investimento, SolicitacaoEmprestimo, Transacao, TipoTransacao, StatusSolicitacao
from decimal import Decimal

def reparar_prejuizos(dry_run=True):
    db: Session = SessionLocal()
    try:
        print(f"{'='*60}")
        print(f"{'AUDITORIA E REPARAÇÃO DE PREJUÍZO DO INVESTIDOR':^60}")
        print(f"{'MODO: DRY RUN' if dry_run else 'MODO: EFETIVAÇÃO':^60}")
        print(f"{'='*60}\n")

        admin = db.query(Usuario).filter(Usuario.is_admin == True).first()
        if not admin:
            print("ERRO: Nenhum administrador encontrado.")
            return

        print(f"Admin para compensação: {admin.nome} (Saldo atual: R$ {admin.saldo:.2f})\n")

        investimentos = db.query(Investimento).all()
        total_reparacao = Decimal("0.00")
        casos_encontrados = 0

        for inv in investimentos:
            sol = inv.solicitacao
            
            # Se o empréstimo foi cancelado ou pendente, não há o que reparar em termos de rateio final
            if sol.status in [StatusSolicitacao.CANCELADO, StatusSolicitacao.PENDENTE]:
                continue

            # Cálculo do principal esperado (pro-rata do capital investido)
            # No caso de contratos CONCLUIDOS, o principal_esperado é o valor_investido integral.
            # No caso de APROVADOS, depende das parcelas pagas.
            
            principal_por_parcela = inv.valor_investido / sol.prazo_meses
            principal_esperado = principal_por_parcela * sol.parcelas_pagas
            
            # Se já amortizou mais valor avulso, o capital esperado pode ser maior
            # Mas a métrica base para prejuízo é: "ele recebeu pelo menos o que aplicou pro-rata?"
            
            prejuizo = principal_esperado - inv.pago_para_investidor
            
            if prejuizo > Decimal("0.01"): # Tolerância de 1 centavo para erros de arredondamento
                casos_encontrados += 1
                total_reparacao += prejuizo
                
                print(f"ID {inv.id} - Investidor: {inv.investidor.nome}")
                print(f"   Pedido #{sol.id} | Status: {sol.status.value}")
                print(f"   Investido: R$ {inv.valor_investido:.2f} | Recebido: R$ {inv.pago_para_investidor:.2f}")
                print(f"   Esperado p/ Principal: R$ {principal_esperado:.2f} | PREJUÍZO: R$ {prejuizo:.2f}")
                print(f"   ---")

                if not dry_run:
                    # Efetivar Reparação
                    inv.investidor.saldo += prejuizo
                    inv.pago_para_investidor += prejuizo
                    admin.saldo -= prejuizo
                    
                    # Registrar Transação de Reparação para o Investidor
                    db.add(Transacao(
                        usuario_id=inv.investidor.id,
                        valor=prejuizo,
                        tipo=TipoTransacao.RECEBIMENTO,
                        status="concluido",
                        detalhes=f"Reparação de Erro de Rateio (Passivo) - Pedido #{sol.id}"
                    ))
                    
                    # Registrar a saída no Admin
                    db.add(Transacao(
                        usuario_id=admin.id,
                        valor=prejuizo,
                        tipo=TipoTransacao.TAXA_INTERMEDIACAO, # Usamos taxa para o admin aparecer como 'ajuste'
                        status="concluido",
                        detalhes=f"Reparação Rateio Investidor {inv.investidor.nome} - Pedido #{sol.id}"
                    ))

        print(f"\nRESUMO:")
        print(f"Casos de prejuízo: {casos_encontrados}")
        print(f"Total a ser reparado: R$ {total_reparacao:.2f}")
        
        if not dry_run and casos_encontrados > 0:
            db.commit()
            print("\nSUCESSO: Todas as reparações foram aplicadas e gravadas no banco de dados.")
        elif dry_run:
            print("\nAVISO: Nenhuma alteração foi feita (Modo Dry Run).")
        else:
            print("\nINFO: Nenhum caso de prejuízo real encontrado.")

    except Exception as e:
        db.rollback()
        print(f"\nERRO FATAL: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--exec", action="store_true", help="Executa a reparação de fato")
    args = parser.parse_args()
    
    reparar_prejuizos(dry_run=not args.exec)
