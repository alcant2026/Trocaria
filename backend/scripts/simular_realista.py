#!/usr/bin/env python3
"""
Simulacao realista: R$100 iniciais, crescimento organico mes a mes.
Mostra quando o negocio se paga e projecao de 12 meses.
"""
from decimal import Decimal

# ============================================================
# CUSTOS FIXOS MENSAIS
# ============================================================
HOSTING         = Decimal("0")     # Render free tier
DOMINIO_MENSAL  = Decimal("3.33")  # R$40/ano ÷ 12
SERVIDOR_EMAIL  = Decimal("0")     # Gratuito inicial
TOTAL_FIXO      = HOSTING + DOMINIO_MENSAL + SERVIDOR_EMAIL

# ============================================================
# CUSTOS VARIAVEIS
# ============================================================
TAXA_MERCADOPAGO = Decimal("0.0399")  # 3.99% por transacao
PONTOS_POR_REAL  = 1000               # 1000 pts = R$1
TAXA_RESGATE     = Decimal("0.20")    # 20% dos pontos sao resgatados

# ============================================================
# PRECOS
# ============================================================
KYC      = Decimal("14.99")
PREMIUM  = Decimal("19.90")
PUBLIC   = Decimal("4.99")
MATCH    = Decimal("9.99")
DESTAQUE = Decimal("5.00")
COBRANCA = Decimal("15.00")
PRECO_VIEWS = {
    100: Decimal("1.00"),
    500: Decimal("5.00"),
    1500: Decimal("12.00"),
    5000: Decimal("35.00"),
}

# ============================================================
# CAIXA INICIAL
# ============================================================
caixa = Decimal("100.00")

# ============================================================
# CRESCIMENTO ORGANICO (viral coefficient ~1.3)
# ============================================================
# Cada usuario convida em media 2 pessoas por mes
# 30% dos convidados se cadastram
# Fator viral = 2 * 0.30 = 0.6 novos usuarios por usuario existente
FATOR_VIRAL = 0.6

# Usuarios iniciais (voce + amigos)
USUARIOS_INICIAIS = 5

print("=" * 75)
print("  SIMULACAO REALISTA - CAIXA INICIAL R$ 100,00")
print("  Crescimento organico (viral coefficient 0.6)")
print("=" * 75)
print()
print(f"{'Mes':>4} {'Usuarios':>8} {'Novos':>6} {'Receita':>10} {'Custos':>10} {'Lucro':>10} {'Caixa':>10} {'Pts OK':>8}")
print("-" * 75)

usuarios = USUARIOS_INICIAIS
meses_pagar = None
total_receita_12m = Decimal("0")
total_custo_12m = Decimal("0")
total_pts_12m = 0
total_usuarios_final = 0

for mes in range(1, 13):
    # Crescimento viral
    novos = int(usuarios * FATOR_VIRAL)
    if mes == 1:
        novos = USUARIOS_INICIAIS  # base inicial
    
    usuarios += novos
    
    # Atividade por mes (cresce com maturidade)
    # Mes 1-2: pouca atividade (exploracao)
    # Mes 3-6: engajamento medio
    # Mes 7-12: alta atividade
    if mes <= 2:
        taxa_atividade = 0.10   # 10% dos usuarios ativos
        boost_medio = Decimal("1.00")
    elif mes <= 6:
        taxa_atividade = 0.20   # 20% ativos
        boost_medio = Decimal("5.00")
    else:
        taxa_atividade = 0.30   # 30% ativos
        boost_medio = Decimal("12.00")
    
    ativos = int(usuarios * taxa_atividade)
    
    # RECEITAS
    receita = Decimal("0")
    pontos_gerados = 0
    receita_detalhe = {}
    
    # KYC (25% dos ativos)
    kyc_count = int(ativos * 0.25)
    rec_kyc = Decimal(str(kyc_count)) * KYC
    receita += rec_kyc
    receita_detalhe["KYC"] = rec_kyc
    pontos_gerados += kyc_count * int(KYC * 3)  # 3x comprador
    
    # Premium (12% dos ativos)
    prem_count = int(ativos * 0.12)
    rec_prem = Decimal(str(prem_count)) * PREMIUM
    receita += rec_prem
    receita_detalhe["Premium"] = rec_prem
    pontos_gerados += prem_count * int(PREMIUM * 3)
    
    # Publicacoes P2P (35% dos ativos)
    pub_count = int(ativos * 0.35)
    rec_pub = Decimal(str(pub_count)) * PUBLIC
    receita += rec_pub
    receita_detalhe["P2P Pub"] = rec_pub
    pontos_gerados += pub_count * int(PUBLIC * 3)
    
    # Match (20% dos ativos)
    match_count = int(ativos * 0.20)
    rec_match = Decimal(str(match_count)) * MATCH
    receita += rec_match
    receita_detalhe["Match"] = rec_match
    pontos_gerados += match_count * int(MATCH * 3)
    
    # Destaque (18% dos ativos)
    dest_count = int(ativos * 0.18)
    rec_dest = Decimal(str(dest_count)) * DESTAQUE
    receita += rec_dest
    receita_detalhe["Destaque"] = rec_dest
    pontos_gerados += dest_count * int(DESTAQUE * 3)
    
    # Boost (10% dos ativos)
    boost_count = int(ativos * 0.10)
    rec_boost = Decimal(str(boost_count)) * boost_medio
    receita += rec_boost
    receita_detalhe["Boost"] = rec_boost
    pontos_gerados += boost_count * int(boost_medio * 3)
    
    # Cobranca (5% dos ativos - raro no inicio)
    cob_count = int(ativos * 0.05)
    rec_cob = Decimal(str(cob_count)) * COBRANCA
    receita += rec_cob
    receita_detalhe["Cobranca"] = rec_cob
    pontos_gerados += cob_count * int(COBRANCA * 3)
    
    # Pontos de indicacao (bonus cadastro)
    indicados = int(novos * 0.30)  # 30% usam codigo
    pontos_indicacao = indicados * 10
    pontos_gerados += pontos_indicacao
    
    # Cliques marketplace (80% dos ativos, media 15 cliques/mes)
    cliques = int(ativos * 0.80 * 15)
    pontos_cliques = cliques * 1  # 1 pt por clique
    pontos_gerados += pontos_cliques
    
    # CUSTOS
    custo_total = Decimal("0")
    
    # Taxa MercadoPago sobre receita
    custo_mp = receita * TAXA_MERCADOPAGO
    custo_total += custo_mp
    
    # Custo de pontos (se resgatados)
    custo_pts = Decimal(str(pontos_gerados)) / Decimal(str(PONTOS_POR_REAL))
    custo_pts_real = custo_pts * TAXA_RESGATE
    custo_total += custo_pts_real
    
    # Custo fixo
    custo_total += TOTAL_FIXO
    
    # LUCRO
    lucro = receita - custo_total
    caixa += lucro
    
    # Acumulados
    total_receita_12m += receita
    total_custo_12m += custo_total
    total_pts_12m += pontos_gerados
    
    if caixa >= Decimal("0") and meses_pagar is None and mes > 1:
        meses_pagar = mes
    
    barra = "█" * min(int(receita / Decimal("10")), 30) if receita > 0 else ""
    
    print(f"{mes:>4} {usuarios:>8} {novos:>6} R${float(receita):>8.2f} R${float(custo_total):>8.2f} R${float(lucro):>8.2f} R${float(caixa):>8.2f} {pontos_gerados:>6}")

total_usuarios_final = usuarios

print()
print("=" * 75)
print("  RESUMO 12 MESES")
print("-" * 75)
print(f"  Usuarios final:                     {total_usuarios_final}")
print(f"  Receita total acumulada:            R$ {float(total_receita_12m):>10.2f}")
print(f"  Custos totais:                      R$ {float(total_custo_12m):>10.2f}")
print(f"  Lucro liquido acumulado:            R$ {float(caixa - Decimal('100')):>10.2f}")
print(f"  Caixa final:                        R$ {float(caixa):>10.2f}")
print(f"  ROI:                                {float((caixa - Decimal('100')) / Decimal('100') * 100):.0f}%")
print(f"  Pontos totais gerados:              {total_pts_12m:,}")
print(f"  Custo total pts (se 20% resgate):   R$ {float(total_custo_12m):.2f}")
print()
if meses_pagar:
    print(f"  ✅ O negocio se pagou no mes {meses_pagar}!")
else:
    print(f"  ⚠️  Caixa ainda negativo. Precisa de mais tempo ou investimento.")
print("=" * 75)
