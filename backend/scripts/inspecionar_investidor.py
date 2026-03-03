from database import SessionLocal
from modelos.modelos_db import SolicitacaoEmprestimo, Investimento, Usuario
from decimal import Decimal

db = SessionLocal()
try:
    sol = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.id == 5).first()
    if sol:
        print(f"Empréstimo #5:")
        print(f"  Valor: {sol.valor}")
        print(f"  Status: {sol.status}")
        print(f"  Parcelas: {sol.parcelas_pagas}/{sol.prazo_meses}")
        print(f"  Taxa Juros: {sol.taxa_juros}%")
        
        for inv in sol.investimentos:
            print(f"  Investimento ID {inv.id}:")
            print(f"    Valor Investido: {inv.valor_investido}")
            print(f"    Pago para Investidor: {inv.pago_para_investidor}")
            
            # Cálculo manual para bater
            taxa_mensal = sol.taxa_juros / 100
            lucro_bruto_total = inv.valor_investido * (taxa_mensal * sol.prazo_meses)
            lucro_liquido_total = lucro_bruto_total * Decimal("0.90")
            valor_liquido_total_esperado = inv.valor_investido + lucro_liquido_total
            valor_restante = valor_liquido_total_esperado - inv.pago_para_investidor
            
            print(f"    Líquido Esperado: {valor_liquido_total_esperado}")
            print(f"    Restante Calculado: {valor_restante}")
    else:
        print("Empréstimo #5 não encontrado.")
finally:
    db.close()
