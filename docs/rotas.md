# Rotas da API · Trocaria

Base URL: `https://peer-5gq5.onrender.com/api` (prod) ou `http://localhost:8000/api` (dev)

Autenticação via JWT Bearer Token (header `Authorization: Bearer <token>`).

---

## Autenticação (`/auth`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/auth/registrar` | Criar conta (nome, email, CPF, senha, PIX, telefone) | ❌ |
| POST | `/auth/login` | Login com CPF + senha → JWT | ❌ |
| POST | `/auth/recuperar-senha/solicitar` | Solicitar código de recuperação | ❌ |
| POST | `/auth/recuperar-senha/redefinir` | Redefinir senha com código | ❌ |
| GET | `/auth/perfil` | Dados completos do usuário logado | ✅ |
| PUT | `/auth/perfil` | Atualizar email, telefone, chave PIX | ✅ |
| POST | `/auth/2fa/gerar` | Gerar segredo TOTP + QR code | ✅ |
| POST | `/auth/2fa/ativar` | Ativar 2FA com código | ✅ |
| POST | `/auth/2fa/desativar` | Desativar 2FA (requer senha + código) | ✅ |
| POST | `/auth/gerar-codigo-indicacao` | Gerar/obter código de indicação | ✅ |
| POST | `/auth/usar-codigo-indicacao` | Usar código de amigo (+5 pts) | ✅ |
| POST | `/auth/upload-foto` | Upload de foto de perfil (máx 2MB) | ✅ |
| GET | `/auth/view-foto/{id}` | Visualizar foto de perfil | ❌ |
| POST | `/auth/aceitar-cookies` | Registrar consentimento LGPD | ✅ |
| DELETE | `/auth/excluir-conta` | Excluir conta (anonimização LGPD) | ✅ |
| GET | `/auth/firebase-config` | Config pública do Firebase (apiKey, projectId) | ❌ |

### Verificação de Email (Firebase)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/auth/verificar-email/solicitar` | Gerar link de verificação Firebase | ✅ |
| POST | `/auth/verificar-email/confirmar` | Verificar status no Firebase → marcar verificado | ✅ |

### Verificação de Telefone (Código na tela)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/auth/verificar-telefone/solicitar` | Gerar código 6 dígitos (hash SHA256) | ✅ |
| POST | `/auth/verificar-telefone/confirmar` | Validar código → marcar verificado | ✅ |

---

## Marketplace & Comunidade (`/comunidade` e `/marketplace`)

### Marketplace

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/comunidade/explorar` | Listar anúncios públicos (categoria, busca) | ❌ |
| GET | `/comunidade/meus-links` | Meus anúncios | ✅ |
| POST | `/comunidade/postar-link` | Criar anúncio grátis (24h) | ✅ |
| POST | `/comunidade/abrir-link/{id}` | Registrar clique + ganhar pontos | ✅ |
| POST | `/comunidade/gerar-pix-destaque` | Pagar destaque R$5 via PIX | ✅ |
| POST | `/comunidade/gerar-pix-boost` | Pagar turbinar via PIX | ✅ |
| POST | `/comunidade/comprar-views` | Turbinar com saldo interno | ✅ |
| POST | `/comunidade/denunciar-link` | Denunciar anúncio | ✅ |
| POST | `/comunidade/avaliar-link` | Avaliar anúncio (1-5 estrelas) | ✅ |

### Resgate de Pontos

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/marketplace/solicitar-resgate` | Converter pontos em PIX (mín 1000 pts) | ✅ |
| GET | `/marketplace/ranking-semanal` | Ranking da semana (top 20 + minha posição) | ✅ |
| GET | `/marketplace/ranking/historico` | Últimos 10 rankings resetados | ❌ |

### Mercado Pago Connect

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/marketplace/auth-url` | URL de autorização OAuth MP | ✅ |
| GET | `/marketplace/callback` | Callback de autorização MP | ❌ |
| POST | `/marketplace/desconectar-mp` | Desvincular conta MP | ✅ |

---

## Financeiro (`/financeiro`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/financeiro/deposito-pix` | Gerar PIX de depósito | ✅ |
| POST | `/financeiro/sacar` | Solicitar saque (PIX gratuito) | ✅ |
| GET | `/financeiro/extrato` | Extrato de transações | ✅ |
| GET | `/financeiro/transacoes-pendentes` | Transações pendentes do usuário | ✅ |
| POST | `/financeiro/webhook-mercadopago` | Webhook de pagamentos MP | ❌ |

### Assinatura Premium

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/financeiro/assinar` | Assinar plano (mensal R$19,99 / anual R$199,99) | ✅ |
| POST | `/financeiro/cancelar-assinatura` | Cancelar renovação automática | ✅ |

---

## Empréstimos P2P

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| POST | `/emprestimo/solicitar` | Criar solicitação de empréstimo (taxa R$2) | ✅ |
| GET | `/emprestimo/disponiveis` | Listar solicitações abertas | ✅ |
| POST | `/emprestimo/match` | Aceitar solicitação como credor | ✅ |
| GET | `/emprestimo/meus` | Meus empréstimos (tomador e credor) | ✅ |

---

## Score & Verificação

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/score/calcular` | Consultar score e limite de crédito | ✅ |
| POST | `/score/upgrade` | Solicitar verificação KYC (R$14,99) | ✅ |

---

## Snapshot / Dashboard

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/snapshot/dashboard` | Dados completos do dashboard pessoal | ✅ |

---

## Admin (`/admin`)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| GET | `/marketplace/admin/ranking-completo` | Top 20 com CPF e PIX (semana atual) | Admin |
| GET | `/marketplace/admin/ranking/historico` | Histórico de pagamentos com dados completos | Admin |
| POST | `/marketplace/admin/ranking/conferir/{id}` | Marcar pagamento como conferido | Admin |
| POST | `/admin/confirmar/{id}` | Confirmar transação pendente | Admin |
| POST | `/admin/rejeitar/{id}` | Rejeitar transação pendente | Admin |
| POST | `/admin/sacar-lucro` | Sacar lucro da plataforma | Admin |
| GET | `/admin/ranking-completo` | Ranking com dados de pagamento | Admin |

---

## Regras de Negócio

### Anúncios (Marketplace)
- **Grátis:** 24h + views limitadas. Desativado quando views = 0.
- **Destaque (R$ 5,00):** 7 dias + 1000 views. Não desativa quando views zeram.
- **Turbinar:** Adiciona views extras. Não desativa por falta de views.

### Pontos
- **Ganho:** 3x o valor gasto em taxas, 1x por clique, 10 por indicação
- **Resgate:** 1000 pts = R$ 1,00 (mínimo 1000 pts)
- **Semanal:** Ranking reseta sábado 18h, prêmio creditado automaticamente

### Saque
- **Gratuito** (sem taxa de saque)

### Limites de Rate Limit
- Registro: 3/min | Login: 5/min | Recuperação: 3/min
- Verificação email: 3/min (solicitar), 5/min (confirmar)
- Verificação telefone: 3/min (solicitar), 5/min (confirmar)
- Mutations gerais: 20/min por IP
