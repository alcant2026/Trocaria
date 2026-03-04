from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from decimal import Decimal
import datetime
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from database import get_db

from rotas.rotas_auth import obter_usuario_logado

router = APIRouter(prefix="/score", tags=["Score"])

class SolicitacaoVerificacao(BaseModel):
    detalhes: str = ""

@router.post("/comprar")
async def comprar_score(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    custo = Decimal("35.00")
    if usuario.saldo < custo:
        raise HTTPException(status_code=400, detail="Saldo insuficiente. Custo: R$ 35,00")

    ganho_score = Decimal("1.5")
    novo_score = usuario.score + ganho_score
    
    # Limite máximo de score é 1000
    if novo_score > Decimal("1000"):
        novo_score = Decimal("1000")

    # Deduzir saldo e atualizar score
    usuario.saldo -= custo
    usuario.score = novo_score
    
    # Registrar transação
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=custo,
        tipo=TipoTransacao.COMPRA_SCORE,
        status="concluido",
        detalhes="Compra de 1.5 pontos de score"
    )

    db.add(nova_transacao)
    db.commit()
    
    return {
        "message": f"Score atualizado: {usuario.score}", 
        "score": float(usuario.score),
        "saldo": float(usuario.saldo)
    }

@router.post("/solicitar-verificacao")
async def solicitar_verificacao(dados: SolicitacaoVerificacao, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    O tomador paga R$ 35,00 para solicitar a verificação humana (Selo Verificado).
    """
    if usuario.is_verified:
        raise HTTPException(status_code=400, detail="Sua conta já está verificada.")

    pagamento_anterior = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.DESBLOQUEIO_DADOS
    ).first()

    custo = Decimal("35.00")
    if not pagamento_anterior:
        if usuario.saldo < custo:
            raise HTTPException(status_code=400, detail="Saldo insuficiente para taxa de verificação (R$ 35,00).")
        # Deduzir saldo apenas se for o primeiro pagamento
        usuario.saldo -= custo
        detalhe_pagamento = "Pagamento Taxa KYC"
    else:
        detalhe_pagamento = "Reenvio de Documentos (Isento de Nova Taxa)"
    
    # Registrar transação de solicitação (o admin verá isso no painel)
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=custo if not pagamento_anterior else Decimal("0.00"),
        tipo=TipoTransacao.DESBLOQUEIO_DADOS, 
        status="pendente",
        detalhes=f"{detalhe_pagamento}: {dados.detalhes}" if dados.detalhes else f"{detalhe_pagamento}"
    )

    db.add(nova_transacao)
    db.commit()

    return {"message": "Solicitação enviada! O processamento é automático e o tempo varia conforme seu Score — quanto maior, mais rápido.", "saldo": float(usuario.saldo)}

@router.post("/atualizar-decaimento")
async def processar_decaimento_diario(db: Session = Depends(get_db)):
    """
    Simula o decaimento diário de score (-0.5 pontos)
    Idealmente chamado por um cron job.
    """
    usuarios = db.query(Usuario).all()
    decaimento = Decimal("0.5")
    
    for u in usuarios:
        if u.score > 0:
            novo_score = u.score - decaimento
            if novo_score < 0:
                novo_score = Decimal("0")
            u.score = novo_score
    
    db.commit()
    return {"message": "Decaimento de score processado para todos os usuários."}
