# Guia de Deploy · Psy Pay

Deploy via [Render](https://render.com) — gratuito para começar.

---

## 1. Banco de Dados

### Produção: Neon (PostgreSQL Serverless)
1. Criar conta em [Neon.tech](https://neon.tech)
2. Copiar a Connection String
3. Adicionar como variável de ambiente no Render: `DATABASE_URL`
4. O SQLAlchemy cria as tabelas automaticamente no primeiro ping

### Desenvolvimento: SQLite
- Usa `cred_plus.db` local automaticamente
- Nenhuma configuração necessária

---

## 2. Backend (Render Web Service)

| Campo | Valor |
|-------|-------|
| **Root Directory** | `backend` |
| **Runtime** | Python 3 |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn -w 1 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT` |

### Variáveis de Ambiente necessárias:
```
DATABASE_URL=postgresql://...
SECRET_KEY=sua_chave_secreta
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
FRONTEND_URL=https://seu-frontend.onrender.com
```

---

## 3. Frontend (Render Static Site)

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

## 4. Configurar CORS

No `backend/main.py`, adicionar a URL do frontend:

```python
CORS_ORIGINS = [
    "http://localhost:5173",        # dev
    "https://seu-frontend.onrender.com"  # prod
]
```

---

## 5. Primeiro Admin

Após o deploy:
1. Cadastre-se pelo frontend (registro normal)
2. Conecte no banco Neon e execute:
```sql
UPDATE usuarios SET is_admin = true WHERE cpf = 'SEU_CPF';
```

---

## 6. Troubleshooting

| Erro | Solução |
|------|---------|
| CORS bloqueado | Adicionar domínio em `CORS_ORIGINS` no `main.py` |
| Neon fechando conexão | Usar no máximo 2 workers (free tier = 10 conexões) |
| 404 nas rotas novas | Reiniciar o serviço no Render |
| Banco não criou tabelas | Verificar se `DATABASE_URL` está correta |
