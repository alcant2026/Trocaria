# 🚀 Guia Definitivo: Deploy Completo (GitHub + Render)

Este guia contém o passo a passo exato para versionar o seu código no **GitHub** e colocá-lo no ar no **Render**, garantindo que o backend, o frontend e o banco de dados funcionem perfeitamente.

---

## 💾 Passo 1: Preparação e GitHub (Obrigatório)

O Render precisa ler os arquivos do seu repositório no GitHub para fazer o deploy automático sempre que você atualizar o código.

1. **Crie um repositório** no seu GitHub (Ex: nomeie como `cred-plus`).
2. **Conecte a sua pasta local** ao GitHub:
   ```bash
   # Dentro da pasta do projeto
   git init
   git add .
   git commit -m "feat: setup completo para produção"
   git remote add origin https://github.com/seu-usuario/cred-plus.git
   git branch -M main
   git push -u origin main
   ```
3. **Atualizações futuras**: Sempre que mudar algo, rode:
   ```bash
   git add .
   git commit -m "descrição da mudança"
   git push origin main
   ```
   *O Render detectará o push e atualizará o site sozinho!*

---

## 🏗️ Passo 2: Banco de Dados (PostgreSQL)

O Render oferece um banco nativo, mas você também pode usar serviços como o **Neon.tech**.

1. No painel do Render, clique em **New +** > **PostgreSQL**.
2. **Name**: `cred-plus-db`
3. Após criar, copie a **Internal Database URL** (para uso dentro do Render).

---

## ⚙️ Passo 3: Backend (Web Service)

O backend é a API que processa os dados.

1. Clique em **New +** > **Web Service**.
2. Conecte o repositório que você criou no Passo 1.
3. **Configurações Principais**:
   - **Name**: `cred-plus-api`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`
4. **Variáveis de Ambiente (Advanced > Add Environment Variable)**:
   - `DATABASE_URL`: (URL do banco do Passo 2)
   - `SECRET_KEY`: (Crie uma chave longa e aleatória)
   - `FRONTEND_URL`: `https://cred-plus-front.onrender.com`
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440`

---

## 🎨 Passo 4: Frontend (Static Site)

1. Clique em **New +** > **Static Site**.
2. Conecte o mesmo repositório do GitHub.
3. **Configurações Principais**:
   - **Name**: `cred-plus-front`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Variáveis de Ambiente (Environment)**:
   - `VITE_API_URL`: `https://cred-plus-api.onrender.com` (A URL do seu backend no Passo 3)

---

## ✅ Passo 5: Verificação e Manutenção

1. **Acesso**: Entre na URL do frontend gerada no Passo 4.
2. **Logs**: Se algo falhar, olhe a aba **Logs** no painel do seu serviço no Render.
3. **Auto-Deploy**: Toda vez que você fizer `git push`, o Render reconstrói o sistema automaticamente.

> [!WARNING]
> **Segurança**: Nunca compartilhe URLs com senhas. O Render gerencia isso com segurança nas variáveis de ambiente.

> [!TIP]
> **Custom Domain**: Você pode conectar seu próprio domínio (`.com.br`) na aba **Settings > Custom Domains** de cada serviço no Render.
