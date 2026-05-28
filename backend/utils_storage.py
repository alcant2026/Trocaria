"""
Utilitários de Storage Optimization - Free Tier vs Premium
Economiza espaço no banco de dados para usuários free.
"""
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import datetime, timezone, timedelta
from modelos.modelos_db import (
    Usuario, Transacao, HistoricoClique, RegistroAuditoria, 
    AcaoAdmin
)
import logging

logger = logging.getLogger("STORAGE")

# Limites por tier (em número de registros ou dias)
LIMITES_FREE = {
    "transacoes_dias": 30,           # manter últimos 30 dias
    "transacoes_max": 50,            # ou máximo 50 registros
    "cliques_dias": 7,               # 7 dias de histórico de cliques
    "auditoria_dias": 7,             # 7 dias de auditoria
    "acoes_admin_dias": 30,          # 30 dias de ações admin
    "detalhes_max_chars": 100,       # texto de detalhes truncado
    "links_afiliados_max": 10,       # máximo 10 links ativos
    "foto_perfil_max_kb": 100,       # foto até 100KB
    "garantia_max_chars": 200,       # descrição de garantia
}

LIMITES_PREMIUM = {
    "transacoes_dias": 365,          # 1 ano
    "transacoes_max": None,          # ilimitado
    "cliques_dias": 60,              # 60 dias
    "auditoria_dias": 90,            # 90 dias
    "acoes_admin_dias": 90,
    "detalhes_max_chars": 500,       # texto completo
    "links_afiliados_max": None,     # ilimitado
    "foto_perfil_max_kb": 2048,      # 2MB
    "garantia_max_chars": 5000,      # texto longo
}

def truncar_texto(texto: str, max_chars: int) -> str:
    """Trunca texto para economizar storage."""
    if not texto:
        return texto
    return texto[:max_chars] if len(texto) > max_chars else texto

def calcular_storage_usuario(db: Session, usuario_id: str) -> float:
    """Calcula o storage aproximado (em MB) usado por um usuário."""
    total_bytes = 0
    
    # Transações (~0.5 KB cada)
    qtd_trans = db.query(Transacao).filter(Transacao.usuario_id == usuario_id).count()
    total_bytes += qtd_trans * 500
    
    # Cliques (~0.1 KB cada)
    qtd_cliques = db.query(HistoricoClique).filter(HistoricoClique.usuario_id == usuario_id).count()
    total_bytes += qtd_cliques * 100
    
    # Auditoria (~0.5 KB cada)
    qtd_aud = db.query(RegistroAuditoria).filter(
        RegistroAuditoria.id.in_(
            db.query(Usuario.auditoria_id).filter(Usuario.id == usuario_id)
        )
    ).count()
    total_bytes += qtd_aud * 500
    
    # Foto de perfil (estimativa)
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if usuario and usuario.foto_perfil:
        total_bytes += 50000  # estimativa 50KB
    
    return round(total_bytes / (1024 * 1024), 2)

def limpar_storage_usuario(db: Session, usuario_id: str):
    """Executa limpeza de storage baseada no tier do usuário."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        return
    
    is_free = not usuario.is_premium
    limites = LIMITES_FREE if is_free else LIMITES_PREMIUM
    
    logger.info(f"🧹 Limpando storage para {usuario_id} (tier: {'free' if is_free else 'premium'})")
    
    # 1. Limpar transações antigas
    if limites["transacoes_dias"]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=limites["transacoes_dias"])
        
        # Free: manter apenas as últimas N transações mais recentes
        if is_free and limites["transacoes_max"]:
            # Subquery para encontrar IDs a manter
            subquery = db.query(Transacao.id).filter(
                Transacao.usuario_id == usuario_id
            ).order_by(Transacao.data_criacao.desc()).limit(limites["transacoes_max"]).subquery()
            
            deletadas = db.query(Transacao).filter(
                Transacao.usuario_id == usuario_id,
                ~Transacao.id.in_(subquery)
            ).delete(synchronize_session=False)
            logger.info(f"   🗑️ Transações removidas: {deletadas}")
        
        # Premium: manter apenas últimos X dias (mas ilimitado em quantidade)
        elif not is_free:
            deletadas = db.query(Transacao).filter(
                Transacao.usuario_id == usuario_id,
                Transacao.data_criacao < cutoff,
                Transacao.status.in_(["expirado", "cancelado", "falhou"])
            ).delete(synchronize_session=False)
            logger.info(f"   🗑️ Transações antigas removidas: {deletadas}")
    
    # 2. Limpar cliques antigos
    if limites["cliques_dias"]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=limites["cliques_dias"])
        deletados = db.query(HistoricoClique).filter(
            HistoricoClique.usuario_id == usuario_id,
            HistoricoClique.data_clique < cutoff
        ).delete(synchronize_session=False)
        logger.info(f"   🗑️ Cliques removidos: {deletados}")
    
    # 3. Limpar auditoria antiga
    if limites["auditoria_dias"] and is_free:
        cutoff = datetime.now(timezone.utc) - timedelta(days=limites["auditoria_dias"])
        deletadas = db.query(RegistroAuditoria).filter(
            RegistroAuditoria.data_registro < cutoff
        ).delete(synchronize_session=False)
        logger.info(f"   🗑️ Registros de auditoria removidos: {deletadas}")
    
    # 4. Compactar textos de transações para free
    if is_free:
        transacoes = db.query(Transacao).filter(
            Transacao.usuario_id == usuario_id,
            func.length(Transacao.detalhes) > LIMITES_FREE["detalhes_max_chars"]
        ).all()
        
        for t in transacoes:
            t.detalhes = truncar_texto(t.detalhes, LIMITES_FREE["detalhes_max_chars"])
        
        if transacoes:
            logger.info(f"   📦 Textos compactados: {len(transacoes)}")
    
    # 5. Atualizar storage_used_mb
    novo_storage = calcular_storage_usuario(db, usuario_id)
    usuario.storage_used_mb = novo_storage
    
    db.commit()
    logger.info(f"   ✅ Storage atualizado: {novo_storage} MB")

def limpar_storage_global(db: Session):
    """Executa limpeza de storage para TODOS os usuários free. Chamada diariamente."""
    logger.info("🚀 Iniciando rotina global de limpeza de storage...")
    
    usuarios_free = db.query(Usuario).filter(
        (Usuario.is_premium == False) | (Usuario.is_premium == None)
    ).all()
    
    total_economizado = 0
    for usuario in usuarios_free:
        storage_antes = float(usuario.storage_used_mb or 0)
        limpar_storage_usuario(db, usuario.id)
        storage_depois = float(usuario.storage_used_mb or 0)
        total_economizado += (storage_antes - storage_depois)
    
    logger.info(f"🎯 Limpeza global concluída. Economia estimada: {abs(total_economizado):.2f} MB")
    return abs(total_economizado)

def verificar_limite_storage(db: Session, usuario_id: str) -> dict:
    """Verifica se o usuário está dentro do limite de storage."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        return {"bloqueado": True, "motivo": "Usuário não encontrado"}
    
    if usuario.is_premium:
        return {"bloqueado": False, "limite": None, "usado": float(usuario.storage_used_mb or 0)}
    
    usado = float(usuario.storage_used_mb or 0)
    limite = float(usuario.storage_limit_mb or 10)
    
    # Se passou de 90% do limite, já avisa
    alerta = usado > (limite * 0.9)
    bloqueado = usado >= limite
    
    return {
        "bloqueado": bloqueado,
        "alerta": alerta,
        "usado": usado,
        "limite": limite,
        "percentual": round((usado / limite) * 100, 1),
        "motivo": "Limite de storage atingido. Faça upgrade para Premium." if bloqueado else None
    }