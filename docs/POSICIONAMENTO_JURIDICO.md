# POSICIONAMENTO JURIDICO DA TROCARIA

**Documento Interno - Estratégia de Compliance Regulatório**
**Data:** 27/05/2026
**Objetivo:** Definir claramente que a Trocaria é um marketplace de classificados (como OLX), sem qualquer atividade de intermediação financeira, empréstimo entre pessoas, captação de recursos ou operação de crédito.

---

## 1. O QUE A TROCARIA É

A Trocaria é uma **plataforma tecnológica de classificados gratuitos** que conecta compradores e vendedores para troca ou venda de produtos.

### Modelo de Negócio
- Anúncios gratuitos de produtos
- Destaque/boost de anúncios (pago)
- Verificação de identidade KYC (pago)
- Assinatura Premium (pago)
- Sistema de gamificação com pontos (cashback)
- Ranking semanal de participantes

### Como a Trocaria ganha dinheiro
- Taxa de destaque/boost de anúncios
- Taxa de verificação KYC
- Assinatura Premium

Todas as taxas são pagas via PIX **diretamente para a conta PJ da empresa**. A plataforma não recebe nem segura valores de terceiros.

---

## 2. O QUE A TROCARIA NÃO É (E NUNCA PODE SER)

| O que NÃO somos | Por quê |
|----------------|---------|
| **Instituição Financeira** | Não captamos recursos do público, não fazemos operações de crédito |
| **SCD (Sociedade de Crédito Direto)** | Não intermediamos operações de crédito com fundos próprios ou de terceiros |
| **SEP (Sociedade de Empréstimo entre Pessoas)** | Não operamos plataforma de empréstimo entre pessoas |
| **Instituição de Pagamento** | Não seguramos saldo de clientes nem fazemos transferências de valores de terceiros |
| **Correspondente Bancário** | Não representamos nenhuma instituição financeira |
| **Fintech de Crédito** | Não concedemos crédito, não analisamos risco de crédito, não temos carteira |

---

## 3. BASE LEGAL

### 3.1 Marketplace de Classificados

A Trocaria opera como plataforma de classificados, mesmo modelo de:
- **OLX / Mercado Livre:** Conecta compradores e vendedores
- **Airbnb:** Conecta anfitrião e hóspede, cobra taxa de serviço
- **Enjoei / Elo7:** Marketplace de produtos

### 3.2 Ausência de Atividade Financeira

A Trocaria NÃO se enquadra em nenhuma das seguintes definições:
- **Instituição financeira** (Lei 4.595/1964, art. 17) - Não capta, não intermedia, não aplica recursos
- **Instituição de pagamento** (Lei 12.865/2013) - Não gerencia contas de pagamento, não segura saldos
- **SCD ou SEP** (Res. CMN 4.657/2018) - Não faz empréstimo entre pessoas
- **Plataforma de crowdfunding** (Instrução CVM 588/2017) - Não faz captação pública

### 3.3 Fundamentos

- **Art. 170 da Constituição Federal:** Livre iniciativa e livre concorrência
- **Marco Civil da Internet (Lei 12.965/2014):** Plataforma não responde por conteúdo de terceiros
- **LGPD (Lei 13.709/2018):** Tratamento de dados com consentimento

---

## 4. FLUXO DE DINHEIRO

```
Usuário                              Trocaria (CNPJ)
   |                                       |
   |-- PIX para destaque/boost ---------->|  Conta PJ da empresa
   |-- PIX para verificação KYC --------->|  Conta PJ da empresa
   |-- PIX para assinatura premium ------>|  Conta PJ da empresa
   |                                       |
   |<-- PIX de resgate de pontos ---------|  Conta PJ da empresa
   |    (apenas quando o usuário resgata)   |
```

**Regra de ouro:** A Trocaria NUNCA recebe dinheiro que pertença a outros usuários. Recebe apenas suas próprias taxas de serviço. Não há:
- Saldo de usuários na plataforma
- Pool de dinheiro
- Escrow
- Depósitos ou saques de terceiros

---

## 5. LICENÇAS E AUTORIZAÇÕES

A Trocaria **NÃO necessita** de autorização do Banco Central ou CVM para operar, pois:
- Não exerce atividade típica de instituição financeira
- Não opera serviço de pagamento (os PIX são processados pelo Mercado Pago, que é instituição de pagamento autorizada pelo Bacen)
- Não faz intermediação de crédito

---

## 6. COMPLIANCE E LGPD

- Consentimento explícito para tratamento de dados
- Direito de exclusão de conta (anonimização)
- Registro de auditoria de acessos
- KYC opcional (verificação de identidade como serviço)
- Denúncias de usuários e moderação

---

## 7. CHECKLIST DE PRODUÇÃO

- [ ] **Não há saldo/ depósito/ saque de usuários** - Removido do código
- [ ] **Não há empréstimo entre pessoas** - Removido do código
- [ ] **Não há pool de dinheiro** - Removido do código
- [ ] **Taxas vão direto para conta PJ** - Via Mercado Pago
- [ ] **Termos de Uso** com disclaimer de marketplace
- [ ] **Política de Privacidade** conforme LGPD
- [ ] **Empresa constituída** com CNPJ ativo
- [ ] **Conta bancária PJ** para receber taxas

---

## 8. CONCLUSAO

A Trocaria opera legalmente como marketplace de classificados, sem necessidade de autorização do Banco Central ou CVM, desde que:
1. Não segure dinheiro de usuários (sem saldo/escrow)
2. Cobre apenas taxas de serviço próprias
3. Não faça intermediação de crédito ou empréstimo
4. Cumpra LGPD e regras de proteção ao consumidor
5. Tenha empresa constituída com CNPJ

---

**Documento confidencial - Uso interno apenas**
**Responsável:** Direção Jurídica / Compliance
**Próxima revisão:** 27/08/2026
