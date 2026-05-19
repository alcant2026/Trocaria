from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from decimal import Decimal
from database import get_db
from modelos.modelos_db import Usuario, ResgatePontos
from rotas.rotas_auth import obter_usuario_logado
from utils_ranking import (
    verificar_saldo_resgate,
    solicitar_resgate,
    obter_extrato_completo,
    obter_hall_da_fama,
    calcular_saldo_pontos,
)
from limitador import limiter

router = APIRouter(prefix="/resgate", tags=["Resgate de Pontos"])


@router.get("/saldo")
async def meu_saldo(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    """Retorna saldo atual de pontos e valor em reais."""
    saldo_info = verificar_saldo_resgate(usuario.id, db)
    return saldo_info


@router.get("/extrato")
async def meu_extrato(
    limit: int = 100,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    """Retorna extrato completo de pontos (creditos e debitos)."""
    extrato = obter_extrato_completo(usuario.id, db, limit=limit)
    saldo = calcular_saldo_pontos(usuario.id, db)
    return {
        "saldo_pontos": saldo,
        "saldo_reais": round(saldo / 1000, 2),
        "extrato": extrato,
        "total_registros": len(extrato),
    }


@router.post("/solicitar")
@limiter.limit("2/minute")
async def solicitar_resgate_endpoint(
    request: Request,
    dados: dict,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    """
    Solicita resgate de TODOS os pontos acumulados via PIX.
    Body: {"chave_pix": "email@exemplo.com"}
    Minimo: 20.000 pts (R$ 20,00)
    """
    chave_pix = dados.get("chave_pix", "").strip()
    if not chave_pix:
        raise HTTPException(status_code=400, detail="Chave PIX obrigatoria.")
    
    # Valida chave PIX (email, CPF, telefone ou chave aleatoria)
    if len(chave_pix) < 5:
        raise HTTPException(status_code=400, detail="Chave PIX invalida.")
    
    resultado = solicitar_resgate(usuario.id, chave_pix, db)
    
    if not resultado["sucesso"]:
        raise HTTPException(status_code=400, detail=resultado["mensagem"])
    
    return resultado


@router.get("/meus-resgates")
async def meus_resgates(
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    """Retorna historico de resgates do usuario."""
    resgates = db.query(ResgatePontos).filter(
        ResgatePontos.usuario_id == usuario.id
    ).order_by(ResgatePontos.data_solicitacao.desc()).all()
    
    return {
        "resgates": [
            {
                "id": r.id,
                "pontos": r.pontos,
                "valor": float(r.valor),
                "chave_pix": r.chave_pix,
                "status": r.status,
                "data_solicitacao": r.data_solicitacao.isoformat() if r.data_solicitacao else None,
                "data_pagamento": r.data_pagamento.isoformat() if r.data_pagamento else None,
            }
            for r in resgates
        ]
    }


@router.get("/hall-da-fama")
async def hall_da_fama(
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """
    Retorna o Hall da Fama — usuarios com mais pontos acumulados (lifetime).
    Nao ha premio automatico. E so um ranking de prestigio.
    """
    hall = obter_hall_da_fama(db, limit=limit)
    return {
        "hall_da_fama": hall,
        "total": len(hall),
        "observacao": "Ranking de prestigio baseado em pontos acumulados. Nao ha premio automatico."
    }


# =============================================================================
# ROTAS ADMIN (para processar resgates manualmente)
# =============================================================================

@router.get("/admin/pendentes")
async def resgates_pendentes(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(obter_usuario_logado)
):
    """[ADMIN] Lista todos os resgates pendentes."""
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a admin.")
    
    resgates = db.query(ResgatePontos).filter(
        ResgatePontos.status.in_(["pendente", "processando"])
    ).order_by(ResgatePontos.data_solicitacao.asc()).all()
    
    return {
        "pendentes": [
            {
                "id": r.id,
                "usuario_id": r.usuario_id,
                "usuario_nome": r.usuario.nome if r.usuario else None,
                "pontos": r.pontos,
                "valor": float(r.valor),
                "chave_pix": r.chave_pix,
                "status": r.status,
                "data_solicitacao": r.data_solicitacao.isoformat() if r.data_solicitacao else None,
            }
            for r in resgates
        ],
        "total_pendente": len(resgates),
        "valor_total_pendente": round(sum(float(r.valor) for r in resgates), 2),
    }


@router.post("/admin/confirmar-pagamento/{resgate_id}")
async def confirmar_pagamento_resgate(
    resgate_id: int,
    dados: dict,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(obter_usuario_logado)
):
    """
    [ADMIN] Confirma que o PIX de resgate foi enviado.
    Body: {"payment_id": "id_do_pix"}
    """
    if not admin.is_admin:
        raise HTTPException(status_code=403, detail="Acesso restrito a admin.")
    
    from utils_ranking import confirmar_pagamento_resgate as confirmar
    
    payment_id = dados.get("payment_id", "").strip()
    if not payment_id:
        raise HTTPException(status_code=400, detail="payment_id obrigatorio.")
    
    resultado = confirmar(resgate_id, payment_id, db)
    
    if not resultado["sucesso"]:
        raise HTTPException(status_code=400, detail=resultado["mensagem"])
    
    return resultado
