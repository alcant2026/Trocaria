# Guia de Deploy · Psy Pay

Deploy gratuito via [Render](https://render.com) + [Neon](https://neon.tech).

---

## 1. Banco de Dados — Neon (PostgreSQL Serverless)

1. Criar conta em [Neon.tech](https://neon.tech)
2. Criar um projeto e copiar a **Connection String**
3. Adicionar como variável no Render: `DATABASE_URL`
4. O SQLAlchemy cria/atualiza as tabelas automaticamente no startup

**Dev local:** SQLite automático (`cred_plus.db`), sem configuração.

---

## 2. Firebase (Verificação de Email)

1. Criar projeto em [Firebase Console](https://console.firebase.google.com)
2. Authentication → Sign-in method → ativar **E-mail/Senha**
3. Configurações do projeto → Contas de serviço → Gerar chave JSON
4. Adicionar no Render:
   - `FIREBASE_API_KEY` (Web API Key do projeto)
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (conteúdo do JSON da service account)

---

## 3. Backend — Render Web Service

| Campo | Valor |
|-------|-------|
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install --no-cache-dir -r requirements.txt` |
| **Start Command** | `gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT --timeout 30` |
| **Health Check Path** | `/__warmup` |

### Variáveis de Ambiente:

```
DATABASE_URL=postgresql://...
SECRET_KEY=sua_chave_secreta
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
FIREBASE_API_KEY=AIzaSy...
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
FRONTEND_URL=https://seu-frontend.onrender.com
RENDER=true
ENVIRONMENT=production
```

---

## 4. Frontend — Render Static Site

| Campo | Valor |
|-------|-------|
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

### Variável de Ambiente:

```
VITE_API_URL=https://seu-backend.onrender.com/api
```

---

## 5. Mercado Pago

1. Criar app em [Mercado Pago Developers](https://www.mercadopago.com.br/developers)
2. Copiar **Access Token** de produção
3. Adicionar `MERCADOPAGO_ACCESS_TOKEN` no Render
4. Configurar Webhook no painel MP apontando para:
   `https://seu-backend.onrender.com/api/financeiro/webhook-mercadopago`

---

## 6. Primeiro Admin

1. Registrar conta normalmente pelo frontend
2. Acessar o banco Neon e executar:

```sql
UPDATE usuarios SET is_admin = true WHERE cpf = 'SEU_CPF';
```

3. Acessar `/dashboard#admin` no frontend

---

## 7. Limites do Free Tier

| Serviço | Limite | Impacto |
|---------|--------|---------|
| **Render Web** | 750h/mês, dorme após 15min inativo | Cold start de ~30s no primeiro acesso |
| **Render Static** | 100 GB/mês banda | Suficiente para ~50k pageviews |
| **Neon** | 500 MB storage, 100h compute/mês | Limpar dados antigos regularmente |
| **Firebase Auth** | 50k MAU, email ilimitado | Suficiente para MVP |
| **Mercado Pago** | 3,99% por transação | Principal custo variável |

### Otimizações já implementadas:
- Gzip no backend (reduz banda)
- Cache de 30s em GETs no frontend
- Terser minification no build
- Service worker para caching de assets
- Limpeza automática de storage a cada 24h
- Lazy imports para reduzir cold start
