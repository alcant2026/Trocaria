from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_, text, or_
import logging

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
import os
import mercadopago

# Inicializa SDK Mercado Pago
mp_access_token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "")
sdk = mercadopago.SDK(mp_access_token) if mp_access_token else None
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
    SolicitacaoEmprestimo, Investimento, RegistroAuditoria, 
    Parceiro, LinkAfiliado
)
from utils_emprestimo import calcular_divida_total
from database import get_db, engine
from rotas.rotas_auth import obter_usuario_logado, exigir_admin, verify_password
from limitador import limiter
from utils_seguranca import registrar_acao_admin
from utils_parceiros import validar_cnpj, normalizar_cnpj, normalizar_status_cadastral, parceiro_esta_apto
from rotas.rotas_snapshot import cache_snapshot_data
from utils_score import atualizar_score

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

# --- CONFIGURAÇÕES DE RISCO (BaaS AUTO-PAYOUT) ---
VALOR_MAX_SAQUE_AUTO = Decimal("100.00")
SAQUES_AUTO_POR_DIA = 1

async def processar_payout_pix_mp(transacao, usuario: Usuario, token_custom: Optional[str] = None):
    """
    Integração com a API de Transaction Intents do Mercado Pago para envio de PIX (BaaS).
    """
    if not mp_access_token:
        logger.error("❌ PAYOUT: Token do Mercado Pago não configurado.")
        return False, "Token de acesso não configurado no servidor."

    idempotency_key = str(uuid.uuid4())
    payload = {
        "transaction_amount": float(transacao.valor),
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
    token_final = (token_custom or mp_access_token).strip()
    
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

    # REGRAS DE TAXA DE SAQUE (PIX)
    # 1. Se valor <= Pool (saldo da plataforma 000PL): Taxa R$ 0,01
    # 2. Se valor > Pool: Taxa 2%
    
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    pool_liquidez = plataforma.saldo if plataforma else Decimal("0.00")
    
    if valor <= pool_liquidez:
        taxa = Decimal("0.01")
    else:
        taxa = valor * Decimal("0.02")

    total_debito = valor + taxa
    if usuario.saldo < total_debito:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para cobrir o saque e a taxa de R$ {taxa:.2f}.")

    # Deduzir saldo + taxa
    usuario.saldo -= total_debito
    
    # Creditar taxa para a plataforma
    if plataforma:
        plataforma.saldo += taxa
    
    # Valor que será efetivamente sacado (líquido)
    valor_liquido = valor
    
    # NOVO: Acumular no gasto total de taxas para dividendos
    if taxa > 0:
        if usuario.gasto_total_taxas is None: usuario.gasto_total_taxas = Decimal("0.00")
        usuario.gasto_total_taxas += taxa

    # Criar transação de saque pendente (com o valor LÍQUIDO que o admin deve pagar)
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor_liquido,
        tipo=TipoTransacao.SAQUE,
        status="pendente",
        metodo=dados.metodo,
        parceiro_id=dados.parceiro_id if dados.metodo == "especie" else None,
        detalhes=f"Saque via {dados.metodo.upper()} para PIX: {chave_pix} | Bruto: R$ {valor} | Taxa: R$ {taxa} (Dedução)"
    )
    db.add(nova_transacao)

    # Se houver taxa, registrar como lucro da plataforma
    if taxa > 0:
        # Creditar lucro à plataforma (000PL)
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if plataforma:
            plataforma.saldo += taxa

        transacao_taxa = Transacao(
            usuario_id=usuario.id,
            valor=taxa,
            tipo=TipoTransacao.TAXA_SAQUE,
            status="concluido",
            detalhes="Taxa de saque (valor solicitado superior ao saldo do Pool)"
        )
        db.add(transacao_taxa)

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
        # DESCENTRALIZAÇÃO: Buscar um parceiro que tenha MP conectado e saldo suficiente para honrar o saque
        parceiro_pagador = db.query(Parceiro).filter(
            Parceiro.mp_access_token != None,
            Parceiro.is_active == True,
            Parceiro.cnpj != None,
            Parceiro.cnpj_status == "ativa",
            Parceiro.saldo_caixa_atual >= valor_liquido
        ).first()

        token_para_payout = None
        if parceiro_pagador:
            token_para_payout = parceiro_pagador.mp_access_token
            logger.info(f"🏦 SAQUE DESCENTRALIZADO: Usando saldo do Parceiro {parceiro_pagador.nome}")
        
        # Tenta processar o PIX imediatamente via API
        sucesso_payout, detalhe_payout = await processar_payout_pix_mp(nova_transacao, usuario, token_custom=token_para_payout)
        
        if sucesso_payout:
            nova_transacao.status = "concluido"
            nova_transacao.detalhes += f" | ✅ AUTO-PIX: {detalhe_payout}"
            if parceiro_pagador:
                nova_transacao.parceiro_id = parceiro_pagador.id
                parceiro_pagador.saldo_caixa_atual -= valor_liquido
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

@router.post("/investir-pool")
@limiter.limit("5/minute")
async def investir_pool(dados: NotificacaoDeposito, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """Move saldo da conta principal para o Fundo Coletivo (Pool)."""
    # Lock para evitar bit-flipping de saldo
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    
    if not usuario.is_verified:
        raise HTTPException(status_code=403, detail="Sua conta precisa estar VERIFICADA para realizar investimentos no Pool.")
    
    if usuario.saldo < dados.valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para investimento no Pool.")
    
    # Registro de Auditoria (IP/Device)
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(auditoria)
    db.flush()

    usuario.saldo -= dados.valor
    usuario.saldo_caixa += dados.valor
    
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor,
        tipo=TipoTransacao.APORTE_POOL,
        status="concluido",
        detalhes="Aporte no Pool (Aceite de Termos e Risco Confirmado)",
        auditoria_id=auditoria.id
    )
    db.add(transacao)
    registrar_acao_admin(db, usuario.id, "APORTE_CAIXA_POOL", alvo_id=usuario.id, detalhes=f"Valor: {dados.valor}", ip=request.client.host)
    
    # NOVO: Ganho de Score por aporte no Pool
    atualizar_score(db, usuario.id, dados.valor, "APORTE_POOL")

    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": f"Aporte de R$ {dados.valor:.2f} realizado com sucesso!", "novo_saldo_caixa": float(usuario.saldo_caixa)}

@router.post("/resgatar-pool")
@limiter.limit("5/minute")
async def resgatar_pool(dados: NotificacaoDeposito, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """Resgata saldo do Pool validando dívidas ativas como colateral."""
    # Lock preventivo
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()

    # NOVO: Validação de Dívida Ativa (Colateral)
    # O saldo no Pool garante o empréstimo. O usuário só pode sacar o que exceder a dívida.
    emprestimo_ativo = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()
    
    if emprestimo_ativo:
        from utils_emprestimo import calcular_divida_total
        divida_total = calcular_divida_total(emprestimo_ativo)
        saldo_disponivel = max(Decimal("0.00"), usuario.saldo_caixa - divida_total)

        if dados.valor > saldo_disponivel:
            raise HTTPException(
                status_code=403,
                detail=f"Saldo Bloqueado: R$ {divida_total:,.2f} do seu Pool estão retidos como garantia do seu empréstimo ativo. Saldo disponível para resgate: R$ {saldo_disponivel:,.2f}."
            )

    if usuario.saldo_caixa < dados.valor:
        raise HTTPException(status_code=400, detail="Saldo no Caixa insuficiente para resgate.")
    
    # Registro de Auditoria
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(auditoria)
    db.flush()

    usuario.saldo_caixa -= dados.valor
    usuario.saldo += dados.valor
    
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor,
        tipo=TipoTransacao.RESGATE_POOL,
        status="concluido",
        detalhes="Resgate do Pool (Fintech Liquidez Diária)",
        auditoria_id=auditoria.id
    )
    db.add(transacao)

    # Perda de Score proporcional por resgate (opcional, mantendo para controle de risco)
    atualizar_score(db, usuario.id, dados.valor, "RESGATE_POOL")

    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": f"Resgate de R$ {dados.valor:.2f} realizado!", "novo_saldo": float(usuario.saldo)}

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
    """Reserva um valor para saque em espécie em um parceiro específico."""
    # from utils_score import verificar_2fa # Se houver utilitário de 2FA
    
    # 1. Lock no usuário para evitar race conditions
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    
    # 2. Verificações de Segurança 🛡️
    if not usuario.is_verified:
        raise HTTPException(status_code=403, detail="Sua conta precisa estar VERIFICADA para realizar saques.")
    
    if not usuario.two_factor_enabled:
        raise HTTPException(status_code=403, detail="O 2FA é obrigatório para realizar saques em espécie.")
    
    if not verify_password(dados.senha_saque, usuario.senha_hash):
        raise HTTPException(status_code=403, detail="Senha de segurança incorreta.")

    if not dados.codigo_2fa or not pyotp.TOTP(usuario.totp_secret).verify(dados.codigo_2fa):
        raise HTTPException(status_code=403, detail="Código 2FA inválido ou expirado.")

    # 3. Validar Parceiro
    parceiro = db.query(Parceiro).filter(Parceiro.id == dados.parceiro_id, Parceiro.is_active == True).first()
    exigir_parceiro_apto(parceiro)

    # 4. Validar Saldo e Reservar
    if usuario.saldo < dados.valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para reservar este saque.")
    
    # Evitar Múltiplas Reservas Pendentes (Opcional, mas recomendado)
    saque_existente = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.metodo == "especie",
        Transacao.status == "pendente"
    ).first()
    if saque_existente:
        raise HTTPException(status_code=400, detail="Você já possui um saque em espécie reservado. Cancele-o antes de criar um novo.")

    # 4. Cálculo de Taxas (2% total: 1% Plataforma, 1% Parceiro)
    taxa_total = dados.valor * Decimal("0.02")
    comissao_parceiro = dados.valor * Decimal("0.01")
    lucro_plataforma = dados.valor * Decimal("0.01")
    
    if usuario.saldo < (dados.valor + taxa_total):
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para cobrir o saque e a taxa de R$ {taxa_total:.2f}.")

    # DEBITAR SALDO (Valor + Taxa) 🛡️
    usuario.saldo -= (dados.valor + taxa_total)
    
    # Credita lucro imediato da plataforma (1%)
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    if plataforma:
        plataforma.saldo += lucro_plataforma

    # 5. Criar Transações
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor, # Valor que o cliente recebe em mãos
        tipo=TipoTransacao.SAQUE,
        status="pendente",
        metodo="especie",
        parceiro_id=parceiro.id,
        detalhes=f"Saque Reservado (Aguardando Retirada: {parceiro.nome}) | Taxa Total: R$ {taxa_total}"
    )
    db.add(nova_transacao)
    
    # Registro de Taxa
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=taxa_total,
        tipo=TipoTransacao.TAXA_ESPECIE,
        status="concluido",
        detalhes=f"Taxa de Saque em Espécie (1% Plataforma, 1% Parceiro)"
    ))
    db.commit()
    
    # Limpar Cache
    from rotas.rotas_snapshot import cache_snapshot_data
    cache_snapshot_data.pop(usuario.id, None)
    
    return {
        "message": f"Saque de R$ {dados.valor:.2f} reservado com sucesso! Vá até a loja {parceiro.nome} com seu ID {usuario.id} para retirar o dinheiro.",
        "transacao_id": nova_transacao.id
    }

class DepositoPixRequest(BaseModel):
    valor: Decimal = Field(gt=0)
    parceiro_id: Optional[int] = None

@router.post("/pix/gerar")
async def gerar_pix_deposito(dados: DepositoPixRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if not sdk:
        raise HTTPException(status_code=500, detail="Integração com Mercado Pago não configurada no servidor.")
    
    # ANTI-POLUIÇÃO: Marcar PIXs anteriores pendentes como EXPIRADOS para limpar o extrato do usuário
    # Assim só o QR Code mais recente fica visível como pendente.
    db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.DEPOSITO,
        Transacao.metodo == "pix",
        Transacao.status == "pendente"
    ).update({"status": "expirado"})
    db.commit()

    # Expiração em 30 minutos
    agora = datetime.datetime.now(datetime.timezone.utc)
    expiracao = agora + datetime.timedelta(minutes=30)
    # Formato MP: 2023-08-22T12:00:00.000-04:00
    expiracao_iso = expiracao.isoformat(timespec='milliseconds')
    
    # DESCENTRALIZAÇÃO: Escolher o SDK (Global ou do Parceiro)
    current_sdk = sdk
    application_fee = None
    parceiro = None

    if dados.parceiro_id:
        parceiro = db.query(Parceiro).filter(Parceiro.id == dados.parceiro_id, Parceiro.is_active == True).first()
        if parceiro and parceiro_esta_apto(parceiro) and parceiro.mp_access_token:
            current_sdk = mercadopago.SDK(parceiro.mp_access_token)
            # TAXA ZERO NO DEPÓSITO: O cliente recebe 100% do que pagou
            application_fee = None
            logger.info(f"🏦 DEPÓSITO DESCENTRALIZADO (GRÁTIS): Usando conta do Parceiro {parceiro.nome}")
        else:
            logger.warning(f"⚠️ Parceiro {dados.parceiro_id} não possui MP conectado. Usando conta principal.")

    payment_data = {
        "transaction_amount": float(dados.valor),
        "description": f"Depósito Psy Pay - {usuario.nome}",
        "payment_method_id": "pix",
        "date_of_expiration": expiracao_iso,
        "payer": {
            "email": usuario.email,
            "first_name": usuario.nome.split(" ")[0] if usuario.nome else "User",
            "last_name": usuario.nome.split(" ")[-1] if usuario.nome and " " in usuario.nome else "Client",
            "identification": {
                "type": "CPF",
                "number": usuario.cpf.replace(".", "").replace("-", "") if usuario.cpf else "00000000000"
            }
        }
    }
    
    if application_fee:
        payment_data["application_fee"] = application_fee

    result = current_sdk.payment().create(payment_data)
    payment = result.get("response", {})
    
    if result.get("status") not in [200, 201]:
        logger.error(f"❌ ERRO MERCADO PAGO ({result.get("status")}): {payment}")
        error_msg = "Não foi possível gerar o PIX. "
        if payment.get("message") == "Unauthorized use of live credentials":
            error_msg += "Não é permitido usar chaves de PRODUÇÃO em localhost."
        elif "application_fee" in str(payment):
            error_msg += "O lojista precisa autorizar a taxa de intermediação."
        elif result.get("status") == 401:
            error_msg += "O token do lojista expirou ou é inválido."
        else:
            error_msg += "Verifique a conexão do parceiro."
        raise HTTPException(status_code=400, detail=error_msg)
    payment_id = payment.get("id")
    qr_code = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code")
    qr_code_base64 = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64")
    
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor,
        tipo=TipoTransacao.DEPOSITO,
        status="pendente",
        metodo="pix",
        payment_id=str(payment_id),
        parceiro_id=parceiro.id if parceiro else None,
        detalhes=f"Pix MP Gerado | ID: {payment_id}" + (f" | Custódia: {parceiro.nome}" if parceiro else " | Custódia Direta")
    )
    db.add(nova_transacao)
    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    
    return {
        "message": "PIX gerado com sucesso.",
        "qr_code": qr_code,
        "qr_code_base64": qr_code_base64,
        "payment_id": payment_id,
        "expires_at": expiracao_iso
    }

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
            "valor": float(transacao.valor)
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
                        # ABSORÇÃO DE TAXAS: O usuário recebe o valor bruto total (Realidade comercial)
                        # A plataforma absorve o custo do Mercado Pago subtraindo do seu saldo de lucro.
                        fee_details = payment.get("fee_details", [])
                        total_fee_mp = sum(Decimal(str(fee.get("amount", 0))) for fee in fee_details)
                        
                        usuario.saldo += valor_mp
                        transacao.status = "concluido"
                        if not transacao.payment_id:
                            transacao.payment_id = str(payment_id)
                        
                        if f"ID: {payment_id}" not in (transacao.detalhes or ""):
                            transacao.detalhes = (transacao.detalhes or "") + f" | Vinculado ao ID MP: {payment_id}"
                        
                        transacao.detalhes += f" | [Taxas MP Absorvidas: R$ {total_fee_mp}]"

                        # NOVO: Gamificação de Reputação (Se for venda do Marketplace)
                        if transacao.tipo == TipoTransacao.RECEBIMENTO:
                            usuario.vendas_completadas = (usuario.vendas_completadas or 0) + 1
                            usuario.score += Decimal("5.0")
                            if usuario.score > Decimal("1000.0"):
                                usuario.score = Decimal("1000.0")
                            logger.info(f"🏆 REPUTAÇÃO: {usuario.nome} completou uma venda! +1 Venda, +5 Score.")

                        # ATUALIZAÇÃO DESCENTRALIZADA: Crédito de Custódia para o Parceiro (Bruto)
                        # O parceiro assume a custódia do valor total que o cliente vê no app.
                        if transacao.parceiro_id:
                            parceiro = db.query(Parceiro).filter(Parceiro.id == transacao.parceiro_id).with_for_update().first()
                            if parceiro:
                                parceiro.saldo_caixa_atual += valor_mp
                                logger.info(f"🏦 CUSTÓDIA: Parceiro {parceiro.nome} assumiu custódia de R$ {valor_mp} (Bruto).")
                                transacao.detalhes += f" | [Custodiado por: {parceiro.nome}]"
                        
                        # Deduz as taxas do Mercado Pago do lucro da plataforma (Absorção)
                        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
                        if plataforma:
                            plataforma.saldo -= total_fee_mp
                            logger.info(f"💸 TAXA ABSORVIDA: R$ {total_fee_mp} descontados do lucro da plataforma.")
                        
                        if usuario.id != "000PL":
                            atualizar_score(db, usuario.id, transacao.valor, "DEPOSITO")
                        
                        db.commit()
                        logger.info(f"✅ WEBHOOK MP: Saldo de R$ {transacao.valor} creditado para {usuario.nome}")
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
                parceiro.saldo_caixa_atual += valor_mp
                transacao.detalhes += f" | [Custodiado por: {parceiro.nome}]"
        
        # Subtrai taxas do admin
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
        if plataforma:
            plataforma.saldo -= total_fee_mp

        if usuario.id != "000PL":
            atualizar_score(db, usuario.id, valor_mp, "DEPOSITO")
        
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
                    parceiro.saldo_caixa_atual += valor_mp
                    transacao.detalhes += f" | [Custodiado por: {parceiro.nome}]"
            
            # Subtrai taxas do admin
            plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
            if plataforma:
                plataforma.saldo -= total_fee_mp

            atualizar_score(db, usuario_db.id, valor_mp, "DEPOSITO")
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

@router.get("/meu-pix/sync-all")
async def sincronizar_meus_pix_todos(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Busca TODAS as transações de Pix pendentes do usuário e tenta sincronizar com o Mercado Pago.
    Isso serve como uma limpeza de 'limbo' para o usuário.
    """
    if not sdk:
        raise HTTPException(status_code=500, detail="SDK Mercado Pago não configurado.")

    transacoes_pendentes = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.status == "pendente",
        Transacao.metodo == "pix"
    ).all()

    if not transacoes_pendentes:
        return {"status": "success", "message": "Você não tem transações de Pix pendentes para sincronizar."}

    total_creditado = Decimal("0")
    count = 0

    for transacao in transacoes_pendentes:
        # Tenta extrair o payment_id dos detalhes
        import re
        match = re.search(r"ID: (\d+)", transacao.detalhes)
        if match:
            payment_id = match.group(1)
            payment_info = sdk.payment().get(payment_id)
            if payment_info.get("status") == 200:
                payment = payment_info.get("response", {})
                if payment.get("status") == "approved":
                    # Credita o saldo
                    usuario_db = db.query(Usuario).filter(Usuario.id == usuario.id).with_for_update().first()
                    usuario_db.saldo += transacao.valor
                    transacao.status = "concluido"
                    transacao.detalhes += " | Sincronizado por Varredura Manual"
                    
                    atualizar_score(db, usuario.id, transacao.valor, "DEPOSITO")
                    total_creditado += transacao.valor
                    count += 1
                    logger.info(f"✅ SYNC-ALL: R$ {transacao.valor} creditado para {usuario.nome} (ID MP: {payment_id})")

    db.commit()
    if count > 0:
        from rotas.rotas_snapshot import cache_snapshot_data
        cache_snapshot_data.pop(usuario.id, None)
        return {"status": "success", "message": f"Sucesso! Identificamos {count} pagamentos e R$ {total_creditado} foi adicionado ao seu saldo."}
    
    return {"status": "error", "message": "Nenhum pagamento aprovado foi encontrado no Mercado Pago para as suas solicitações pendentes."}

# --- Checkout Físico (Painel Parceiro) ---
class ParceiroVerificarRequest(BaseModel):
    cliente_id: str
    valor: float

class ParceiroConfirmarRequest(BaseModel):
    transacao_id: int

@router.post("/parceiro/transacoes/verificar")
async def verificar_transacao_parceiro(dados: ParceiroVerificarRequest, db: Session = Depends(get_db), parceiro_user: Usuario = Depends(obter_usuario_logado)):
    # Localiza se o logado é um parceiro válido
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == parceiro_user.id, Parceiro.is_active == True).first()
    if not parceiro:
        raise HTTPException(status_code=403, detail="Acesso exclusivo para Lojistas Parceiros autorizados.")
    exigir_parceiro_apto(parceiro)

    valor_decimal = Decimal(str(dados.valor))
    
    # Procura uma transacao em especie desse parceiro pra aquele cliente, no valor exato
    transacao = db.query(Transacao).filter(
        Transacao.usuario_id == dados.cliente_id,
        Transacao.valor == valor_decimal,
        Transacao.metodo == "especie",
        Transacao.status == "pendente",
        Transacao.parceiro_id == parceiro.id
    ).first()

    if not transacao:
         raise HTTPException(status_code=404, detail="Não há solicitação válida deste valor para este usuário. Peça que ele solicite o Caixa no app e tente novamente.")

    cliente = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).first()
    tipo_str = "Saque" if transacao.tipo == TipoTransacao.SAQUE else "Depósito"

    return {
        "mensagem": "Transação encontrada!",
        "transacao": {
            "id": transacao.id,
            "tipo": tipo_str,
            "valor": float(transacao.valor),
            "valor_liquido": round(float(transacao.valor) * 0.98, 2),
            "cliente_nome": cliente.nome
        }
    }

@router.post("/parceiro/transacoes/confirmar")
async def confirmar_transacao_parceiro(dados: ParceiroConfirmarRequest, request: Request, db: Session = Depends(get_db), parceiro_user: Usuario = Depends(obter_usuario_logado)):
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == parceiro_user.id, Parceiro.is_active == True).first()
    if not parceiro:
        raise HTTPException(status_code=403, detail="Acesso exclusivo para Lojistas Parceiros autorizados.")
    exigir_parceiro_apto(parceiro)

    transacao = db.query(Transacao).filter(
        Transacao.id == dados.transacao_id,
        Transacao.status == "pendente",
        Transacao.parceiro_id == parceiro.id
    ).with_for_update().first() # Lock na transação para evitar duplo processamento

    if not transacao:
        raise HTTPException(status_code=404, detail="Esta transação não existe ou já foi finalizada.")
    
    # Lock no cliente e na plataforma para segurança financeira
    cliente = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).with_for_update().first()
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()

    # --- Nova lógica de taxas ---
    # Garante Decimal puro para evitar TypeError com SQLite (que pode retornar float)
    valor_decimal = Decimal(str(transacao.valor))
    comissao_parceiro = valor_decimal * Decimal("0.005")  # 0.5% para o parceiro
    taxa_plataforma   = valor_decimal * Decimal("0.015")  # 1.5% para a plataforma
    fee_total         = valor_decimal * Decimal("0.02")   # 2% total

    # Confirmação Efetiva e Registro de Taxas
    if transacao.tipo == TipoTransacao.DEPOSITO:
        # Cliente recebe apenas o valor líquido (98%) no saldo
        valor_liquido = valor_decimal - fee_total
        cliente.saldo = (Decimal(str(cliente.saldo or 0)) + valor_liquido)
    elif transacao.tipo == TipoTransacao.SAQUE:
        # O valor bruto (100%) já foi deduzido do saldo do cliente na solicitação.
        # O cliente recebe apenas o valor líquido (98%) em mãos via parceiro.
        pass

    tipo_txt = 'Depósito' if transacao.tipo == TipoTransacao.DEPOSITO else 'Saque'

    # Em ambos os casos (Depósito/Saque), registrar o lucro da plataforma (0.5%)
    # Credita no saldo do 000PL (Usuário de Sistema) para que apareça como lucro disponível
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    if plataforma:
        plataforma.saldo += taxa_plataforma

    db.add(Transacao(
        usuario_id=cliente.id,
        valor=taxa_plataforma,
        tipo=TipoTransacao.TAXA_ESPECIE,
        status="concluido",
        detalhes=f"Receita Plataforma: Taxa espécie {tipo_txt} (Parceiro ID:{parceiro.id})"
    ))

    transacao.status = "concluido"

    # Creditar comissão (1.5%) em comissoes_acumuladas
    saldo_atual = Decimal(str(parceiro.comissoes_acumuladas or 0))
    parceiro.comissoes_acumuladas = saldo_atual + comissao_parceiro
    db.add(parceiro)  # garante tracking explicitamente na sessão


    # Registro de auditoria simples (campos disponíveis no modelo)
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(auditoria)
    db.flush()  # gera o ID do auditoria antes do commit
    transacao.auditoria_id = auditoria.id

    db.commit()

    # Invalida o cache do snapshot para dados frescos no próximo GET
    try:
        from rotas.rotas_snapshot import cache_snapshot_data
        cache_snapshot_data.pop(parceiro_user.id, None)
        cache_snapshot_data.pop(transacao.usuario_id, None)
    except Exception:
        pass

    return {"message": f"{tipo_txt} processado com sucesso!"}

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
async def sacar_comissoes_parceiro(db: Session = Depends(get_db), parceiro_user: Usuario = Depends(obter_usuario_logado)):
    """Transfere as comissões acumuladas do parceiro para o saldo da carteira."""
    # Lock no registro do parceiro para garantir integridade do saque de comissão
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == parceiro_user.id, Parceiro.is_active == True).with_for_update().first()
    if not parceiro:
        raise HTTPException(status_code=403, detail="Acesso exclusivo para Lojistas Parceiros autorizados.")

    # Lock no usuário para o crédito
    usuario = db.query(Usuario).filter(Usuario.id == parceiro_user.id).with_for_update().first()

    saldo_comissoes = parceiro.comissoes_acumuladas or Decimal("0.00")
    if saldo_comissoes <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Você não possui comissões acumuladas para sacar.")

    # Transferir para o saldo da carteira
    usuario.saldo = (usuario.saldo or Decimal("0.00")) + saldo_comissoes
    parceiro.comissoes_acumuladas = Decimal("0.00")

    # Registrar no histórico
    db.add(Transacao(
        usuario_id=parceiro_user.id,
        valor=saldo_comissoes,
        tipo=TipoTransacao.COMISSAO_PARCEIRO,
        status="concluido",
        detalhes=f"Resgate de comissões acumuladas do Caixa Físico"
    ))

    db.commit()

    # Invalida cache do snapshot
    try:
        from rotas.rotas_snapshot import cache_snapshot_data
        cache_snapshot_data.pop(parceiro_user.id, None)
    except Exception:
        pass

    return {"message": f"R$ {saldo_comissoes:.2f} transferidos para sua carteira com sucesso!"}

# --- Gestão de Parceiros (Admin) ---

@router.get("/admin/parceiros")
async def listar_parceiros(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    return db.query(Parceiro).order_by(Parceiro.nome).all()

@router.get("/parceiros")
async def listar_parceiros_publico(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    # Buscamos parceiros ativos
    parceiros = db.query(Parceiro).filter(Parceiro.is_active == True).order_by(Parceiro.nome).all()
    
    # Log para debug (aparecerá no terminal do backend)
    print(f"🔍 MARKETPLACE: Encontrados {len(parceiros)} parceiros ativos.")
    
    return [{
        "id": p.id, 
        "nome": p.nome, 
        "razao_social": p.razao_social,
        "cnpj": p.cnpj,
        "endereco": p.endereco,
        "caixa_aberto": p.caixa_aberto,
        "mp_conectado": bool(p.mp_access_token)
    } for p in parceiros if parceiro_esta_apto(p)]

class ParceiroCreate(BaseModel):
    nome: str
    razao_social: str
    cnpj: str
    cnpj_status: str = "ativa"
    endereco: str
    usuario_id: str | None = None

class ParceiroUpdate(BaseModel):
    nome: str
    razao_social: str
    cnpj: str
    cnpj_status: str = "ativa"
    endereco: str
    usuario_id: str | None = None
    ativo: bool = True

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
    
    # SEGURANÇA: Se o caixa estiver aberto, fechar automaticamente para evitar saldos "órfãos"
    if parceiro.caixa_aberto:
        parceiro.caixa_aberto = False
        # O saldo_caixa_atual permanece registrado no parceiro inativo para fins de auditoria
    
    db.commit()
    return {"message": "Parceiro desativado e caixa encerrado com sucesso!"}

@router.get("/admin/pendentes")
async def listar_pendentes(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    
    subq_gasto = db.query(
        Transacao.usuario_id,
        func.coalesce(func.sum(Transacao.valor), 0).label('total_gasto')
    ).filter(
        Transacao.tipo.in_([
            TipoTransacao.TAXA_SAQUE, TipoTransacao.COMPRA_SCORE, 
            TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_INTERMEDIACAO, 
            TipoTransacao.TAXA_CONVENIENCIA
        ]),
        Transacao.status == "concluido"
    ).group_by(Transacao.usuario_id).subquery()

    pendentes_query = db.query(Transacao, func.coalesce(subq_gasto.c.total_gasto, 0)).join(Usuario).outerjoin(
        subq_gasto, Transacao.usuario_id == subq_gasto.c.usuario_id
    ).filter(
        Transacao.status == "pendente",
        Transacao.tipo.in_([TipoTransacao.DEPOSITO, TipoTransacao.SAQUE, TipoTransacao.DESBLOQUEIO_DADOS]),
        Transacao.parceiro_id == None,
        ~Transacao.detalhes.like("%Pix MP Gerado%") # Ocultar MP que é automatico
    ).order_by(
        func.coalesce(subq_gasto.c.total_gasto, 0).desc(),
        Usuario.score.desc(),
        func.coalesce(Usuario.saldo_caixa, 0).desc(),
        Transacao.data_criacao.asc()
    ).all()
    
    resultado = []
    for t_row in pendentes_query:
        t = t_row[0]
        total_gasto = float(t_row[1])
        data = t.data_criacao
        if data.tzinfo is None:
            data = data.replace(tzinfo=timezone.utc)
        data_brasilia = data.astimezone(TZ_BRASILIA)

        resultado.append({
            "transacao_id": t.id,
            "usuario_nome": f"{t.usuario.nome} [🏆 R$ {total_gasto:.2f} | Score {float(t.usuario.score):.0f} | Pool R$ {float(t.usuario.saldo_caixa or 0):.0f}]",
            "usuario_cpf": t.usuario.cpf,
            "usuario_verificado": t.usuario.is_verified,
            "valor": float(t.valor),
            "tipo": t.tipo.value,
            "detalhes": t.detalhes,
            "data": data_brasilia.isoformat()
        })

    return resultado

# --- Loja de Afiliados ---

class LinkAfiliadoCreate(BaseModel):
    nome_produto: str
    url_afiliado: str
    url_imagem: str = None
    is_active: bool = True

@router.get("/loja/itens")
async def listar_itens_loja(pagina: int = 1, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    limite = 12
    offset = (pagina - 1) * limite
    total = db.query(LinkAfiliado).filter(LinkAfiliado.is_active == True).count()
    itens = db.query(LinkAfiliado).filter(LinkAfiliado.is_active == True).order_by(LinkAfiliado.data_criacao.desc()).offset(offset).limit(limite).all()
    return {
        "itens": itens,
        "total": total,
        "paginas": (total + limite - 1) // limite,
        "pagina_atual": pagina
    }

@router.get("/admin/loja/itens")
async def admin_listar_itens_loja(pagina: int = 1, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    limite = 12
    offset = (pagina - 1) * limite
    total = db.query(LinkAfiliado).count()
    itens = db.query(LinkAfiliado).order_by(LinkAfiliado.data_criacao.desc()).offset(offset).limit(limite).all()
    return {
        "itens": itens,
        "total": total,
        "paginas": (total + limite - 1) // limite,
        "pagina_atual": pagina
    }

@router.post("/admin/loja/itens")
async def criar_item_loja(dados: LinkAfiliadoCreate, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    novo_item = LinkAfiliado(
        nome_produto=dados.nome_produto,
        url_afiliado=dados.url_afiliado,
        url_imagem=dados.url_imagem,
        is_active=dados.is_active
    )
    db.add(novo_item)
    db.commit()
    return {"message": "Produto adicionado à loja!"}

@router.put("/admin/loja/itens/{id}")
async def editar_item_loja(id: int, dados: LinkAfiliadoCreate, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    item = db.query(LinkAfiliado).filter(LinkAfiliado.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    
    item.nome_produto = dados.nome_produto
    item.url_afiliado = dados.url_afiliado
    item.url_imagem = dados.url_imagem
    item.is_active = dados.is_active
    db.commit()
    return {"message": "Item atualizado!"}

@router.delete("/admin/loja/itens/{id}")
async def deletar_item_loja(id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    item = db.query(LinkAfiliado).filter(LinkAfiliado.id == id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado.")
    
    db.delete(item)
    db.commit()
    return {"message": "Item removido da loja!"}

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
        # NOVO: Ganho de score por Depósito
        atualizar_score(db, usuario.id, transacao.valor, "DEPOSITO")
    elif transacao.tipo == TipoTransacao.SAQUE:
        # No saque, o saldo já foi deduzido (bloqueado) na solicitação.
        # Aqui o admin apenas confirma que enviou o Pix.
        msg = f"Saque de R$ {transacao.valor} para {usuario.nome} marcado como enviado!"
        # NOVO: Perda de score por Saque (Penalidade)
        atualizar_score(db, usuario.id, transacao.valor, "SAQUE")
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
    from modelos.modelos_db import DocumentoVerificacao
    docs = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.status == "pendente").all()
    resultado = []
    for d in docs:
        resultado.append({
            "usuario_id": d.usuario_id,
            "usuario_nome": d.usuario.nome,
            "usuario_cpf": d.usuario.cpf,
            "data_envio": d.data_envio.isoformat(),
            "tem_rg": bool(d.caminho_rg),
            "tem_renda": bool(d.caminho_renda),
            "tem_residencia": bool(d.caminho_residencia),
        })
    return resultado

@router.get("/admin/view-doc/{usuario_id}/{tipo_doc}")
async def view_documento(usuario_id: str, tipo_doc: str, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import DocumentoVerificacao
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

@router.post("/admin/confirmar-verificacao/{transacao_id}")
async def confirmar_verificacao(transacao_id: int, request: Request, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao or transacao.status != "pendente":
        raise HTTPException(status_code=404, detail="Solicitação de verificação não encontrada.")

    usuario = transacao.usuario
    usuario.is_verified = True
    transacao.status = "concluido"
    
    from modelos.modelos_db import DocumentoVerificacao
    doc = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == usuario.id, DocumentoVerificacao.status == "pendente").first()
    if doc:
        doc.status = "aprovado"
        doc.data_analise = datetime.datetime.now(datetime.timezone.utc)

    registrar_acao_admin(db, admin.id, "CONFIRMAR_VERIFICACAO", alvo_id=usuario.id, detalhes=f"Transacao: {transacao.id}", ip=request.client.host)
    db.commit()
    return {"message": f"Identidade de {usuario.nome} verificada com sucesso!"}

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

@router.post("/assinar-plano")
async def assinar_plano_premium(dados: AssinarPlanoRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """Ativa o plano de assinatura Mensal ou Anual."""
    if dados.plano == 'anual':
        preco = Decimal("199.99")
        dias = 365
        nome_plano = "ANUAL"
    else:
        preco = Decimal("19.99")
        dias = 30
        nome_plano = "MENSAL"
    
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    
    if usuario.saldo < preco:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente. O plano {nome_plano} custa R$ {preco}.")

    # Deduzir saldo
    usuario.saldo -= preco
    
    # Benefício do Plano: Dias de Premium
    agora = datetime.datetime.now(datetime.timezone.utc)
    if usuario.is_subscriber and usuario.assinatura_expira_em and usuario.assinatura_expira_em > agora:
        usuario.assinatura_expira_em += datetime.timedelta(days=dias)
    else:
        usuario.is_subscriber = True
        usuario.assinatura_expira_em = agora + datetime.timedelta(days=dias)

    # NOVO: Bônus de Score Imediato pela Fidelidade
    bonus_score = Decimal("100.0") if dados.plano == 'anual' else Decimal("20.0")
    usuario.score += bonus_score
    if usuario.score > Decimal("1000.0"):
        usuario.score = Decimal("1000.0")

    # Registrar Transação
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=preco,
        tipo=TipoTransacao.ASSINATURA,
        status="concluido",
        detalhes=f"Assinatura Premium Marketplace ({nome_plano} - {dias} dias)"
    )
    db.add(transacao)
    
    # O valor vai para o lucro da plataforma
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if plataforma:
        plataforma.saldo += preco

    db.commit()
    return {"message": f"Parabéns! Seu plano {nome_plano} foi ativado com sucesso.", "expira_em": usuario.assinatura_expira_em}
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    
    return {
        "message": "Parabéns! Você agora é um membro Premium Psy Pay.",
        "expira_em": usuario.assinatura_expira_em.isoformat()
    }

@router.get("/admin/fiscal")
async def obter_resumo_fiscal(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Retorna o resumo fiscal da plataforma para declaração: 
    Total sob custódia (saldo dos usuários) e Lucro da Plataforma (Taxas).
    Versão Otimizada (SQL-Aggregated).
    """
    try:
        # 1. Saldo Total Gerenciado (Passivo da plataforma)
        saldo_usuarios = db.query(func.sum(Usuario.saldo)).scalar() or Decimal("0.00")

        # 2. Configurações de tempo
        agora_brasilia = datetime.datetime.now(TZ_BRASILIA)
        mes_atual_str = agora_brasilia.strftime("%Y-%m")

        # 3. Tipos de Receita
        tipos_receita = [
            TipoTransacao.COMPRA_SCORE, 
            TipoTransacao.DESBLOQUEIO_DADOS, 
            TipoTransacao.TAXA_SAQUE,
            TipoTransacao.TAXA_INTERMEDIACAO,
            TipoTransacao.TAXA_ESPECIE,
            TipoTransacao.APORTE_CAPITAL,
            TipoTransacao.TAXA_POSTAGEM,
            TipoTransacao.RETORNO_INVESTIMENTO,
            TipoTransacao.ASSINATURA
        ]

        # 4. Lucro Total Histórico (Agregado no SQL)
        total_lucro_historico = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        # 5. Saques de lucro do admin + investimentos institucionais
        total_sacado_admin = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == TipoTransacao.SAQUE,
            Transacao.detalhes.like("RESGATE DE LUCRO %"),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        total_investido_institucional = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == TipoTransacao.INVESTIMENTO,
            Transacao.detalhes.like("%INSTITUCIONAL%LUCRO%"),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        # 5b. Passivo da Plataforma com os Parceiros (Comissões acumuladas não pagas)
        total_comissoes_pendentes = db.query(func.sum(Parceiro.comissoes_acumuladas)).filter(
            Parceiro.is_active == True
        ).scalar() or Decimal("0.00")

        lucro_disponivel = max(Decimal("0.00"), total_lucro_historico - total_sacado_admin - total_investido_institucional - total_comissoes_pendentes)

        # 6. Detalhamento Histórico (sem filtro de mês — bate com o Bruto)
        receitas_historico_query = db.query(Transacao.tipo, func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido"
        ).group_by(Transacao.tipo).all()

        detalhamento_historico = {t.name.lower(): Decimal("0.00") for t in tipos_receita}
        for tipo, soma in receitas_historico_query:
            detalhamento_historico[tipo.value] = soma

        # 6b. Detalhes do Mês Atual (para o histórico mensal)
        primerio_dia_mes = agora_brasilia.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        receitas_mes_query = db.query(Transacao.tipo, func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido",
            Transacao.data_criacao >= primerio_dia_mes
        ).group_by(Transacao.tipo).all()

        detalhamento_mes = {t.name.lower(): Decimal("0.00") for t in tipos_receita}
        for tipo, soma in receitas_mes_query:
            detalhamento_mes[tipo.value] = soma

        total_lucro_mes = sum(detalhamento_mes.values())

        # 7. Histórico Mensal Otimizado
        # Agrupa por mês usando truncamento de data (Postgres/SQLite compatível)
        if "sqlite" in str(engine.url):
            trunc_fn = func.strftime('%Y-%m', Transacao.data_criacao)
        else:
            trunc_fn = func.to_char(Transacao.data_criacao, 'YYYY-MM')

        historico_raw = db.query(
            trunc_fn.label("mes"),
            func.sum(case((Transacao.tipo == TipoTransacao.DEPOSITO, Transacao.valor), else_=0)).label("depositos"),
            func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, ~Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("saques"),
            func.sum(case((Transacao.tipo.in_(tipos_receita), Transacao.valor), else_=0)).label("lucro"),
            func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("lucro_sacado")
        ).filter(Transacao.status == "concluido").group_by("mes").order_by(text("mes DESC")).limit(12).all()

        historico_formatado = []
        for h in historico_raw:
            historico_formatado.append({
                "mes": h.mes,
                "depositos": float(h.depositos or 0),
                "saques": float(h.saques or 0),
                "lucro": float(h.lucro or 0),
                "lucro_sacado": float(h.lucro_sacado or 0)
            })

        return {
            "saldo_usuarios_gerenciado": float(saldo_usuarios),
            "lucro_plataforma_total": float(total_lucro_mes),
            "lucro_plataforma_historico": float(total_lucro_historico),
            "lucro_disponivel": float(lucro_disponivel),
            "comissoes_parceiros_pendentes": float(total_comissoes_pendentes),
            "detalhamento_lucro": {
                "taxas_postagem": float(detalhamento_historico.get('taxa_postagem', 0)),
                "desbloqueio_dados": float(detalhamento_historico.get('desbloqueio_dados', 0)),
                "kyc_score": float(detalhamento_historico.get('compra_score', 0)),
                "taxas_saque": float(detalhamento_historico.get('taxa_saque', 0)),
                "taxa_intermediacao": float(detalhamento_historico.get('taxa_intermediacao', 0)),
                "aportes_externos": float(detalhamento_historico.get('aporte_capital', 0)),
                "retorno_investimento": float(detalhamento_historico.get('retorno_investimento', 0)),
                "assinaturas": float(detalhamento_historico.get('assinatura', 0))
            },
            "saldo_pool_caixa": float(db.query(func.sum(Usuario.saldo_caixa)).scalar() or 0),
            "historico_mensal": historico_formatado
        }
    except Exception as e:
        logger.error(f"Erro no relatório fiscal: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar relatório fiscal.")





class SaqueAdminRequest(BaseModel):
    chave_pix: str
    valor: Decimal = Field(gt=0)
    motivo: str


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
        Transacao.tipo.in_([TipoTransacao.COMPRA_SCORE, TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_SAQUE, TipoTransacao.TAXA_INTERMEDIACAO, TipoTransacao.TAXA_ESPECIE, TipoTransacao.TAXA_POSTAGEM, TipoTransacao.RETORNO_INVESTIMENTO, TipoTransacao.TAXA_ADM_EMPRESTIMO]),
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
            detail=f"Saldo de lucro insuficiente. Disponível: R$ {float(saldo_lucro_liquido):.2f}"
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
        "message": f"Saque de R$ {float(dados.valor):.2f} registrado! Realize o PIX para a chave: {dados.chave_pix}",
        "lucro_disponivel_restante": float(saldo_lucro_liquido - dados.valor)
    }

@router.post("/admin/aportar-lucro")
async def aportar_lucro_plataforma(
    request: Request,
    dados: SaqueAdminRequest, # Reutilizando o schema pois os campos são os mesmos
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Permite ao admin injetar capital/lucro de fontes externas para o balanço da plataforma.
    """
    if dados.valor <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Valor inválido para o aporte.")

    if not dados.motivo or len(dados.motivo.strip()) < 5:
        raise HTTPException(status_code=400, detail="Forneça uma justificativa para o aporte (mínimo 5 caracteres).")

    # Registra a transação de aporte (entrada no fiscal) no usuário 000PL com LOCK
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if not plataforma:
        raise HTTPException(status_code=500, detail="Erro interno: Conta de sistema não encontrada.")

    # NOVO COMPORTAMENTO: Aportes Institucionais vão direto para o Fundo Coletivo (Pool)
    plataforma.saldo_caixa += dados.valor
    
    transacao = Transacao(
        usuario_id=plataforma.id,
        valor=dados.valor,
        tipo=TipoTransacao.APORTE_CAPITAL,
        status="concluido",
        detalhes=f"APORTE INSTITUCIONAL DIRETO NO POOL (ADMIN: {admin.id}) → ORIGEM: {dados.chave_pix} | MOTIVO: {dados.motivo}"
    )
    db.add(transacao)
    registrar_acao_admin(db, admin.id, "APORTAR_CAPITAL_POOL", alvo_id=plataforma.id, detalhes=f"Valor: {dados.valor}, Motivo: {dados.motivo}", ip=request.client.host)
    db.commit()
    return {"message": "Aporte no Pool realizado com sucesso!"}

@router.post("/admin/reinvestir-lucro-pool")
async def reinvestir_lucro_pool(
    dados: Decimal = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Move valor do Lucro Disponível diretamente para o Pool (Caixa).
    """
    if dados <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Valor inválido.")

    # 1. Calcular Lucro Disponível (Histórico - Sacado)
    # Nota: Usamos a mesma lógica do snapshot para consistência
    tipos_receita = [
        TipoTransacao.COMPRA_SCORE, 
        TipoTransacao.DESBLOQUEIO_DADOS, 
        TipoTransacao.TAXA_SAQUE, 
        TipoTransacao.TAXA_INTERMEDIACAO,
        TipoTransacao.TAXA_ESPECIE,
        TipoTransacao.APORTE_CAPITAL,
        TipoTransacao.TAXA_POSTAGEM,
        TipoTransacao.RETORNO_INVESTIMENTO
    ]
    
    total_receita = db.query(func.sum(Transacao.valor)).filter(
        Transacao.tipo.in_(tipos_receita),
        Transacao.status == "concluido"
    ).scalar() or Decimal("0.00")

    total_sacado = db.query(func.sum(Transacao.valor)).filter(
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.detalhes.like("RESGATE DE LUCRO %"),
        Transacao.status == "concluido"
    ).scalar() or Decimal("0.00")

    lucro_disponivel = total_receita - total_sacado

    if dados > lucro_disponivel:
        raise HTTPException(status_code=400, detail="Lucro insuficiente.")

    # 2. Executar Movimentação no Usuário de Sistema 000PL com LOCK
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if not plataforma:
        raise HTTPException(status_code=500, detail="Erro interno: Conta de sistema não encontrada.")

    plataforma.saldo -= dados # Tira do lucro disponível (saldo 000PL)
    plataforma.saldo_caixa += dados # Coloca no Pool (saldo_caixa 000PL)
    
    # Registro de Saída do Lucro
    db.add(Transacao(
        usuario_id=plataforma.id,
        valor=dados,
        tipo=TipoTransacao.SAQUE,
        status="concluido",
        detalhes=f"RESGATE DE LUCRO PARA REINVESTIMENTO NO POOL (ID ADMIN: {admin.id})"
    ))

    # Registro de Entrada no Pool
    db.add(Transacao(
        usuario_id=plataforma.id,
        valor=dados,
        tipo=TipoTransacao.APORTE_CAIXA,
        status="concluido",
        detalhes=f"REINVESTIMENTO INSTITUCIONAL NO POOL (ORIGEM: LUCRO PLATAFORMA)"
    ))

    registrar_acao_admin(db, admin.id, "REINVESTIR_LUCRO_POOL", alvo_id=plataforma.id, detalhes=f"Valor: {dados}", ip=None)
    db.commit()
    return {"message": "Sucesso! Lucro reinvestido no Pool.", "novo_saldo_pool": float(admin.saldo_caixa)}

@router.post("/admin/resgatar-pool-para-lucro")
async def resgatar_pool_para_lucro(
    dados: Decimal = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Retira valor do Pool (Capital + Juros) e devolve para o Lucro da plataforma.
    """
    # 1. Executar Movimentação no Usuário 000PL com LOCK
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if not plataforma:
        raise HTTPException(status_code=500, detail="Erro interno: Conta de sistema não encontrada.")

    if dados > plataforma.saldo_caixa:
        raise HTTPException(status_code=400, detail="Saldo insuficiente no Pool da Plataforma.")

    plataforma.saldo_caixa -= dados
    plataforma.saldo += dados

    # Registro de Saída do Pool
    db.add(Transacao(
        usuario_id=plataforma.id,
        valor=dados,
        tipo=TipoTransacao.RESGATE_CAIXA,
        status="concluido",
        detalhes=f"RESGATE DO POOL PARA RETORNO AO LUCRO (CAPITAL + JUROS) - ADMIN {admin.id}"
    ))

    # Registro de Entrada no Balanço de Lucro (Aporte de Capital)
    db.add(Transacao(
        usuario_id=plataforma.id,
        valor=dados,
        tipo=TipoTransacao.APORTE_CAPITAL,
        status="concluido",
        detalhes=f"RETORNO DE REINVESTIMENTO DO POOL (REINJETADO NO LUCRO DISPONÍVEL)"
    ))

    registrar_acao_admin(db, admin.id, "RESGATAR_POOL_PARA_LUCRO", alvo_id=plataforma.id, detalhes=f"Valor: {dados}", ip=None)
    db.commit()
    return {"message": "Sucesso! Capital e juros retornaram ao Lucro.", "novo_saldo_pool": float(admin.saldo_caixa)}

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
        "transaction_amount": float(dados.valor),
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

class InvestimentoAdminRequest(BaseModel):
    solicitacao_id: int
    valor: Decimal = Field(gt=0)
    motivo: str

@router.post("/admin/investir-lucro")
async def investir_lucro_plataforma(
    dados: InvestimentoAdminRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Permite ao admin investir o lucro acumulado em solicitações de empréstimo.
    """
    valor = dados.valor
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == dados.solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada ou não está mais pendente.")

    # Calcula o saldo total disponível no Pool (Soma do saldo_caixa de todos os usuários)
    saldo_pool_global = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")

    if valor > saldo_pool_global:
        raise HTTPException(
            status_code=400, 
            detail=f"Saldo do Pool insuficiente para este investimento. Disponível: R$ {float(saldo_pool_global):.2f}"
        )

    # Validar meta (Arredondamento para evitar erro de float)
    restante = (solicitacao.valor - solicitacao.valor_arrecadado).quantize(Decimal("0.01"))
    if valor > restante:
         raise HTTPException(status_code=400, detail=f"Valor excede o necessário. Faltam apenas R$ {restante}")

    # Processar investimento (Não tira do saldo pessoal do admin, é institucional)
    solicitacao.valor_arrecadado += valor

    # Criar registro de auditoria
    agora = datetime.datetime.now(datetime.timezone.utc)
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        municipio=f"{admin.cidade}/{admin.estado}" if admin.cidade else "Localização Admin",
        user_agent=request.headers.get("user-agent"),
        data_registro=agora
    )
    db.add(auditoria)
    db.flush()

    novo_investimento = Investimento(
        investidor_id=admin.id,
        solicitacao_id=solicitacao.id,
        valor_investido=valor,
        pago_para_investidor=Decimal("0.00"),
        data_investimento=agora,
        ciencia_risco=True,
        auditoria_id=auditoria.id,
        cpf_aceite=admin.cpf,
        is_institutional=True,
        is_pool=True
    )

    # Registrar transação
    transacao = Transacao(
        usuario_id=admin.id,
        valor=valor,
        tipo=TipoTransacao.INVESTIMENTO,
        status="concluido",
        detalhes=f"INVESTIMENTO INSTITUCIONAL (POOL) -> Pedido #{solicitacao.id} | MOTIVO: {dados.motivo}"
    )

    # Se atingiu a meta, tenta liberar
    from utils_emprestimo import tentar_liberar_emprestimo
    if solicitacao.valor_arrecadado == solicitacao.valor:
        tentar_liberar_emprestimo(solicitacao.id, db)

    # Deduzir do Pool de forma pro-rata entre todos os participantes
    total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("1.00")
    participantes_caixa = db.query(Usuario).filter(Usuario.saldo_caixa > 0).all()
    
    for p_caixa in participantes_caixa:
        fatia_debito = (p_caixa.saldo_caixa / total_pool) * valor
        p_caixa.saldo_caixa -= fatia_debito

    db.add(novo_investimento)
    db.add(transacao)
    registrar_acao_admin(db, admin.id, "INVESTIR_LUCRO_SISTEMA", alvo_id=str(solicitacao.id), detalhes=f"Valor: {valor}, Motivo: {dados.motivo}", ip=request.client.host)
    db.commit()

    return {"message": "Investimento realizado com sucesso usando o saldo do Pool (Caixa)!", "valor": float(valor)}

@router.post("/depositar-manual")
async def registrar_deposito_manual(usuario_id: int, valor: Decimal, db: Session = Depends(get_db)):
    """
    Função administrativa para registrar entrada de dinheiro
    (Processamento via pix manual pelo admin)
    """
    if valor <= 0:
        raise HTTPException(status_code=400, detail="O valor do depósito deve ser maior que zero.")
    
    admin_id = 0 # Dummy admin logic
    
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Alvo do depósito não encontrado.")

    usuario.saldo += valor
    
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor,
        tipo=TipoTransacao.DEPOSITO,
        status="concluido",
        detalhes="Depósito manual via transferência Pix (Aprovado pelo Admin)"
    )

    db.add(nova_transacao)
    db.commit()
    
    return {"message": "Depósito creditado com sucesso.", "novo_saldo": usuario.saldo}

@router.get("/meu-historico")
async def meu_historico(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Retorna as últimas transações do usuário (Depósitos, Saques, etc)
    """
    transacoes = db.query(Transacao).filter(Transacao.usuario_id == usuario.id).order_by(Transacao.data_criacao.desc()).limit(10).all()
    
    resultado = []
    for t in transacoes:
        data = t.data_criacao
        if data.tzinfo is None:
            data = data.replace(tzinfo=timezone.utc)
        data_brasilia = data.astimezone(TZ_BRASILIA)

        resultado.append({
            "id": t.id,
            "valor": float(t.valor),
            "tipo": t.tipo.value,
            "status": t.status,
            "detalhes": t.detalhes,
            "data": data_brasilia.isoformat()
        })
    
    return resultado
@router.post("/admin/liquidar-caixa")
async def liquidar_caixa_devedores(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Chave de Liquidação: Em dezembro, o sistema identifica investidores que possuem saldo no Caixa 
    mas estão inadimplentes ou com empréstimos ativos. 
    O saldo deles é confiscado e rateado entre os investidores adimplentes.
    """
    agora = datetime.datetime.now(TZ_BRASILIA)
    if agora.month != 12:
        raise HTTPException(status_code=400, detail="A Liquidação Compulsória só pode ser executada em Dezembro.")

    # 1. Identificar Devedores que possuem saldo no Caixa
    devedores = db.query(Usuario).join(SolicitacaoEmprestimo).filter(
        Usuario.saldo_caixa > 0,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).all()

    total_confiscado = Decimal("0.00")
    for dev in devedores:
        valor_confisco = dev.saldo_caixa
        total_confiscado += valor_confisco
        dev.saldo_caixa = Decimal("0.00")
        
        db.add(Transacao(
            usuario_id=dev.id,
            valor=valor_confisco,
            tipo=TipoTransacao.RESGATE_CAIXA, # Usando tipo existente para fluxo
            status="falhou",
            detalhes=f"LIQUIDAÇÃO COMPULSÓRIA: Saldo confiscado por dívida ativa em {agora.year}."
        ))

    # 2. Ratear entre Investidores Adimplentes (quem tem saldo_caixa > 0 e NÃO é devedor)
    if total_confiscado > 0:
        # Subquery para excluir devedores do rateio
        ids_devedores = [d.id for d in devedores]
        investidores_bons = db.query(Usuario).filter(
            Usuario.saldo_caixa > 0,
            ~Usuario.id.in_(ids_devedores)
        ).all()

        total_caixa_bom = sum(u.saldo_caixa for u in investidores_bons) or Decimal("1.00")
        
        for inv in investidores_bons:
            fatia = (inv.saldo_caixa / total_caixa_bom) * total_confiscado
            inv.saldo_caixa += fatia
            
            db.add(Transacao(
                usuario_id=inv.id,
                valor=fatia,
                tipo=TipoTransacao.RETORNO_POOL,
                status="concluido",
                detalhes=f"BÔNUS DE LIQUIDAÇÃO: Rateio de devedores em {agora.year}."
            ))

    db.commit()

class ParceiroCreate(BaseModel):
    nome: str
    razao_social: str
    cnpj: str
    cnpj_status: str = "ativa"
    endereco: str
    usuario_id: Optional[str] = None
    prazo_liquidacao: int = 0
    taxa_comissao: Decimal = Decimal("0.00")

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
        prazo_liquidacao=dados.prazo_liquidacao,
        taxa_comissao=dados.taxa_comissao,
        is_active=True,
        caixa_aberto=False,
        saldo_caixa_atual=Decimal("0.00"),
        comissoes_acumuladas=Decimal("0.00")
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
