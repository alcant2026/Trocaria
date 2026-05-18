# RESUMO DE PROTECOES IMPLEMENTADAS - PSY PAY

**Data:** 18/05/2026
**Versao:** 1.0
**Status:** Pronto para auditoria regulatoria

---

## LISTA COMPLETA DE PROTECOES

### 1. PROTECAO CONTRA BACEN (Banco Central)

#### ❌ Sistema de Saldo REMOVIDO
- [x] Rotas de deposito bloqueadas (erro 410)
- [x] Rotas de saque bloqueadas (erro 410)
- [x] Admin nao pode adicionar saldo (erro 410)
- [x] Admin nao pode sacar lucro virtual (erro 410)
- [x] Webhook ignora transacoes DEPOSITO/SAQUE
- [x] Frontend mostra alerta "Sistema Descontinuado"

#### ✅ Fluxo P2P Direto (Sem Intermediacao)
- [x] `GET /emprestimos/chave-pix/{pedido_id}` → Investidor ve chave PIX do Tomador
- [x] `POST /emprestimos/registrar-transferencia/{pedido_id}` → Confirma envio P2P
- [x] `POST /emprestimos/registrar-recebimento-inicial/{pedido_id}` → Confirma recebimento P2P
- [x] Dinheiro circula DIRETO via PIX, nunca passa pela plataforma

#### ✅ Modelo de Receita (Taxas de Servico)
- [x] Taxa de publicacao: R$ 2,00 (vai para CNPJ da empresa)
- [x] Taxa de match: R$ 2,00 (vai para CNPJ da empresa)
- [x] Taxa de cobranca: R$ 2,00 (vai para CNPJ da empresa)
- [x] Taxa de destaque: variavel (vai para CNPJ da empresa)
- [x] Assinatura Premium: R$ 19,99/mes (vai para CNPJ da empresa)

#### ✅ Documentacao Anti-Intermediacao
- [x] `docs/POSICIONAMENTO_JURIDICO.md` → Estrategia completa
- [x] `docs/NAO_SOMOS_INSTITUICAO_FINANCEIRA.md` → Declaracao publica
- [x] `docs/TERMOS_DE_USO.md` v3.0 → Clausulas de nao-intermediacao
- [x] Rota publica `/api/compliance/declaracao-regulatoria` → Acessivel a todos

---

### 2. PROTECAO CONTRA CVM (Valores Mobiliarios)

#### ✅ Sem Captacao de Recursos
- [x] NAO prometemos retorno fixo aos investidores
- [x] NAO emitimos CRI, CRA, FIDC ou qualquer valor mobiliario
- [x] NAO fazemos oferta publica
- [x] Contrato de mútuo declara: "risco é exclusivo do investidor"

#### ✅ Termo de Ciencia de Risco
- [x] Obrigatorio para investidores antes de aceitar oferta
- [x] Lista todos os riscos: calote, atraso, fraude, insolvencia
- [x] Hash de aceite para auditoria
- [x] Registrado no banco (`ContratoMutuo.termo_risco_aceite`)

#### ✅ Programa de Fidelidade (Anti-Loteria)
- [x] Renomeado de "premiacao" para "recompensa de fidelidade"
- [x] Limite por usuario: R$ 50,00/sem
- [x] Limite total: R$ 1.000,00/sem
- [x] Regulamento juridico completo (`docs/REGULAMENTO_RANKING.md`)
- [x] Pontos por engajamento, NAO por sorte

---

### 3. PROTECAO CONTRA USURA (Juros Abusivos)

#### ✅ Limites de Juros no Sistema
- [x] Limite maximo: 12% ao mes (hard limit no Pydantic)
- [x] Validacao na criacao do pedido
- [x] Validacao no aceite da oferta
- [x] CET informado no contrato

#### ✅ Contrato de Mútuo Digital
- [x] `utils_contrato.py` → Gera contrato com hash SHA-256
- [x] Modelo `ContratoMutuo` no banco
- [x] Cláusula de nao-intermediacao
- [x] Assinaturas digitais com IP e hash
- [x] Texto plano para PDF

---

### 4. PROTECAO LGPD (Lei 13.709/2018)

#### ✅ Rotas de Compliance
- [x] `GET /compliance/dados-pessoais` → Direito de Acesso
- [x] `POST /compliance/portabilidade` → Direito de Portabilidade
- [x] `POST /compliance/correcao` → Direito de Retificacao
- [x] `DELETE /compliance/exclusao` → Direito ao Esquecimento
- [x] `POST /compliance/revogar-consentimento` → Revogacao
- [x] `GET /compliance/consentimentos` → Listar consentimentos
- [x] `GET /compliance/info-tratamento` → Informacoes publicas

#### ✅ Documentacao LGPD
- [x] `docs/POLITICA_PRIVACIDADE.md`
- [x] Consentimentos granularizados (termos, privacidade, marketing, cookies)
- [x] DPO nomeado (dpo@psypay.com.br)
- [x] Prazo de resposta: 15 dias

---

### 5. PROTECAO ANTI-FRAUDE E PLD/FT

#### ✅ Validacoes de Seguranca
- [x] `utils_seguranca.py` → Anti-fraude completo
- [x] Validacao de CPF (digito verificador)
- [x] Bloqueio de emails temporarios
- [x] Deteccao de contas fake (multiplas contas mesmo IP)
- [x] Limites de transacao (PLD): R$ 10.000/dia, R$ 50.000/mes
- [x] Validacao de velocidade suspeita

#### ✅ Auditoria Imutavel
- [x] `utils_auditoria.py` → Logs com hash encadeado
- [x] Auditoria de transacoes financeiras
- [x] Auditoria de acesso admin
- [x] Auditoria de mudancas sensiveis
- [x] Auditoria de KYC

#### ✅ Sistema de Disputas
- [x] `rotas_disputas.py` → Mediacao de conflitos
- [x] Abertura de disputa por Tomador ou Investidor
- [x] Resposta da parte acionada
- [x] Mediacao administrativa
- [x] Decisao com ressarcimento
- [x] Encaminhamento judicial

---

### 6. SEGURANCA TECNICA

#### ✅ Middlewares de Protecao
- [x] HSTS (Strict-Transport-Security)
- [x] X-XSS-Protection
- [x] X-Frame-Options: DENY
- [x] X-Content-Type-Options: nosniff
- [x] Referrer-Policy: strict-origin-when-cross-origin
- [x] Permissions-Policy
- [x] Bloqueio de IPs suspeitos
- [x] Rate limiting (SlowAPI)

#### ✅ Headers de Seguranca
- [x] CORS restrito (nao usa `*`)
- [x] Validacao de Host em producao
- [x] Limite de upload de arquivos (2MB)
- [x] Validacao de magic bytes

---

### 7. DOCUMENTACAO COMPLETA

| Documento | Proposito |
|-----------|-----------|
| `POSICIONAMENTO_JURIDICO.md` | Estrategia de compliance regulatorio |
| `TERMOS_DE_USO.md` v3.0 | Clausulas de protecao juridica |
| `POLITICA_PRIVACIDADE.md` | Conformidade LGPD |
| `NAO_SOMOS_INSTITUICAO_FINANCEIRA.md` | Declaracao publica de transparencia |
| `REGULAMENTO_RANKING.md` | Evita enquadramento como loteria |
| `PLANO_RESPOSTA_INCIDENTES.md` | Seguranca e resposta a incidentes |
| `CHECKLIST_SEGURANCA_PRODUCAO.md` | Checklist pre-producao |
| `GUIA_REMOVER_SALDO.md` | Documentacao tecnica da migracao |

---

### 8. ARQUIVOS DE CODIGO CRIADOS/ALTERADOS

#### Novos Arquivos
- `backend/utils_seguranca.py` → Anti-fraude, PLD, limites
- `backend/utils_auditoria.py` → Logs imutaveis
- `backend/utils_contrato.py` → Contratos digitais de mútuo
- `backend/utils_termo_risco.py` → Termo de ciencia de risco
- `backend/rotas/rotas_compliance.py` → Rotas LGPD
- `backend/rotas/rotas_disputas.py` → Sistema de disputas
- `docs/` → 8 documentos juridicos

#### Arquivos Alterados (Backend)
- `backend/main.py` → Novos middlewares e rotas
- `backend/modelos/modelos_db.py` → Novas tabelas (Disputa, ConsentimentoLGPD, ContratoMutuo)
- `backend/rotas/rotas_financeiro.py` → Rotas de saldo bloqueadas
- `backend/rotas/rotas_emprestimo.py` → Fluxo P2P direto + validacoes
- `backend/rotas/rotas_auth.py` → Saldo retorna 0
- `backend/rotas/rotas_snapshot.py` → Sem saldo
- `backend/rotas/rotas_comunidade.py` → Sem saldo
- `backend/rotas/rotas_marketplace.py` → Sem saldo
- `backend/rotas/rotas_admin_fiscal.py` → Sem custodia
- `backend/utils_ranking.py` → Anti-loteria

#### Arquivos Alterados (Frontend)
- `frontend/src/paginas/DashboardCliente.jsx` → Alertas de descontinuado
- `frontend/src/paginas/AdminDashboard.jsx` → Botoes desabilitados
- `frontend/src/componentes/HomeView.jsx` → Sem deposito/saque
- `frontend/src/componentes/HistoricoView.jsx` → Sem deposito/saque
- `frontend/src/componentes/MarketplaceView.jsx` → Texto atualizado

---

### 9. CHECKLIST PRE-PRODUCAO (O que ainda precisa)

- [ ] Preencher CNPJ real nos documentos
- [ ] Preencher nome do DPO nos documentos
- [ ] Preencher endereco real nos documentos
- [ ] Rotacionar SECRET_KEY (nova chave aleatoria)
- [ ] Rotacionar MERCADOPAGO_ACCESS_TOKEN
- [ ] Rotacionar MERCADOPAGO_CLIENT_SECRET
- [ ] Rotacionar Firebase API Key
- [ ] Configurar variaveis no Render (nunca commitar .env)
- [ ] Testar fluxo P2P completo
- [ ] Testar rotas de compliance LGPD
- [ ] Testar contrato digital
- [ ] Testar termo de ciencia de risco
- [ ] Backup do banco de dados
- [ ] Configurar SSL (HTTPS obrigatorio)
- [ ] Verificar certificado SSL (nao vencido)
- [ ] Configurar monitoramento (Sentry ou similar)

---

### 10. CONTATOS IMPORTANTES

- **Suporte:** suporte@psypay.com.br
- **Ouvidoria:** ouvidoria@psypay.com.br
- **DPO:** dpo@psypay.com.br
- **Juridico:** juridico@psypay.com.br
- **ANPD:** www.gov.br/anpd | atendimento@anpd.gov.br
- **Banco Central:** www.bcb.gov.br
- **CVM:** www.cvm.gov.br

---

**Documento confidencial - Uso interno**
**Ultima atualizacao:** 18/05/2026

