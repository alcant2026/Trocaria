from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import httpx
import datetime
from decimal import Decimal
from database import get_db
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, RankingHistorico
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
import mercadopago
import logging

logger = logging.getLogger(__name__)
PONTOS_POR_REAL = 1000

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])

IS_PROD = os.environ.get("RENDER") == "true"
CLIENT_ID = os.environ.get("MERCADOPAGO_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("MERCADOPAGO_CLIENT_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL" if IS_PROD else "FRONTEND_URL_LOCAL", "http://localhost:3000")
# O link deve apontar para o BACKEND (servidor) no Render
BACKEND_URL_PROD = "https://peer-5gq5.onrender.com"
REDIRECT_URI = f"{BACKEND_URL_PROD if IS_PROD else FRONTEND_URL}/api/marketplace/callback"

import urllib.parse

@router.get("/auth-url")
async def get_auth_url(usuario: Usuario = Depends(obter_usuario_logado)):
    """Retorna a URL de autorização do Mercado Pago."""
    if not CLIENT_ID:
        raise HTTPException(status_code=500, detail="MERCADOPAGO_CLIENT_ID não configurado.")
    
    # Codificar a Redirect URI para evitar erros de caracteres especiais
    redirect_uri_encoded = urllib.parse.quote(REDIRECT_URI)
    
    # Adicionamos o ID do usuário no state para validar no callback (segurança)
    state = f"{usuario.id}"
    url = (
        f"https://auth.mercadopago.com.br/authorization"
        f"?client_id={CLIENT_ID}"
        f"&response_type=code"
        f"&platform_id=mp"
        f"&state={state}"
        f"&redirect_uri={redirect_uri_encoded}"
    )
    return {"url": url}

@router.get("/callback")
async def marketplace_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Recebe o code do MP e troca por access_token."""
    if not code:
        raise HTTPException(status_code=400, detail="Código de autorização ausente.")
    
    # O state deve conter o ID do usuário
    usuario_id = state
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    url = "https://api.mercadopago.com/oauth/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "client_secret": CLIENT_SECRET,
        "client_id": CLIENT_ID,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT_URI,
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data, headers=headers)
        frontend_url_redirect = FRONTEND_URL.rstrip("/")
        
        if response.status_code != 200:
            logger.error(f"Erro OAuth MP: {response.text}")
            return RedirectResponse(url=f"{FRONTEND_URL}/#marketplace?status=error&msg=Falha+na+autenticacao")
        
        token_data = response.json()
        
        # Salva as credenciais no usuário
        usuario.mp_access_token = token_data.get("access_token")
        usuario.mp_refresh_token = token_data.get("refresh_token")
        usuario.mp_user_id = str(token_data.get("user_id"))
        
        expires_in = token_data.get("expires_in", 0)
        if expires_in:
            usuario.mp_token_expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=expires_in)
        
        # NOVO: Se o usuário for um Parceiro, salvar também na tabela de Parceiros
        from modelos.modelos_db import Parceiro
        parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id).first()
        if parceiro:
            parceiro.mp_access_token = usuario.mp_access_token
            parceiro.mp_refresh_token = usuario.mp_refresh_token
            parceiro.mp_user_id = usuario.mp_user_id
            parceiro.mp_token_expires_at = usuario.mp_token_expires_at
            logger.info(f"✅ MP vinculado ao Parceiro ID: {parceiro.id}")

        db.commit()
        return RedirectResponse(url=f"{FRONTEND_URL}/#marketplace?status=success")

@router.get("/status")
async def get_mp_status(usuario: Usuario = Depends(obter_usuario_logado)):
    """Verifica se o usuário já tem conta MP conectada."""
    return {
        "conectado": bool(usuario.mp_access_token),
        "mp_user_id": usuario.mp_user_id,
        "expira_em": usuario.mp_token_expires_at
    }

@router.post("/desconectar")
async def desconectar_mp(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Remove as credenciais do Mercado Pago do usuário e do lojista vinculado."""
    usuario.mp_access_token = None
    usuario.mp_refresh_token = None
    usuario.mp_user_id = None
    usuario.mp_token_expires_at = None

    # Limpa também do Parceiro vinculado (se existir)
    from modelos.modelos_db import Parceiro
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id).first()
    if parceiro:
        parceiro.mp_access_token = None
        parceiro.mp_refresh_token = None
        parceiro.mp_user_id = None
        parceiro.mp_token_expires_at = None
        logger.info(f"🔌 MP desvinculado do Parceiro ID: {parceiro.id}")

    db.commit()
    return {"message": "Conta Mercado Pago desconectada."}

@router.post("/solicitar-resgate")
async def solicitar_resgate(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    pontos = usuario.pontos_marketplace or 0
    if pontos < PONTOS_POR_REAL:
        raise HTTPException(status_code=400, detail=f"Minimo de {PONTOS_POR_REAL} pontos para resgate. Voce tem {pontos}.")

    # Verificar se ja tem resgate pendente
    pendente = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.RESGATE_PONTOS,
        Transacao.status == "pendente"
    ).first()
    if pendente:
        raise HTTPException(status_code=400, detail="Voce ja tem um resgate pendente.")

    valor = Decimal(pontos / PONTOS_POR_REAL)
    transacao = Transacao(
        usuario_id=usuario.id, valor=valor, tipo=TipoTransacao.RESGATE_PONTOS,
        status="pendente", metodo="pix",
        detalhes=f"Resgate de {pontos} pontos — R$ {valor}"
    )
    db.add(transacao)
    usuario.pontos_marketplace = 0
    db.commit()
    return {"message": f"Solicitacao de resgate de R$ {valor} criada!", "valor": float(valor or 0)}


@router.get("/admin/resgates-pendentes")
async def listar_resgates_pendentes(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    resgates = db.query(Transacao).filter(
        Transacao.tipo == TipoTransacao.RESGATE_PONTOS,
        Transacao.status == "pendente"
    ).order_by(Transacao.data_criacao.desc()).all()
    resultado = []
    for r in resgates:
        user = db.query(Usuario).filter(Usuario.id == r.usuario_id).first()
        resultado.append({
            "id": r.id,
            "usuario_nome": user.nome if user else "—",
            "usuario_cpf": user.cpf if user else "—",
            "chave_pix": user.chave_pix if user else "—",
            "valor": float(r.valor or 0),
            "data": r.data_criacao.isoformat() if r.data_criacao else None
        })
    return resultado


@router.post("/admin/aprovar-resgate/{transacao_id}")
async def aprovar_resgate(transacao_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tipo == TipoTransacao.RESGATE_PONTOS,
        Transacao.status == "pendente"
    ).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Resgate nao encontrado.")
    transacao.status = "concluido"
    transacao.detalhes += f" | Aprovado por admin {admin.id}"
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if plataforma:
        plataforma.saldo -= transacao.valor
    db.commit()
    return {"message": "Resgate aprovado! Envie o PIX para o usuario.", "chave_pix": None}


@router.post("/admin/rejeitar-resgate/{transacao_id}")
async def rejeitar_resgate(transacao_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tipo == TipoTransacao.RESGATE_PONTOS,
        Transacao.status == "pendente"
    ).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Resgate nao encontrado.")
    # Devolve os pontos
    user = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).first()
    if user:
        pontos_perdidos = int(transacao.valor * PONTOS_POR_REAL)
        user.pontos_marketplace = (user.pontos_marketplace or 0) + pontos_perdidos
    transacao.status = "cancelado"
    transacao.detalhes += f" | Rejeitado por admin {admin.id}"
    db.commit()
    return {"message": "Resgate rejeitado. Pontos devolvidos ao usuario."}


# --- RANKING SEMANAL (CAMPEONATO) ---
@router.get("/ranking-semanal")
async def ranking_semanal(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    from modelos.modelos_db import Usuario
    top20 = db.query(Usuario.id, Usuario.nome, Usuario.pontos_semanais).filter(Usuario.pontos_semanais > 0).order_by(Usuario.pontos_semanais.desc()).limit(20).all()
    ranking = []
    for i, u in enumerate(top20, 1):
        ranking.append({"posicao": i, "id": u.id, "nome": u.nome, "pontos": u.pontos_semanais or 0,
            "premio": round((u.pontos_semanais or 0) / 1000, 2), "destaque": u.id == usuario.id})
    minha_pos = next((i for i, u in enumerate(top20, 1) if u.id == usuario.id), None)
    meus_pontos = usuario.pontos_semanais or 0
    agora = datetime.datetime.now()
    dias_ate_sabado = (5 - agora.weekday()) % 7
    if dias_ate_sabado == 0 and agora.hour >= 18:
        dias_ate_sabado = 7
    prox_sabado = (agora + datetime.timedelta(days=dias_ate_sabado)).replace(hour=18, minute=0, second=0, microsecond=0)
    return {"ranking": ranking, "minha_posicao": minha_pos, "meus_pontos": meus_pontos,
        "top20_minimo": top20[-1].pontos_semanais if len(top20) >= 20 else 0, "proximo_pagamento": prox_sabado.isoformat()}


@router.get("/admin/ranking-completo")
async def ranking_completo(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import Usuario
    usuarios = db.query(Usuario).filter(
        Usuario.pontos_semanais > 0
    ).order_by(Usuario.pontos_semanais.desc()).limit(20).all()

    resultado = []
    for i, u in enumerate(usuarios, 1):
        resultado.append({
            "posicao": i,
            "id": u.id,
            "nome": u.nome,
            "cpf": u.cpf,
            "chave_pix": u.chave_pix,
            "pontos": u.pontos_semanais or 0,
            "premio": round((u.pontos_semanais or 0) / 1000, 2)
        })
    return {"ranking": resultado}


@router.get("/ranking/historico")
async def ranking_historico(db: Session = Depends(get_db)):
    """Retorna os últimos 10 rankings semanais resetados (público)."""
    import json
    historicos = db.query(RankingHistorico).order_by(
        RankingHistorico.data_reset.desc()
    ).limit(10).all()
    
    return [{
        "id": h.id,
        "data_reset": h.data_reset.isoformat(),
        "total_pontos": h.total_pontos,
        "total_premio": float(h.total_premio or 0),
        "status": h.status or "pago",
        "top20": json.loads(h.dados_json)
    } for h in historicos]


@router.get("/admin/ranking/historico")
async def admin_ranking_historico(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """Admin: histórico completo de pagamentos do ranking com CPF e chave PIX."""
    import json
    historicos = db.query(RankingHistorico).order_by(
        RankingHistorico.data_reset.desc()
    ).limit(20).all()

    resultado = []
    for h in historicos:
        dados = json.loads(h.dados_json)

        # Enriquecer com CPF e chave PIX
        ids = [d["id"] for d in dados]
        usuarios = {u.id: u for u in db.query(Usuario).filter(Usuario.id.in_(ids)).all()}

        vencedores = []
        for d in dados:
            u = usuarios.get(d["id"])
            vencedores.append({
                **d,
                "cpf": u.cpf if u else "***",
                "chave_pix": u.chave_pix if u else "***"
            })

        resultado.append({
            "id": h.id,
            "data_reset": h.data_reset.strftime("%d/%m/%Y %H:%M"),
            "data_reset_iso": h.data_reset.isoformat(),
            "total_pontos": h.total_pontos,
            "total_premio": float(h.total_premio or 0),
            "status": h.status or "pago",
            "conferido_por": h.conferido_por,
            "data_conferido": h.data_conferido.isoformat() if h.data_conferido else None,
            "vencedores": vencedores
        })

    return {"pagamentos": resultado}


@router.post("/admin/ranking/conferir/{historico_id}")
async def conferir_pagamento_ranking(
    historico_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """Admin: marca um pagamento do ranking como conferido."""
    historico = db.query(RankingHistorico).filter(RankingHistorico.id == historico_id).first()
    if not historico:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado.")

    historico.status = "conferido"
    historico.conferido_por = admin.id
    historico.data_conferido = datetime.datetime.now(datetime.timezone.utc)
    db.commit()

    return {"message": "Pagamento conferido com sucesso!", "id": historico.id, "status": "conferido"}


