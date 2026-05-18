# CHECKLIST DE SEGURANÇA PARA PRODUÇÃO - PSY PAY

Este documento deve ser verificado antes de qualquer deploy em produção.

---

## SEGREDOS E CREDENCIAIS

- [ ] **NENHUM** arquivo `.env` está commitado no Git
- [ ] **NENHUM** arquivo de credencial Firebase (`*adminsdk*.json`) está no Git
- [ ] **NENHUM** arquivo de chave privada (`.pem`, `.key`) está no Git
- [ ] As chaves de API do Mercado Pago são de **produção** (não de teste/sandbox)
- [ ] O `SECRET_KEY` do JWT tem pelo menos **32 caracteres** e é aleatório
- [ ] Existe uma `AUDIT_SECRET_KEY` separada para assinar logs
- [ ] Variáveis de ambiente sensíveis estão configuradas no painel do Render (não no código)
- [ ] O banco de dados PostgreSQL (Neon) usa SSL obrigatório (`sslmode=require`)

---

## BANCO DE DADOS

- [ ] O banco de produção é PostgreSQL (não SQLite)
- [ ] Backups automáticos estão configurados no Neon
- [ ] Teste de restauração de backup foi realizado nos últimos 30 dias
- [ ] Conexões de banco são limitadas (pool_size=1, max_overflow=2 no Render Free)
- [ ] A senha do banco de dados é forte e exclusiva

---

## AUTENTICAÇÃO E AUTORIZAÇÃO

- [ ] Senhas são hasheadas com bcrypt (custo >= 12)
- [ ] JWT tem expiração curta (recomendado: 1-4 horas, não 24h)
- [ ] Refresh tokens estão implementados (para não usar JWT de 24h)
- [ ] 2FA (TOTP) está funcional e testado
- [ ] Rotas administrativas exigem `is_admin=True`
- [ ] Conta de sistema `000PL` está protegida contra login
- [ ] Rate limiting está ativo em todas as rotas de autenticação
- [ ] Existe proteção contra brute force (bloqueio após tentativas falhas)

---

## UPLOADS E ARQUIVOS

- [ ] A pasta `uploads/` NÃO está servida publicamente via StaticFiles
- [ ] Documentos KYC só são acessíveis por rotas protegidas e auditadas
- [ ] Uploads são limitados a 2MB
- [ ] Validação de magic bytes está ativa (não confiar apenas em extension)
- [ ] A pasta `uploads/` está fora do Git (`.gitignore`)

---

## COMPLIANCE LEGAL

- [ ] Termos de Uso estão publicados e acessíveis na plataforma
- [ ] Política de Privacidade (LGPD) está publicada
- [ ] O usuário é obrigado a aceitar os termos no cadastro (`aceite_termos=True`)
- [ ] Existe registro de consentimentos LGPD no banco (`consentimentos_lgpd`)
- [ ] O DPO está nomeado e o contato está visível
- [ ] Existe canal para exercício de direitos LGPD (`/api/compliance`)
- [ ] O sistema de disputas está funcional

---

## ANTI-FRAUDE E PLD

- [ ] Validação de CPF está ativa (dígito verificador)
- [ ] Emails temporários são bloqueados no cadastro
- [ ] Existe verificação de contas suspeitas (multiplas contas mesmo IP)
- [ ] Limites de transação estão configurados (diário/mensal)
- [ ] Taxas de juros são validadas contra limites legais
- [ ] Logs de auditoria são gerados para TODAS as transações financeiras
- [ ] Existe detecção de velocidade suspeita (ações rápidas pós-cadastro)

---

## INFRAESTRUTURA

- [ ] HTTPS está obrigatório (redirecionamento de HTTP para HTTPS)
- [ ] Certificado SSL é válido e não está próximo do vencimento
- [ ] Headers de segurança estão configurados (HSTS, CSP, X-Frame-Options)
- [ ] CORS está restrito aos domínios oficiais (não `*`)
- [ ] O WAF (Cloudflare ou similar) está ativo
- [ ] O domínio oficial está configurado (não usar URLs do Render diretamente)

---

## MONITORAMENTO

- [ ] Logs de erro estão sendo coletados (Sentry ou similar)
- [ ] Alertas de indisponibilidade estão configurados
- [ ] Monitoramento de transações suspeitas está ativo
- [ ] O e-mail de alerta de segurança está configurado e testado

---

## AÇÕES IMEDIATAS PENDENTES

Após revisar este checklist, execute:

1. **Rotacionar todas as chaves** que estavam expostas no `.env` antigo:
   - `SECRET_KEY`
   - `MERCADOPAGO_ACCESS_TOKEN`
   - `MERCADOPAGO_CLIENT_SECRET`
   - Chave do Firebase

2. **Excluir do histórico do Git** qualquer arquivo sensível que tenha sido commitado acidentalmente:
   ```bash
   git filter-repo --path backend/.env --invert-paths
   ```

3. **Configurar variáveis no Render:**
   - Acesse o dashboard do Render
   - Adicione todas as variáveis do `.env` nas Environment Variables
   - NUNCA commite o `.env` novamente

4. **Testar o sistema de disputas** com uma conta de teste

5. **Testar a rota de compliance LGPD** (`/api/compliance/dados-pessoais`)

6. **Fazer um backup manual** do banco antes do deploy

---

**Data da última verificação:** ___/___/______  
**Verificado por:** _________________________  
**Aprovado para produção:** ☐ Sim  ☐ Não

