"""
rotas_disputas.py - Sistema de Mediação e Resolução de Conflitos P2P
Permite que Tomadores e Investidores abram disputas e busquem mediação da plataforma.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from database import get_db
from modelos.modelos_db import (
    Usuario, SolicitacaoEmprestimo, Disputa, 
    StatusSolicitacao, Transacao, AcaoAdmin
)
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from utils_auditoria import AuditoriaImutavel, auditar_acesso_admin

router = APIRouter(prefix="/disputas", tags=["Disputas e Mediação"])


# ============================================================================
# MODELOS Pydantic
# ============================================================================

class AbrirDisputaRequest(BaseModel):
    solicitacao_emprestimo_id: int
    tipo: str  # nao_recebimento, valor_incorreto, calote, fraude, outro
    descricao: str
    evidencias: Optional[str] = None


class ResponderDisputaRequest(BaseModel):
    disputa_id: int
    resposta: str


class DecisaoDisputaRequest(BaseModel):
    disputa_id: int
    decisao: str
    favoravel_a: str  # ID do usuário que ganhou a disputa
    valor_ressarcimento: Optional[float] = 0.00


# ============================================================================
# ROTAS DO USUÁRIO
# ============================================================================

@router.post("/abrir")
async def abrir_disputa(
    request: Request,
    dados: AbrirDisputaRequest,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Abre uma nova disputa relacionada a uma operação de empréstimo.
    """
    # Valida tipo
    tipos_validos = {"nao_recebimento", "valor_incorreto", "calote", "fraude", "outro"}
    if dados.tipo not in tipos_validos:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo inválido. Use um dos seguintes: {tipos_validos}"
        )
    
    # Busca a solicitação
    emp = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == dados.solicitacao_emprestimo_id
    ).first()
    
    if not emp:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")
    
    # Verifica se o usuário é parte da operação (Tomador ou Investidor)
    if usuario.id not in (emp.usuario_id, emp.credor_id):
        raise HTTPException(
            status_code=403,
            detail="Você não participa desta operação de empréstimo."
        )
    
    # Verifica se já existe disputa aberta para este empréstimo
    disputa_existente = db.query(Disputa).filter(
        Disputa.solicitacao_emprestimo_id == dados.solicitacao_emprestimo_id,
        Disputa.status.in_(["aberta", "em_analise", "mediando"])
    ).first()
    
    if disputa_existente:
        raise HTTPException(
            status_code=400,
            detail="Já existe uma disputa em andamento para este empréstimo."
        )
    
    # Determina quem é requerente e quem é requerido
    if usuario.id == emp.usuario_id:
        requerente_id = emp.usuario_id
        requerido_id = emp.credor_id
    else:
        requerente_id = emp.credor_id
        requerido_id = emp.usuario_id
    
    # Cria a disputa
    nova_disputa = Disputa(
        solicitacao_emprestimo_id=dados.solicitacao_emprestimo_id,
        requerente_id=requerente_id,
        requerido_id=requerido_id,
        tipo=dados.tipo,
        descricao=dados.descricao[:2000],  # Limita tamanho
        evidencias=dados.evidencias[:5000] if dados.evidencias else None,
        status="aberta",
        data_limite_resposta=datetime.now(timezone.utc) + timedelta(days=7),
        ip_abertura=request.client.host,
        user_agent_abertura=request.headers.get("user-agent")
    )
    
    db.add(nova_disputa)
    db.flush()
    
    # Auditoria
    auditor = AuditoriaImutavel(db)
    auditor.registrar(
        ip=request.client.host,
        acao="DISPUTA_ABERTA",
        usuario_id=usuario.id,
        detalhes={
            "disputa_id": nova_disputa.id,
            "emprestimo_id": dados.solicitacao_emprestimo_id,
            "tipo": dados.tipo,
            "requerente": requerente_id,
            "requerido": requerido_id
        },
        user_agent=request.headers.get("user-agent")
    )
    
    db.commit()
    
    return {
        "message": "Disputa aberta com sucesso! Nossa equipe de mediação analisará o caso.",
        "disputa_id": nova_disputa.id,
        "prazo_resposta_requerido": nova_disputa.data_limite_resposta.isoformat(),
        "status": "aberta"
    }


@router.post("/responder")
async def responder_disputa(
    request: Request,
    dados: ResponderDisputaRequest,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Permite que o requerido (parte acionada) responda à disputa.
    """
    disputa = db.query(Disputa).filter(Disputa.id == dados.disputa_id).first()
    
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa não encontrada.")
    
    if disputa.requerido_id != usuario.id:
        raise HTTPException(
            status_code=403,
            detail="Apenas o requerido pode responder a esta disputa."
        )
    
    if disputa.status not in ("aberta", "em_analise"):
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível responder uma disputa com status '{disputa.status}'."
        )
    
    disputa.resposta_requerido = dados.resposta[:3000]
    disputa.data_resposta_requerido = datetime.now(timezone.utc)
    disputa.status = "mediando"
    
    # Auditoria
    auditor = AuditoriaImutavel(db)
    auditor.registrar(
        ip=request.client.host,
        acao="DISPUTA_RESPONDIDA",
        usuario_id=usuario.id,
        detalhes={
            "disputa_id": disputa.id,
            "emprestimo_id": disputa.solicitacao_emprestimo_id
        },
        user_agent=request.headers.get("user-agent")
    )
    
    db.commit()
    
    return {
        "message": "Resposta registrada. A mediação continuará com ambas as partes ouvidas.",
        "disputa_id": disputa.id,
        "status": "mediando"
    }


@router.get("/minhas")
async def listar_minhas_disputas(
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Lista todas as disputas onde o usuário é requerente ou requerido."""
    disputas = db.query(Disputa).filter(
        (Disputa.requerente_id == usuario.id) | (Disputa.requerido_id == usuario.id)
    ).order_by(Disputa.data_abertura.desc()).all()
    
    return {
        "usuario_id": usuario.id,
        "total": len(disputas),
        "disputas": [
            {
                "id": d.id,
                "emprestimo_id": d.solicitacao_emprestimo_id,
                "tipo": d.tipo,
                "status": d.status,
                "sou_requerente": d.requerente_id == usuario.id,
                "outra_parte": d.requerido.nome if d.requerente_id == usuario.id else d.requerente.nome,
                "data_abertura": d.data_abertura.isoformat() if d.data_abertura else None,
                "data_resolucao": d.data_resolucao.isoformat() if d.data_resolucao else None,
                "decisao": d.decisao,
                "valor_ressarcimento": float(d.valor_ressarcimento) if d.valor_ressarcimento else None,
            }
            for d in disputas
        ]
    }


@router.get("/{disputa_id}")
async def visualizar_disputa(
    disputa_id: int,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Visualiza detalhes de uma disputa específica."""
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa não encontrada.")
    
    if usuario.id not in (disputa.requerente_id, disputa.requerido_id) and not usuario.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Você não tem acesso a esta disputa."
        )
    
    return {
        "id": disputa.id,
        "emprestimo_id": disputa.solicitacao_emprestimo_id,
        "tipo": disputa.tipo,
        "status": disputa.status,
        "descricao": disputa.descricao,
        "evidencias": disputa.evidencias,
        "requerente": {
            "id": disputa.requerente.id,
            "nome": disputa.requerente.nome,
        },
        "requerido": {
            "id": disputa.requerido.id,
            "nome": disputa.requerido.nome,
        },
        "resposta_requerido": disputa.resposta_requerido,
        "data_resposta_requerido": disputa.data_resposta_requerido.isoformat() if disputa.data_resposta_requerido else None,
        "decisao": disputa.decisao,
        "decisao_favoravel_a": disputa.decisao_favoravel_a,
        "valor_ressarcimento": float(disputa.valor_ressarcimento) if disputa.valor_ressarcimento else None,
        "data_abertura": disputa.data_abertura.isoformat() if disputa.data_abertura else None,
        "data_analise": disputa.data_analise.isoformat() if disputa.data_analise else None,
        "data_resolucao": disputa.data_resolucao.isoformat() if disputa.data_resolucao else None,
        "data_limite_resposta": disputa.data_limite_resposta.isoformat() if disputa.data_limite_resposta else None,
    }


# ============================================================================
# ROTAS ADMINISTRATIVAS (MEDIAÇÃO)
# ============================================================================

@router.get("/admin/listar")
async def listar_disputas_admin(
    status: Optional[str] = None,
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    """Lista todas as disputas para análise administrativa."""
    query = db.query(Disputa)
    
    if status:
        query = query.filter(Disputa.status == status)
    
    disputas = query.order_by(Disputa.data_abertura.desc()).all()
    
    return {
        "total": len(disputas),
        "disputas": [
            {
                "id": d.id,
                "emprestimo_id": d.solicitacao_emprestimo_id,
                "tipo": d.tipo,
                "status": d.status,
                "requerente": d.requerente.nome,
                "requerido": d.requerido.nome,
                "data_abertura": d.data_abertura.isoformat() if d.data_abertura else None,
                "dias_aberta": (datetime.now(timezone.utc) - d.data_abertura).days if d.data_abertura else None,
            }
            for d in disputas
        ]
    }


@router.post("/admin/analisar")
async def assumir_analise_disputa(
    disputa_id: int,
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    """Um analista admin assume a disputa para mediação."""
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa não encontrada.")
    
    if disputa.status not in ("aberta", "mediando"):
        raise HTTPException(
            status_code=400,
            detail=f"Disputa com status '{disputa.status}' não pode ser assumida."
        )
    
    disputa.analista_id = admin.id
    disputa.data_analise = datetime.now(timezone.utc)
    if disputa.status == "aberta":
        disputa.status = "em_analise"
    
    auditar_acesso_admin(
        db=db,
        admin_id=admin.id,
        acao="DISPUTA_ANALISE_ASSUMIDA",
        alvo_id=str(disputa_id),
        detalhes={"disputa_id": disputa_id}
    )
    
    db.commit()
    
    return {
        "message": "Disputa assumida para análise.",
        "disputa_id": disputa.id,
        "analista": admin.nome,
        "status": disputa.status
    }


@router.post("/admin/decidir")
async def decidir_disputa(
    request: Request,
    dados: DecisaoDisputaRequest,
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    """
    Admin registra a decisão final da mediação.
    """
    disputa = db.query(Disputa).filter(Disputa.id == dados.disputa_id).first()
    
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa não encontrada.")
    
    if disputa.status not in ("em_analise", "mediando"):
        raise HTTPException(
            status_code=400,
            detail=f"Disputa com status '{disputa.status}' não pode receber decisão."
        )
    
    # Verifica se o favorável é parte da disputa
    if dados.favoravel_a not in (disputa.requerente_id, disputa.requerido_id):
        raise HTTPException(
            status_code=400,
            detail="O usuário favorecido deve ser parte da disputa."
        )
    
    # Registra decisão
    disputa.decisao = dados.decisao[:5000]
    disputa.decisao_favoravel_a = dados.favoravel_a
    disputa.valor_ressarcimento = dados.valor_ressarcimento
    disputa.data_resolucao = datetime.now(timezone.utc)
    disputa.status = "resolvida"
    
    # Auditoria
    auditar_acesso_admin(
        db=db,
        admin_id=admin.id,
        acao="DISPUTA_DECIDIDA",
        alvo_id=disputa.requerente_id,
        detalhes={
            "disputa_id": disputa.id,
            "favoravel_a": dados.favoravel_a,
            "valor_ressarcimento": dados.valor_ressarcimento,
            "decisao_resumo": dados.decisao[:200]
        },
        ip=request.client.host
    )
    
    db.commit()
    
    return {
        "message": "Disputa resolvida. A decisão foi registrada e as partes serão notificadas.",
        "disputa_id": disputa.id,
        "status": "resolvida",
        "favoravel_a": dados.favoravel_a,
        "valor_ressarcimento": dados.valor_ressarcimento
    }


@router.post("/admin/encaminhar-judicial")
async def encaminhar_judicialmente(
    disputa_id: int,
    motivo: str,
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    """
    Encaminha disputa para resolução judicial quando a mediação falha.
    """
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa não encontrada.")
    
    disputa.status = "encaminhada_judicial"
    disputa.decisao = f"ENCAMINHADA JUDICIALMENTE: {motivo[:1000]}"
    
    auditar_acesso_admin(
        db=db,
        admin_id=admin.id,
        acao="DISPUTA_JUDICIAL",
        alvo_id=disputa.requerente_id,
        detalhes={
            "disputa_id": disputa.id,
            "motivo": motivo
        }
    )
    
    db.commit()
    
    return {
        "message": "Disputa encaminhada para resolução judicial. As partes serão orientadas sobre os próximos passos.",
        "disputa_id": disputa.id,
        "status": "encaminhada_judicial"
    }
