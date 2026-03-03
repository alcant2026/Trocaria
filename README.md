# 🚀 cred+ | Plataforma P2P de Crédito Ético

O **cred+** é uma solução moderna de empréstimos *Peer-to-Peer* (P2P), conectando pessoas que precisam de crédito a investidores que buscam rentabilidade. Focada em segurança, transparência e agilidade, a plataforma elimina intermediários bancários tradicionais.

---

## ✨ Funcionalidades Principais

### 🏦 Para o Tomador (Empréstimo)
- **Solicitação Ágil**: Peça crédito em segundos com taxas competitivas.
- **Garantia Social**: Sistema de garantidores via ID de amigos para aumentar a confiança.
- **Transparência Total**: Visualização clara de parcelas, juros e prazos.
- **Score Dinâmico**: Evolução do perfil conforme o histórico de pagamentos.

### 💰 Para o Investidor
- **Mercado de Oportunidades**: Escolha onde investir com base no score e perfil do tomador.
- **Rentabilidade Real**: Lucros líquidos calculados automaticamente (já descontada a taxa de performance de 10%).
- **Gestão de Carteira**: Acompanhe recebimentos, ativos e fluxo de caixa diário.
- **Segurança de Dados**: Desbloqueio seguro de perfis para análise detalhada.

---

## 🛡️ Segurança e Tecnologia

### 🔐 Mentalidade Zero Trust
- **Validação de Sangue Frio**: Todas as transações são validadas em múltiplas camadas (Frontend + Backend) para impedir valores negativos ou inconsistentes.
- **Autenticação Robusta**: Proteção via JWT e suporte a Segundo Fator de Autenticação (2FA) para saques.
- **LGPD Compliance**: Dados sensíveis protegidos e anonimizados onde necessário.

### 🛠️ Stack Tecnológica
- **Backend**: Python 3.10+ com **FastAPI** (Alta performance e assincronismo).
- **Frontend**: React.js com **Vite** e Tailwind-like styles para UX premium.
- **Banco de Dados**: PostgreSQL com suporte nativo a indexação financeira.
- **Infraestrutura**: Configurado para deploy contínuo (CI/CD) no **Render**.

---

## 🚀 Como Começar (Ambiente Local)

### Pré-requisitos
- Python 3.10+
- Node.js 18+
- PostgreSQL ativo

### 1. Configurando o Backend
```bash
# Entre na pasta e crie o ambiente
cd backend
python -m venv .venv
source .venv/bin/activate  # No Windows: .venv\Scripts\activate

# Instale as dependências
pip install -r requirements.txt

# Inicie a API
python main.py
```
*Acesse a documentação Swagger em `/docs`.*

### 2. Configurando o Frontend
```bash
# Em outro terminal
cd frontend
npm install
npm run dev
```
*O sistema estará disponível em `http://localhost:3000`.*

---

## 🌍 Deploy Produção

Para colocar o sistema no ar de forma profissional, consulte o nosso [Guia de Deploy (Render + GitHub)](/DEPLOY.md).

---

## 📜 Regras de Negócio e Taxas
- **Custo de Solicitação**: R$ 4,00 (Taxa administrativa).
- **Taxa de Performance**: 10% sobre os juros recebidos pelo investidor.
- **Janelas de Expiração**: 4 horas para pedidos sem lances e 5 dias para o ciclo total.
- **Precisão Financeira**: Uso obrigatório da biblioteca `decimal` em todos os cálculos.

---

*Desenvolvido com foco em democratização financeira e segurança de dados.*
