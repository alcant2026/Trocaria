"""
Simulação Financeira Trocaria — TODOS os custos incluídos
"""

from decimal import Decimal

R = Decimal("0.00")

def fmt(v):
    return f"R$ {float(v):,.2f}"

def simular():
    print("=" * 72)
    print("  TROCARIA — SIMULAÇÃO FINANCEIRA COMPLETA (12 MESES)")
    print("=" * 72)

    # === PARÂMETROS DE RECEITA ===
    TAXA_JUROS_MENSAL = Decimal("0.05")
    TAXA_ADM = Decimal("0.10")
    TAXA_ORIGEM_PEQUENA = Decimal("2.00")
    TAXA_ORIGEM_GRANDE = Decimal("4.00")
    TAXA_SAQUE_PADRAO = Decimal("0.02")
    TAXA_ESPECIE_PLAT = Decimal("0.01")
    TAXA_ESPECIE_PARCEIRO = Decimal("0.01")
    CUSTO_MP_PCT = Decimal("0.0399")

    # === CUSTOS FIXOS (MENSAIS) ===
    # PESSOAL (3 pessoas com encargos)
    CUSTO_PESSOAL_MES = Decimal("18000")
    # INFRAESTRUTURA
    CUSTO_INFRA_MES = Decimal("350")
    # OPERACIONAIS (contador, marketing, ferramentas)
    CUSTO_OPEX_MES = Decimal("2000")
    # IMPOSTOS (% sobre o faturamento - Simples Nacional Anexo III)
    ALIQUOTA_IMPOSTO = Decimal("0.11")

    n_usuarios = 500

    total_emprestimos = R
    total_parcelas = R
    total_juros = R
    total_taxa_adm = R
    total_taxa_origem = R
    total_taxa_saque = R
    total_taxa_especie = R
    total_marketplace = R

    total_custo_mp = R
    total_custo_comissao_parceiro = R
    total_inadimplencia = R
    total_pessoal = R
    total_infra = R
    total_opex = R
    total_impostos = R

    print(f"\n{'─' * 72}")
    print(f"  CENÁRIO BASE")
    print(f"  {n_usuarios} usuários iniciais | 5% crescimento/mês")
    print(f"  Pessoal: {fmt(CUSTO_PESSOAL_MES)}/mês | Infra: {fmt(CUSTO_INFRA_MES)}/mês | OPEX: {fmt(CUSTO_OPEX_MES)}/mês")
    print(f"  Impostos: {float(ALIQUOTA_IMPOSTO)*100:.0f}% s/ faturamento")
    print(f"{'─' * 72}")

    for mes_idx in range(1, 13):
        mes = Decimal(mes_idx)
        usuarios_mes = int(n_usuarios * (1.05 ** (mes_idx - 1)))

        # 1. EMPRÉSTIMOS
        n_emprestimos = int(usuarios_mes * Decimal("0.30"))
        valor_medio = Decimal("200")
        prazo_medio = 4
        valor_emprestado_mes = n_emprestimos * valor_medio
        total_emprestimos += valor_emprestado_mes

        taxa_origem_mes = n_emprestimos * TAXA_ORIGEM_GRANDE
        total_taxa_origem += taxa_origem_mes

        # 2. PARCELAS
        estoque_emprestimos = int(n_emprestimos * min(mes, prazo_medio) / prazo_medio)
        n_parcelas_pagas = int(estoque_emprestimos * Decimal("0.85"))
        inadimplentes = estoque_emprestimos - n_parcelas_pagas

        valor_parcela_base = valor_medio / prazo_medio
        juros_parcela = valor_medio * TAXA_JUROS_MENSAL
        valor_parcela_total = valor_parcela_base + juros_parcela
        recebido_parcelas_mes = n_parcelas_pagas * valor_parcela_total

        total_parcelas += recebido_parcelas_mes
        total_juros += n_parcelas_pagas * juros_parcela

        taxa_adm_mes = recebido_parcelas_mes * TAXA_ADM
        total_taxa_adm += taxa_adm_mes
        total_inadimplencia += inadimplentes * valor_parcela_total

        # 3. SAQUES
        n_saques = int(usuarios_mes * Decimal("0.20"))
        valor_saque_medio = Decimal("100")
        taxa_saque_mes = n_saques * (valor_saque_medio * TAXA_SAQUE_PADRAO)
        total_taxa_saque += taxa_saque_mes

        # 4. SAQUES EM ESPÉCIE
        n_especie = int(usuarios_mes * Decimal("0.05"))
        valor_especie_medio = Decimal("150")
        receita_especie_mes = n_especie * (valor_especie_medio * TAXA_ESPECIE_PLAT)
        custo_especie_mes = n_especie * (valor_especie_medio * TAXA_ESPECIE_PARCEIRO)
        total_taxa_especie += receita_especie_mes
        total_custo_comissao_parceiro += custo_especie_mes

        # 5. MARKETPLACE
        n_boosts = int(usuarios_mes * Decimal("0.10"))
        receita_market_mes = n_boosts * Decimal("15")
        total_marketplace += receita_market_mes

        # 6. CUSTO MP
        n_depositos = int(usuarios_mes * Decimal("0.25"))
        valor_deposito_medio = Decimal("150")
        custo_mp_mes = n_depositos * valor_deposito_medio * CUSTO_MP_PCT
        total_custo_mp += custo_mp_mes

        # 7. CUSTOS FIXOS
        total_pessoal += CUSTO_PESSOAL_MES
        total_infra += CUSTO_INFRA_MES
        total_opex += CUSTO_OPEX_MES

        # 8. IMPOSTOS (sobre a receita bruta do mes)
        receita_mes = (taxa_adm_mes + taxa_origem_mes + taxa_saque_mes
                       + receita_especie_mes + receita_market_mes)
        imposto_mes = receita_mes * ALIQUOTA_IMPOSTO
        total_impostos += imposto_mes

        custo_mes = (custo_mp_mes + custo_especie_mes + CUSTO_PESSOAL_MES
                     + CUSTO_INFRA_MES + CUSTO_OPEX_MES + imposto_mes)
        lucro_mes = receita_mes - custo_mes

        print(f"\n{'─' * 72}")
        print(f"  MÊS {mes} — {usuarios_mes} usuários")
        print(f"{'─' * 72}")
        print(f"  📊 EMPRÉSTIMOS: {n_emprestimos} x {fmt(valor_medio)} = {fmt(valor_emprestado_mes)}")
        print(f"  📥 PARCELAS:    {n_parcelas_pagas} pagas / {estoque_emprestimos} ativas | {inadimplentes} inadimplentes")
        print(f"     Juros: +{fmt(n_parcelas_pagas * juros_parcela)}  ADM: +{fmt(taxa_adm_mes)}  Origem: +{fmt(taxa_origem_mes)}")
        print(f"  💸 SAQUES:      {n_saques} PIX + {n_especie} espécie → taxas: +{fmt(taxa_saque_mes + receita_especie_mes)}")
        print(f"  🛒 MARKETPLACE: {n_boosts} boosts = {fmt(receita_market_mes)}")
        print(f"")
        print(f"  💰 RECEITA: +{fmt(receita_mes)}")
        print(f"  💳 CUSTOS VARIÁVEIS: MP -{fmt(custo_mp_mes)} | Com. Parceiro -{fmt(custo_especie_mes)}")
        print(f"  👥 PESSOAL: -{fmt(CUSTO_PESSOAL_MES)}")
        print(f"  🖥 INFRA: -{fmt(CUSTO_INFRA_MES)} | OPEX: -{fmt(CUSTO_OPEX_MES)}")
        print(f"  📋 IMPOSTOS (11%): -{fmt(imposto_mes)}")
        print(f"  {'=' * 50}")
        print(f"  📊 CUSTO TOTAL: -{fmt(custo_mes)}  |  LUCRO: {fmt(lucro_mes)}")

    receita_total = (total_juros + total_taxa_adm + total_taxa_origem + total_taxa_saque
                     + total_taxa_especie + total_marketplace)
    custo_total = (total_custo_mp + total_custo_comissao_parceiro + total_inadimplencia
                   + total_pessoal + total_infra + total_opex + total_impostos)
    lucro_total = receita_total - custo_total
    margem = (lucro_total / receita_total * 100) if receita_total > 0 else 0

    print(f"\n{'=' * 72}")
    print(f"  RESUMO 12 MESES")
    print(f"{'=' * 72}")
    print(f"")
    print(f"  📈 RECEITAS")
    print(f"  {'Juros de Empréstimos (5% a.m.)':.<45s} {fmt(total_juros)}")
    print(f"  {'Taxa ADM (10% sobre parcelas)':.<45s} {fmt(total_taxa_adm)}")
    print(f"  {'Taxa de Origem (R$4)':.<45s} {fmt(total_taxa_origem)}")
    print(f"  {'Taxa de Saque PIX (2%)':.<45s} {fmt(total_taxa_saque)}")
    print(f"  {'Taxa de Saque Espécie (1%)':.<45s} {fmt(total_taxa_especie)}")
    print(f"  {'Marketplace (Boosts)':.<45s} {fmt(total_marketplace)}")
    print(f"  {'─' * 55}")
    print(f"  {'RECEITA TOTAL':.<45s} {fmt(receita_total)}")
    print(f"")
    print(f"  📉 CUSTOS")
    print(f"  {'Variáveis':.45s}")
    print(f"  {'  Taxas Mercado Pago (3,99%)':.<45s} {fmt(total_custo_mp)}")
    print(f"  {'  Comissão Parceiros (1% espécie)':.<45s} {fmt(total_custo_comissao_parceiro)}")
    print(f"  {'  Inadimplência (15% parcelas)':.<45s} {fmt(total_inadimplencia)}")
    print(f"  {'Fixos':.45s}")
    print(f"  {'  Pessoal (3 pessoas c/ encargos)':.<45s} {fmt(total_pessoal)}")
    print(f"  {'  Infraestrutura (servidor, DB, email)':.<45s} {fmt(total_infra)}")
    print(f"  {'  Operacionais (contador, marketing)':.<45s} {fmt(total_opex)}")
    print(f"  {'Tributários':.45s}")
    print(f"  {'  Impostos (11% Simples Nacional)':.<45s} {fmt(total_impostos)}")
    print(f"  {'─' * 55}")
    print(f"  {'CUSTO TOTAL':.<45s} {fmt(custo_total)}")
    print(f"")
    print(f"  {'=' * 55}")
    print(f"  {'LUCRO LÍQUIDO (12 meses)':.<45s} {fmt(lucro_total)}")
    print(f"  {'MARGEM LÍQUIDA':.<45s} {margem:.1f}%")
    print(f"  {'=' * 55}")
    print(f"")
    print(f"  💎 VOLUME EMPRESTADO: {fmt(total_emprestimos)}")
    print(f"  💎 MÉDIA LUCRO/MÊS:   {fmt(lucro_total / 12)}")
    print(f"  💎 PONTO EQUILÍBRIO:   ~{fmt(CUSTO_PESSOAL_MES + CUSTO_INFRA_MES + CUSTO_OPEX_MES)}/mês em receita")
    print(f"{'=' * 72}")

if __name__ == "__main__":
    simular()
