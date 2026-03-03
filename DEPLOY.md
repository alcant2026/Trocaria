# 🚀 Guia Definitivo: Deploy Completo no Render

Este guia contém o passo a passo exato para colocar a plataforma **cred+** no ar, garantindo que o backend, o frontend e o banco de dados se comuniquem perfeitamente.

---

## 🏗️ Passo 1: Banco de Dados (PostgreSQL)

O Render oferece um banco nativo, mas você também pode usar serviços como o **Neon.tech** (gratuito e escalável).

1. No painel do Render, clique em **New +** > **PostgreSQL**.
2. **Name**: `cred-plus-db`
3. **Region**: Escolha a mesma região onde ficará o seu backend (Ex: `Oregon` ou `Ohio`).
4. Após criar, copie a **Internal Database URL** (se o backend estiver no Render) ou a **External Database URL** (se quiser acessar do seu computador).
   - Exemplo de formato: `postgresql://user:password@hostname/dbname`

---

## ⚙️ Passo 2: Backend (Web Service)

O backend é a API que processa os dados.

1. Clique em **New +** > **Web Service**.
2. Conecte o seu repositório do GitHub (que deve se chamar `peer`).
3. **Configurações Principais**:
   - **Name**: `cred-plus-api`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT`
4. **Variáveis de Ambiente (Advanced > Add Environment Variable)**:
   - `DATABASE_URL`: (Cole a URL do seu banco do Passo 1)
   - `SECRET_KEY`: (Crie uma senha longa e aleatória para o JWT)
   - `FRONTEND_URL`: `https://cred-plus-front.onrender.com` (Será o nome do seu frontend abaixo)
   - `ACCESS_TOKEN_EXPIRE_MINUTES`: `1440` (Duração do login em minutos)

---

## 🎨 Passo 3: Frontend (Static Site)

O frontend é a interface visual que o usuário acessa.

1. Clique em **New +** > **Static Site**.
2. Conecte o mesmo repositório do GitHub.
3. **Configurações Principais**:
   - **Name**: `cred-plus-front`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Variáveis de Ambiente (Environment)**:
   - `VITE_API_URL`: `https://cred-plus-api.onrender.com` (A URL que o Render gerou para o seu backend no Passo 2)

---

## ✅ Passo 4: Verificação e Manutenção

1. **Acesso**: Entre na URL gerada no Passo 3 (Ex: `https://cred-plus-front.onrender.com`).
2. **Logs**: Se algo não carregar, vá no painel do Render, clique em seu Web Service de Backend e olhe a aba **Logs**.
3. **Sincronização de Banco**: O sistema está configurado para criar automaticamente as colunas necessárias ao iniciar. Se você deletar o banco, ele se reconstruirá sozinho no primeiro acesso.

> [!WARNING]
> **Segurança**: Nunca compartilhe o seu arquivo `.env` ou as URLs com a senha do banco em locais públicos. O Render já oculta as variáveis de ambiente para você.

> [!TIP]
> **Custom Domain**: No Render, você pode conectar o seu próprio domínio (`seu-site.com.br`) facilmente nas configurações de cada serviço (Settings > Custom Domains).
