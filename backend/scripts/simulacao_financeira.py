"""
Simulacao Financeira - Trocaria (CUSTOS REDUZIDOS)
Modelo enxuto: sem pro-labore, marketing organico, operacao solo
"""
import json

print("=" * 70)
print("  SIMULACAO FINANCEIRA - TROCARIA (Modelo Enxuto)")
print("=" * 70)

# ============================================================
# PREMISSAS
# ============================================================
USUARIOS = 100
PREMISSA = {
    "usuarios_que_pedem_apoio": 0.15,      # 15% pedem apoio no mes
    "pedidos_que_viran_match": 0.40,        # 40% dos pedidos viram match
    "usuarios_que_anunciam": 0.10,          # 10% anunciam no mes
    "anuncios_que_viram_destaque": 0.10,    # 10% dos anuncios viram destaque
    "anuncios_que_viram_boost": 0.15,       # 15% compram boost (medio)
    "usuarios_que_assinam": 0.05,           # 5% assinam Premium
    "usuarios_com_calote": 0.05,            # 5% dos matches viram calote
    "calotes_que_cobram": 0.30,             # 30% dos calotes usam cobranca
    "usuarios_que_resgatam": 0.10,          # 10% resgatam pontos no mes
    "match_taxa_pct": 0.02,                # 2% taxa de match
    "match_valor_medio": 1500.00,           # valor medio do pedido
    "assinatura_mensal": 19.99,
    "assinatura_anual": 199.99,
    "taxa_publicacao_pct": 0.02,
    "taxa_publicacao_min": 2.00,
    "taxa_publicacao_max": 20.00,
    "taxa_match": 2.00,
    "taxa_cobranca": 2.00,
    "taxa_resgate": 2.99,                   # NOVO: taxa por saque
    "destaque_preco": 5.00,
    "boost_pct_medio": 6.00,               # media dos pacotes de boost
    "resgate_medio": 35.00,                # valor medio de resgate
}

# ============================================================
# RECEITAS
# ============================================================
print("\n" + "-" * 70)
print("  1. RECEITAS (100 usuarios ativos)")
print("-" * 70)

receitas = []

# 1. Taxa de Publicacao (2%, min R$2, max R$20)
qtd_pedidos = int(USUARIOS * PREMISSA["usuarios_que_pedem_apoio"])
taxa_publicacao_media = max(PREMISSA["taxa_publicacao_min"], min(PREMISSA["taxa_publicacao_max"], PREMISSA["match_valor_medio"] * PREMISSA["taxa_publicacao_pct"]))
rec_publicacao = qtd_pedidos * taxa_publicacao_media
receitas.append(("Taxa de Publicacao (2%)", qtd_pedidos, taxa_publicacao_media, rec_publicacao))

# 2. Taxa de Match (R$ 2,00 fixo)
qtd_matches = int(qtd_pedidos * PREMISSA["pedidos_que_viran_match"])
rec_match = qtd_matches * PREMISSA["taxa_match"]
receitas.append(("Taxa de Match (R$ 2 fixo)", qtd_matches, PREMISSA["taxa_match"], rec_match))

# 3. Assinatura Premium
qtd_assinantes = int(USUARIOS * PREMISSA["usuarios_que_assinam"])
qtd_mensal = int(qtd_assinantes * 0.7)
qtd_anual = int(qtd_assinantes * 0.3)
rec_assinatura = qtd_mensal * PREMISSA["assinatura_mensal"] + qtd_anual * PREMISSA["assinatura_anual"] / 12
receitas.append(("Assinatura Premium", qtd_assinantes, 0, rec_assinatura))

# 4. Destaque (R$ 5,00)
qtd_anuncios = int(USUARIOS * PREMISSA["usuarios_que_anunciam"])
qtd_destaque = int(qtd_anuncios * PREMISSA["anuncios_que_viram_destaque"])
rec_destaque = qtd_destaque * PREMISSA["destaque_preco"]
receitas.append(("Destaque de Anuncio (R$ 5)", qtd_destaque, PREMISSA["destaque_preco"], rec_destaque))

# 5. Boost de Views (R$ 6 medio)
qtd_boost = int(qtd_anuncios * PREMISSA["anuncios_que_viram_boost"])
rec_boost = qtd_boost * PREMISSA["boost_pct_medio"]
receitas.append(("Boost de Views (R$ 6 medio)", qtd_boost, PREMISSA["boost_pct_medio"], rec_boost))

# 6. Cobranca (R$ 2,00)
qtd_calotes = int(qtd_matches * PREMISSA["usuarios_com_calote"])
qtd_cobrancas = int(qtd_calotes * PREMISSA["calotes_que_cobram"])
rec_cobranca = qtd_cobrancas * PREMISSA["taxa_cobranca"]
receitas.append(("Cobranca de Calote (R$ 2)", qtd_cobrancas, PREMISSA["taxa_cobranca"], rec_cobranca))

# 7. Taxa de Resgate (NOVO - R$ 2,99 por saque)
qtd_resgates = int(USUARIOS * PREMISSA["usuarios_que_resgatam"])
rec_resgate = qtd_resgates * PREMISSA["taxa_resgate"]
receitas.append(("Taxa de Resgate (R$ 2,99)", qtd_resgates, PREMISSA["taxa_resgate"], rec_resgate))

# TOTAL RECEITAS
total_receitas = sum(r[3] for r in receitas)

print(f"\n  {'Fonte':<45} {'Qtd':>5} {'Unit':>8} {'Total':>10}")
print(f"  {'-'*68}")
for nome, qtd, unit, total in receitas:
    unit_str = f"R$ {unit:.2f}" if unit > 0 else "-"
    print(f"  {nome:<45} {qtd:>5} {unit_str:>8} R$ {total:>7.2f}")
print(f"  {'-'*68}")
print(f"  {'TOTAL RECEITAS':<45} {'':>5} {'':>8} R$ {total_receitas:>7.2f}")

# ============================================================
# CUSTOS (MODELO ENXUTO)
# ============================================================
print("\n" + "-" * 70)
print("  2. CUSTOS (Modelo Enxuto - Sem Pro-labore/Marketing)")
print("-" * 70)

custos = []

# Render (Web Service Free)
custo_render = 0
custos.append(("Render (Web Service)", "Free Tier", custo_render))

# Neon DB (Free tier)
custo_neon = 0
custos.append(("Neon (Banco Postgres)", "Free Tier", custo_neon))

# Cloudflare (DNS/Proxy)
custo_dominio = 0
custos.append(("Cloudflare (DNS/Proxy)", "Free Tier", custo_dominio))

# Mercado Pago (taxa de processamento: 3.99% por transacao PIX)
taxa_mp_pct = 0.0399
custo_mp = total_receitas * taxa_mp_pct
custos.append(("Mercado Pago (3,99%)", "Variavel", custo_mp))

# Taxa de resgate paga aos usuarios (custo direto)
custo_resgates = qtd_resgates * PREMISSA["resgate_medio"]
custos.append(("Pagamento de Resgates (usuarios)", "Variavel", custo_resgates))

# Email/Resend API
custo_email = 0
custos.append(("Resend (Email)", "Free Tier (100/dia)", custo_email))

# Ferramentas
custo_ferramentas = 0
custos.append(("GitHub, VSCode, etc.", "Free", custo_ferramentas))

# Pro-labore: ZERO (operacao solo, sem salario)
custo_pro_labore = 0
custos.append(("Pro-labore (Fundador)", "Operacao solo", custo_pro_labore))

# Marketing: ZERO (organico via indicação/Kwai/TikTok)
custo_marketing = 0
custos.append(("Marketing (Ads)", "Organico (Kwai/TikTok)", custo_marketing))

total_custos = sum(c[2] for c in custos)

print(f"\n  {'Custo':<45} {'Tipo':>10} {'Valor':>10}")
print(f"  {'-'*68}")
for nome, tipo, valor in custos:
    if valor > 0:
        print(f"  {nome:<45} {tipo:>10} R$ {valor:>7.2f}")
    else:
        print(f"  {nome:<45} {tipo:>10} {'Gratis':>10}")
print(f"  {'-'*68}")
print(f"  {'TOTAL CUSTOS':<45} {'':>10} R$ {total_custos:>7.2f}")

# ============================================================
# RESULTADO
# ============================================================
print("\n" + "=" * 70)
print("  3. RESULTADO MENSAL (100 usuarios - Modelo Enxuto)")
print("=" * 70)

lucro = total_receitas - total_custos
margem = (lucro / total_receitas * 100) if total_receitas > 0 else 0

print(f"\n  {'Receitas':.<55} R$ {total_receitas:>8.2f}")
print(f"  {'Custos':.<55} R$ {total_custos:>8.2f}")
print(f"  {'Lucro/Prejuizo':.<55} R$ {lucro:>8.2f}")
print(f"  {'Margem':.<55} {margem:>8.1f}%")

# ============================================================
# PROJECAO PARA DIFERENTES CENARIOS
# ============================================================
print("\n" + "=" * 70)
print("  4. PROJECAO PARA DIFERENTES CENARIOS (Modelo Enxuto)")
print("=" * 70)

cenarios = [
    ("Estagio Inicial", 100),
    ("Crescendo", 500),
    ("Escalando", 2000),
    ("Sustentavel", 5000),
    ("Lucrativo", 10000),
]

print(f"\n  {'Cenario':<20} {'Usuarios':>10} {'Receitas':>12} {'Custos':>12} {'Lucro':>12} {'Margem':>8}")
print(f"  {'-'*75}")
for nome, n_usuarios in cenarios:
    fator = n_usuarios / 100
    r = total_receitas * fator
    # Custos variaveis escalam, fixos permanecem zero
    c = (custo_mp * fator) + (custo_resgates * fator)
    l = r - c
    m = (l / r * 100) if r > 0 else 0
    print(f"  {nome:<20} {n_usuarios:>10} R$ {r:>8.2f} R$ {c:>8.2f} R$ {l:>8.2f} {m:>7.1f}%")

# ============================================================
# RECEITAS DETALHADAS POR USUARIO
# ============================================================
print("\n" + "=" * 70)
print("  5. DETALHAMENTO POR USUARIO")
print("=" * 70)

receita_por_usuario = total_receitas / USUARIOS
custo_por_usuario = total_custos / USUARIOS
lucro_por_usuario = lucro / USUARIOS

print(f"\n  Receita media por usuario:   R$ {receita_por_usuario:.2f}/mes")
print(f"  Custo medio por usuario:     R$ {custo_por_usuario:.2f}/mes")
print(f"  Lucro medio por usuario:     R$ {lucro_por_usuario:.2f}/mes")
print(f"\n  Break-even:                  {total_custos / receita_por_usuario:.0f} usuarios")
print(f"  Payback do CAC (R$ 5):       {(5.0 / lucro_por_usuario) if lucro_por_usuario > 0 else 'N/A'} meses")

# ============================================================
# RESUMO EXECUTIVO
# ============================================================
print("\n" + "=" * 70)
print("  6. RESUMO EXECUTIVO - MODELO ENXUTO")
print("=" * 70)
print(f"""
  MODELO: Marketplace P2P + Servicos (Operacao Solo)

  RECEITAS (100 usuarios):
  - Taxa de Publicacao (2%):        R$ {rec_publicacao:>7.2f}
  - Taxa de Match (R$ 2):           R$ {rec_match:>7.2f}
  - Assinatura Premium:             R$ {rec_assinatura:>7.2f}
  - Destaque (R$ 5):                R$ {rec_destaque:>7.2f}
  - Boost Views (R$ 6):             R$ {rec_boost:>7.2f}
  - Cobranca de Calote (R$ 2):      R$ {rec_cobranca:>7.2f}
  - Taxa de Resgate (R$ 2,99):      R$ {rec_resgate:>7.2f}  <-- NOVO
  -----------------------------------------------------
  TOTAL RECEITAS:                    R$ {total_receitas:>7.2f}

  CUSTOS (Modelo Enxuto):
  - Infrastructure:                 Gratis (Free Tier)
  - Mercado Pago (3,99%):           R$ {custo_mp:>7.2f}
  - Pagamento de Resgates:          R$ {custo_resgates:>7.2f}
  - Pro-labore:                     R$ 0,00 (operacao solo)
  - Marketing:                      R$ 0,00 (organico)
  -----------------------------------------------------
  TOTAL CUSTOS:                      R$ {total_custos:>7.2f}

  LUCRO LIQUIDO:                     R$ {lucro:>7.2f}
  MARGEM:                            {margem:>5.1f}%

  CONCLUSAO:
  - Com 100 usuarios: {margem > 0 and 'LUCRO POSITIVO' or 'PREJUIZO (poucos usuarios)'}
  - Break-even: {total_custos / receita_por_usuario:.0f} usuarios
  - Com 500 usuarios: Lucro de R$ {(total_receitas * 5 - total_custos * 5):.2f}/mes
  - Com 2.000 usuarios: Lucro de R$ {(total_receitas * 20 - total_custos * 20):.2f}/mes
  - Taxa de resgate (R$ 2,99) gera receita extra sem custo direto
  - Compressao de imagens KYC economiza 97% de storage
""")
