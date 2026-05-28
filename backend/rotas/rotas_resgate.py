from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from modelos.modelos_db import Usuario, ExtratoPontos, ResgatePontos
from rotas.rotas_auth import obter_usuario_logado
from rotas.rotas_pontos import saldo_usuario, BENEFICIOS_CATALOGO, PONTOS_POR_REAL

router = APIRouter(prefix="/resgate", tags=["Resgate de Pontos"])


@router.get("/saldo")
async def meu_saldo(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    pts = saldo_usuario(db, usuario.id)
    return {"saldo_pontos": pts, "saldo_reais": round(pts / PONTOS_POR_REAL, 2)}


@router.get("/extrato")
async def meu_extrato(limit: int = 100, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    entradas = db.query(ExtratoPontos).filter(ExtratoPontos.usuario_id == usuario.id).order_by(ExtratoPontos.data_criacao.desc()).limit(limit).all()
    saidas = db.query(ResgatePontos).filter(ResgatePontos.usuario_id == usuario.id, ResgatePontos.status == "concluido").order_by(ResgatePontos.data_solicitacao.desc()).limit(limit).all()
    pts = saldo_usuario(db, usuario.id)
    return {
        "saldo_pontos": pts,
        "saldo_reais": round(pts / PONTOS_POR_REAL, 2),
        "extrato": [
            {"id": e.id, "tipo": e.tipo, "pontos": e.pontos, "valor_referencia": float(e.valor_referencia or 0), "detalhes": e.detalhes, "data": e.data_criacao.isoformat()}
            for e in entradas
        ],
        "beneficios_resgatados": [
            {"id": r.id, "tipo": r.tipo_beneficio, "pontos": r.pontos, "detalhes": r.detalhes, "data": r.data_solicitacao.isoformat()}
            for r in saidas
        ],
    }


@router.get("/catalogo")
async def catalogo():
    return BENEFICIOS_CATALOGO
