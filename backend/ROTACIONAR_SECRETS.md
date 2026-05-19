# Rotacao de Secrets — Trocaria

> **AVISO:** Siga este procedimento IMEDIATAMENTE se suspeitar que alguma secret vazou (commit acidental, log exposto, etc.).

---

## 1. Rotacionar Credenciais do Mercado Pago

1. Acesse o [Dashboard de Credenciais do Mercado Pago](https://www.mercadopago.com.br/developers/panel/credentials).
2. Gere um novo **Access Token** de producao.
3. Gere um novo **Client Secret** (se estiver usando OAuth App proprio).
4. Atualize as variaveis de ambiente no Render/Heroku/Neon:
   - `MERCADOPAGO_ACCESS_TOKEN`
   - `MERCADOPAGO_CLIENT_SECRET` (se aplicavel)
5. **Revogue** o token antigo assim que confirmar que o novo esta funcionando.
6. Verifique se nao ha webhooks antigos apontando para URLs comprometidas.

---

## 2. Rotacionar o Firebase Admin SDK

1. Acesse [Firebase Console > Project Settings > Service Accounts](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk).
2. Clique em **Generate new private key**.
3. Baixe o novo arquivo JSON (`trocaria-firebase-adminsdk-*.json`).
4. Substitua o arquivo antigo no servidor/deployment.
5. **Delete a chave antiga** na console do Firebase (lista de chaves do service account).
6. Atualize a variavel `GOOGLE_APPLICATION_CREDENTIALS` se necessario.

---

## 3. Rotacionar a SECRET_KEY da Aplicacao

1. Gere uma nova chave secreta forte:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Atualize a variavel de ambiente `SECRET_KEY` no painel da hospedagem.
3. **Reinicie** o servidor para invalidar todos os tokens JWT antigos.
4. Comunique os usuarios que precisarao fazer login novamente.

---

## 4. Remover Secrets do Historico Git

Se `backend/.env` ou `trocaria-firebase-adminsdk-*.json` foram commitados por engano, **apagar o arquivo em um commit novo nao e suficiente** — ele ainda estara no historico.

### Opcao A: BFG Repo-Cleaner (mais rapido para repositorios grandes)

```bash
# 1. Faca um clone mirror do repo
git clone --mirror https://github.com/SEU_USUARIO/trocaria.git
cd trocaria.git

# 2. Baixe o BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O bfg.jar

# 3. Remova os arquivos do historico
java -jar bfg.jar --delete-files .env
java -jar bfg.jar --delete-files trocaria-firebase-adminsdk-*.json

# 4. Limpe o historico local
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (CUIDADO: reescreve o historico remoto)
git push --force
```

### Opcao B: git filter-repo (recomendado pela documentacao oficial do Git)

```bash
# 1. Instale o filter-repo (pip ou pacote do sistema)
pip install git-filter-repo

# 2. Faca um clone mirror
git clone --mirror https://github.com/SEU_USUARIO/trocaria.git
cd trocaria.git

# 3. Remova os arquivos sensiveis do historico
git filter-repo --path backend/.env --invert-paths
git filter-repo --path-glob 'trocaria-firebase-adminsdk-*.json' --invert-paths

# 4. Force push
git push --force
```

> **IMPORTANTE:**
> - Avise todos os colaboradores para fazerem `git clone` novamente ou `git reset --hard origin/main` apos o push force.
> - Verifique se nao ha forks ou clones locais com o historico antigo.
> - Considere usar o [GitHub Secret Scanning](https://docs.github.com/pt/code-security/secret-scanning) para detectar vazamentos futuros.

---

## Checklist Pos-Rotacao

- [ ] Novo Access Token do MP testado em producao
- [ ] Client Secret antigo revogado
- [ ] Nova chave Firebase Admin SDK funcionando (teste um login/registro)
- [ ] Nova SECRET_KEY aplicada e app reiniciado
- [ ] Historico Git purgado e force push realizado
- [ ] Todos os devs notificados para re-clonar o repo
- [ ] Variaveis de ambiente atualizadas no Render/Neon/Heroku
- [ ] Nenhum log antigo exposto em servicos de monitoramento (Sentry, etc.)
