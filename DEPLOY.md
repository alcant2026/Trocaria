# Guia de Deploy no Render - cred+

Este documento detalha os passos necessários para colocar a plataforma em produção utilizando o Render.

## 1. Banco de Dados (PostgreSQL)

Você pode usar o serviço de PostgreSQL nativo do Render ou um externo (como Neon.tech).

1. No Render, clique em **New** > **PostgreSQL**.
2. Nomeie como `cred-plus-db`.
3. Após a criação, copie a **Internal Database URL** (para uso dentro do Render).

## 2. Backend (Web Service)

O backend é construído em FastAPI e utiliza Gunicorn em produção.

1. Clique em **New** > **Web Service**.
2. Conecte o repositório `peer` (GitHub).
3. **Configurações:**
   - **Name:** `peer-api`
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`
4. **Variáveis de Ambiente (Advanced > Add Environment Variable):**
   - `DATABASE_URL`: (A URL do seu banco PostgreSQL)
   - `SECRET_KEY`: (Uma chave aleatória e segura)
   - `FRONTEND_URL`: `https://peer-front.onrender.com` (Sua URL do frontend abaixo)
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440`

## 3. Frontend (Static Site)

O frontend utiliza Vite e React.

1. Clique em **New** > **Static Site**.
2. Conecte o mesmo repositório do GitHub.
3. **Configurações:**
   - **Name:** `peer-front`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. **Variáveis de Ambiente:**
   - `VITE_API_URL`: `https://peer-api.onrender.com` (A URL do seu backend acima)

## 4. Verificação

- Após o deploy, acesse a URL do frontend.
- Tente realizar um login/cadastro.
- Verifique os logs do Web Service se houver erros de conexão com o banco.

> [!IMPORTANT]
> Lembre-se que as URLs do Render são únicas. Substitua `peer-api` e `peer-front` pelos nomes que você escolher durante a criação.
