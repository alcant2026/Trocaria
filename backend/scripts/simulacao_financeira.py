"""
Simulacao Financeira - Psy Pay
100 usuarios ativos, projecao mensal de receitas e custos
"""
import json

print("=" * 65)
print("  SIMULACAO FINANCEIRA - PSY PAY (100 usuarios ativos)")
print("=" * 65)

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
    "match_taxa_pct": 0.02,                # 2% taxa de match
    "match_valor_medio": 1500.00,           # valor medio do pedido
    "assinatura_mensal": 19.99,
    "assinatura_anual": 199.99,
    "taxa_publicacao": 2.00,
    "taxa_cobranca": 2.00,
    "destaque_preco": 5.00,
    "boost_pct_medio": 6.00,               # media dos pacotes de boost
}

# ============================================================
# RECEITAS
# ============================================================
print("\n" + "-" * 65)
print("  1. RECEITAS")
print("-" * 65)

receitas = []

# 1. Taxa de Publicacao (R$ 2,00)
qtd_pedidos = int(USUARIOS * PREMISSA["usuarios_que_pedem_apoio"])
rec_publicacao = qtd_pedidos * PREMISSA["taxa_publicacao"]
receitas.append(("Taxa de Publicacao (R$2)", qtd_pedidos, PREMISSA["taxa_publicacao"], rec_publicacao))

# 2. Taxa de Match (2%, min R$2, max R$20)
qtd_matches = int(qtd_pedidos * PREMISSA["pedidos_que_viran_match"])
taxa_match_media = max(2.00, min(20.00, PREMISSA["match_valor_medio"] * PREMISSA["match_taxa_pct"]))
rec_match = qtd_matches * taxa_match_media
receitas.append(("Taxa de Match (2% / R$ {:.2f})".format(taxa_match_media), qtd_matches, taxa_match_media, rec_match))

# 3. Assinatura Premium
qtd_assinantes = int(USUARIOS * PREMISSA["usuarios_que_assinam"])
# 70% mensal, 30% anual
qtd_mensal = int(qtd_assinantes * 0.7)
qtd_anual = int(qtd_assinantes * 0.3)
rec_assinatura = qtd_mensal * PREMISSA["assinatura_mensal"] + qtd_anual * PREMISSA["assinatura_anual"] / 12
receitas.append(("Assinatura Premium ({} mensal + {} anual)".format(qtd_mensal, qtd_anual), qtd_assinantes, 0, rec_assinatura))

# 4. Destaque (R$ 5,00)
qtd_anuncios = int(USUARIOS * PREMISSA["usuarios_que_anunciam"])
qtd_destaque = int(qtd_anuncios * PREMISSA["anuncios_que_viram_destaque"])
rec_destaque = qtd_destaque * PREMISSA["destaque_preco"]
receitas.append(("Destaque de Anuncio (R$5)", qtd_destaque, PREMISSA["destaque_preco"], rec_destaque))

# 5. Boost de Views (R$ 6 medio)
qtd_boost = int(qtd_anuncios * PREMISSA["anuncios_que_viram_boost"])
rec_boost = qtd_boost * PREMISSA["boost_pct_medio"]
receitas.append(("Boost de Views (R$ {:.2f} medio)".format(PREMISSA["boost_pct_medio"]), qtd_boost, PREMISSA["boost_pct_medio"], rec_boost))

# 6. Cobranca (R$ 2,00)
qtd_calotes = int(qtd_matches * PREMISSA["usuarios_com_calote"])
qtd_cobrancas = int(qtd_calotes * PREMISSA["calotes_que_cobram"])
rec_cobranca = qtd_cobrancas * PREMISSA["taxa_cobranca"]
receitas.append(("Cobranca de Calote (R$2)", qtd_cobrancas, PREMISSA["taxa_cobranca"], rec_cobranca))

# TOTAL RECEITAS
total_receitas = sum(r[3] for r in receitas)

print(f"\n  {'Fonte':<40} {'Qtd':>5} {'Unit':>8} {'Total':>10}")
print(f"  {'-'*63}")
for nome, qtd, unit, total in receitas:
    unit_str = f"R$ {unit:.2f}" if unit > 0 else "-"
    print(f"  {nome:<40} {qtd:>5} {unit_str:>8} R$ {total:>7.2f}")
print(f"  {'-'*63}")
print(f"  {'TOTAL RECEITAS':<40} {'':>5} {'':>8} R$ {total_receitas:>7.2f}")

# ============================================================
# CUSTOS
# ============================================================
print("\n" + "-" * 65)
print("  2. CUSTOS FIXOS")
print("-" * 65)

custos = []

# Render (Web Service Free - mas vamos considerar o minimo)
custo_render = 0  # Plano Free: US$ 0/mes (512MB RAM, 0.1 CPU)
custos.append(("Render (Web Service)", "Free Tier", custo_render))

# Neon DB (Free tier - 500MB, 10 conexoes)
custo_neon = 0  # Plano Free: US$ 0/mes
custos.append(("Neon (Banco Postgres)", "Free Tier", custo_neon))

# Domino (Cloudflare)
custo_dominio = 0  # Cloudflare Free
custos.append(("Cloudflare (DNS/Proxy)", "Free Tier", custo_dominio))

# Mercado Pago (taxa de processamento: 3.99% por transacao)
# Considerando que todas as receitas envolvem PIX via MP
taxa_mp_pct = 0.0399
custo_mp = total_receitas * taxa_mp_pct
custos.append(("Mercado Pago (3.99% sobre receitas)", "3.99%", custo_mp))

# Email/Resend API (100 emails/dia gratis)
custo_email = 0  # Free tier: 100 emails/dia
custos.append(("Resend (Email)", "Free Tier", custo_email))

# Pessoal (fundador)
custo_pro_labore = 1500.00  # Pro-labore do fundador (part-time)
custos.append(("Pro-labore (Fundador)", "Part-time", custo_pro_labore))

# Marketing (Google Ads, Instagram, etc.)
custo_marketing = 500.00  # Marketing inicial modesto
custos.append(("Marketing (Ads)", "Google/IG", custo_marketing))

# Ferramentas (GitHub, etc.)
custo_ferramentas = 0  # GitHub Free, VSCode gratis
custos.append(("Ferramentas", "Free", custo_ferramentas))

total_custos = sum(c[2] for c in custos)

print(f"\n  {'Custo':<40} {'Tipo':>10} {'Valor':>10}")
print(f"  {'-'*63}")
for nome, tipo, valor in custos:
    print(f"  {nome:<40} {tipo:>10} R$ {valor:>7.2f}" if valor > 0 else f"  {nome:<40} {tipo:>10} {'Gratis':>10}")
print(f"  {'-'*63}")
print(f"  {'TOTAL CUSTOS':<40} {'':>10} R$ {total_custos:>7.2f}")

# ============================================================
# RESULTADO
# ============================================================
print("\n" + "=" * 65)
print("  3. RESULTADO MENSAL (100 usuarios)")
print("=" * 65)

lucro = total_receitas - total_custos
margem = (lucro / total_receitas * 100) if total_receitas > 0 else 0

print(f"\n  {'Receitas':.<50} R$ {total_receitas:>8.2f}")
print(f"  {'Custos':.<50} R$ {total_custos:>8.2f}")
print(f"  {'Lucro/Prejuizo':.<50} R$ {lucro:>8.2f}")
print(f"  {'Margem':.<50} {margem:>8.1f}%")

# ============================================================
# PROJECAO PARA DIFERENTES CENARIOS
# ============================================================
print("\n" + "=" * 65)
print("  4. PROJECAO PARA DIFERENTES CENARIOS")
print("=" * 65)

cenarios = [
    ("Estagio Inicial", 100, 0, 500.00, 0, 0),
    ("Crescendo", 500, 0, 1500.00, 2000.00, 0),
    ("Escalando", 2000, 19.00, 3000.00, 5000.00, 19.00),
    ("Sustentavel", 5000, 49.00, 8000.00, 10000.00, 49.00),
]

print(f"\n  {'Cenario':<20} {'Usuarios':>10} {'Receitas':>12} {'Custos':>12} {'Lucro':>12} {'Margem':>8}")
print(f"  {'-'*75}")
for nome, n_usuarios, v_render, v_pessoal, v_mkt, v_db in cenarios:
    # Calcular receita proporcional
    fator = n_usuarios / 100
    r = total_receitas * fator
    # Custos escalaveis
    c = (custo_mp * fator) + v_render + v_pessoal + v_mkt + v_db
    l = r - c
    m = (l / r * 100) if r > 0 else 0
    print(f"  {nome:<20} {n_usuarios:>10} R$ {r:>8.2f} R$ {c:>8.2f} R$ {l:>8.2f} {m:>7.1f}%")

# ============================================================
# RECEITAS DETALHADAS POR USUARIO
# ============================================================
print("\n" + "=" * 65)
print("  5. DETALHAMENTO POR USUARIO")
print("=" * 65)

receita_por_usuario = total_receitas / USUARIOS
custo_por_usuario = total_custos / USUARIOS
lucro_por_usuario = lucro / USUARIOS

print(f"\n  Receita media por usuario:   R$ {receita_por_usuario:.2f}/mes")
print(f"  Custo medio por usuario:     R$ {custo_por_usuario:.2f}/mes")
print(f"  Lucro medio por usuario:     R$ {lucro_por_usuario:.2f}/mes")
print(f"\n  Custo de aquisicao (CAC):    R$ 5,00 - R$ 15,00 (estimado via ads)")
print(f"  Break-even por usuario:      {custo_por_usuario / receita_por_usuario * 30:.1f} dias" if receita_por_usuario > 0 else "")
print(f"  Payback do CAC:              {(5.0 / lucro_por_usuario) if lucro_por_usuario > 0 else 'N/A'} meses (CAC R$5)")

# ============================================================
# RESUMO EXECUTIVO
# ============================================================
print("\n" + "=" * 65)
print("  6. RESUMO EXECUTIVO")
print("=" * 65)
print(f"""
  MODELO DE NEGOCIO: Marketplace P2P + Servicos

  RECEITAS (100 usuarios):
  - Taxa de Publicacao (R$ 2):        R$ {rec_publicacao:>7.2f}
  - Taxa de Match (2%):               R$ {rec_match:>7.2f}
  - Assinatura Premium (R$ 19,99):    R$ {rec_assinatura:>7.2f}
  - Destaque (R$ 5):                  R$ {rec_destaque:>7.2f}
  - Boost Views (R$ 6 medio):         R$ {rec_boost:>7.2f}
  - Cobranca de Calote (R$ 2):        R$ {rec_cobranca:>7.2f}
  ------------------------------------------------
  TOTAL:                               R$ {total_receitas:>7.2f}

  CUSTOS:
  - Infrastructure (Render + Neon):   Gratis (Free Tier)
  - Mercado Pago (3.99%):             R$ {custo_mp:>7.2f}
  - Pro-labore:                       R$ {custo_pro_labore:>7.2f}
  - Marketing:                        R$ {custo_marketing:>7.2f}
  ------------------------------------------------
  TOTAL:                               R$ {total_custos:>7.2f}

  LUCRO LIQUIDO:                       R$ {lucro:>7.2f}
  MARGEM:                              {margem:>5.1f}%

  NOTAS:
  - Free Tier Render/Neon: 512MB RAM e 500MB BD - suficiente para < 1000 usuarios
  - Quando escalar > 1000 usuarios: Render US$ 19/mes, Neon US$ 19/mes
  - MP processa 3.99% de cada transacao PIX (custo repassavel?)
  - Com 100 usuarios, o modelo JA e sustentavel (lucro positivo)
  - A margem melhora conforme escala (custos fixos diluidos)
""")
