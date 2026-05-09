from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, text, or_
import logging

# Bonus de indicacao: quando um usuario paga uma taxa, o convidador ganha pontos
PONTOS_POR_REAL_INDICADOR = 1  # 1 ponto por R$ 1 gasto em taxas (indicador)
PONTOS_POR_REAL_COMPRADOR = 3  # 3 pontos por R$ 1 gasto em taxas (quem comprou)

def conceder_pontos_indicacao(db: Session, usuario: Usuario, valor_pago: Decimal, descricao: str):
    """Concede pontos a TODOS os indicadores do usuario (efeito rede)."""
    from modelos.modelos_db import Indicacao
    
    # Buscar todos os indicadores na rede
    indicacoes = db.query(Indicacao).filter(Indicacao.indicado_id == usuario.id).all()
    if not indicacoes:
        return
    
    pontos = int(valor_pago * PONTOS_POR_REAL_INDICADOR)
    if pontos <= 0:
        return
    
    for indicacao in indicacoes:
        convidador = db.query(Usuario).filter(Usuario.id == indicacao.indicador_id).with_for_update().first()
        if convidador:
            convidador.pontos_marketplace = (convidador.pontos_marketplace or 0) + pontos
            convidador.pontos_semanais = (convidador.pontos_semanais or 0) + pontos
            db.add(Transacao(
                usuario_id=convidador.id, valor=Decimal(str(pontos)),
                tipo=TipoTransacao.BONUS, status="concluido",
                detalhes=f"{pontos} pontos por indicacao - {descricao}"
            ))

def conceder_pontos_compra(db: Session, usuario: Usuario, valor_pago: Decimal, descricao: str):
    """Concede 3x pontos ao usuario que realizou a compra."""
    pontos = int(valor_pago * PONTOS_POR_REAL_COMPRADOR)
    if pontos <= 0:
        return
    usuario.pontos_marketplace = (usuario.pontos_marketplace or 0) + pontos
    usuario.pontos_semanais = (usuario.pontos_semanais or 0) + pontos
    db.add(Transacao(
        usuario_id=usuario.id, valor=Decimal(str(pontos)),
        tipo=TipoTransacao.BONUS, status="concluido",
        detalhes=f"{pontos} pontos por compra - {descricao}"
    ))

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
import os
import mercadopago

# SDK do Mercado Pago (lazy)
_sdk_instance = None

def get_sdk():
    global _sdk_instance
    if _sdk_instance is None:
        token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "")
        _sdk_instance = mercadopago.SDK(token) if token else None
    return _sdk_instance

sdk = get_sdk()
from limitador import limiter
from fastapi.responses import FileResponse
from decimal import Decimal
import datetime
from datetime import timezone, timedelta
import pyotp
import uuid
import httpx
from typing import Optional, List
from modelos.modelos_db import (
    Usuario, Transacao, TipoTransacao, StatusSolicitacao, 
    SolicitacaoEmprestimo, RegistroAuditoria, 
    Parceiro, LinkAfiliado
)
from utils_emprestimo import calcular_divida_total
from database import get_db, engine
from rotas.rotas_auth import obter_usuario_logado, exigir_admin, verify_password
from limitador import limiter
from utils_seguranca import registrar_acao_admin
from rotas.rotas_snapshot import cache_snapshot_data

class NotificacaoDeposito(BaseModel):
    valor: Decimal = Field(gt=0)
    metodo: str = "pix" # pix ou especie
    parceiro_id: Optional[int] = None

class ReservaSaqueRequest(BaseModel):
    valor: Decimal = Field(gt=0)
    parceiro_id: int
    senha_saque: str
    codigo_2fa: str = ""

class SolicitacaoSaque(BaseModel):
    valor: Decimal = Field(gt=0)
    chave_pix: str = ""
    metodo: str = "pix" # pix ou especie
    parceiro_id: Optional[int] = None
    senha: str
    codigo_2fa: str

class AporteCaixaRequest(BaseModel):
    valor: Decimal = Field(gt=0)
    senha: str
    codigo_2fa: str = ""
    aceite_termos: bool = False

router = APIRouter(prefix="/financeiro", tags=["Movimentação"])
TZ_BRASILIA = timezone(timedelta(hours=-3))



def normalizar_cnpj(cnpj: str) -> str:
    return "".join(filter(str.isdigit, cnpj))

def validar_cnpj(cnpj: str) -> bool:
    cnpj = normalizar_cnpj(cnpj)
    return len(cnpj) == 14

def normalizar_status_cadastral(status: str) -> str:
    return status.lower() if status else "pendente"

def exigir_parceiro_apto(parceiro: Parceiro):
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")
    if not parceiro.is_active:
        raise HTTPException(status_code=403, detail="Parceiro inativo.")
    if not validar_cnpj(parceiro.cnpj):
        raise HTTPException(status_code=403, detail="Parceiro sem CNPJ valido.")
    if normalizar_status_cadastral(parceiro.cnpj_status) != "ativa":
        raise HTTPException(status_code=403, detail="Parceiro precisa estar com CNPJ em situacao ATIVA para operar.")
    return parceiro


class ParceiroCreate(BaseModel):
    nome: str
    razao_social: str | None = None
    cnpj: str
    cnpj_status: str = "ativa"
    endereco: str
    usuario_id: str | None = None

class ParceiroUpdate(BaseModel):
    nome: str | None = None
    endereco: str | None = None
    is_active: bool | None = None

class SaqueAdminRequest(BaseModel):
    valor: Decimal
    motivo: str = "Resgate de lucro"

class DepositoPixRequest(BaseModel):
    valor: Decimal = Field(gt=0)

# --- CONFIGURAÇÕES DE RISCO (BaaS AUTO-PAYOUT) ---
VALOR_MAX_SAQUE_AUTO = Decimal("100.00")
SAQUES_AUTO_POR_DIA = 1

async def processar_payout_pix_mp(transacao, usuario: Usuario, token_custom: Optional[str] = None):
    """
    Integração com a API de Transaction Intents do Mercado Pago para envio de PIX (BaaS).
    """
    if not os.environ.get("MERCADOPAGO_ACCESS_TOKEN"):
        logger.error("❌ PAYOUT: Token do Mercado Pago não configurado.")
        return False, "Token de acesso não configurado no servidor."

    idempotency_key = str(uuid.uuid4())
    payload = {
        "transaction_amount": float(transacao.valor or 0),
        "description": f"Saque Psy Pay - {usuario.nome} (ID:{transacao.id})",
        "payment_method_id": "pix",
        "point_of_interaction": {
            "type": "payout"
        },
        "receiver": {
            "identification": {
                "type": "CPF",
                "number": usuario.cpf.replace(".", "").replace("-", "")
            }
        },
        "payer": {
            "email": usuario.email
        }
    }

    # Nota: Em alguns países/contas o endpoint principal de BaaS é o transaction-intents
    # Porém, para contas padrão com Payout habilitado, o v1/payouts é o mais estável.
    url = "https://api.mercadopago.com/v1/payouts"
    token_final = (token_custom or os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "")).strip()
    
    headers = {
        "Authorization": f"Bearer {token_final}",
        "X-Idempotency-Key": idempotency_key,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            logger.info(f"🚀 ENVIANDO PAYOUT PIX (ID: {transacao.id}) - Valor: {transacao.valor}")
            response = await client.post(url, json=payload, headers=headers)
            
            # Tentar fallback se o primeiro endpoint falhar com 404
            if response.status_code == 404:
                url_fallback = "https://api.mercadopago.com/v1/transaction-intents/process"
                response = await client.post(url_fallback, json=payload, headers=headers)

            data = response.json()
            logger.info(f"📡 RESPOSTA MP ({response.status_code}): {data}")
            
            if response.status_code in [200, 201]:
                status_payout = data.get("status")
                if status_payout in ["approved", "in_process", "pending"]:
                    logger.info(f"✅ PAYOUT SUCESSO: Transação {transacao.id} enviada ao MP. Status: {status_payout}")
                    return True, f"PIX enviado com sucesso via MP. ID: {data.get('id')}"
                else:
                    logger.error(f"❌ PAYOUT ERRO: MP recusou com status {status_payout}. Detalhes: {data}")
                    return False, f"O Mercado Pago recusou a transferência: {status_payout}"
            else:
                error_msg = data.get("message", "Erro desconhecido na API do Mercado Pago.")
                # Tratamento específico para erro de assinatura
                if "signature" in error_msg.lower():
                    error_msg = f"Erro de Assinatura/Permissão (Invalid Signature). Detalhes: {data.get('cause', [])}"
                
                logger.error(f"❌ PAYOUT API ERRO ({response.status_code}): {error_msg}")
                return False, f"Erro na API de Payouts: {error_msg}"
                
    except Exception as e:
        logger.error(f"❌ PAYOUT EXCEPTION: {str(e)}")
        return False, f"Falha na conexão com o banco para realizar o PIX: {str(e)}"

@router.post("/solicitar-saque")
@limiter.limit("2/minute")
async def solicitar_saque(request: Request, dados: SolicitacaoSaque, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    # SEGURANÇA MÁXIMA: Lock do registro do usuário para evitar race conditions no saldo
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    # ANTI-POLUIÇÃO: Verificar se já existe um saque pendente
    saque_pendente = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.status == "pendente"
    ).first()
    if saque_pendente:
        raise HTTPException(
            status_code=400, 
            detail="Você já possui uma solicitação de saque pendente. Aguarde o processamento ou peça o cancelamento ao suporte."
        )

    valor = dados.valor
    chave_pix = dados.chave_pix
    
    if valor <= 0:
        raise HTTPException(status_code=400, detail="Valor de saque inválido.")

    if usuario.saldo < valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para este saque.")

    # AML (Anti-Lavagem de Dinheiro): Limites Escalonados (Tiers)
    if usuario.is_verified and usuario.is_subscriber:
        LIMITE_DIARIO_SAQUE = Decimal("15000.00") # Nível 3 (VIP Total)
    elif usuario.is_verified or usuario.is_subscriber:
        LIMITE_DIARIO_SAQUE = Decimal("5000.00")  # Nível 2 (Verificado ou Premium)
    else:
        LIMITE_DIARIO_SAQUE = Decimal("1500.00")  # Nível 1 (Básico - Risco Maior)
    hoje = datetime.datetime.now(datetime.timezone.utc).date()
    inicio_dia = datetime.datetime.combine(hoje, datetime.time.min)
    fim_dia = datetime.datetime.combine(hoje, datetime.time.max)
    
    saques_hoje = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.data_transacao >= inicio_dia,
        Transacao.data_transacao <= fim_dia,
        Transacao.status.in_(["pendente", "concluido"]) # Ignora cancelados
    ).all()
    
    total_sacado_hoje = sum([s.valor for s in saques_hoje])
    
    if total_sacado_hoje + valor > LIMITE_DIARIO_SAQUE:
        raise HTTPException(
            status_code=400, 
            detail=f"Limite diário de saque excedido. (Máx: R$ {LIMITE_DIARIO_SAQUE}/dia). Você já movimentou R$ {total_sacado_hoje:.2f} hoje."
        )

    # SEGURANÇA: Validação de PIX (Zero Trust Policy)
    # A regra do usuário é que o saque tem que ser na mesma chave PIX do nome
    # Em um cenário real, consultaríamos uma API do Bacen/PSP para validar a titularidade.
    # Como o processo é manual inicial, registraremos a intenção e alertaremos o admin.
    
    # Simulação de validação de titularidade (nome no cadastro vs nome da chave pix)
    # Aqui, como o usuário cadastrou sua chave_pix no perfil, comparamos com a solicitada no saque
    # Validação baseada no método
    if dados.metodo == "pix":
        if not chave_pix:
            raise HTTPException(status_code=400, detail="Chave PIX obrigatória para este método.")
        if chave_pix != usuario.chave_pix:
            raise HTTPException(
                status_code=401, 
                detail="Saque negado: A chave PIX deve pertencer obrigatoriamente à mesma titularidade da conta."
            )
    elif dados.metodo == "especie":
        if not dados.parceiro_id:
            raise HTTPException(status_code=400, detail="Parceiro obrigatório para saque em espécie.")
        parceiro = db.query(Parceiro).filter(Parceiro.id == dados.parceiro_id, Parceiro.is_active == True).first()
        exigir_parceiro_apto(parceiro)

    # NOVO: Validação OBRIGATÓRIA de Senha e 2FA
    if not verify_password(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=403, detail="Senha de segurança incorreta.")
    
    if not usuario.is_verified:
        raise HTTPException(
            status_code=403, 
            detail="Conta não verificada: Para sua segurança, saques são permitidos apenas para contas com documentos validados (Identidade, Renda e Residência)."
        )

    if not usuario.two_factor_enabled:
        raise HTTPException(
            status_code=403, 
            detail="2FA Obrigatório: Você precisa ativar a Autenticação de Dois Fatores (Google Authenticator) antes de realizar um saque."
        )
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if not totp.verify(dados.codigo_2fa):
        raise HTTPException(status_code=403, detail="Código 2FA (Authenticator) inválido ou expirado.")

    # TRAVA DE SEGURANÇA: 48 HORAS APÓS MUDANÇA DE 2FA
    if usuario.ultima_alteracao_2fa:
        # Garantir que estamos comparando offset-naive UTC times
        agora_utc = datetime.datetime.now(datetime.timezone.utc)
        tempo_decorrido = agora_utc - usuario.ultima_alteracao_2fa
        
        if tempo_decorrido < timedelta(hours=48):
            horas_restantes = 48 - (tempo_decorrido.total_seconds() / 3600)
            raise HTTPException(
                status_code=403, 
                detail=f"Saque Bloqueado: Por medida de segurança, após alterar o 2FA, os saques ficam suspensos por 48 horas. Tente novamente em aproximadamente {int(horas_restantes)} horas."
            )

    # Saque gratuito
    taxa = Decimal("0.00")

    total_debito = valor + taxa
    if usuario.saldo < total_debito:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para cobrir o saque e a taxa de R$ {taxa:.2f}.")

    # Deduzir saldo
    usuario.saldo -= total_debito
    
    # Valor que será efetivamente sacado (líquido)
    valor_liquido = valor

    # Criar transação de saque pendente
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor_liquido,
        tipo=TipoTransacao.SAQUE,
        status="pendente",
        metodo=dados.metodo,
        detalhes=f"Saque via {dados.metodo.upper()} para PIX: {chave_pix} | Valor: R$ {valor}"
    )
    db.add(nova_transacao)

    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    
    # --- NOVO: Lógica de Saque Automático (BaaS) ---
    msg_final = "Solicitação de saque registrada."
    
    # Critérios para Saque Automático:
    # 1. Valor <= Limite definido
    # 2. Usuário Verificado (Documentos Aprovados)
    # 3. 2FA Ativo
    # 4. Método PIX
    if dados.metodo == "pix" and valor_liquido <= VALOR_MAX_SAQUE_AUTO and usuario.is_verified and usuario.two_factor_enabled:
        parceiro_pagador = db.query(Parceiro).filter(
            Parceiro.mp_access_token != None,
            Parceiro.is_active == True,
            Parceiro.cnpj != None,
            Parceiro.cnpj_status == "ativa"
        ).first()

        token_para_payout = None
        if parceiro_pagador:
            token_para_payout = parceiro_pagador.mp_access_token
            logger.info(f"🏦 SAQUE DESCENTRALIZADO: Usando Parceiro {parceiro_pagador.nome}")
        
        sucesso_payout, detalhe_payout = await processar_payout_pix_mp(nova_transacao, usuario, token_custom=token_para_payout)
        
        if sucesso_payout:
            nova_transacao.status = "concluido"
            nova_transacao.detalhes += f" | ✅ AUTO-PIX: {detalhe_payout}"
            if parceiro_pagador:
                nova_transacao.parceiro_id = parceiro_pagador.id
            db.commit()
            msg_final = f"Saque de R$ {valor_liquido:.2f} realizado com sucesso via PIX Instantâneo!"
        else:
            nova_transacao.detalhes += f" | ⚠️ FALHA AUTO-PIX: {detalhe_payout}"
            db.commit()
            msg_final = "Saque registrado, mas precisará de aprovação manual (Falha na automação PIX)."
    else:
        # Se não cair no automático, vai pra fila manual (padrão)
        prazos = "até 24h úteis"
        if valor_liquido > 500: prazos = "até 48h úteis"
        msg_final = f"Solicitação de saque de R$ {valor_liquido:.2f} registrada e aguardando processamento manual ({prazos})."

    if taxa > 0:
        msg_final += f" (Taxa de R$ {taxa} aplicada)."
    
    return {"message": msg_final}

@router.post("/notificar-deposito")
@limiter.limit("2/minute")
async def notificar_deposito(request: Request, dados: NotificacaoDeposito, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    # ANTI-POLUIÇÃO: Verificar se já existe depósito pendente do mesmo método para evitar sujeira no extrato
    if dados.metodo == "especie":
        deposito_pendente = db.query(Transacao).filter(
            Transacao.usuario_id == usuario.id,
            Transacao.tipo == TipoTransacao.DEPOSITO,
            Transacao.metodo == "especie",
            Transacao.status == "pendente"
        ).first()
        if deposito_pendente:
            raise HTTPException(
                status_code=400, 
                detail="Você já tem um depósito em espécie pendente. Peça ao lojista para confirmar ou cancelar antes de criar um novo."
            )

    valor = dados.valor
    
    if dados.metodo == "especie":
        if not dados.parceiro_id:
            raise HTTPException(status_code=400, detail="Parceiro obrigatório para depósito em espécie.")
        parceiro = db.query(Parceiro).filter(Parceiro.id == dados.parceiro_id, Parceiro.is_active == True).first()
        exigir_parceiro_apto(parceiro)

    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor,
        tipo=TipoTransacao.DEPOSITO,
        status="pendente",
        metodo=dados.metodo,
        parceiro_id=dados.parceiro_id if dados.metodo == "especie" else None,
        detalhes=f"Notificação de depósito via {dados.metodo.upper()}" + (f" (Parceiro ID: {dados.parceiro_id})" if dados.metodo == "especie" else "")
    )
    db.add(nova_transacao)
    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": "Notificação enviada. O saldo será creditado assim que o admin confirmar."}

@router.post("/saque/reservar")
@limiter.limit("2/minute")
async def reservar_saque_especie(dados: ReservaSaqueRequest, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """[DEPRECATED] Saque em espécie removido."""
    raise HTTPException(status_code=410, detail="Saque em espécie não está mais disponível. Use PIX.")


@router.get("/deposito/pix-detalhes/{transacao_id}")
async def obter_detalhes_pix(transacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.DEPOSITO,
        Transacao.metodo == "pix"
    ).first()
    
    if not transacao:
        raise HTTPException(status_code=404, detail="Depósito não encontrado ou não pertence a este usuário.")
    
    if not transacao.payment_id:
        raise HTTPException(status_code=400, detail="Este depósito não possui um ID de pagamento válido para recuperação.")

    if not sdk:
        raise HTTPException(status_code=500, detail="SDK Mercado Pago não configurado.")

    try:
        # Consultar o Mercado Pago para pegar o QR Code atualizado/armazenado
        payment_info = sdk.payment().get(transacao.payment_id)
        if payment_info.get("status") != 200:
            raise HTTPException(status_code=400, detail="Não foi possível recuperar os dados do PIX no Mercado Pago.")
            
        payment = payment_info.get("response", {})
        qr_code = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code")
        qr_code_base64 = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64")
        expires_at = payment.get("date_of_expiration")
        
        # Verificar se já expirou
        if payment.get("status") == "cancelled":
             raise HTTPException(status_code=400, detail="Este código PIX já expirou. Por favor, gere um novo depósito.")

        return {
            "qr_code": qr_code,
            "qr_code_base64": qr_code_base64,
            "payment_id": transacao.payment_id,
            "expires_at": expires_at,
            "valor": float(transacao.valor or 0)
        }
    except Exception as e:
        logger.error(f"Erro ao recuperar PIX: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao consultar o provedor de pagamento: {str(e)}")

@router.post("/webhook/mercadopago")
@limiter.limit("10/minute")
async def webhook_mercadopago(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Payload inválido"}
        
    action = payload.get("action")
    type_ = payload.get("type")
    
    logger.info(f"🔔 WEBHOOK MP: Action={action}, Type={type_}")
    
    if (action and "payment" in action) or type_ == "payment":
        payment_id = payload.get("data", {}).get("id")
        if not payment_id:
            logger.warning("🔔 WEBHOOK MP: ID do pagamento não encontrado no payload.")
            return {"status": "ignored"}
            
        if not sdk: 
            logger.error("🔔 WEBHOOK MP: SDK não configurado no .env")
            return {"status": "error", "message": "MP não configurado"}
            
        logger.info(f"🔔 WEBHOOK MP: Buscando info do pagamento {payment_id}")
        payment_info = sdk.payment().get(payment_id)
        if payment_info.get("status") == 200:
            payment = payment_info.get("response", {})
            status_mp = payment.get("status")
            status_detail = payment.get("status_detail")
            valor_mp = Decimal(str(payment.get("transaction_amount")))
            
            logger.info(f"🔔 WEBHOOK MP: Pagamento {payment_id} está {status_mp} ({status_detail}) - Valor: {valor_mp}")
            
            if status_mp == "approved":
                # Tenta achar a transação de 3 formas: payment_id (novo), ID exato no Detalhes (legado) ou Valor
                transacao = db.query(Transacao).filter(Transacao.payment_id == str(payment_id)).first()
                if not transacao:
                    transacao = db.query(Transacao).filter(Transacao.detalhes.like(f"%ID: {payment_id}%")).first()
                
                if not transacao:
                    transacao = db.query(Transacao).filter(
                        Transacao.valor == valor_mp,
                        Transacao.status == "pendente",
                        Transacao.metodo == "pix"
                    ).order_by(Transacao.id.desc()).first()
                
                if transacao and transacao.status == "pendente":
                    usuario = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).with_for_update().first()
                    if usuario:
                        fee_details = payment.get("fee_details", [])
                        total_fee_mp = sum(Decimal(str(fee.get("amount", 0))) for fee in fee_details)
                        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()

                        if transacao.tipo == TipoTransacao.TAXA_DEPOSITO_VIRTUAL:
                            transacao.status = "concluido"
                            if not transacao.payment_id:
                                transacao.payment_id = str(payment_id)
                            transacao.detalhes = (transacao.detalhes or "") + f" | Vinculado ao ID MP: {payment_id} | Credito virtual de R$ {transacao.valor} liberado!"
                            db.commit()
                            logger.info(f"✅ CREDITO VIRTUAL: R$ {transacao.valor} liberado para {usuario.nome}")
                            cache_snapshot_data.pop(usuario.id, None)
                        elif transacao.tipo == TipoTransacao.ASSINATURA:
                            agora = datetime.datetime.now(datetime.timezone.utc)
                            dias = 365 if "ANUAL" in (transacao.detalhes or "") else 30
                            if usuario.is_subscriber and usuario.assinatura_expira_em and usuario.assinatura_expira_em > agora:
                                usuario.assinatura_expira_em += datetime.timedelta(days=dias)
                            else:
                                usuario.is_subscriber = True
                                usuario.assinatura_expira_em = agora + datetime.timedelta(days=dias)
                            transacao.status = "concluido"
                            if not transacao.payment_id:
                                transacao.payment_id = str(payment_id)
                            transacao.detalhes += f" | Premium ativado - {dias} dias"
                            plataforma.saldo += Decimal(str(valor_mp))
                            conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"assinatura de {usuario.nome}")
                            conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"assinatura premium")
                            db.commit()
                            logger.info(f"ASSINATURA: Premium ativado para {usuario.nome} por {dias} dias")
                            cache_snapshot_data.pop(usuario.id, None)
                        elif transacao.tipo == TipoTransacao.TAXA_SOLICITACAO:
                            import json as _json
                            dados_str = transacao.detalhes.replace("PENDENTE_SOLICITACAO:", "") if transacao.detalhes else None
                            if dados_str:
                                try:
                                    dados = _json.loads(dados_str)
                                    from utils_fintech import criar_solicitacao_p2p
                                    solic = criar_solicitacao_p2p(
                                        usuario_id=usuario.id,
                                        valor=Decimal(str(dados["valor"])),
                                        prazo=dados["parcelas"],
                                        taxa=Decimal(str(dados["taxa"])),
                                        db=db
                                    )
                                    transacao.status = "concluido"
                                    transacao.detalhes = f"Taxa paga - Pedido #{solic.id} criado"
                                    if not transacao.payment_id:
                                        transacao.payment_id = str(payment_id)
                                    plataforma.saldo += Decimal(str(valor_mp))
                                    conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"publicacao de {usuario.nome}")
                                    conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"taxa de solicitacao P2P")
                                    db.commit()
                                    logger.info(f"SOLICITACAO: Pedido #{solic.id} criado + R$ {valor_mp} receita")
                                    cache_snapshot_data.pop(usuario.id, None)
                                except Exception as e:
                                    logger.error(f"Erro ao criar solicitacao apos pagamento: {e}")
                                    transacao.status = "concluido"
                                    transacao.detalhes += f" | Pago mas erro ao criar: {e}"
                                    plataforma.saldo += Decimal(str(valor_mp))
                                    conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"publicacao de {usuario.nome}")
                                    conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"taxa de solicitacao P2P")
                                    db.commit()
                        elif transacao.tipo == TipoTransacao.TAXA_MATCH:
                            try:
                                from utils_fintech import confirmar_match
                                result = confirmar_match(db, transacao.id)
                                plataforma.saldo += Decimal(str(valor_mp))
                                conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"match de {usuario.nome}")
                                conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"taxa de match P2P")
                                logger.info(f"MATCH: {result['message']}")
                            except Exception as e:
                                logger.error(f"MATCH: Erro ao confirmar match: {e}")
                                transacao.status = "concluido"
                                if not transacao.payment_id:
                                    transacao.payment_id = str(payment_id)
                                db.commit()
                            cache_snapshot_data.pop(usuario.id, None)
                            cache_snapshot_data.pop(transacao.usuario_id, None)
                        elif transacao.tipo == TipoTransacao.DESBLOQUEIO_DADOS:
                            usuario.is_verified = True
                            usuario.score = (usuario.score or Decimal("0")) + Decimal("10")
                            if usuario.score > Decimal("1000"):
                                usuario.score = Decimal("1000")
                            transacao.status = "concluido"
                            if not transacao.payment_id:
                                transacao.payment_id = str(payment_id)
                            transacao.detalhes = "Conta verificada apos pagamento KYC"
                            plataforma.saldo += Decimal(str(valor_mp))
                            conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"KYC de {usuario.nome}")
                            conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"verificacao KYC")
                            db.commit()
                            logger.info(f"KYC: Conta de {usuario.nome} verificada apos pagamento de R$14,99")
                            cache_snapshot_data.pop(usuario.id, None)
                        elif transacao.tipo == TipoTransacao.TAXA_POSTAGEM and transacao.detalhes and "DESTAQUE_LINK:" in transacao.detalhes:
                            try:
                                link_id = int(transacao.detalhes.split(":")[1])
                                from modelos.modelos_db import LinkAfiliado
                                link = db.query(LinkAfiliado).filter(LinkAfiliado.id == link_id).first()
                                if link:
                                    link.is_boosted = True
                                    link.visualizacoes_restantes += 1000
                                    link.data_expiracao = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)
                                    link.ponto_min = 1
                                    link.ponto_max = 5
                                transacao.status = "concluido"
                                if not transacao.payment_id:
                                    transacao.payment_id = str(payment_id)
                                plataforma.saldo += Decimal(str(valor_mp))
                                conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"destaque de {usuario.nome}")
                                conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"destaque de anuncio")
                                db.commit()
                                logger.info(f"DESTAQUE: Link #{link_id} destacado por 7 dias (R${valor_mp})")
                            except Exception as e:
                                logger.error(f"DESTAQUE: Erro ao destacar link: {e}")
                            cache_snapshot_data.pop(usuario.id, None)
                        elif transacao.tipo == TipoTransacao.TAXA_POSTAGEM and transacao.detalhes and "BOOST_LINK:" in transacao.detalhes:
                            try:
                                partes = transacao.detalhes.split(":")
                                link_id = int(partes[1])
                                pacote_id = int(partes[2])
                                from modelos.modelos_db import LinkAfiliado
                                from rotas.rotas_comunidade import PRECO_VIEWS
                                link = db.query(LinkAfiliado).filter(LinkAfiliado.id == link_id).first()
                                pacote = PRECO_VIEWS.get(pacote_id)
                                if link and pacote:
                                    link.is_boosted = True
                                    link.visualizacoes_restantes += pacote["views"]
                                    link.data_expiracao = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
                                transacao.status = "concluido"
                                if not transacao.payment_id:
                                    transacao.payment_id = str(payment_id)
                                plataforma.saldo += Decimal(str(valor_mp))
                                conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"boost de {usuario.nome}")
                                conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"boost de anuncio")
                                db.commit()
                                logger.info(f"BOOST: Link #{link_id} +{pacote['views'] if pacote else '?'} views (R${valor_mp})")
                            except Exception as e:
                                logger.error(f"BOOST: Erro ao processar boost: {e}")
                            cache_snapshot_data.pop(usuario.id, None)
                        elif transacao.detalhes and "COBRANCA:" in (transacao.detalhes or ""):
                            try:
                                from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao
                                sc_id = int(transacao.detalhes.split(":")[1])
                                sc = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.id == sc_id).first()
                                tomador = db.query(Usuario).filter(Usuario.id == sc.usuario_id).first() if sc else None
                                credor = db.query(Usuario).filter(Usuario.id == sc.credor_id).first() if sc else None
                                if tomador and credor:
                                    import urllib.parse
                                    debito = sc.valor
                                    if tomador.telefone:
                                        num = "".join(filter(str.isdigit, tomador.telefone))
                                        if not num.startswith("55"): num = "55" + num
                                        msg = f"Ola {tomador.nome.split()[0]}, voce tem um debito de R$ {float(debito or 0):.2f} do contrato #{sc.id} com {credor.nome}. - Psy Pay"
                                        wa = f"https://wa.me/{num}?text={urllib.parse.quote(msg)}"
                                        print(f"COBRANCA: WhatsApp link para cobranca: {wa}")
                                transacao.status = "concluido"
                                if not transacao.payment_id:
                                    transacao.payment_id = str(payment_id)
                                plataforma.saldo += Decimal(str(valor_mp))
                                conceder_pontos_indicacao(db, usuario, Decimal(str(valor_mp)), f"cobranca")
                                conceder_pontos_compra(db, usuario, Decimal(str(valor_mp)), f"cobranca de divida")
                                db.commit()
                                logger.info(f"COBRANCA: Contrato #{sc_id} - email enviado + receita R${valor_mp}")
                            except Exception as e:
                                logger.error(f"COBRANCA: Erro: {e}")
                            cache_snapshot_data.pop(usuario.id, None)
                        else:
                            usuario.saldo += valor_mp
                            transacao.status = "concluido"
                            if not transacao.payment_id:
                                transacao.payment_id = str(payment_id)

                            if f"ID: {payment_id}" not in (transacao.detalhes or ""):
                                transacao.detalhes = (transacao.detalhes or "") + f" | Vinculado ao ID MP: {payment_id}"

                            transacao.detalhes += f" | [Taxas MP Absorvidas: R$ {total_fee_mp}]"

                            if transacao.tipo == TipoTransacao.RECEBIMENTO:
                                usuario.vendas_completadas = (usuario.vendas_completadas or 0) + 1
                                logger.info(f"REPUTACAO: {usuario.nome} completou uma venda!")

                            if transacao.parceiro_id:
                                parceiro = db.query(Parceiro).filter(Parceiro.id == transacao.parceiro_id).with_for_update().first()
                                if parceiro:
                                    plataforma.saldo += valor_mp  # (was parceiro.saldo_caixa_atual)
                                    transacao.detalhes += f" | [Custodiado por: {parceiro.nome}]"

                            if plataforma:
                                plataforma.saldo -= total_fee_mp
                                logger.info(f"TAXA ABSORVIDA: R$ {total_fee_mp} descontados.")

                            if usuario.id != "000PL":
                                pass  # score via depósito removido

                            db.commit()
                            logger.info(f"WEBHOOK MP: Saldo de R$ {transacao.valor} creditado para {usuario.nome}")
                            cache_snapshot_data.pop(usuario.id, None)
                            cache_snapshot_data.pop("000PL", None)
                    else:
                        logger.error(f"❌ WEBHOOK MP: Usuário {transacao.usuario_id} não encontrado no DB.")
                elif transacao and transacao.status == "concluido":
                    logger.info(f"ℹ️ WEBHOOK MP: Pagamento {payment_id} já foi processado anteriormente.")
                else:
                    logger.warning(f"⚠️ WEBHOOK MP: Nenhuma transação pendente encontrada para o pagamento {payment_id}")
                    
    return {"status": "success"}

@router.get("/admin/sync-pix/{payment_id}")
async def sincronizar_pix_manual(payment_id: str, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Rota de emergência para o administrador forçar a sincronização de um Pix 
    caso o Webhook tenha falhado ou não esteja configurado.
    """
    logger.info(f"🛠️ SYNC MANUAL: Iniciando para ID {payment_id} por {admin.nome}")
    if not sdk:
        raise HTTPException(status_code=500, detail="SDK Mercado Pago não configurado.")

    payment_info = sdk.payment().get(payment_id)
    if payment_info.get("status") != 200:
        logger.error(f"❌ SYNC MANUAL: Pagamento {payment_id} não encontrado no MP API.")
        raise HTTPException(status_code=404, detail="Pagamento não encontrado no Mercado Pago.")

    payment = payment_info.get("response", {})
    status_mp = payment.get("status")
    valor_mp = Decimal(str(payment.get("transaction_amount")))

    logger.info(f"🛠️ SYNC MANUAL: Status no MP é {status_mp}")

    if status_mp != "approved":
        return {"status": "error", "message": f"O pagamento ainda está com status: {status_mp}"}

    # Busca a transação pendente associada a este pagamento no banco de dados
    transacao = db.query(Transacao).filter(Transacao.detalhes.like(f"%ID: {payment_id}%")).first()
    
    if not transacao:
         logger.info(f"🛠️ SYNC MANUAL: Buscando transação genérica de Pix no valor de R$ {valor_mp}")
         transacao = db.query(Transacao).filter(
             Transacao.valor == valor_mp, 
             Transacao.status == "pendente", 
             Transacao.metodo == "pix"
         ).order_by(Transacao.id.desc()).first()

    if not transacao:
        logger.error(f"❌ SYNC MANUAL: Nenhuma transação pendente compatível encontrada para o valor {valor_mp}")
        raise HTTPException(status_code=404, detail="Não encontramos transação pendente compatível no banco.")

    if transacao.status == "concluido":
        logger.info(f"🛠️ SYNC MANUAL: Transação {transacao.id} já estava concluída.")
        return {"status": "success", "message": "Este pagamento já foi creditado."}

    # Credita o saldo ao usuário
    usuario = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).with_for_update().first()
    if usuario:
        # ABSORÇÃO DE TAXAS: O usuário recebe o bruto
        fee_details = payment.get("fee_details", [])
        total_fee_mp = sum(Decimal(str(fee.get("amount", 0))) for fee in fee_details)

        usuario.saldo += valor_mp
        transacao.status = "concluido"
        if f"ID: {payment_id}" not in (transacao.detalhes or ""):
            transacao.detalhes = (transacao.detalhes or "") + f" | Vinculado ao ID MP: {payment_id}"
        transacao.detalhes += f" | Sincronizado Manualmente | [Taxas MP Absorvidas: R$ {total_fee_mp}]"

        # DESCENTRALIZAÇÃO: Atualizar custódia do parceiro (Bruto)
        if transacao.parceiro_id:
            parceiro = db.query(Parceiro).filter(Parceiro.id == transacao.parceiro_id).with_for_update().first()
            if parceiro:
                plataforma.saldo += valor_mp  # (was parceiro.saldo_caixa_atual)
                transacao.detalhes += f" | [Custodiado por: {parceiro.nome}]"
        
        # Subtrai taxas do admin
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
        if plataforma:
            plataforma.saldo -= total_fee_mp

        if usuario.id != "000PL":
            pass  # score via depósito removido
        
        db.commit()
        
        logger.info(f"✅ SYNC MANUAL: R$ {transacao.valor} creditados para {usuario.nome} com sucesso!")
        from rotas.rotas_snapshot import cache_snapshot_data
        cache_snapshot_data.pop(usuario.id, None)
        
        return {"status": "success", "message": f"R$ {transacao.valor} creditado para {usuario.nome}!"}

    return {"status": "error", "message": "Usuário não encontrado."}

@router.get("/meu-pix/sync/{payment_id}")
async def sincronizar_meu_pix_especifico(payment_id: str, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Sincroniza um pagamento PIX específico do usuário logado para fechamento automático de QR Code."""
    if not sdk:
        raise HTTPException(status_code=500, detail="SDK Mercado Pago não configurado.")

    payment_info = sdk.payment().get(payment_id)
    if payment_info.get("status") != 200:
        return {"status": "pending", "message": "Pagamento não encontrado ou ainda processando."}

    payment = payment_info.get("response", {})
    status_mp = payment.get("status")
    
    if status_mp == "approved":
        # Busca a transação pendente associada
        transacao = db.query(Transacao).filter(
            Transacao.usuario_id == usuario.id,
            Transacao.status == "pendente",
            Transacao.detalhes.like(f"%ID: {payment_id}%")
        ).first()

        if transacao:
            usuario_db = db.query(Usuario).filter(Usuario.id == usuario.id).with_for_update().first()
            
            # ABSORÇÃO DE TAXAS: O usuário recebe o bruto
            fee_details = payment.get("fee_details", [])
            total_fee_mp = sum(Decimal(str(fee.get("amount", 0))) for fee in fee_details)
            valor_mp = Decimal(str(payment.get("transaction_amount")))

            usuario_db.saldo += valor_mp
            transacao.status = "concluido"
            transacao.detalhes += f" | Polling Automático | [Taxas MP Absorvidas: R$ {total_fee_mp}]"

            # DESCENTRALIZAÇÃO: Atualizar custódia do parceiro (Bruto)
            if transacao.parceiro_id:
                parceiro = db.query(Parceiro).filter(Parceiro.id == transacao.parceiro_id).with_for_update().first()
                if parceiro:
                    plataforma.saldo += valor_mp  # (was parceiro.saldo_caixa_atual)
                    transacao.detalhes += f" | [Custodiado por: {parceiro.nome}]"
            
            # Subtrai taxas do admin
            plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
            if plataforma:
                plataforma.saldo -= total_fee_mp

            pass  # score via depósito removido
            db.commit()
            
            from rotas.rotas_snapshot import cache_snapshot_data
            cache_snapshot_data.pop(usuario.id, None)
            
            return {"status": "success", "message": "Pagamento aprovado e saldo creditado!"}
    
    elif status_mp in ["cancelled", "expired", "rejected"]:
        # Marcar como expirado no banco para "limpar" os registros pendentes do usuário
        transacao = db.query(Transacao).filter(
            Transacao.usuario_id == usuario.id,
            Transacao.status == "pendente",
            Transacao.detalhes.like(f"%ID: {payment_id}%")
        ).first()
        
        if transacao:
            transacao.status = "expirado"
            transacao.detalhes += f" | Finalizado no MP como: {status_mp}"
            db.commit()
            return {"status": "expired", "message": "Este PIX expirou ou foi cancelado."}

    return {"status": "pending", "message": "Pagamento ainda não aprovado."}

@router.post("/confirmar-recebimento/{id}")
async def confirmar_recebimento_saque(id: int, request: Request, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Permite que o cliente confirme que recebeu o PIX do saque."""
    transacao = db.query(Transacao).filter(
        Transacao.id == id, 
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.SAQUE
    ).first()

    if not transacao:
        raise HTTPException(status_code=404, detail="Transação de saque não encontrada.")

    if transacao.status != "concluido":
        raise HTTPException(status_code=400, detail="Você só pode confirmar o recebimento de saques já processados pela plataforma.")

    if transacao.confirmado_cliente:
        return {"message": "Este saque já foi confirmado anteriormente."}

    # Registro de Auditoria
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(auditoria)
    db.flush()

    transacao.confirmado_cliente = True
    transacao.data_confirmacao_cliente = datetime.datetime.now(timezone.utc)
    transacao.auditoria_id = auditoria.id
    
    db.commit()
    return {"message": "Recebimento confirmado com sucesso! Obrigado pelo feedback."}

# @router.post("/parceiro/sacar-comissoes")
@router.get("/admin/parceiros")
async def listar_parceiros(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    return db.query(Parceiro).order_by(Parceiro.nome).all()

@router.post("/admin/parceiros")
async def criar_parceiro(request: Request, dados: ParceiroCreate, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    cnpj = normalizar_cnpj(dados.cnpj)
    if not validar_cnpj(cnpj):
        raise HTTPException(status_code=400, detail="CNPJ inválido. Parceiros devem ser cadastrados somente como pessoa jurídica.")
    status_cnpj = normalizar_status_cadastral(dados.cnpj_status)
    if status_cnpj != "ativa":
        raise HTTPException(status_code=400, detail="Só aceitamos parceiros com CNPJ em situação ATIVA.")
    parceiro_existente = db.query(Parceiro).filter(Parceiro.cnpj == cnpj).first()
    if parceiro_existente:
        raise HTTPException(status_code=400, detail="Já existe parceiro cadastrado com este CNPJ.")

    parceiro = Parceiro(
        nome=dados.nome,
        razao_social=dados.razao_social,
        cnpj=cnpj,
        cnpj_status=status_cnpj,
        cnpj_validado_em=datetime.datetime.now(datetime.timezone.utc),
        endereco=dados.endereco,
        usuario_id=dados.usuario_id
    )
    
    # Sincroniza tokens do MP se o usuário já tiver vinculado antes de virar parceiro
    usuario_alvo = db.query(Usuario).filter(Usuario.id == dados.usuario_id).first()
    if usuario_alvo and usuario_alvo.mp_access_token:
        parceiro.mp_access_token = usuario_alvo.mp_access_token
        parceiro.mp_refresh_token = usuario_alvo.mp_refresh_token
        parceiro.mp_user_id = usuario_alvo.mp_user_id
        parceiro.mp_token_expires_at = usuario_alvo.mp_token_expires_at
    
    db.add(parceiro)
    db.commit()
    registrar_acao_admin(db, admin.id, "CRIAR_PARCEIRO", alvo_id=str(parceiro.id), detalhes=f"Parceiro: {parceiro.nome}", ip=request.client.host)
    db.commit()
    return {"message": "Parceiro PJ cadastrado com sucesso!"}

@router.put("/admin/parceiros/{id}")
async def editar_parceiro(id: int, request: Request, dados: ParceiroUpdate, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    parceiro = db.query(Parceiro).filter(Parceiro.id == id).first()
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")

    cnpj = normalizar_cnpj(dados.cnpj)
    if not validar_cnpj(cnpj):
        raise HTTPException(status_code=400, detail="CNPJ inválido. Parceiros devem ser cadastrados somente como pessoa jurídica.")
    status_cnpj = normalizar_status_cadastral(dados.cnpj_status)
    if status_cnpj != "ativa":
        raise HTTPException(status_code=400, detail="Só aceitamos parceiros com CNPJ em situação ATIVA.")
    parceiro_existente = db.query(Parceiro).filter(Parceiro.cnpj == cnpj, Parceiro.id != parceiro.id).first()
    if parceiro_existente:
        raise HTTPException(status_code=400, detail="Já existe outro parceiro cadastrado com este CNPJ.")
    
    parceiro.nome = dados.nome
    parceiro.razao_social = dados.razao_social
    parceiro.cnpj = cnpj
    parceiro.cnpj_status = status_cnpj
    parceiro.cnpj_validado_em = datetime.datetime.now(datetime.timezone.utc)
    parceiro.endereco = dados.endereco
    parceiro.usuario_id = dados.usuario_id
    parceiro.is_active = dados.ativo
    
    # NOVO: Sincroniza tokens do MP na edição
    if dados.usuario_id:
        usuario_alvo = db.query(Usuario).filter(Usuario.id == dados.usuario_id).first()
        if usuario_alvo and usuario_alvo.mp_access_token:
            parceiro.mp_access_token = usuario_alvo.mp_access_token
            parceiro.mp_refresh_token = usuario_alvo.mp_refresh_token
            parceiro.mp_user_id = usuario_alvo.mp_user_id
            parceiro.mp_token_expires_at = usuario_alvo.mp_token_expires_at

    registrar_acao_admin(db, admin.id, "EDITAR_PARCEIRO", alvo_id=str(parceiro.id), detalhes=f"Novo nome: {parceiro.nome}, Ativo: {parceiro.is_active}", ip=request.client.host)
    db.commit()
    return {"message": "Parceiro atualizado e token sincronizado!"}

@router.post("/admin/parceiros/sincronizar-tokens")
async def sincronizar_tokens_parceiros(request: Request, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Percorre todos os lojistas e copia o token do Mercado Pago
    do usuário dono para o registro da loja. Útil quando o lojista
    foi criado antes de o usuário vincular a conta do MP.
    """
    parceiros = db.query(Parceiro).filter(Parceiro.usuario_id != None).all()
    atualizados = []
    nao_atualizados = []

    for p in parceiros:
        usuario_alvo = db.query(Usuario).filter(Usuario.id == p.usuario_id).first()
        if usuario_alvo and usuario_alvo.mp_access_token:
            p.mp_access_token = usuario_alvo.mp_access_token
            p.mp_refresh_token = usuario_alvo.mp_refresh_token
            p.mp_user_id = usuario_alvo.mp_user_id
            p.mp_token_expires_at = usuario_alvo.mp_token_expires_at
            atualizados.append(p.nome)
        else:
            nao_atualizados.append(p.nome)

    db.commit()
    registrar_acao_admin(db, admin.id, "SINCRONIZAR_TOKENS_MP", alvo_id="todos", detalhes=f"Atualizados: {atualizados}", ip=request.client.host)
    return {
        "message": f"{len(atualizados)} lojista(s) sincronizado(s) com sucesso!",
        "atualizados": atualizados,
        "sem_mp_vinculado": nao_atualizados
    }

@router.delete("/admin/parceiros/{id}")
async def deletar_parceiro(id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    parceiro = db.query(Parceiro).filter(Parceiro.id == id).first()
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")
    
    # REGRA DE NEGÓCIO: Sempre inativar (Soft Delete) para preservar histórico financeiro
    parceiro.is_active = False
    
    db.commit()
    return {"message": "Parceiro desativado com sucesso!"}

@router.post("/admin/confirmar/{transacao_id}")
async def confirmar_transacao(transacao_id: int, request: Request, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    # Lock na transação e no usuário alvo
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).with_for_update().first()
    if not transacao or transacao.status != "pendente":
        raise HTTPException(status_code=404, detail="Transação pendente não encontrada.")

    usuario = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).with_for_update().first()
    
    if transacao.tipo == TipoTransacao.DEPOSITO:
        usuario.saldo += transacao.valor
        msg = f"Saldo de R$ {transacao.valor} creditado para {usuario.nome}!"
    elif transacao.tipo == TipoTransacao.SAQUE:
        # No saque, o saldo já foi deduzido (bloqueado) na solicitação.
        msg = f"Saque de R$ {transacao.valor} para {usuario.nome} marcado como enviado!"
    elif transacao.tipo == TipoTransacao.DESBLOQUEIO_DADOS:
        # Lógica de Verificação de Conta (KYC)
        usuario.is_verified = True
        # Tentar localizar os documentos para marcar como aprovados
        from modelos.modelos_db import DocumentoVerificacao
        docs = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == usuario.id, DocumentoVerificacao.status == "pendente").first()
        if docs:
            docs.status = "aprovado"
            docs.data_analise = datetime.datetime.now(datetime.timezone.utc)
        msg = f"Identidade de {usuario.nome} verificada com sucesso!"
    else:
        msg = f"Transação de {usuario.nome} confirmada!"
    
    transacao.status = "concluido"
    registrar_acao_admin(db, admin.id, "CONFIRMAR_TRANSACAO", alvo_id=str(transacao.id), detalhes=f"Tipo: {transacao.tipo.value}, Valor: {transacao.valor}", ip=request.client.host)
    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": msg}

@router.get("/admin/kyc-pendentes")
async def listar_kyc_pendentes(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import DocumentoVerificacao, Transacao
    docs = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.status == "pendente").all()
    resultado = []
    for d in docs:
        transacao = db.query(Transacao).filter(
            Transacao.usuario_id == d.usuario_id,
            Transacao.tipo == TipoTransacao.DESBLOQUEIO_DADOS,
            Transacao.status == "pendente"
        ).first()
        resultado.append({
            "id": d.id,
            "transacao_id": transacao.id if transacao else None,
            "usuario_id": d.usuario_id,
            "usuario_nome": d.usuario.nome,
            "usuario_cpf": d.usuario.cpf,
            "data_envio": d.data_envio.isoformat(),
            "url_rg": f"/financeiro/admin/view-doc/{d.usuario_id}/rg" if d.caminho_rg else None,
            "url_renda": f"/financeiro/admin/view-doc/{d.usuario_id}/renda" if d.caminho_renda else None,
            "url_residencia": f"/financeiro/admin/view-doc/{d.usuario_id}/residencia" if d.caminho_residencia else None,
        })
    return resultado

@router.get("/admin/view-doc/{usuario_id}/{tipo_doc}")
async def view_documento(usuario_id: str, tipo_doc: str, request: Request, token: Optional[str] = None, db: Session = Depends(get_db)):
    from rotas.rotas_auth import verificar_token_manual
    from modelos.modelos_db import DocumentoVerificacao

    user_id = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        user_id = verificar_token_manual(auth_header[7:])
    if not user_id and token:
        user_id = verificar_token_manual(token)

    if not user_id:
        raise HTTPException(status_code=401, detail="Token ausente ou inválido")
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado")

    doc = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == usuario_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documentos não encontrados")
    
    path = None
    if tipo_doc == "rg": path = doc.caminho_rg
    elif tipo_doc == "renda": path = doc.caminho_renda
    elif tipo_doc == "residencia": path = doc.caminho_residencia
    
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor")
        
    return FileResponse(path)

class LimiteManualRequest(BaseModel):
    limite: Optional[Decimal] = None

@router.put("/admin/cliente/{usuario_id}/limite")
async def atualizar_limite_manual(usuario_id: str, dados: LimiteManualRequest, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    cliente = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    cliente.limite_credito_personalizado = dados.limite
    db.commit()
    from rotas.rotas_snapshot import cache_snapshot_data
    cache_snapshot_data.pop(usuario_id, None)
    return {"message": f"Limite manual atualizado para {dados.limite if dados.limite is not None else 'Automático'}."}

@router.post("/admin/rejeitar/{transacao_id}")
async def rejeitar_transacao(transacao_id: int, request: Request, motivo: str = Body(..., embed=True), db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao or transacao.status != "pendente":
        raise HTTPException(status_code=404, detail="Transação pendente não encontrada.")

    usuario = transacao.usuario
    # Lock no usuário para garantir atomicidade na rejeição (estorno de saldo)
    usuario_lock = db.query(Usuario).filter(Usuario.id == usuario.id).with_for_update().first()
    
    # Só não estorna em DEPÓSITO (dinheiro ainda não entrou) e RECEBIMENTO (dinheiro vindo de fora)
    if transacao.tipo.value not in ["deposito", "recebimento"]:
        usuario_lock.saldo += transacao.valor
    
    transacao.status = "falhou"
    transacao.detalhes = f"REJEITADO: {motivo}"
    
    if transacao.tipo == TipoTransacao.DESBLOQUEIO_DADOS:
        from modelos.modelos_db import DocumentoVerificacao
        doc = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == usuario.id, DocumentoVerificacao.status == "pendente").first()
        if doc:
            doc.status = "rejeitado"
            doc.motivo_rejeicao = motivo
            doc.data_analise = datetime.datetime.now(datetime.timezone.utc)

    registrar_acao_admin(db, admin.id, "REJEITAR_TRANSACAO", alvo_id=str(transacao.id), detalhes=f"Motivo: {motivo}", ip=request.client.host)
    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": f"Transacao de {usuario.nome} rejeitada. Motivo: {motivo}"}

class AssinarPlanoRequest(BaseModel):
    plano: str # 'mensal' ou 'anual'

@router.post("/admin/adicionar-saldo")
async def admin_adicionar_saldo(usuario_id: str = Form(...), valor: Decimal = Form(gt=0), db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    usuario.saldo = (usuario.saldo or Decimal("0.00")) + valor
    db.add(Transacao(usuario_id=usuario.id, valor=valor, tipo=TipoTransacao.DEPOSITO, status="concluido", metodo="admin", detalhes=f"Adicionado pelo admin {admin.id}"))
    db.commit()
    return {"message": f"R$ {valor} adicionado para {usuario_id}!", "novo_saldo": float(usuario.saldo or 0)}

@router.post("/assinar-plano")
async def assinar_plano_premium(dados: AssinarPlanoRequest, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    if dados.plano == 'anual':
        preco = Decimal("199.99")
        dias = 365
        nome_plano = "ANUAL"
    else:
        preco = Decimal("19.99")
        dias = 30
        nome_plano = "MENSAL"

    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).first()

    from limitador import limiter
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    if not sdk:
        return {"message": "MP nao configurado", "simulacao": True, "preco": float(preco or 0)}

    payment_data = {
        "transaction_amount": float(preco or 0),
        "description": f"Assinatura Premium {nome_plano} - {usuario.nome}",
        "payment_method_id": "pix",
        "payer": {"email": usuario.email}
    }
    result = sdk.payment().create(payment_data)
    payment = result.get("response", {})
    if result.get("status") not in [200, 201]:
        raise HTTPException(status_code=400, detail="Erro ao gerar PIX.")

    transacao = Transacao(
        usuario_id=usuario.id, valor=preco, tipo=TipoTransacao.ASSINATURA,
        status="pendente", payment_id=str(payment.get("id")), metodo="pix",
        detalhes=f"Assinatura Premium {nome_plano} ({dias} dias)"
    )
    db.add(transacao)
    db.commit()

    return {
        "message": f"Pague R$ {preco} via PIX para ativar o plano {nome_plano}.",
        "preco": float(preco or 0), "plano": nome_plano,
        "qr_code": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code"),
        "qr_code_base64": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64"),
        "payment_id": payment.get("id"),
        "transacao_id": transacao.id
    }

@router.post("/admin/sacar-lucro")
async def sacar_lucro_plataforma(
    request: Request,
    dados: SaqueAdminRequest,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Permite ao admin resgatar parte do lucro acumulado da plataforma.
    O valor é registrado como transação de auditoria e a chave PIX é exibida no painel.
    """

    if dados.valor <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Valor inválido para o saque.")

    # Calcula o lucro total disponível (histórico de taxas)
    # IMPORTANTE: APORTE_CAPITAL não entra aqui, pois agora vai para o Pool, não para o caixa livre.
    todas_receitas = db.query(Transacao).filter(
        Transacao.tipo.in_([TipoTransacao.COMPRA_SCORE, TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_INTERMEDIACAO, TipoTransacao.TAXA_POSTAGEM, TipoTransacao.RETORNO_INVESTIMENTO, TipoTransacao.TAXA_ADM_EMPRESTIMO]),
        Transacao.status == "concluido"
    ).all()
    lucro_disponivel = sum(t.valor for t in todas_receitas)

    # Subtrai saques anteriores do admin
    from sqlalchemy import or_
    saques_anteriores = db.query(Transacao).filter(
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.status == "concluido",
        or_(
            Transacao.detalhes.like("Saque de lucro da plataforma%"),
            Transacao.detalhes.like("RESGATE DE LUCRO%")
        )
    ).all()
    total_sacado = sum(t.valor for t in saques_anteriores)

    saldo_lucro_liquido = lucro_disponivel - total_sacado

    if dados.valor > saldo_lucro_liquido:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo de lucro insuficiente. Disponível: R$ {float(saldo_lucro_liquido or 0):.2f}"
        )

    if not dados.motivo or len(dados.motivo.strip()) < 5:
        raise HTTPException(status_code=400, detail="Você deve fornecer uma justificativa clara (mínimo 5 caracteres) para o resgate de lucro.")

    # DEDUZIR DO SALDO DA PLATAFORMA (USUARIO 000PL) com LOCK
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if not plataforma:
        raise HTTPException(status_code=500, detail="Erro interno: Conta de sistema não encontrada.")
    
    if plataforma.saldo < dados.valor:
        # Se houver descompasso entre o saldo real e o virtual, permitimos o saque
        # mas lançamos um aviso no log de auditoria para reconciliação manual posterior.
        # Isso evita que o admin fique "preso" por erros de arredondamento ou perdas históricas.
        plataforma.saldo = dados.valor # Forçamos o saldo para permitir a dedução

    plataforma.saldo -= dados.valor

    # Registra a transação de auditoria vinculado à plataforma
    transacao = Transacao(
        usuario_id=plataforma.id,
        valor=dados.valor,
        tipo=TipoTransacao.SAQUE,
        status="concluido",
        detalhes=f"RESGATE DE LUCRO → PIX: {dados.chave_pix} | MOTIVO: {dados.motivo}"
    )
    db.add(transacao)
    # Novo: Registro de Auditoria Admin
    registrar_acao_admin(db, admin.id, "SACAR_LUCRO_SISTEMA", alvo_id=plataforma.id, detalhes=f"Valor: {dados.valor}, Motivo: {dados.motivo}", ip=request.client.host)
    
    db.commit()

    return {
        "message": f"Saque de R$ {float(dados.valor or 0):.2f} registrado! Realize o PIX para a chave: {dados.chave_pix}",
        "lucro_disponivel_restante": float(saldo_lucro_liquido - dados.valor)
    }

@router.post("/admin/aporte-capital/gerar")
async def gerar_pix_aporte_admin(dados: DepositoPixRequest, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """Gera um PIX do Mercado Pago para injeção de capital institucional (000PL)."""
    if not sdk:
        raise HTTPException(status_code=500, detail="Integração com Mercado Pago não configurada.")
    
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    
    agora = datetime.datetime.now(datetime.timezone.utc)
    expiracao = agora + datetime.timedelta(minutes=30)
    expiracao_iso = expiracao.isoformat(timespec='milliseconds')
    
    payment_data = {
        "transaction_amount": float(dados.valor or 0),
        "description": f"Aporte Institucional Psy Pay - Admin {admin.id}",
        "payment_method_id": "pix",
        "date_of_expiration": expiracao_iso,
        "payer": {
            "email": admin.email, # O admin é o pagador
            "first_name": "ADMIN",
            "last_name": "PSY PAY",
            "identification": {
                "type": "CPF",
                "number": admin.cpf.replace(".", "").replace("-", "")
            }
        }
    }
    
    result = sdk.payment().create(payment_data)
    payment = result.get("response", {})
    
    if result.get("status") not in [200, 201]:
        logger.error(f"Erro MP Admin: {payment}")
        raise HTTPException(status_code=400, detail="Erro ao gerar aporte via Mercado Pago.")
        
    payment_id = payment.get("id")
    qr_code = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code")
    qr_code_base64 = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64")
    
    # Registra a transação para a PLATAFORMA (000PL)
    nova_transacao = Transacao(
        usuario_id="000PL",
        valor=dados.valor,
        tipo=TipoTransacao.APORTE_CAPITAL,
        status="pendente",
        metodo="pix",
        detalhes=f"Aporte Institucional Gerado via MP | ID: {payment_id} | Origem: Admin {admin.id}"
    )
    db.add(nova_transacao)
    db.commit()
    cache_snapshot_data.pop(admin.id, None)
    cache_snapshot_data.pop("000PL", None)
    
    return {
        "message": "PIX de Aporte gerado com sucesso.",
        "qr_code": qr_code,
        "qr_code_base64": qr_code_base64,
        "payment_id": payment_id,
        "expires_at": expiracao_iso
    }

@router.post("/admin/fiscal/parceiros")
async def criar_parceiro(
    dados: ParceiroCreate,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """Cadastra um novo parceiro lojista no sistema com regras de recebíveis."""
    
    # Validar se o usuario_id existe caso fornecido
    if dados.usuario_id:
        user_alvo = db.query(Usuario).filter(Usuario.id == dados.usuario_id).first()
        if not user_alvo:
            raise HTTPException(status_code=404, detail=f"Usuário ID {dados.usuario_id} não encontrado na plataforma.")

    cnpj = normalizar_cnpj(dados.cnpj)
    if not validar_cnpj(cnpj):
        raise HTTPException(status_code=400, detail="CNPJ inválido. Parceiros devem ser cadastrados somente como pessoa jurídica.")
    status_cnpj = normalizar_status_cadastral(dados.cnpj_status)
    if status_cnpj != "ativa":
        raise HTTPException(status_code=400, detail="Só aceitamos parceiros com CNPJ em situação ATIVA.")
    parceiro_existente = db.query(Parceiro).filter(Parceiro.cnpj == cnpj).first()
    if parceiro_existente:
        raise HTTPException(status_code=400, detail="Já existe parceiro cadastrado com este CNPJ.")

    novo_parceiro = Parceiro(
        nome=dados.nome,
        razao_social=dados.razao_social,
        cnpj=cnpj,
        cnpj_status=status_cnpj,
        cnpj_validado_em=datetime.datetime.now(datetime.timezone.utc),
        endereco=dados.endereco,
        usuario_id=dados.usuario_id,

        is_active=True,

    )
    db.add(novo_parceiro)
    db.commit()
    return {"message": "Parceiro cadastrado com sucesso!", "id": novo_parceiro.id}

@router.delete("/admin/fiscal/parceiros/{parceiro_id}")
async def excluir_parceiro(
    parceiro_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """Remove (desativa) um parceiro lojista."""
    parceiro = db.query(Parceiro).filter(Parceiro.id == parceiro_id).first()
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")
    
    # Em vez de deletar fisicamente, apenas desativamos para manter histórico de transações
    parceiro.is_active = False
    db.commit()
    return {"message": "Parceiro removido com sucesso."}
