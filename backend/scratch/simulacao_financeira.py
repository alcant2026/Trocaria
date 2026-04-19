from decimal import Decimal
import random

def simular_caixa():
    # Estado Inicial
    saldo_digital = Decimal("10.00")
    saldo_gaveta = Decimal("10.00")
    comissoes_acumuladas = Decimal("0.00")
    lucro_plataforma_total = Decimal("0.00")
    
    taxa_especie_total = Decimal("0.05") # 5%
    comissao_parceiro_dep = Decimal("0.01") # 1%
    lucro_app_dep = Decimal("0.04") # 4%
    
    taxa_saque_total = Decimal("0.02") # 2%
    comissao_parceiro_saq = Decimal("0.01") # 1%
    lucro_app_saq = Decimal("0.01") # 1%

    print("🚀 INICIANDO SIMULAÇÃO PSY PAY - 7 DIAS")
    print(f"Estado Inicial: Digital R$ {saldo_digital} | Gaveta R$ {saldo_gaveta}\n")

    for dia in range(1, 8):
        transacoes_dia = 0
        volume_dia = Decimal("0.00")
        
        # Simula 8 horas de movimento (média de 10 a 15 transações aleatórias)
        for _ in range(random.randint(10, 15)):
            tipo = random.choice(["deposito", "saque"])
            
            if tipo == "deposito":
                # No depósito, o limite é o saldo DIGITAL do lojista
                valor_max = float(saldo_digital)
                if valor_max < 1: continue
                
                valor = Decimal(str(round(random.uniform(1, min(valor_max, 100)), 2)))
                
                # Processamento
                saldo_digital -= valor
                saldo_gaveta += valor
                
                comissao = valor * comissao_parceiro_dep
                lucro_app = valor * lucro_app_dep
                
                comissoes_acumuladas += comissao
                lucro_plataforma_total += lucro_app
                transacoes_dia += 1
                volume_dia += valor
                
            else: # SAQUE
                # No saque, o limite é o saldo em GAVETA do lojista
                valor_max = float(saldo_gaveta)
                if valor_max < 1: continue
                
                valor = Decimal(str(round(random.uniform(1, min(valor_max, 100)), 2)))
                
                # O parceiro entrega o valor líquido (Saque - Taxa?) 
                # Não, conforme regra nova: Cliente paga Valor + 2% digital. Parceiro entrega Valor.
                
                saldo_digital += valor # Reembolso digital do que deu em mãos
                saldo_gaveta -= valor
                
                comissao = valor * comissao_parceiro_saq
                lucro_app = valor * lucro_app_saq
                
                comissoes_acumuladas += comissao
                lucro_plataforma_total += lucro_app
                transacoes_dia += 1
                volume_dia += valor

        # Final do Dia: Lojista "Liquida" as comissões (puxa pro saldo digital)
        saldo_digital += comissoes_acumuladas
        ganho_dia = comissoes_acumuladas
        comissoes_acumuladas = Decimal("0.00")

        print(f"📅 DIA {dia}: {transacoes_dia} transações | Volume: R$ {volume_dia:.2f}")
        print(f"   Saldo Digital: R$ {saldo_digital:.2f} | Gaveta: R$ {saldo_gaveta:.2f}")
        print(f"   Lucro Lojista hoje: R$ {ganho_dia:.2f} | Lucro Acumulado App: R$ {lucro_plataforma_total:.2f}")
        print("-" * 50)

    print("\n🏁 FIM DA SIMULAÇÃO")
    print(f"Saldo Digital Final: R$ {saldo_digital:.2f}")
    print(f"Saldo Físico Final: R$ {saldo_gaveta:.2f}")
    print(f"Patrimônio Total Lojista: R$ {saldo_digital + saldo_gaveta:.2f}")
    print(f"Lucro Total Plataforma: R$ {lucro_plataforma_total:.2f}")

if __name__ == "__main__":
    simular_caixa()
