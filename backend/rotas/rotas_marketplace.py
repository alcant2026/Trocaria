from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import os
import httpx
import datetime
from database import get_db
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from rotas.rotas_auth import obter_usuario_logado
import mercadopago
import logging

logger = logging.getLogger(__name__)

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
            usuario.mp_token_expires_at = datetime.datetime.utcnow() + datetime.timedelta(seconds=expires_in)
        
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
    """Remove as credenciais do Mercado Pago do usuário."""
    usuario.mp_access_token = None
    usuario.mp_refresh_token = None
    usuario.mp_user_id = None
    usuario.mp_token_expires_at = None
    db.commit()
    return {"message": "Conta Mercado Pago desconectada."}

@router.post("/gerar-pagamento-split")
async def gerar_pagamento_split(
    vendedor_id: str, 
    valor: float, 
    db: Session = Depends(get_db),
    comprador: Usuario = Depends(obter_usuario_logado)
):
    """Gera um pagamento PIX em nome do vendedor, separando a taxa da plataforma."""
    vendedor = db.query(Usuario).filter(Usuario.id == vendedor_id).first()
    if not vendedor or not vendedor.mp_access_token:
        raise HTTPException(status_code=400, detail="Vendedor não encontrado ou não conectou o Mercado Pago.")
    
    # Definimos a taxa da plataforma (ex: 5% ou valor fixo)
    # Aqui vou usar 5% como exemplo, mas você pode ajustar
    taxa_plataforma = round(valor * 0.05, 2)
    
    # Inicializa o SDK com o token do VENDEDOR
    sdk = mercadopago.SDK(vendedor.mp_access_token)
    
    payment_data = {
        "transaction_amount": valor,
        "description": f"Compra no Marketplace - Psy Pay (Vendedor: {vendedor.nome})",
        "payment_method_id": "pix",
        "application_fee": taxa_plataforma,
        "payer": {
            "email": comprador.email,
            "identification": {
                "type": "CPF",
                "number": comprador.cpf.replace(".", "").replace("-", "")
            }
        },
        "notification_url": f"https://cred30.site/api/financeiro/webhook/mercadopago" # Webhook global
    }
    
    result = sdk.payment().create(payment_data)
    payment = result.get("response", {})
    
    if result.get("status") not in [200, 201]:
        logger.error(f"Erro Split MP: {payment}")
        raise HTTPException(status_code=400, detail=f"Erro ao gerar pagamento: {payment.get('message')}")
    
    # Registra a transação no banco (como pendente)
    nova_transacao = Transacao(
        usuario_id=vendedor.id, # O crédito vai pro vendedor
        valor=valor - taxa_plataforma, # Valor líquido do vendedor
        tipo=TipoTransacao.RECEBIMENTO,
        status="pendente",
        payment_id=str(payment.get("id")),
        detalhes=f"Venda Marketplace | Comprador: {comprador.nome} | Taxa App: R$ {taxa_plataforma}"
    )
    db.add(nova_transacao)
    db.commit()
    
    return {
        "payment_id": payment.get("id"),
        "qr_code": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code"),
        "qr_code_base64": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64"),
        "valor": valor,
        "taxa": taxa_plataforma
    }
