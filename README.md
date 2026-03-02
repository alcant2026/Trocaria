# 🚀 Como Testar o Peer

Siga os passos abaixo para rodar o backend e visualizar as telas do frontend.

## 1. Preparar o Backend (Python)
1.  **Cadastro:** Use a rota `/auth/registrar` no Swagger (`/docs`) para criar um usuário.
2.  **Login:** Use `/auth/login` para pegar o token e ver os dados do usuário.
3.  **Saldo:** Como o administrador (você) faz o depósito manual, você pode simular um depósito usando a rota `/financeiro/depositar-manual`.
4.  **Empréstimo:** Com saldo e score, tente solicitar um empréstimo no painel do tomador.
5.  **Investidor:** Tente visualizar a lista de empréstimos e pagar R$ 15 para ver os detalhes de um solicitante.

---

### Observações Importantes:
- **Banco de Dados:** O sistema cria automaticamente um arquivo `cred_plus.db` (SQLite) na primeira execução.
- **Chave PIX Plataforma:** `credpix@gmail.com` (exibida no painel do tomador).
- **Segurança:** A chave PIX de saque é validada contra a chave cadastrada no registro.
