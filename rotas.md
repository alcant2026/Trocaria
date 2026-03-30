# 🗺️ Mapeamento de Rotas da API (Psy Pay)

Este documento centraliza todas as principais rotas ativas criadas no Backend FastAPI da Psycho Pay.

---
## 🌐 `rotas_snapshot.py` (Dashboard Central)
**`GET /snapshot`**
- Ponto de entrada mais crítico da plataforma. Retorna um pacote massivo unificado (O `snapshot`) contendo informações da conta do cliente, histórico de empréstimos (Status Tomador e Investidor) e o **Fiscal Hub** do Administrador de uma única vez.
- Economiza conexões de banco de dados por ter limite de CACHE nativo (15s).

---
## 🔐 `rotas_auth.py` (Perfil & Autenticação)
**`POST /auth/login`**: Valida a dupla Senha/Digitalização MFA e emite o Bearer Token.
**`GET /auth/perfil`**: Dados do usuário cru e configuração da conta.
**`POST /auth/kyc-pay`**: Endpoint onde novos usuários pagam a validação (Desbloqueio a R$35,00) que gera Lucro Direto da Plataforma (`000PL`).

---
## 💳 `rotas_financeiro.py` (Transações e Admin)

### Fundo Coletivo (Clientes)
**`POST /financeiro/investir-pool`**: O usuário injeta dinheiro no caixa livre do Pool P2P.
**`POST /financeiro/resgatar-pool`**: O investidor saca a quantia líquida que possui parada no Pool.

### Fiscal Hub (Admin - 000PL)
**`POST /financeiro/admin/aportar-lucro`** *(Renomeado para Aportar no Pool)*
- **Objetivo**: Aporte Institucional. Injeta capital direto no `saldo_caixa` (Fundo P2P) como forma de infligir liquidez.
**`POST /financeiro/admin/sacar-lucro`** 
- **Objetivo**: Retirada do "Lucro Acumulado". Apenas fundos orgânicos recolhidos via *Taxas/Comissões* e *Ads* são elegíveis.

---
## 📱 `rotas_comunidade.py` (Social e Marketplace)
**`GET /comunidade/feed`**: Extrai as publicações curadas pela comunidade interna.
**`POST /comunidade/comprar-views`** *(Marketplace Ads)*:
- O usuário paga para turbinar um Link. O valor é 100% transferido para o caixa puro da startup `000PL.saldo` (Lucro Livre) sendo listado na seção *Marketplace Ads* do Painel Fiscal.
**`POST /comunidade/registrar-view`**: Consome 1 visão restante do anúncio afiliado ao clicar.

---
## 🏦 `rotas_emprestimo.py` (Motor de Crédito)
**`GET /emprestimos/limite`**: Verifica o trunfo e o fator Score do Tomador atual cruzando com o **Pool de Liquidez** geral ativo.
**`POST /emprestimos/solicitar`**: Solicitação que congela crédito P2P do Fundo Coletivo se for aprovado instantaneamente pelo bot.
**`POST /emprestimos/{id}/pagar-parcela`**: Executa a operação que tira do Tomador final e envia *90% do valor dos juros de volta para capitalização do Pool (divisão pro-rata)* e destina *10% do juro real para a carteira Startup (Lucro de Gestão)*.
