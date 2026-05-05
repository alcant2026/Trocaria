# 🚀 Arquitetura de Rotas - Psy Pay Backend

Este documento fornece um mapeamento completo de todos os arquivos que compõem o motor (backend) do Psy Pay, divididos por responsabilidade.

---

## 🏗️ 1. Orquestração e Deploy
Arquivos que iniciam e configuram o servidor.
*   `main.py`: Ponto de entrada do FastAPI. Onde as rotas são acopladas.
*   `start.sh`: Script de inicialização automática (Uvicorn + Gunicorn).
*   `render.yaml`: Configuração de infraestrutura para hospedagem na nuvem (Render/Neon).
*   `.env`: Variáveis de ambiente sensíveis (Chaves MP, DB_URL, JWT_SECRET).

## 🗄️ 2. Camada de Dados (`backend/modelos/`)
Definição de como os dados são salvos.
*   `database.py`: Gerenciador de conexão com o banco de dados (Engine/Session).
*   `modelos/modelos_db.py`: Tabelas do sistema (Usuário, Transação, Empréstimo, Ads).

## 🧠 3. Lógica de Negócio & Motores (`backend/utils_*.py`)
A inteligência por trás dos cálculos e regras de dinheiro.
*   `utils_fintech.py`: Motor do Fundo Coletivo (Pool), Liquidez e Reserva de 30%.
*   `utils_score.py`: Algoritmo que calcula o Score (0-1000) baseado no comportamento.
*   `utils_emprestimo.py`: Cálculos de juros, parcelas e projeções financeiras.
*   `auditoria_saldo.py`: Sistema que verifica se o saldo dos usuários é real ou manipulado.

## 🛡️ 4. Segurança e Filtros
*   `limitador.py`: Controle de taxa (Rate Limiting) para evitar ataques de spam e brute force.

## 🚀 5. Rotas de API (`backend/rotas/`)
Os arquivos que respondem às requisições do Frontend:
*   `rotas_auth.py`: Login, Registro e Segurança (2FA).
*   `rotas_financeiro.py`: Depósitos PIX, Saques e Gestão Admin.
*   `rotas_comunidade.py`: Marketplace, Ads, Pontos e Gamificação.
*   `rotas_emprestimo.py`: Simulações e tomadas de crédito institucional.
*   `rotas_snapshot.py`: Dashboard e Relatórios Fiscais (Fiscal Hub).
*   `rotas_score.py`: Análise de risco e limites de crédito.
*   `rotas_parceiros_caixa.py`: Gestão de depósitos em dinheiro físico.

---
> [!NOTE]
> Todos os arquivos acima são essenciais para o funcionamento do ecossistema Psy Pay. Qualquer alteração em `utils_*.py` impacta diretamente os cálculos de lucro e risco.

---
> [!NOTE]
> Todas as rotas críticas (saques e transferências) exigem **2FA ativo** e as rotas administrativas exigem permissão de **Superusuário (Admin)**.
