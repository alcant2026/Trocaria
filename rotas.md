# Mapa de Rotas do Backend - Peer

Este documento lista todas as rotas do sistema e serve como controle para os testes e documentação da API.

## ✅ Autenticação (`/auth`)
- `POST /auth/registrar` - Registro de novo usuário (Validação de CPF, Nome e Email)
- `POST /auth/login` - Login, geração de Token JWT e dados iniciais
- `GET /auth/perfil` - Obter dados detalhados do usuário logado
- `POST /auth/2fa/gerar` - Gerar segredo e QR Code (Base64) do 2FA
- `POST /auth/2fa/ativar` - Ativar 2FA definitivamente com código TOTP
- `POST /auth/2fa/desativar` - Desativar 2FA com validação de senha e código
- `DELETE /auth/excluir-conta` - Anonimização e exclusão lógica (LGPD)

## 💰 Empréstimos (`/emprestimos`)
- `POST /emprestimos/solicitar` - Criar nova solicitação de crédito
- `POST /emprestimos/vincular-garantidores/{id}` - Vincular 2 IDs de amigos para garantia social (Pós-meta)
- `POST /emprestimos/aceitar-garantia/{id}` - Aceite do amigo como garantidor (Assinatura Digital)
- `GET /emprestimos/listar` - Listar oportunidades pendentes (Filtro por desbloqueio)
- `POST /emprestimos/desbloquear-dados/{id}` - Pagar R$ 15 para visualizar dados do tomador
- `GET /emprestimos/meus-emprestimos` - Lista detalhada de empréstimos do tomador
- `POST /emprestimos/pagar-parcela/{id}` - Pagamento de parcela com cálculo de mora
- `POST /emprestimos/quitar-total/{id}` - Quitação integral antecipada (Amortização)
- `POST /emprestimos/pagamento-avulso/{id}` - Pagamento de qualquer valor (Taxa R$ 1,50)
- `GET /emprestimos/contrato/pdf/{id}` - Download do contrato profissional assinado em PDF
- `GET /emprestimos/contrato/{id}` - Texto base do contrato (Legacy/Texto)
- `POST /emprestimos/admin/verificar-inadimplencia` - Job de auditoria para penalizar inadimplentes com Score 0 (Admin)

## 📈 Investidor (`/investidor`)
- `POST /investidor/desbloquear/{id}` - Alias para desbloqueio de dados do tomador
- `GET /investidor/meus-investimentos` - Histórico de sessões de análise (Desbloqueios)
- `GET /investidor/carteira` - Dashboard de performance e rentabilidade dos ativos
- `POST /investidor/investir/{id}` - Realizar aporte em um pedido (Blindagem Jurídica)
- `POST /investidor/processar-expiracoes` - Job de gestão de tempo (Jobs de 4h e 5d)

## 🏦 Financeiro (`/financeiro`)
- `POST /financeiro/solicitar-saque` - Retirada via PIX (Exige 2FA e mesma titularidade)
- `POST /financeiro/notificar-deposito` - Aviso de depósito para crédito de saldo
- `GET /financeiro/meu-historico` - Extrato detalhado (Últimas 10 transações)
- `GET /financeiro/admin/pendentes` - Fila de transações aguardando aprovação (Admin)
- `POST /financeiro/admin/confirmar/{id}` - Efetivar Depósito ou Saque (Admin)
- `POST /financeiro/admin/confirmar-verificacao/{id}` - Aprovar Selo Verificado/KYC (Admin)
- `POST /financeiro/admin/rejeitar/{id}` - Rejeitar transação com motivo (Admin)
- `GET /financeiro/admin/fiscal` - Relatório consolidado de Custódia e Lucros (Admin)
- `POST /financeiro/admin/sacar-lucro` - Resgate de lucros da plataforma para o admin
- `POST /financeiro/depositar-manual` - Crédito forçado por ID de usuário (Admin/Teste)

## 🎯 Score (`/score`)
- `POST /score/comprar` - Compra pontual de reputação (R$ 35 -> +1.5 pts)
- `POST /score/solicitar-verificacao` - Iniciar processo de verificação humana
- `POST /score/atualizar-decaimento` - Job de redução orgânica diária (-0.5 pts)

## ⚙️ Global
- `GET /` - Check de saúde da API (Health Check)
