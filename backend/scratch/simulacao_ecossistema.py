from decimal import Decimal

def simular_ecossistema():
    # --- CONFIGURAÇÃO ---
    clientes = [f"Cliente_{i}" for i in range(1, 11)]
    lojistas = [f"Lojista_{i}" for i in range(1, 6)]
    
    saldo_digital_clientes = {c: Decimal("0.00") for c in clientes}
    investido_pool = {c: Decimal("0.00") for c in clientes}
    
    saldo_mp_lojistas = {l: Decimal("100.00") for l in lojistas} # Início com R$ 100
    saldo_digital_lojistas = {l: Decimal("100.00") for l in lojistas}
    
    pool_liquidez_digital = Decimal("0.00")
    lucro_plataforma = Decimal("0.00")

    print("🚀 --- PASSO 1: DEPÓSITOS (Capitalização) ---")
    # Cada cliente deposita R$ 200 em um lojista aleatório
    total_depositado = Decimal("0.00")
    for c in clientes:
        valor = Decimal("200.00")
        lojista = lojistas[clientes.index(c) % 5]
        
        # Cliente dá R$ 200 papel -> Lojista transfere R$ 200 digital
        saldo_digital_lojistas[lojista] -= valor
        saldo_mp_lojistas[lojista] += valor # Lojista agora tem o papel
        saldo_digital_clientes[c] += valor
        total_depositado += valor
        
    print(f"✅ R$ {total_depositado} injetados no sistema via Lojistas.")
    print(f"   Saldo Médio MP Lojistas: R$ {sum(saldo_mp_lojistas.values())/5:.2f}")

    print("\n🚀 --- PASSO 2: FUNDO COMUNITÁRIO (Investimento) ---")
    # 5 clientes investem R$ 100 cada no Pool
    for i in range(5):
        c = clientes[i]
        valor = Decimal("100.00")
        saldo_digital_clientes[c] -= valor
        investido_pool[c] += valor
        pool_liquidez_digital += valor
    
    print(f"✅ Pool de Liquidez criado com R$ {pool_liquidez_digital:.2f} digitais.")

    print("\n🚀 --- PASSO 3: EMPRÉSTIMOS (Crédito) ---")
    # 3 clientes pedem empréstimo de R$ 150 cada
    for i in range(7, 10):
        c = clientes[i]
        valor_emprestimo = Decimal("150.00")
        taxa_adesao = Decimal("5.00") # Taxa fixa de exemplo
        
        pool_liquidez_digital -= valor_emprestimo
        saldo_digital_clientes[c] += valor_emprestimo
        lucro_plataforma += taxa_adesao
        
    print(f"✅ R$ 450,00 em empréstimos concedidos usando a liquidez do Pool.")
    print(f"   Pool Restante: R$ {pool_liquidez_digital:.2f}")

    print("\n🚀 --- PASSO 4: MARKETPLACE (Vendas) ---")
    # 3 Vendas de R$ 50 cada com Split de 10%
    for i in range(3):
        vendedor = lojistas[i] # Lojista vendendo produto no Marketplace
        comprador = clientes[i+5]
        valor_venda = Decimal("50.00")
        taxa_marketplace = valor_venda * Decimal("0.10")
        
        saldo_digital_clientes[comprador] -= valor_venda
        saldo_digital_lojistas[vendedor] += (valor_venda - taxa_marketplace)
        lucro_plataforma += taxa_marketplace
        
    print(f"✅ Vendas realizadas. Taxas de Marketplace geraram R$ {lucro_plataforma:.2f} de lucro total.")

    print("\n🚀 --- PASSO 5: SAQUE (Liquidação) ---")
    # Um lojista quer sacar R$ 100 via PIX
    # Como o Pool está em R$ 50 (baixo), ele paga 2%
    valor_saque = Decimal("100.00")
    taxa_saque = Decimal("0.00")
    
    if valor_saque > pool_liquidez_digital:
        taxa_saque = valor_saque * Decimal("0.02")
    else:
        taxa_saque = Decimal("0.01")
        
    lucro_plataforma += taxa_saque
    print(f"✅ Saque realizado. Taxa de R$ {taxa_saque:.2f} cobrada por falta de liquidez no Pool.")

    print("\n🏁 --- BALANÇO FINAL DO ECOSSISTEMA ---")
    print(f"💰 Lucro Total Plataforma: R$ {lucro_plataforma:.2f}")
    print(f"🏦 Liquidez no Pool: R$ {pool_liquidez_digital:.2f}")
    print(f"🏪 Dinheiro nas mãos dos Lojistas (MP): R$ {sum(saldo_mp_lojistas.values()):.2f}")
    print(f"👥 Saldo total dos Clientes: R$ {sum(saldo_digital_clientes.values()):.2f}")

if __name__ == "__main__":
    simular_ecossistema()
