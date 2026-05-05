# Psy Pay · Rede de Apoio entre Pares

Plataforma P2P que combina **empréstimos**, **marketplace de afiliados** e **rede de indicação** em um só lugar. Qualquer pessoa pode anunciar produtos, pedir ou oferecer crédito, e ganhar pontos convertíveis em dinheiro real.

---

## Funcionalidades

### Marketplace (estilo OLX)
- Landing page pública com categorias, busca e anúncios
- Anúncios gratuitos (24h) ou destacados por R$5 (7 dias)
- Turbinar anúncios com views extras (R$1 a R$35)
- Sistema de avaliações e denúncias

### Empréstimos P2P
- Criação de solicitações com parcelas e taxa
- Match entre credores e tomadores
- Score de reputação (0-1000) e verificação KYC
- Cobrança e contratos via plataforma

### Rede de Indicação (Multi-nível)
- Cada usuário gera seu código de indicação único
- Indicado ganha **5 pontos** ao usar código de amigo
- Indicador ganha **10 pontos** por cada novo cadastro
- Efeito rede: ao comprar, **3x pontos** pra você, **1x** pra cada indicador
- Múltiplas indicações permitidas (pessoas diferentes)

### Conversão de Pontos
- 1000 pontos = R$ 1,00 (resgate via PIX)
- Mínimo de 1000 pontos para solicitar

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite (JavaScript) |
| Backend | Python + FastAPI |
| Banco | PostgreSQL (prod) / SQLite (dev) |
| Pagamentos | MercadoPago PIX |
| Deploy | Render (free tier) |

---

## Estrutura

```
psy-pay/
├── frontend/src/
│   ├── paginas/          # Dashboard, Login, Registro, Perfil
│   ├── componentes/      # LandingPage, MarketplaceView, Footer, etc.
│   └── index.css         # CSS global com design system
├── backend/
│   ├── rotas/            # auth, financeiro, comunidade, marketplace
│   ├── modelos/          # modelos_db.py (todas as tabelas)
│   ├── scripts/          # Simulações financeiras
│   └── main.py           # Ponto de entrada FastAPI
├── docs/                 # Documentação
├── scripts/              # Scripts auxiliares
└── render.yaml           # Deploy config
```

---

## Rodar Local

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173` para a landing page pública.
