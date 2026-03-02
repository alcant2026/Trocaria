# cred+

Plataforma P2P de crédito com:
- Backend em FastAPI (autenticação JWT, regras de empréstimo, fluxo financeiro e área de investidor).
- Frontend em React + Vite.

## Estrutura

```text
cred+/
├── backend/
└── frontend/
```

## Pré-requisitos

- Python 3.10+
- Node.js 18+
- npm

## Configuração do backend

1. Entre na pasta:
```bash
cd backend
```

2. Crie e ative o ambiente virtual:
```bash
python -m venv .venv
source .venv/bin/activate
```

3. Instale dependências:
```bash
pip install -r requirements.txt
```

4. Configure o arquivo `.env` (`backend/.env`):
```env
DATABASE_URL=postgresql://USUARIO:SENHA@HOST/DB?sslmode=require
SECRET_KEY=defina_uma_chave_forte
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=http://localhost:3000
```

5. Rode a API:
```bash
python main.py
```

API disponível em: `http://localhost:8000`  
Swagger em: `http://localhost:8000/docs`

## Configuração do frontend

1. Em outro terminal, entre na pasta:
```bash
cd frontend
```

2. Instale dependências:
```bash
npm install
```

3. Rode em desenvolvimento:
```bash
npm run dev
```

Frontend disponível em: `http://localhost:3000`

Observação:
- Em ambiente local, o Vite faz proxy de `/api` para `http://localhost:8000`.
- Para produção, defina `VITE_API_URL` se necessário.

## Fluxo rápido de teste

1. Acesse `http://localhost:8000/docs`.
2. Registre um usuário em `/auth/registrar` com `aceite_termos=true`.
3. Faça login em `/auth/login`.
4. Simule saldo com `/financeiro/depositar-manual`.
5. Crie pedido em `/emprestimos/solicitar`.
6. Liste pedidos e teste desbloqueio/investimento pelas rotas de investidor.

## Regras importantes do domínio

- Postar solicitação de empréstimo custa `R$ 4,00`.
- Desbloqueio de dados para investidor custa `R$ 15,00`.
- Saques passam por validação da chave PIX do usuário.
- Solicitações podem expirar (regras de 4h e 5 dias).
