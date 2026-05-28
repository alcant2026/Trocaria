from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from decimal import Decimal
import datetime
from database import get_db
from modelos.modelos_db import Usuario, Disputa, ConfirmacaoVenda
from rotas.rotas_auth import obter_usuario_logado, exigir_admin

router = APIRouter(tags=["Disputas"])

@router.post("/comunidade/abrir-disputa")
async def abrir_disputa(dados: dict, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    confirmacao_id = dados.get("confirmacao_id")
    motivo = dados.get("motivo", "").strip()
    descricao = dados.get("descricao", "").strip()

    if not confirmacao_id or not motivo:
        raise HTTPException(status_code=400, detail="confirmacao_id e motivo sao obrigatorios.")

    conf = db.query(ConfirmacaoVenda).filter(ConfirmacaoVenda.id == confirmacao_id).first()
    if not conf:
        raise HTTPException(status_code=404, detail="Venda nao encontrada.")
    if conf.vendedor_id != usuario.id and conf.comprador_id != usuario.id:
        raise HTTPException(status_code=403, detail="Voce nao faz parte desta venda.")
    if conf.status not in ("pendente", "confirmada", "comprador_confirmou", "vendedor_confirmou"):
        raise HTTPException(status_code=400, detail="Esta venda nao pode ser disputada.")

    existe = db.query(Disputa).filter(
        Disputa.confirmacao_venda_id == confirmacao_id,
        Disputa.status.in_(["aberta", "em_andamento"])
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ja existe uma disputa aberta para esta venda.")

    disputa = Disputa(
        confirmacao_venda_id=confirmacao_id,
        abridor_id=usuario.id,
        motivo=motivo,
        descricao=descricao,
        status="aberta",
    )
    db.add(disputa)
    db.commit()
    db.refresh(disputa)

    return {
        "message": "Disputa registrada! O administrador vai analisar.",
        "disputa_id": disputa.id,
        "status": disputa.status,
    }


@router.get("/comunidade/minhas-disputas")
async def minhas_disputas(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    disputas = db.query(Disputa).options(
        joinedload(Disputa.confirmacao).joinedload(ConfirmacaoVenda.link)
    ).filter(
        Disputa.abridor_id == usuario.id
    ).order_by(Disputa.data_criacao.desc()).all()

    return [
        {
            "id": d.id,
            "confirmacao_id": d.confirmacao_venda_id,
            "produto": d.confirmacao.link.nome_produto if d.confirmacao and d.confirmacao.link else "N/D",
            "motivo": d.motivo,
            "descricao": d.descricao,
            "status": d.status,
            "decisao": d.decisao,
            "notapublica": d.notapublica,
            "data": d.data_criacao.isoformat(),
            "data_resolucao": d.data_resolucao.isoformat() if d.data_resolucao else None,
        }
        for d in disputas
    ]


@router.get("/admin/disputas")
async def listar_disputas_admin(db: Session = Depends(get_db), admin_user: Usuario = Depends(exigir_admin)):
    disputas = db.query(Disputa).options(
        joinedload(Disputa.confirmacao).joinedload(ConfirmacaoVenda.link),
        joinedload(Disputa.abridor),
    ).order_by(
        Disputa.status.asc(),
        Disputa.data_criacao.desc()
    ).all()

    return [
        {
            "id": d.id,
            "confirmacao_id": d.confirmacao_venda_id,
            "produto": d.confirmacao.link.nome_produto if d.confirmacao and d.confirmacao.link else "N/D",
            "vendedor_id": d.confirmacao.vendedor_id if d.confirmacao else None,
            "comprador_id": d.confirmacao.comprador_id if d.confirmacao else None,
            "valor": float(d.confirmacao.link.valor) if d.confirmacao and d.confirmacao.link else 0,
            "abridor_id": d.abridor_id,
            "abridor_nome": d.abridor.nome if d.abridor else "N/D",
            "motivo": d.motivo,
            "descricao": d.descricao,
            "status": d.status,
            "decisao": d.decisao,
            "notapublica": d.notapublica,
            "data": d.data_criacao.isoformat(),
            "data_resolucao": d.data_resolucao.isoformat() if d.data_resolucao else None,
        }
        for d in disputas
    ]


@router.post("/admin/disputas/{disputa_id}/resolver")
async def resolver_disputa(
    disputa_id: int,
    dados: dict,
    db: Session = Depends(get_db),
    admin_user: Usuario = Depends(exigir_admin),
):
    disputa = db.query(Disputa).filter(Disputa.id == disputa_id).first()
    if not disputa:
        raise HTTPException(status_code=404, detail="Disputa nao encontrada.")
    if disputa.status in ("resolvida", "rejeitada"):
        raise HTTPException(status_code=400, detail="Disputa ja foi resolvida.")

    decisao = dados.get("decisao", "").strip()
    notapublica = dados.get("notapublica", "").strip()
    if not decisao:
        raise HTTPException(status_code=400, detail="Decisao e obrigatoria.")

    disputa.status = "resolvida"
    disputa.decisao = decisao
    disputa.notapublica = notapublica
    disputa.admin_id = admin_user.id
    disputa.data_resolucao = datetime.datetime.now(datetime.timezone.utc)

    db.commit()

    from rotas.rotas_snapshot import cache_snapshot_data
    cache_snapshot_data.pop(admin_user.id, None)

    return {
        "message": "Disputa resolvida!",
        "decisao": decisao,
        "status": disputa.status,
    }
