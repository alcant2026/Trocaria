# 🚀 Psy Pay | Guia Oficial de Deploy (Render & Neon DB)

Este guia cobre todos os passos para hospedar a **psy pay** usando infraestruturas modernas: **Render** (Node + Python Hosting) e **Neon.tech** (PostgreSQL Serverless).

## 1️⃣ Configurando Banco de Dados no Neon.tech
Como o aplicativo está programado nativamente com SQLAlchemy, sua migração banco é praticamente autônoma.
1. Crie uma conta no [Neon.tech](https://neon.tech/) e crie um novo projeto.
2. Copie a `Connection String` (URL). 
   - Exemplo: `postgresql://seu_usuario:sua_senha@ep-bold-surf-12345.sa-east-1.aws.neon.tech/neondb`
3. Seu arquivo `database.py` já conta com filtros de "Limites de Conexões" para o Neon e bloqueio inteligente de `sslmode`. **Nenhuma alteração de código é necessária.**

## 2️⃣ Variáveis de Ambiente (.env) Global
Você deve adicionar no seu painel da Render, tanto para o Frontend quanto para o Backend.
- `DATABASE_URL=postgresql://sua...string...do...neon`
- `VITE_API_URL=https://api.suaurlrender.com` (apenas para frontend)

## 3️⃣ Subindo o Backend (Render)
1. Crie um **Web Service** no [Render](https://dashboard.render.com).
2. Conecte com seu GitHub (`krkn12/peer`).
3. Defina as configurações:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 2 -k uvicorn.workers.UvicornWorker main:app`
     *(Usar 2 workers impede que as conexões saturem o Neon Database).*
4. Insira a `DATABASE_URL` no menu "Environment".
5. O sistema criará sozinho as 8 tabelas financeiras ao processar o primeiro ping. Após isso, registre a conta principal da plataforma via App Frontend e marque-a como Administrador (com a ajuda de seu painel do DB e do script criado, se necessário).

## 4️⃣ Subindo o Frontend (Render)
1. Crie um **Static Site** no [Render](https://dashboard.render.com).
2. Conecte com o GitHub e selecione a pasta frontend do seu repositório *(configure Root Directory = `frontend`)*.
3. Defina as configurações:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Na aba "Environment", defina a `VITE_API_URL` apontando para o link do backend web service criado no Passo 3.

## ✅ Tratamento de Erros Comuns
- **CORS Bloqueado no Frontend**: Caso seu link do frontend seja novo (ex: `app.psypay.com`), ele deve ser incluído na lista de `CORS_ORIGINS` no `main.py` do Backend.
- **Neon fechando Conexão**: Não use mais de 2 `workers` web. O Free Tier permite máximo 10 conexões. Nossa lógica no `database.py` segura esse teto nativamente se `"neon.tech"` constar na `DATABASE_URL`.
