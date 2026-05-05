#!/usr/bin/env python3
"""
Simulacao financeira de 1 mes com 100 usuarios
Mostra todas as receitas e custos do modelo de negocio
"""
import random
import datetime
from decimal import Decimal

random.seed(42)  # Reprodutivel

# ============================================================
# VALORES / PRECOS
# ============================================================
VALOR_KYC = 14.99
VALOR_PREMIUM_MENSAL = 19.90
VALOR_PREMIUM_ANUAL = 199.90
VALOR_DESTAQUE = 5.00
VALOR_PUBLICACAO = 4.99  # taxa de solicitacao P2P
VALOR_MATCH = 9.99  # taxa de match
VALOR_COBRANCA = 15.00  # taxa de cobranca de divida

# Pacotes de views (boost)
PRECO_VIEWS = {
    0: {"views": 100, "preco": 9.90},
    1: {"views": 500, "preco": 39.90},
    2: {"views": 1500, "preco": 99.90},
    3: {"views": 5000, "preco": 299.90},
}

# Pontos
PONTOS_POR_REAL_INDICADOR = 1   # indicador ganha 1 ponto por R$1 gasto
PONTOS_POR_REAL_COMPRADOR = 3    # comprador ganha 3x pontos
TAXA_CONVERSAO_PONTOS = 0.001   # R$ 1,00 por 1000 pontos = R$0.001 por ponto

# ============================================================
# DISTRIBUICAO PROBABILISTICA (baseado em comportamento real)
# ============================================================
NUM_USUARIOS = 100

# Probabilidades de cada evento POR USUARIO POR MES
PROB_ASSINATURA = 0.12      # 12% assina premium no mes
PROB_KYC = 0.25              # 25% faz KYC
PROB_PUBLICAR_P2P = 0.35     # 35% cria solicitacao P2P
PROB_DAR_MATCH = 0.20        # 20% da match em algum contrato
PROB_DESTAQUE = 0.18          # 18% destaca anuncio no marketplace
PROB_BOOST = 0.10             # 10% compra boost (turbinar)
PROB_COBRANCA = 0.08          # 8% gera cobranca de divida
PROB_INDICACAO = 0.30         # 30% usa codigo de indicacao no cadastro
PROB_CLIQUE_MARKETPLACE = 0.80  # 80% clica em links do marketplace
MEDIA_CLIQUES_MES = 15        # media de cliques por mes por usuario ativo

# ============================================================
# SIMULACAO
# ============================================================
print("=" * 70)
print(f"  SIMULACAO FINANCEIRA - {NUM_USUARIOS} USUARIOS - 30 DIAS")
print("=" * 70)

# Cria usuarios
usuarios = []
for i in range(NUM_USUARIOS):
    u = {
        "id": i,
        "nome": f"User{i:04d}",
        "indicado_por": None,
        "indicacoes": [],
        "assinante": False,
        "pontos": 0,
    }
    
    # Cada usuario pode ter sido indicado por ate 3 pessoas diferentes
    num_indicadores = 0
    if random.random() < PROB_INDICACAO:
        num_indicadores = random.choices([1, 2, 3], weights=[0.6, 0.3, 0.1])[0]
    
    for _ in range(num_indicadores):
        # Sorteia um indicador que veio antes (cadastro sequencial)
        possiveis = [x for x in usuarios if x["id"] != i]
        if possiveis:
            indicador = random.choice(possiveis)
            # Evita loop (se o indicador ja foi indicado por este usuario)
            if i not in [ind["id"] for ind in indicador.get("indicacoes", [])]:
                u["indicacoes"].append({"id": indicador["id"], "nome": indicador["nome"]})
    
    usuarios.append(u)

# Contadores
receitas = {
    "assinaturas_premium": Decimal("0"),
    "kyc_verificacao": Decimal("0"),
    "publicacoes_p2p": Decimal("0"),
    "matches_p2p": Decimal("0"),
    "destaques_comunidade": Decimal("0"),
    "boosts_views": Decimal("0"),
    "cobrancas_divida": Decimal("0"),
    "total_bruto": Decimal("0"),
}

custos = {
    "pontos_indicadores": 0,    # pontos dados a indicadores
    "pontos_compradores": 0,     # pontos dados a compradores (3x)
    "pontos_indicacao_cadastro": 0,  # bonus de cadastro (10+5 ptos)
    "pontos_cliques_marketplace": 0,  # pontos por clicks em anuncios
    "total_pontos_concedidos": 0,
    "custo_monetario_pontos": Decimal("0"),  # se converter pontos em dinheiro
}

contadores = {
    "assinaturas": 0,
    "kyc": 0,
    "publicacoes": 0,
    "matches": 0,
    "destaques": 0,
    "boosts": 0,
    "cobrancas": 0,
    "total_indicacoes_registradas": 0,
    "total_cliques_marketplace": 0,
}

# Processa cada usuario
for u in usuarios:
    # ASSINATURA PREMIUM
    if random.random() < PROB_ASSINATURA:
        anual = random.random() < 0.15  # 15% dos assinantes escolhem anual
        valor = VALOR_PREMIUM_ANUAL if anual else VALOR_PREMIUM_MENSAL
        receitas["assinaturas_premium"] += Decimal(str(valor))
        contadores["assinaturas"] += 1
        u["assinante"] = True
        
        # Comprador ganha 3x pontos
        pontos_compra = int(valor * PONTOS_POR_REAL_COMPRADOR)
        u["pontos"] += pontos_compra
        custos["pontos_compradores"] += pontos_compra
        
        # Cada indicador ganha 1x pontos
        for ind in u["indicacoes"]:
            pontos_ind = int(valor * PONTOS_POR_REAL_INDICADOR)
            usuarios[ind["id"]]["pontos"] += pontos_ind
            custos["pontos_indicadores"] += pontos_ind
    
    # KYC
    if random.random() < PROB_KYC:
        receitas["kyc_verificacao"] += Decimal(str(VALOR_KYC))
        contadores["kyc"] += 1
        pontos_compra = int(VALOR_KYC * PONTOS_POR_REAL_COMPRADOR)
        u["pontos"] += pontos_compra
        custos["pontos_compradores"] += pontos_compra
        for ind in u["indicacoes"]:
            custos["pontos_indicadores"] += int(VALOR_KYC * PONTOS_POR_REAL_INDICADOR)
    
    # PUBLICACAO P2P (SOLICITACAO)
    if random.random() < PROB_PUBLICAR_P2P:
        receitas["publicacoes_p2p"] += Decimal(str(VALOR_PUBLICACAO))
        contadores["publicacoes"] += 1
        pontos_compra = int(VALOR_PUBLICACAO * PONTOS_POR_REAL_COMPRADOR)
        u["pontos"] += pontos_compra
        custos["pontos_compradores"] += pontos_compra
        for ind in u["indicacoes"]:
            custos["pontos_indicadores"] += int(VALOR_PUBLICACAO * PONTOS_POR_REAL_INDICADOR)
    
    # MATCH
    if random.random() < PROB_DAR_MATCH:
        receitas["matches_p2p"] += Decimal(str(VALOR_MATCH))
        contadores["matches"] += 1
        pontos_compra = int(VALOR_MATCH * PONTOS_POR_REAL_COMPRADOR)
        u["pontos"] += pontos_compra
        custos["pontos_compradores"] += pontos_compra
        for ind in u["indicacoes"]:
            custos["pontos_indicadores"] += int(VALOR_MATCH * PONTOS_POR_REAL_INDICADOR)
    
    # DESTAQUE COMUNIDADE
    if random.random() < PROB_DESTAQUE:
        receitas["destaques_comunidade"] += Decimal(str(VALOR_DESTAQUE))
        contadores["destaques"] += 1
        pontos_compra = int(VALOR_DESTAQUE * PONTOS_POR_REAL_COMPRADOR)
        u["pontos"] += pontos_compra
        custos["pontos_compradores"] += pontos_compra
        for ind in u["indicacoes"]:
            custos["pontos_indicadores"] += int(VALOR_DESTAQUE * PONTOS_POR_REAL_INDICADOR)
    
    # BOOST (TURBINAR VIEWS)
    if random.random() < PROB_BOOST:
        pacote = random.choice(list(PRECO_VIEWS.values()))
        receitas["boosts_views"] += Decimal(str(pacote["preco"]))
        contadores["boosts"] += 1
        pontos_compra = int(pacote["preco"] * PONTOS_POR_REAL_COMPRADOR)
        u["pontos"] += pontos_compra
        custos["pontos_compradores"] += pontos_compra
        for ind in u["indicacoes"]:
            custos["pontos_indicadores"] += int(pacote["preco"] * PONTOS_POR_REAL_INDICADOR)
    
    # COBRANCA DE DIVIDA
    if random.random() < PROB_COBRANCA:
        receitas["cobrancas_divida"] += Decimal(str(VALOR_COBRANCA))
        contadores["cobrancas"] += 1
        pontos_compra = int(VALOR_COBRANCA * PONTOS_POR_REAL_COMPRADOR)
        u["pontos"] += pontos_compra
        custos["pontos_compradores"] += pontos_compra
        for ind in u["indicacoes"]:
            custos["pontos_indicadores"] += int(VALOR_COBRANCA * PONTOS_POR_REAL_INDICADOR)

# Pontos de indicacao no cadastro
total_indicacoes = sum(len(u["indicacoes"]) for u in usuarios)
contadores["total_indicacoes_registradas"] = total_indicacoes
custos["pontos_indicacao_cadastro"] = total_indicacoes * 10  # 10 pts por indicacao

# Cliques no marketplace (geram pontos pros anunciantes - custo futuro)
for u in usuarios:
    if random.random() < PROB_CLIQUE_MARKETPLACE:
        cliques = random.randint(1, MEDIA_CLIQUES_MES * 3)
        contadores["total_cliques_marketplace"] += cliques
        # Cada clique gera 1-5 pontos pro anunciante (media 2.5 se premium, 1 se free)
        pts_por_clique = 2 if u["assinante"] else 1
        pontos_gerados = cliques * pts_por_clique
        custos["pontos_cliques_marketplace"] += pontos_gerados

# Totalizar
custos["total_pontos_concedidos"] = (
    custos["pontos_indicadores"] +
    custos["pontos_compradores"] +
    custos["pontos_indicacao_cadastro"] +
    custos["pontos_cliques_marketplace"]
)

# Custo monetario dos pontos (se usuario resgatar 1000 pts = R$0.10)
custos["custo_monetario_pontos"] = Decimal(str(custos["total_pontos_concedidos"])) * Decimal(str(TAXA_CONVERSAO_PONTOS))

# Total receitas
receitas["total_bruto"] = sum(receitas.values()) - receitas.get("total_bruto", Decimal("0"))

# Lucro estimado
# Receita da plataforma = receitas de taxas - custos com pontos (se resgatados)
# Tambem considerar que nem todo ponto e resgatado (20% de resgate estimado)
taxa_resgate = 0.20
custo_real_pontos = custos["custo_monetario_pontos"] * Decimal(str(taxa_resgate))
liquido = receitas["total_bruto"] - custo_real_pontos

# ============================================================
# RELATORIO
# ============================================================
print()
print("📊 VOLUME DE TRANSACOES")
print("-" * 50)
print(f"  Assinaturas Premium vendidas:   {contadores['assinaturas']:>6}")
print(f"  Verificacoes KYC realizadas:    {contadores['kyc']:>6}")
print(f"  Solicitacoes P2P criadas:       {contadores['publicacoes']:>6}")
print(f"  Matches P2P concretizados:      {contadores['matches']:>6}")
print(f"  Destaques de anuncios:          {contadores['destaques']:>6}")
print(f"  Boosts (turbinar views):        {contadores['boosts']:>6}")
print(f"  Cobrancas de divida:            {contadores['cobrancas']:>6}")
print(f"  Indicacoes registradas:         {contadores['total_indicacoes_registradas']:>6}")
print(f"  Cliques no marketplace:         {contadores['total_cliques_marketplace']:>6}")

print()
print("💰 RECEITAS (R$)")
print("-" * 50)
for k, v in receitas.items():
    if k != "total_bruto":
        print(f"  {k.replace('_', ' ').title():35s} R$ {float(v):>10.2f}")
print(f"  {'─' * 48}")
print(f"  {'RECEITA BRUTA TOTAL':35s} R$ {float(receitas['total_bruto']):>10.2f}")

print()
print("📉 CUSTOS - PONTOS CONCEDIDOS")
print("-" * 50)
print(f"  Pontos p/ indicadores (1x):         {custos['pontos_indicadores']:>10,}")
print(f"  Pontos p/ compradores (3x):         {custos['pontos_compradores']:>10,}")
print(f"  Pontos bonus cadastro (indicacao):  {custos['pontos_indicacao_cadastro']:>10,}")
print(f"  Pontos p/ cliques marketplace:      {custos['pontos_cliques_marketplace']:>10,}")
print(f"  {'─' * 48}")
print(f"  TOTAL PONTOS CONCEDIDOS:            {custos['total_pontos_concedidos']:>10,}")

print()
print("💸 CUSTO MONETARIO DOS PONTOS")
print("-" * 50)
print(f"  Taxa de conversao:          1.000 pts = R$ 0,10")
print(f"  Custo total se 100% resgate:  R$ {float(custo_real_pontos / Decimal(str(taxa_resgate))):>10.2f}")
print(f"  Taxa estimada de resgate:     {taxa_resgate*100:.0f}%")
print(f"  Custo real estimado:          R$ {float(custo_real_pontos):>10.2f}")

print()
print("=" * 70)
print(f"  💎 LUCRO LIQUIDO ESTIMADO (1 mes):  R$ {float(liquido):>10.2f}")
print(f"  Margem liquida:                      {float(liquido/receitas['total_bruto']*100) if receitas['total_bruto'] > 0 else 0:.1f}%")
print("=" * 70)

print()
print("📈 METRICAS POR USUARIO (media)")
print("-" * 50)
print(f"  Receita bruta por usuario:      R$ {float(receitas['total_bruto']/NUM_USUARIOS):.2f}")
print(f"  Lucro por usuario:              R$ {float(liquido/NUM_USUARIOS):.2f}")
print(f"  Total usuarios:                 {NUM_USUARIOS}")
print(f"  Pontos medios por usuario:      {custos['total_pontos_concedidos']/NUM_USUARIOS:.0f}")
print()
