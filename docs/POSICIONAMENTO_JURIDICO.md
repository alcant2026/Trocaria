# POSICIONAMENTO JURIDICO DA TROCARIA

**Documento Interno - Estratégia de Compliance Regulatório**
**Data:** 18/05/2026
**Objetivo:** Definir claramente o escopo da Trocaria para evitar caracterização como instituição financeira, intermediadora de valores, SCD, SEP ou instituição de pagamento.

---

## 1. O QUE A TROCARIA NÃO E (E NUNCA PODE SER)

Para evitar problema com CVM, Bacen e outras autoridades, a Trocaria JAMAIS pode ser caracterizada como:

| O que NÃO somos | Por quê é proibido sem autorização | O que fazemos diferente |
|----------------|-----------------------------------|------------------------|
| **Banco / Financeira** | Captar recursos do público, fazer operações de crédito como instituição | Não captamos dinheiro. Não emprestamos nosso dinheiro. |
| **SCD (Sociedade de Crédito Direto)** | Intermediar operações de crédito com fundos próprios ou de terceiros | Não intermediamos financeiramente. Apenas conectamos pessoas. |
| **SEP (Sociedade de Empréstimo entre Pessoas)** | Operar como plataforma de crowdfunding de dívida com escrow | Não temos escrow. O dinheiro vai direto P2P. |
| **Instituição de Pagamento** | Segurar saldo de clientes, fazer transferências de valores de terceiros | NÃO seguramos saldo de empréstimos. Taxas vão direto para nossa conta. |
| **Correspondente Bancário** | Atuar em nome de banco/financeira autorizada | Não representamos nenhuma instituição financeira. |
| **Administradora de Consórcio** | Administrar grupos de consórcio | Não temos grupos de consórcio. |
| **Securitizadora** | Emitir ou administrar CRI, CRA, FIDC | Não emitimos títulos. |

---

## 2. O QUE A TROCARIA REALMENTE FAZ

### 2.1 Definição Jurídica
A Trocaria é uma **plataforma tecnológica de correspondência entre particulares** para operações de **mútuo direto** (art. 586 do Código Civil), com as seguintes características:

- **Correspondente de interesses:** Conecta pessoas que querem emprestar com pessoas que querem tomar emprestado
- **Geradora de contratos:** Elabora e armazena contratos de mútuo entre as partes
- **Cobradora de taxas de serviço:** Cobra do tomador uma taxa para publicar o pedido e do credor uma taxa para usar ferramentas de cobrança
- **Prestadora de serviços de informação:** Score de reputação, histórico, verificação de identidade

### 2.2 Fluxo de Dinheiro CORRETO (Direto P2P)

```
Tomador (Fulano)                              Investidor (Ciclano)
      |                                               |
      |-- R$ 2,00 (taxa de publicação) -->|            |
      |          TROCARIA (nossa conta)     |            |
      |                                    |            |
      |<-------- R$ 1.000,00 (empréstimo) --------------|
      |         VIA PIX DIRETO (P2P)                    |
      |                                               |
      |-- R$ 100,00 (parcela 1) ---------------------->|
      |         VIA PIX DIRETO (P2P)                    |
      |                                               |
      |-- R$ 100,00 (parcela 2) ---------------------->|
      |         VIA PIX DIRETO (P2P)                    |
```

**IMPORTANTE:** O dinheiro do empréstimo NUNCA passa pela conta da Trocaria. Vai direto do PIX do investidor para o PIX do tomador.

### 2.3 O que a Trocaria pode cobrar (e como)

| Serviço | Quem paga | Como é cobrado | Para onde vai |
|---------|----------|----------------|---------------|
| Publicar pedido de empréstimo | Tomador | PIX direto para conta da Trocaria | Conta corrente da empresa (CNPJ) |
| Destacar/boost no marketplace | Anunciante | PIX direto para conta da Trocaria | Conta corrente da empresa (CNPJ) |
| Ferramenta de cobrança (boleto/PIX) | Credor | PIX direto para conta da Trocaria | Conta corrente da empresa (CNPJ) |
| Verificação KYC | Usuário | PIX direto para conta da Trocaria | Conta corrente da empresa (CNPJ) |
| Assinatura Premium | Usuário | PIX direto para conta da Trocaria | Conta corrente da empresa (CNPJ) |

**Regra de ouro:** A Trocaria NUNCA recebe dinheiro que pertença aos usuários (empréstimos, saldos, depósitos). Recebe apenas suas **próprias taxas de serviço**.

---

## 3. O QUE PRECISA SER CORRIGIDO NO SISTEMA ATUAL

### 3.1 PROBLEMA GRAVE: Sistema de "Saldo"

O código atual tem `usuario.saldo`, `deposito`, `saque` — isso implica que a plataforma SEGURA dinheiro dos usuários.

**Risco:** Isso pode ser interpretado como:
- Captação de recursos do público (Lei 4.595/1964)
- Intermediação de valores (Lei 12.865/2013 - Instituições de Pagamento)
- Operação irregular de instituição financeira (art. 16 da Lei 4.595/1964)
- **Pena:** Crime contra o sistema financeiro (art. 10, Decreto-Lei 2.848/1940 - Código Penal)

### 3.2 Solução

**REMOVER completamente do sistema:**
- [ ] Campo `saldo` do usuário (não pode ter saldo na plataforma)
- [ ] Rota `/financeiro/notificar-deposito` (não aceitamos depósitos)
- [ ] Rota `/financeiro/solicitar-saque` (não fazemos saques de saldo)
- [ ] Rota `/financeiro/admin/adicionar-saldo` (admin não pode adicionar saldo)
- [ ] Campo `saldo_caixa` do usuário
- [ ] Conceito de "reserva de saque"

**MANTER (são taxas de serviço, permitidas):**
- [ ] Taxa de publicação de pedido (R$ 2,00) - PIX direto para conta da empresa
- [ ] Taxa de cobrança (R$ 2,00) - PIX direto para conta da empresa
- [ ] Taxa de destaque/boost no marketplace - PIX direto para conta da empresa
- [ ] Assinatura Premium - PIX direto para conta da empresa

### 3.3 Como fica o empréstimo sem "saldo"

1. Tomador publica pedido (paga R$ 2,00 de taxa)
2. Investidor visualiza e aceita
3. Investidor transfere via PIX **diretamente** para o Tomador (fora da plataforma)
4. Tomador clica "Confirmar recebimento" na plataforma (apenas confirma que recebeu)
5. Tomador paga parcelas via PIX **diretamente** para o Investidor (fora da plataforma)
6. Investidor clica "Confirmar pagamento" na plataforma (apenas confirma que recebeu)
7. Se Tomador não pagar, Investidor pode usar a ferramenta de cobrança (paga R$ 2,00 de taxa)

A plataforma apenas **registra** as confirmações. O dinheiro circula fora.

---

## 4. BASE LEGAL DA OPERACAO

### 4.1 Mútuo entre Particulares (Art. 586 a 592, Código Civil)

> Art. 586. No mútuo real, o mutuário é obrigado a restituir ao mutuante a mesma quantidade e qualidade da coisa emprestada.

O Código Civil permite que pessoas físicas façam empréstimos entre si (mútuo) sem necessidade de instituição financeira.

### 4.2 Ausência de Intermediação Financeira

Como a Trocaria:
- Não empresta dinheiro próprio
- Não empresta dinheiro de terceiros
- Não garante o empréstimo
- Não segurou o dinheiro em escrow
- Não faz transferências de valores de terceiros

Ela NÃO se enquadra nas definições de:
- Instituição financeira (Lei 4.595/1964)
- Instituição de pagamento (Lei 12.865/2013)
- SCD ou SEP (Res. CMN 4.657/2018)
- Plataforma de crowdfunding (Instrução CVM 588/2017 - pois não securitizamos)

### 4.3 Correspondência de Interesses (Modelo Airbnb/OLX/Tinder)

A Trocaria opera no mesmo modelo jurídico de:
- **Airbnb:** Conecta anfitrião e hóspede, cobra taxa de serviço
- **OLX:** Conecta vendedor e comprador, cobra taxa de destaque
- **Tinder:** Conecta pessoas, cobra assinatura premium

Nenhuma dessas empresas é instituição financeira. São **plataformas de correspondência de interesses**.

---

## 5. RISCOS E COMO EVITAR

### 5.1 Risco: Ser confundida com SCD/SEP

**Como evitar:**
- Nunca dizer que "facilitamos crédito" ou "intermediamos empréstimos"
- Sempre dizer que "conectamos pessoas interessadas em operações de mútuo"
- Nunca usar termos como "captação", "originação", "carteira de crédito"
- Nunca prometer retorno aos investidores

### 5.2 Risco: Ser confundida com Instituição de Pagamento

**Como evitar:**
- NUNCA segurar saldo de valores de terceiros
- As taxas de serviço vão DIRETO para a conta PJ da empresa
- Nunca fazer "payout" de valores que não sejam próprios da empresa
- Nunca ter "carteira digital" ou "conta de pagamento"

### 5.3 Risco: Usura (Juros Abusivos)

**Como evitar:**
- Limitar taxas de juros a no máximo 12% ao mês (limite prudente)
- Informar CET (Custo Efetivo Total) antes da aceitação
- Não recomendar taxas específicas
- Deixar as partes livres para negociar (dentro do limite legal)

### 5.4 Risco: Lavagem de Dinheiro (PLD/FT)

**Como evitar:**
- Manter KYC obrigatório
- Reportar operações suspeitas ao Coaf
- Manter registros por 5 anos
- Não permitir operações anônimas

---

## 6. CHECKLIST DE COMPLIANCE REGULATORIO

Antes de ir para produção, verificar:

- [ ] **Sistema de saldo/desposito/saque REMOVIDO** (usuário não tem saldo na plataforma)
- [ ] **Taxas de serviço vão direto para conta PJ da empresa** (via Mercado Pago ou PIX da empresa)
- [ ] **Contrato de mútuo gerado** para cada operação, com cláusulas claras
- [ ] **Termos de Uso** com disclaimers de não-intermediação financeira
- [ ] **Política de Privacidade** conforme LGPD
- [ ] **KYC obrigatório** para operações acima de R$ 1.000
- [ ] **Limite de juros** no sistema (ex: máx 12% a.m.)
- [ ] **Nenhuma promessa de retorno** aos investidores
- [ ] **Registro de operações** para Coaf (se necessário)
- [ ] **Empresa constituída** com CNPJ ativo
- [ ] **Conta bancária PJ** no nome da empresa para receber taxas

---

## 7. ESTRUTURA SOCIETARIA RECOMENDADA

Para operar com segurança jurídica:

1. **Constituir empresa** (recomendado: Ltda ou S.A.)
2. **CNPJ ativo** com CNAE adequado:
   - 63.11-0-00: Tratamento de dados, provedores de serviços de aplicação e serviços de hospedagem na internet
   - 47.42-0-03: Comércio varejista pela internet
   - 73.19-0-04: Agenciamento de serviços e negócios em geral
3. **Conta bancária PJ** exclusiva para receber taxas
4. **Contador** para declarar receitas de taxas de serviço
5. **Advogado** especialista em direito digital e regulatório

---

## 8. CONCLUSAO

A Trocaria pode operar legalmente **desde que**:

1. Não segure dinheiro de usuários (sem saldo/escrow)
2. Cobre apenas taxas de serviço (publicação, cobrança, destaque)
3. Deixe claro que é apenas correspondente de interesses
4. Gere contratos de mútuo entre as partes
5. Não prometa retornos nem garanta operações
6. Cumpra KYC e PLD/FT
7. Tenha empresa constituída com CNPJ

**O código atual precisa de ajustes técnicos para remover o sistema de saldo antes de ir para produção.**

---

**Documento confidencial - Uso interno apenas**
**Responsável:** Direção Jurídica / Compliance
**Próxima revisão:** 18/08/2026

