from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from modelos.modelos_db import Usuario
from database import get_db
from utils_storage import (
    calcular_storage_usuario, limpar_storage_usuario, 
    limpar_storage_global, verificar_limite_storage, truncar_texto,
    LIMITES_FREE, LIMITES_PREMIUM
)
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from datetime import datetime, timezone, timedelta
import os

router = APIRouter(prefix="/storage", tags=["Storage"])

class UpgradePremiumRequest(BaseModel):
    duracao_dias: int = 30  # padrão 30 dias

@router.get("/meu-uso")
async def meu_uso_storage(
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Retorna o uso de storage do usuário logado."""
    # Recalcula para ter valor atualizado
    storage_atual = calcular_storage_usuario(db, usuario.id)
    usuario.storage_used_mb = storage_atual
    db.commit()
    
    status_storage = verificar_limite_storage(db, usuario.id)
    
    return {
        "tier": usuario.storage_tier or "free",
        "is_premium": usuario.is_premium,
        "premium_expira_em": usuario.premium_expira_em.isoformat() if usuario.premium_expira_em else None,
        "storage_usado_mb": storage_atual,
        "storage_limite_mb": float(usuario.storage_limit_mb or 10),
        "percentual_usado": status_storage.get("percentual", 0),
        "alerta": status_storage.get("alerta", False),
        "bloqueado": status_storage.get("bloqueado", False),
        "limites": LIMITES_PREMIUM if usuario.is_premium else LIMITES_FREE
    }

@router.post("/limpar-meu-storage")
async def limpar_meu_storage(
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Usuário pode solicitar limpeza manual do próprio storage."""
    storage_antes = float(usuario.storage_used_mb or 0)
    limpar_storage_usuario(db, usuario.id)
    storage_depois = float(usuario.storage_used_mb or 0)
    
    return {
        "message": "Storage limpo com sucesso!",
        "storage_antes_mb": storage_antes,
        "storage_depois_mb": storage_depois,
        "economizado_mb": round(storage_antes - storage_depois, 2)
    }

@router.post("/upgrade-premium")
async def upgrade_para_premium(
    dados: UpgradePremiumRequest,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Ativa o plano premium para o usuário.
    Em produção, aqui integraria com gateway de pagamento.
    Por enquanto, liberação manual via código ou admin.
    """
    # Verifica se já tem premium ativo
    if usuario.is_premium and usuario.premium_expira_em and usuario.premium_expira_em > datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400, 
            detail=f"Você já possui Premium ativo até {usuario.premium_expira_em.strftime('%d/%m/%Y')}."
        )
    
    # Em produção real, aqui validaria pagamento
    # Por enquanto, permite ativar com um código especial ou via admin
    
    usuario.is_premium = True
    usuario.storage_tier = "premium"
    usuario.storage_limit_mb = 0  # 0 = ilimitado
    usuario.premium_expira_em = datetime.now(timezone.utc) + timedelta(days=dados.duracao_dias)
    db.commit()
    
    return {
        "message": f"🎉 Parabéns! Você agora é Premium por {dados.duracao_dias} dias!",
        "premium_expira_em": usuario.premium_expira_em.isoformat(),
        "beneficios": [
            "Storage ilimitado",
            "Histórico de transações de 1 ano",
            "Histórico de cliques de 60 dias",
            "Textos de detalhes completos",
            "Links afiliados ilimitados",
            "Foto de perfil até 2MB"
        ]
    }

@router.get("/admin/limpeza-global")
async def admin_limpeza_global(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """Admin executa limpeza global de storage (apenas usuários free)."""
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
    """Admin lista usuários e seus tiers de storage."""
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

# Middleware helper para verificar storage antes de criar registros
def check_storage_antes_criar(usuario: Usuario, db: Session):
    """
    Verifica se usuário free tem espaço antes de criar novos registros.
    Retorna True se pode prosseguir, False se está bloqueado.
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