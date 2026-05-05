# Rotas da API · Psy Pay

Mapeamento completo dos endpoints do backend.

---

## Autenticação (`/auth`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/auth/registrar` | Criar conta | ❌ |
| POST | `/auth/login` | Login com CPF + senha | ❌ |
| POST | `/auth/recuperar-senha` | Enviar código por e-mail | ❌ |
| POST | `/auth/redefinir-senha` | Redefinir com código | ❌ |
| GET | `/auth/perfil` | Dados do usuário logado | ✅ |
| PUT | `/auth/perfil` | Atualizar e-mail, telefone, PIX | ✅ |
| POST | `/auth/2fa/gerar` | Gerar segredo 2FA | ✅ |
| POST | `/auth/2fa/ativar` | Ativar 2FA | ✅ |
| POST | `/auth/2fa/desativar` | Desativar 2FA | ✅ |
| POST | `/auth/gerar-codigo-indicacao` | Gerar código de indicação | ✅ |
| POST | `/auth/usar-codigo-indicacao` | Usar código de amigo (ganha 5 pts) | ✅ |
| DELETE | `/auth/excluir-conta` | Excluir conta (LGPD) | ✅ |

## Comunidade & Marketplace (`/comunidade`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/comunidade/explorar` | Listar anúncios públicos | ❌ |
| GET | `/comunidade/meus-links` | Meus anúncios | ✅ |
| POST | `/comunidade/postar-link` | Criar anúncio grátis | ✅ |
| POST | `/comunidade/abrir-link` | Registrar clique + ganhar pontos | ✅ |
| POST | `/comunidade/gerar-pix-destaque` | Pagar destaque R$5 (PIX) | ✅ |
| POST | `/comunidade/gerar-pix-boost` | Pagar turbinar (PIX) | ✅ |
| POST | `/comunidade/comprar-views` | Turbinar com saldo da conta | ✅ |
| POST | `/comunidade/denunciar-link` | Denunciar anúncio | ✅ |
| POST | `/comunidade/avaliar-link` | Avaliar anúncio (1-5) | ✅ |

## Resgate de Pontos (`/marketplace`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/marketplace/solicitar-resgate` | Converter pontos em PIX | ✅ |
| GET | `/marketplace/auth-url` | Vincular conta MercadoPago | ✅ |
| GET | `/marketplace/callback` | Callback de autorização MP | ❌ |

## Financeiro & Admin (`/financeiro`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/financeiro/deposito-pix` | Gerar PIX de depósito | ✅ |
| GET | `/financeiro/extrato` | Extrato de transações | ✅ |
| GET | `/financeiro/transacoes-pendentes` | Transações pendentes | ✅ |
| POST | `/financeiro/webhook-mercadopago` | Webhook de pagamentos | ❌ |

## Empréstimos P2P

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/emprestimo/solicitar` | Criar solicitação P2P | ✅ |
| GET | `/emprestimo/disponiveis` | Listar solicitações | ✅ |
| POST | `/emprestimo/match` | Aceitar solicitação | ✅ |
| GET | `/emprestimo/meus` | Meus empréstimos | ✅ |

## Snapshot & Score

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/snapshot/dashboard` | Dados do dashboard | ✅ |
| GET | `/score/calcular` | Ver score e limite | ✅ |
| POST | `/score/upgrade` | Solicitar upgrade de score | ✅ |

---

## Regras de Negócio

### Anúncios (Marketplace)
- **Grátis:** 24h + views limitadas. Desativado quando views = 0.
- **Destaque (R$5):** 7 dias + 1000 views. NÃO desativa quando views zeram.
- **Turbinar:** Adiciona views extras. NÃO desativa por falta de views.

### Pontos
- **Ganho:** 3x o valor gasto em compras, 1x por clique, 10 por indicação
- **Resgate:** 1000 pts = R$ 1,00 (mínimo 1000 pts)
- **Indicação:** Cada indicador ganha 1 pt/R$ quando você compra
