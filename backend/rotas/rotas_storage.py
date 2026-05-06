from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from modelos.modelos_db import Usuario
from database import get_db
from utils_storage import (
    calcular_storage_usuario, limpar_storage_usuario, 
    limpar_storage_global, verificar_limite_storage,
    LIMITES_FREE, LIMITES_PREMIUM
)
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from datetime import datetime, timezone, timedelta
import os

router = APIRouter(prefix="/storage", tags=["Storage"])

# ========================================================================
# ROTAS ADMINISTRATIVAS (apenas para controle interno da equipe)
# ========================================================================

@router.get("/admin/limpeza-global")
async def admin_limpeza_global(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    [ADMIN] Executa limpeza global de storage para usuários free.
    Remove dados antigos automaticamente para economizar espaço no BD.
    """
    economia = limpar_storage_global(db)
    return {
        "message": "Limpeza global executada com sucesso!",
        "economia_mb": economia,
        "executado_por": admin.nome,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/admin/usuarios-por-tier")
async def admin_listar_usuarios_por_tier(
    tier: str = None,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    [ADMIN] Lista usuários e seus tiers de storage para monitoramento.
    """
    query = db.query(Usuario)
    
    if tier:
        query = query.filter(Usuario.storage_tier == tier)
    
    usuarios = query.order_by(Usuario.storage_used_mb.desc()).limit(100).all()
    
    return {
        "total": len(usuarios),
        "usuarios": [
            {
                "id": u.id,
                "nome": u.nome,
                "tier": u.storage_tier or "free",
                "is_premium": u.is_premium,
                "storage_mb": float(u.storage_used_mb or 0),
                "limite_mb": float(u.storage_limit_mb or 10),
                "premium_expira": u.premium_expira_em.isoformat() if u.premium_expira_em else None
            }
            for u in usuarios
        ]
    }

@router.get("/admin/status-banco")
async def admin_status_banco(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    [ADMIN] Retorna estatísticas gerais do banco para monitoramento.
    """
    from sqlalchemy import func
    from modelos.modelos_db import Transacao, HistoricoClique, RegistroAuditoria, SolicitacaoEmprestimo
    
    total_usuarios = db.query(Usuario).count()
    total_free = db.query(Usuario).filter((Usuario.is_premium == False) | (Usuario.is_premium == None)).count()
    total_premium = db.query(Usuario).filter(Usuario.is_premium == True).count()
    
    total_transacoes = db.query(Transacao).count()
    total_cliques = db.query(HistoricoClique).count()
    total_auditoria = db.query(RegistroAuditoria).count()
    
    # Top 10 usuários que mais consomem storage
    top_consumidores = db.query(Usuario).order_by(Usuario.storage_used_mb.desc()).limit(10).all()
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "usuarios": {
            "total": total_usuarios,
            "free": total_free,
            "premium": total_premium
        },
        "registros": {
            "transacoes": total_transacoes,
            "cliques": total_cliques,
            "auditoria": total_auditoria
        },
        "top_consumidores_mb": [
            {"id": u.id, "nome": u.nome, "storage_mb": float(u.storage_used_mb or 0)}
            for u in top_consumidores
        ],
        "limites_configurados": {
            "free": LIMITES_FREE,
            "premium": LIMITES_PREMIUM
        }
    }

# ========================================================================
# HELPERS INTERNOS (usados por outras rotas, não expostos como endpoints)
# ========================================================================

def check_storage_antes_criar(usuario: Usuario, db: Session):
    """
    Verifica se usuário free tem espaço antes de criar novos registros.
    Retorna True se pode prosseguir, False se está bloqueado.
    
    NOTA: Esta função é usada internamente por outras rotas.
    Não é exposta como endpoint para o usuário.
    """
    if usuario.is_premium:
        return True
    
    # Recalcula storage
    storage_atual = calcular_storage_usuario(db, usuario.id)
    usuario.storage_used_mb = storage_atual
    
    limite = float(usuario.storage_limit_mb or 10)
    
    # Se passou do limite, bloqueia criação de novos dados
    if storage_atual >= limite:
        return False
    
    return True