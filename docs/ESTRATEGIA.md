# Estratégia de Negócio · Psy Pay

Modelo de receita real, custos operacionais e projeção de sustentabilidade. **Atualizado com o estado atual do código.**

---

## Fontes de Receita (12 fontes)

| # | Fonte | Valor | Tipo |
|---|-------|-------|------|
| 1 | Taxa de solicitação P2P | R$ 2,00 | Por pedido |
| 2 | Taxa de match (intermediação) | 2% (mín R$2, máx R$20) | Por contrato |
| 3 | Assinatura Premium mensal | R$ 19,99 | Recorrente |
| 4 | Assinatura Premium anual | R$ 199,99 | Recorrente |
| 5 | Verificação KYC | R$ 14,99 | Única |
| 6 | Destaque de anúncio | R$ 5,00 | Por 7 dias |
| 7 | Boost views — Básico | R$ 1,00 (100 views) | Por pacote |
| 8 | Boost views — Popular | R$ 5,00 (500 views) | Por pacote |
| 9 | Boost views — Intermediário | R$ 12,00 (1500 views) | Por pacote |
| 10 | Boost views — Avançado | R$ 35,00 (5000 views) | Por pacote |
| 11 | Cobrança de dívida | R$ 2,00 | Por cobrança |
| 12 | Pontos de fidelidade | 1-5 pts/clique (engajamento) | Gamificação |

---

## Custos Operacionais

### Infraestrutura (tudo free tier)

| Serviço | Custo | Plano |
|---------|-------|-------|
| Render (backend web service) | R$ 0 | Free — 750h/mês, dorme após 15min |
| Render (frontend static) | R$ 0 | Free — 100 GB/mês |
| Neon (PostgreSQL) | R$ 0 | Free — 500 MB, 100h compute |
| Firebase Auth (email) | R$ 0 | Spark — 50k MAU, email ilimitado |
| Cloudflare (DNS/CDN) | R$ 0 | Free |

**Infraestrutura total: R$ 0/mês**

### Custos Variáveis

| Custo | Valor | Quando |
|-------|-------|--------|
| Mercado Pago (taxa PIX) | ~3,99% por transação | Cada pagamento recebido |
| Prêmios ranking semanal | 1000 pts = R$ 1,00 | Top 20, todo sábado 18h |
| Resgate de pontos | 1000 pts = R$ 1,00 (~20% estimado) | Quando usuário solicita |
| Domínio (.com.br) | ~R$ 40/ano | Anual |

### Quando escalar (fora do free tier)

| Serviço | Plano | Custo |
|---------|-------|-------|
| Render Web (sem cold start) | Starter | ~R$ 100/mês |
| Neon (mais storage) | Scale | ~R$ 100/mês |

---

## Projeção de Crescimento

Crescimento orgânico com coeficiente viral ~0.6 (cada usuário traz ~0.6 novos/mês via indicações).

Com **infraestrutura R$ 0** e **12 fontes de receita**, o modelo é **sustentável desde o primeiro usuário pagante**.

| Mês | Usuários | Receita est. | Custo est. | Lucro est. |
|-----|----------|-------------|-----------|-----------|
| 1 | 10 | R$ 0 | R$ 0 | R$ 0 |
| 3 | 25 | R$ 30 | R$ 5 | R$ 25 |
| 6 | 100 | R$ 230 | R$ 15 | R$ 215 |
| 12 | 1.700 | R$ 6.500 | R$ 250 | R$ 6.250 |

> **Nota:** Estimativas conservadoras. O principal custo é a taxa do Mercado Pago (3,99% das transações). Margem líquida operacional >95%.

---

## Sistema de Pontos (Gamificação)

### Como Ganhar Pontos

| Ação | Pontos |
|------|--------|
| Indicar amigo (cadastro concluído) | +10 pts |
| Ser indicado (usar código) | +5 pts |
| Pagar taxa na plataforma (comprador) | 3x o valor (R$1 = 3 pts) |
| Indicado pagar taxa (efeito rede) | 1x o valor (cada indicador) |
| Clicar em anúncio (free) | +1 pt |
| Clicar em anúncio (premium) | +1 a 5 pts aleatórios |

### Premiação Semanal

- **Ranking:** top 20 por `pontos_semanais`
- **Reset:** sábado 18:00 (BRT) — automático
- **Prêmio:** 1000 pts = R$ 1,00 — creditado no saldo
- **Pagamento:** automático, debita da plataforma (000PL)
- **Conferência:** admin marca como "conferido" no painel

### Resgate de Pontos

- **Conversão:** 1000 pontos = R$ 1,00
- **Mínimo:** 1000 pontos para solicitar
- **Método:** PIX (Mercado Pago)
- **Taxa:** sem taxa de saque

---

## Diferenciais Competitivos

1. **Infraestrutura R$ 0** — todo o stack usa free tier, margem quase 100%
2. **12 fontes de receita** — diversificada, sem dependência de uma única
3. **Rede de indicação multi-nível** — crescimento orgânico viral
4. **Gamificação com dinheiro real** — ranking semanal pago em saldo
5. **Verificação KYC + 2FA** — segurança nível bancário
6. **LGPD-ready** — exclusão de conta com anonimização, cookies consent

---

## Roadmap

| Fase | Meta | Status |
|------|------|--------|
| **MVP** | P2P + marketplace + indicações | ✅ Concluído |
| **Segurança** | 2FA, KYC, verificação email/telefone | ✅ Concluído |
| **Gamificação** | Ranking semanal com prêmios automáticos | ✅ Concluído |
| **Otimização** | Free tier storage, cache, gzip, cold start | ✅ Concluído |
| **Lançamento** | 100 usuários, validar produto | 🔜 |
| **Escala** | 1.000+ usuários, migrar Render pago | 📋 |
