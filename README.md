# Trocaria · Plataforma de Crédito Colaborativo P2P

Plataforma financeira descentralizada que conecta pessoas para empréstimos entre pares, com marketplace de afiliados, rede de indicação multi-nível e sistema de gamificação com prêmios em dinheiro real.

---

## Funcionalidades Principais

### Empréstimos P2P
- Solicitações de crédito com valor, taxa de juros e parcelas
- Match entre credores e tomadores com score de reputação (0-1000)
- Verificação de identidade (KYC) via documentos
- Cobrança automatizada e contratos digitais

### Marketplace de Afiliados
- Landing page pública com categorias, busca e anúncios
- Anúncios gratuitos (24h) ou **destaque por R$ 5,00** (7 dias)
- Turbinar anúncios com views extras (pacotes de R$ 1 a R$ 35)
- Sistema de avaliações (1-5 estrelas) e denúncias

### Rede de Indicação Multi-nível
- Código de indicação único por usuário
- Indicado ganha **5 pontos** ao usar código de amigo
- Indicador ganha **10 pontos** por cada novo cadastro
- Efeito rede: ao pagar taxas, **3x pontos** para você, **1x** para cada indicador

### Campeonato Semanal
- Ranking com top 20 usuários por `pontos_semanais`
- **Reset automático todo sábado às 18:00 (BRT)**
- Prêmio: **1000 pontos = R$ 1,00** creditado automaticamente no saldo
- Histórico de pagamentos disponível para auditoria

### Assinatura Premium
- **Mensal: R$ 19,99** | **Anual: R$ 199,99**
- Benefícios: 1-5 pontos aleatórios por clique (vs 1 fixo), prioridade nos anúncios, badge VIP

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite (JavaScript) |
| Backend | Python + FastAPI |
| Banco | PostgreSQL via Neon (prod) / SQLite (dev) |
| Pagamentos | Mercado Pago (PIX) |
| Autenticação | JWT (CPF + senha) + 2FA (TOTP) |
| Verificação Email | Firebase Auth (grátis, link de verificação) |
| Verificação Telefone | Código na tela (hash SHA256 no banco) |
| Deploy | Render (free tier) |

---

## Fontes de Receita

| Fonte | Valor |
|-------|-------|
| Taxa de solicitação P2P | R$ 2,00 |
| Taxa de match (intermediação) | 2% (mín R$ 2, máx R$ 20) |
| Assinatura Premium mensal | R$ 19,99 |
| Assinatura Premium anual | R$ 199,99 |
| Verificação KYC | R$ 14,99 |
| Destaque de anúncio (7 dias) | R$ 5,00 |
| Boost de views (4 tiers) | R$ 1 / 5 / 12 / 35 |
| Cobrança de dívida | R$ 2,00 |

---

## Estrutura do Projeto

```
trocaria/
├── frontend/src/
│   ├── paginas/          # Dashboard, Login, Registro, Admin, Verificação
│   ├── componentes/      # LandingPage, Marketplace, RankingSemanal, Footer
│   ├── api.js            # Cliente HTTP com cache e retry
│   └── firebase.js       # Inicialização Firebase (email verification)
├── backend/
│   ├── rotas/            # auth, emprestimo, financeiro, comunidade, marketplace, score, snapshot, storage
│   ├── modelos/          # modelos_db.py (todas as tabelas SQLAlchemy)
│   ├── utils_*.py        # Firebase, Telegram, Ranking, Storage, OTP log
│   ├── scripts/          # Simulações financeiras e manutenção
│   └── main.py           # Ponto de entrada FastAPI com middlewares
├── docs/                 # Documentação
└── render.yaml           # Config de deploy Render (backend + frontend)
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
DATABASE_URL_LOCAL=sqlite:///./cred_plus.db
DATABASE_URL=postgresql://...       # Produção (Neon)

# Segurança
SECRET_KEY=sua_chave_secreta
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Firebase (verificação de email)
FIREBASE_API_KEY=AIzaSy...
FIREBASE_SERVICE_ACCOUNT_PATH=/caminho/service-account.json

# Mercado Pago
MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
MERCADOPAGO_PUBLIC_KEY=APP_USR-...

# Frontend
FRONTEND_URL=https://seu-frontend.onrender.com
FRONTEND_URL_LOCAL=http://localhost:3000
```
