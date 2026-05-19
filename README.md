# Trocaria · Classificados e Comunidade P2P

Plataforma de classificados gratuitos que conecta compradores e vendedores locais. Marketplace com sistema de reputação comunitária, rede de indicação e gamificação com recompensas por engajamento.

---

## Funcionalidades Principais

### Marketplace de Classificados
- Anúncios gratuitos com duração de 24h (feed sempre atualizado)
- Até 6 fotos por anúncio com compressão automática
- Busca textual, filtros por categoria, cidade e faixa de preço
- Sistema de ofertas entre usuários (48h para resposta)
- Avaliações de 1-5 estrelas por anúncio

### Confiança Comunitária
- Score de reputação (0-1000) baseado em interações verificadas
- Confirmação bilateral de vendas: vendedor e comprador confirmam juntos
- Selos visuais de confiança no perfil e nos anúncios
- Denúncia comunitária: 3 denúncias = revisão automática
- Bloqueio de usuários indesejados

### Rede de Indicação
- Código de indicação único por usuário
- Indicado ganha **5 pontos** ao se cadastrar
- Indicador ganha **10 pontos** por cada novo membro
- Efeito rede: ao usar recursos da plataforma, pontos extras para toda a cadeia

### Campeonato Semanal
- Ranking com top 20 usuários por pontos acumulados na semana
- **Reset automático todo sábado às 18:00 (BRT)**
- Conversão: **1000 pontos = R$ 1,00** (resgate via PIX)
- Histórico de resgates disponível

### Assinatura Premium
- **Mensal: R$ 19,99** | **Anual: R$ 199,99**
- Benefícios: 1-5 pontos aleatórios por clique, badge exclusivo, prioridade visual

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite (JavaScript) |
| Backend | Python + FastAPI |
| Banco | PostgreSQL via Neon (prod) / SQLite (dev) |
| Pagamentos | Mercado Pago (PIX para serviços da plataforma) |
| Autenticação | JWT (CPF + senha) + 2FA (TOTP) |
| Verificação Email | Firebase Auth |
| Deploy | Render |

---

## Recursos da Plataforma

| Recurso | Descrição |
|---------|-----------|
| Anúncio gratuito | 24h de visibilidade, 50 views iniciais |
| Destaque de anúncio | R$ 5,00 por 7 dias no topo |
| Boost de visibilidade | Pacotes de R$ 1 a R$ 35 para views extras |
| Assinatura Premium | R$ 19,99/mês ou R$ 199,99/ano |

---

## Estrutura do Projeto

```
trocaria/
├── frontend/src/
│   ├── paginas/          # Dashboard, Login, Registro, Admin
│   ├── componentes/      # Marketplace, Ranking, SeloConfianca, Modais
│   ├── api.js            # Cliente HTTP com cache e retry
│   └── firebase.js       # Verificação de email
├── backend/
│   ├── rotas/            # auth, comunidade, financeiro, marketplace, score
│   ├── modelos/          # modelos_db.py (SQLAlchemy)
│   ├── utils_*.py        # Ranking, Storage, Segurança
│   └── main.py           # FastAPI com middlewares de segurança
├── docs/                 # Documentação
└── render.yaml           # Deploy Render
```

---

## Rodar Local

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Backend: `http://localhost:8000` | Frontend: `http://localhost:3000`

---

## Variáveis de Ambiente (.env)

```env
# Banco de dados
DATABASE_URL_LOCAL=sqlite:///./trocaria.db
DATABASE_URL=postgresql://...       # Produção

# Segurança
SECRET_KEY=sua_chave_secreta
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Firebase
FIREBASE_API_KEY=AIzaSy...
FIREBASE_SERVICE_ACCOUNT_PATH=/caminho/service-account.json

# Mercado Pago (serviços da plataforma)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...

# Frontend
FRONTEND_URL=https://seu-frontend.onrender.com
FRONTEND_URL_LOCAL=http://localhost:3000
```
