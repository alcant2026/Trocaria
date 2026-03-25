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

@router.get("/meu-score")
async def consultar_score(usuario: Usuario = Depends(obter_usuario_logado)):
    """Retorna o score atual do usuário logado."""
    return {"score": float(usuario.score)}

@router.post("/solicitar-verificacao")
async def solicitar_verificacao(dados: SolicitacaoVerificacao, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """
    O tomador paga R$ 35,00 para solicitar a verificação humana (Selo Verificado).
    """
    # LOCK
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()

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
        
        # Creditar lucro à plataforma (000PL) com LOCK
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
        if plataforma:
            plataforma.saldo += custo

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
