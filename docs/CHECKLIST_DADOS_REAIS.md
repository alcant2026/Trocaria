# CHECKLIST: DADOS REAIS DA EMPRESA

> ⚠️ **IMPORTANTE:** Antes de colocar a Trocaria em produção, você DEVE preencher os dados reais da empresa em TODOS os documentos listados abaixo. Subir os documentos com placeholders pode invalidar a proteção jurídica e gerar multas do PROCON/CDC.

---

## Dados que você precisa ter em mãos

| Dado | Exemplo | Onde usar |
|------|---------|-----------|
| **Razão Social** | Trocaria Tecnologia Ltda. | Todos os termos |
| **CNPJ** | 12.345.678/0001-99 | Todos os termos, POSICIONAMENTO_JURIDICO.md |
| **Endereço completo** | Av. Paulista, 1000, Sala 100, São Paulo/SP, CEP 01310-100 | TERMOS_DE_USO.md, POLITICA_PRIVACIDADE.md |
| **Nome do DPO** | João da Silva | POLITICA_PRIVACIDADE.md |
| **E-mail do DPO** | dpo@trocaria.com.br | POLITICA_PRIVACIDADE.md, TERMOS_DE_USO.md |
| **Telefone de contato** | (11) 99999-9999 | TERMOS_DE_USO.md, NAO_SOMOS_INSTITUICAO_FINANCEIRA.md |
| **Conta bancária da empresa (CNPJ)** | Banco XXX, Ag. 0001, CC 12345-6 | Webhook/configuração do Mercado Pago |

---

## Arquivos que precisam ser atualizados

### 1. `docs/POSICIONAMENTO_JURIDICO.md`
- [ ] Preencher CNPJ real da empresa
- [ ] Preencher endereço real
- [ ] Preencher nome do responsável legal
- [ ] Confirmar CNAE da empresa (sugestão: 62.01-5-00 - Desenvolvimento de programas de computador)

### 2. `docs/TERMOS_DE_USO.md`
- [ ] Substituir placeholders de dados da empresa
- [ ] Confirmar valores das taxas (publicação 2%, match R$ 2,00 fixo)
- [ ] Atualizar e-mail de contato e DPO

### 3. `docs/POLITICA_PRIVACIDADE.md`
- [ ] Preencher nome e CNPJ da empresa (controlador de dados)
- [ ] Preencher nome completo do DPO
- [ ] Preencher e-mail do DPO
- [ ] Preencher endereço físico da empresa

### 4. `docs/NAO_SOMOS_INSTITUICAO_FINANCEIRA.md`
- [ ] Preencher CNPJ real
- [ ] Preencher telefone de contato real
- [ ] Adicionar link para consulta pública do CNPJ (Receita Federal)

### 5. `docs/REGULAMENTO_RANKING.md`
- [ ] Preencher CNPJ real
- [ ] Confirmar limites de prêmios (R$ 50/usuário, R$ 1.000/semana)

### 6. `docs/PLANO_RESPOSTA_INCIDENTES.md`
- [ ] Preencher e-mails reais do time de resposta
- [ ] Preencher telefones reais

### 7. `backend/ROTACIONAR_SECRETS.md` (novo)
- [ ] Executar o passo a passo para rotacionar as credenciais do Mercado Pago
- [ ] Executar o script `scripts/purgar_secrets_git.sh` para limpar o histórico Git
- [ ] Configurar variáveis de ambiente no Render/Heroku com os novos valores

---

## Comandos úteis para fazer as substituições em massa

```bash
# Navegue até a pasta docs
cd docs

# Substitua os placeholders (exemplo com CNPJ)
sed -i 's/00\.000\.000\/0000-00/12.345.678\/0001-99/g' *.md
sed -i 's/NOME_DA_EMPRESA/Trocaria Tecnologia Ltda./g' *.md
sed -i 's/NOME_DO_DPO/João da Silva/g' *.md
sed -i 's/DPO@EMPRESA.COM/dpo@trocaria.com.br/g' *.md
```

> ⚠️ **ATENÇÃO:** Faça um `git diff` antes de commitar para garantir que não substituiu nada demais.

---

## Próximos passos após preencher os dados

1. [ ] Revisar todos os documentos com um advogado especialista em direito digital/fintech
2. [ ] Gerar versão PDF assinada digitalmente dos termos (para arquivo)
3. [ ] Publicar os termos em uma rota pública do site (ex: `/termos-de-uso`, `/privacidade`)
4. [ ] Registrar a Política de Privacidade na ANPD (quando obrigatório)
5. [ ] Registrar o programa de fidelidade/ranking na SECAP/ME (se aplicável)

---

*Última atualização: 2026-05-18*
