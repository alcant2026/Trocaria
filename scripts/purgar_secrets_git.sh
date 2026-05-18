#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# purgar_secrets_git.sh
# =============================================================================
# Automatiza a remocao de arquivos sensiveis do historico Git usando
# BFG Repo-Cleaner ou git-filter-repo.
#
# USO:
#   ./scripts/purgar_secrets_git.sh <URL_DO_REPO_REMOTO>
#
# EXEMPLO:
#   ./scripts/purgar_secrets_git.sh https://github.com/SEU_USUARIO/psy-pay.git
# =============================================================================

REMOTE_URL="${1:-}"

if [ -z "$REMOTE_URL" ]; then
    echo "Erro: informe a URL do repositorio remoto."
    echo "Uso: $0 <URL_DO_REPO_REMOTO>"
    exit 1
fi

REPO_NAME=$(basename "$REMOTE_URL" .git)
MIRROR_DIR="${REPO_NAME}.git"
BFG_JAR="bfg-1.14.0.jar"

echo "=========================================="
echo "  Psy Pay — Purga de Secrets do Git"
echo "=========================================="
echo ""
echo "ATENCAO: Este script vai REESCREVER o historico Git."
echo "Todos os colaboradores precisarao clonar o repo novamente."
echo ""
read -p "Tem certeza que deseja continuar? (digite 'SIM'): " CONFIRM
if [ "$CONFIRM" != "SIM" ]; then
    echo "Cancelado pelo usuario."
    exit 0
fi

# ---------------------------------------------------------------------------
# 1. Clone mirror
# ---------------------------------------------------------------------------
echo ""
echo "[1/6] Clonando mirror de $REMOTE_URL ..."
if [ -d "$MIRROR_DIR" ]; then
    echo "Diretorio $MIRROR_DIR ja existe. Removendo..."
    rm -rf "$MIRROR_DIR"
fi
git clone --mirror "$REMOTE_URL" "$MIRROR_DIR"
cd "$MIRROR_DIR"

# ---------------------------------------------------------------------------
# 2. Detectar ferramenta disponivel (BFG ou filter-repo)
# ---------------------------------------------------------------------------
echo ""
echo "[2/6] Verificando ferramenta de purga..."

HAS_FILTER_REPO=false
HAS_BFG=false

if command -v git-filter-repo &> /dev/null; then
    HAS_FILTER_REPO=true
    echo "git-filter-repo encontrado."
elif [ -f "../$BFG_JAR" ]; then
    HAS_BFG=true
    echo "BFG Repo-Cleaner encontrado (../$BFG_JAR)."
else
    echo "git-filter-repo nao encontrado. Tentando baixar BFG..."
    wget -q "https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/$BFG_JAR" -O "../$BFG_JAR" || {
        echo "Falha ao baixar BFG. Instale manualmente ou use:"
        echo "  pip install git-filter-repo"
        exit 1
    }
    HAS_BFG=true
    echo "BFG baixado com sucesso."
fi

# ---------------------------------------------------------------------------
# 3. Executar purga
# ---------------------------------------------------------------------------
echo ""
echo "[3/6] Removendo arquivos sensiveis do historico..."

if [ "$HAS_FILTER_REPO" = true ]; then
    git filter-repo --path backend/.env --invert-paths --force
    git filter-repo --path-glob 'psy-pay-firebase-adminsdk-*.json' --invert-paths --force
elif [ "$HAS_BFG" = true ]; then
    java -jar "../$BFG_JAR" --delete-files .env
    java -jar "../$BFG_JAR" --delete-files psy-pay-firebase-adminsdk-*.json
else
    echo "Nenhuma ferramenta de purga disponivel."
    exit 1
fi

# ---------------------------------------------------------------------------
# 4. Limpeza do reflog e garbage collection
# ---------------------------------------------------------------------------
echo ""
echo "[4/6] Limpando reflog e garbage collect..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# ---------------------------------------------------------------------------
# 5. Verificacao rapida
# ---------------------------------------------------------------------------
echo ""
echo "[5/6] Verificando se os arquivos ainda existem no historico..."
if git log --all --full-history -- "backend/.env" | grep -q .; then
    echo "AVISO: backend/.env ainda encontrado no historico!"
else
    echo "OK: backend/.env removido do historico."
fi

if git log --all --full-history -- "psy-pay-firebase-adminsdk-*.json" | grep -q .; then
    echo "AVISO: psy-pay-firebase-adminsdk-*.json ainda encontrado no historico!"
else
    echo "OK: psy-pay-firebase-adminsdk-*.json removido do historico."
fi

# ---------------------------------------------------------------------------
# 6. Push force
# ---------------------------------------------------------------------------
echo ""
echo "[6/6] Push force para o remoto..."
read -p "Deseja executar 'git push --force' agora? (digite 'SIM'): " PUSH_CONFIRM
if [ "$PUSH_CONFIRM" = "SIM" ]; then
    git push --force
    echo ""
    echo "=========================================="
    echo "  Purga concluida com sucesso!"
    echo "=========================================="
    echo ""
    echo "LEMBRE-SE DE:"
    echo "  1. Notificar todos os devs para re-clonar o repo."
    echo "  2. Rotacionar as secrets que vazaram (MP, Firebase, SECRET_KEY)."
    echo "  3. Verificar se ha forks com o historico antigo."
else
    echo "Push cancelado. Voce pode fazer manualmente depois com:"
    echo "  cd $MIRROR_DIR && git push --force"
fi

cd ..
