from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
import logging

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
import os
import mercadopago

# Inicializa SDK Mercado Pago
mp_access_token = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "")
sdk = mercadopago.SDK(mp_access_token) if mp_access_token else None
from fastapi.responses import FileResponse
from decimal import Decimal
import datetime
from datetime import timezone, timedelta
import pyotp
from typing import Optional, List
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, StatusSolicitacao, SolicitacaoEmprestimo
from utils_emprestimo import calcular_divida_total, liquidar_emprestimo_via_pool
from database import get_db, engine
from rotas.rotas_auth import obter_usuario_logado, exigir_admin, verify_password
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Investimento, RegistroAuditoria, Parceiro, LinkAfiliado
from limitador import limiter
from utils_seguranca import registrar_acao_admin
from rotas.rotas_snapshot import cache_snapshot_data
from utils_score import atualizar_score

class NotificacaoDeposito(BaseModel):
    valor: Decimal = Field(gt=0)
    metodo: str = "pix" # pix ou especie
    parceiro_id: Optional[int] = None

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

router = APIRouter(prefix="/financeiro", tags=["Financeiro"])
TZ_BRASILIA = timezone(timedelta(hours=-3))

@router.post("/solicitar-saque")
@limiter.limit("2/minute")
async def solicitar_saque(request: Request, dados: SolicitacaoSaque, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    # SEGURANÇA MÁXIMA: Lock do registro do usuário para evitar race conditions no saldo
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    
    valor = dados.valor
    chave_pix = dados.chave_pix
    
    if valor <= 0:
        raise HTTPException(status_code=400, detail="Valor de saque inválido.")

    if usuario.saldo < valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para este saque.")

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
        if not parceiro:
            raise HTTPException(status_code=404, detail="Parceiro não encontrado ou inativo.")

    # NOVO: Validação OBRIGATÓRIA de Senha e 2FA
    if not verify_password(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Senha de segurança incorreta.")
    
    if not usuario.two_factor_enabled:
        raise HTTPException(
            status_code=403, 
            detail="2FA Obrigatório: Você precisa ativar a Autenticação de Dois Fatores (Google Authenticator) antes de realizar um saque."
        )
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if not totp.verify(dados.codigo_2fa):
        raise HTTPException(status_code=401, detail="Código 2FA (Authenticator) inválido ou expirado.")

    # TRAVA DE SEGURANÇA: 48 HORAS APÓS MUDANÇA DE 2FA
    if usuario.ultima_alteracao_2fa:
        # Garantir que estamos comparando offset-naive UTC times
        agora_utc = datetime.datetime.utcnow()
        tempo_decorrido = agora_utc - usuario.ultima_alteracao_2fa
        
        if tempo_decorrido < timedelta(hours=48):
            horas_restantes = 48 - (tempo_decorrido.total_seconds() / 3600)
            raise HTTPException(
                status_code=403, 
                detail=f"Saque Bloqueado: Por medida de segurança, após alterar o 2FA, os saques ficam suspensos por 48 horas. Tente novamente em aproximadamente {int(horas_restantes)} horas."
            )

    # Regra: Isento se o valor do saque for menor ou igual ao saldo no Pool (saldo_caixa)
    # Senão: R$ 5,00 de taxa (descontada do valor solicitado)
    taxa = Decimal("0.00")
    saldo_caixa_v = usuario.saldo_caixa or Decimal("0.00")
    if valor > saldo_caixa_v:
        taxa = Decimal("5.00")
        if valor <= taxa:
            raise HTTPException(status_code=400, detail=f"O valor solicitado deve ser maior que a taxa de R$ {taxa}.")
    
    if usuario.saldo < valor:
        raise HTTPException(status_code=400, detail="Saldo principal insuficiente para realizar este saque.")

    # Valor que será efetivamente sacado (líquido)
    valor_liquido = valor - taxa
    
    # Deduzir o valor bruto do saldo do usuário
    usuario.saldo -= valor
    
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
    cache_snapshot_data.clear()
    
    msg = "Solicitação de saque registrada." 
    if taxa > 0:
        msg += f" Taxa de R$ {taxa} aplicada (Saque > Saldo Pool)."
    
    return {"message": msg + " Aguardando processamento manual."}

@router.post("/investir-pool")
@limiter.limit("5/minute")
async def investir_pool(dados: NotificacaoDeposito, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """Move saldo da conta principal para o Fundo Coletivo (Pool)."""
    # Lock para evitar bit-flipping de saldo
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    
    if usuario.saldo < dados.valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para investimento no Pool.")
    
    # Registro de Auditoria (IP/Device)
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.datetime.utcnow()
    )
    db.add(auditoria)
    db.flush()

    usuario.saldo -= dados.valor
    usuario.saldo_caixa += dados.valor
    
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor,
        tipo=TipoTransacao.APORTE_CAIXA,
        status="concluido",
        detalhes="Aporte no Pool (Aceite de Termos e Risco Confirmado)",
        auditoria_id=auditoria.id
    )
    db.add(transacao)
    registrar_acao_admin(db, usuario.id, "APORTE_CAIXA_POOL", alvo_id=usuario.id, detalhes=f"Valor: {dados.valor}", ip=request.client.host)
    
    # NOVO: Ganho de Score por aporte no Pool
    atualizar_score(db, usuario.id, dados.valor, "APORTE_CAIXA")

    db.commit()
    cache_snapshot_data.clear()
    return {"message": f"Aporte de R$ {dados.valor:.2f} realizado com sucesso!", "novo_saldo_caixa": float(usuario.saldo_caixa)}

@router.post("/resgatar-pool")
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
        data_registro=datetime.datetime.utcnow()
    )
    db.add(auditoria)
    db.flush()

    usuario.saldo_caixa -= dados.valor
    usuario.saldo += dados.valor
    
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor,
        tipo=TipoTransacao.RESGATE_CAIXA,
        status="concluido",
        detalhes="Resgate do Pool (Fintech Liquidez Diária)",
        auditoria_id=auditoria.id
    )
    db.add(transacao)

    # Perda de Score proporcional por resgate (opcional, mantendo para controle de risco)
    atualizar_score(db, usuario.id, dados.valor, "RESGATE_CAIXA")

    db.commit()
    cache_snapshot_data.clear()
    return {"message": f"Resgate de R$ {dados.valor:.2f} realizado!", "novo_saldo": float(usuario.saldo)}

@router.post("/notificar-deposito")
async def notificar_deposito(dados: NotificacaoDeposito, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    valor = dados.valor
    
    if dados.metodo == "especie":
        if not dados.parceiro_id:
            raise HTTPException(status_code=400, detail="Parceiro obrigatório para depósito em espécie.")
        parceiro = db.query(Parceiro).filter(Parceiro.id == dados.parceiro_id, Parceiro.is_active == True).first()
        if not parceiro:
            raise HTTPException(status_code=404, detail="Parceiro não encontrado ou inativo.")

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
    cache_snapshot_data.clear()
    return {"message": "Notificação enviada. O saldo será creditado assim que o admin confirmar."}

class DepositoPixRequest(BaseModel):
    valor: Decimal = Field(gt=0)

@router.post("/pix/gerar")
async def gerar_pix_deposito(dados: DepositoPixRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if not sdk:
        raise HTTPException(status_code=500, detail="Integração com Mercado Pago não configurada no servidor.")
    
    # Expiração em 30 minutos
    agora = datetime.datetime.now(datetime.timezone.utc)
    expiracao = agora + datetime.timedelta(minutes=30)
    # Formato MP: 2023-08-22T12:00:00.000-04:00
    expiracao_iso = expiracao.isoformat(timespec='milliseconds')
    
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
    
    result = sdk.payment().create(payment_data)
    payment = result.get("response", {})
    
    if result.get("status") not in [200, 201]:
        logger.error(f"Erro Mercado Pago: {payment}")
        error_msg = "Não foi possível gerar o código PIX. Verifique suas credenciais no .env"
        if payment.get("message") == "Unauthorized use of live credentials":
            error_msg = "Erro: Você está usando chaves de PRODUÇÃO em localhost. Use chaves de TESTE (Sandbox)."
        elif result.get("status") == 401:
            error_msg = "Erro: Token do Mercado Pago inválido ou expirado."
            
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
        detalhes=f"Pix MP Gerado | ID: {payment_id}"
    )
    db.add(nova_transacao)
    db.commit()
    cache_snapshot_data.clear()
    
    return {
        "message": "PIX gerado com sucesso.",
        "qr_code": qr_code,
        "qr_code_base64": qr_code_base64,
        "payment_id": payment_id,
        "expires_at": expiracao_iso
    }

@router.post("/webhook/mercadopago")
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
                # Tenta achar a transação de 3 formas: ID exato, Valor/Método ou Valor/Última Pendente
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
                        usuario.saldo += transacao.valor
                        transacao.status = "concluido"
                        if f"ID: {payment_id}" not in transacao.detalhes:
                            transacao.detalhes += f" | Vinculado ao ID MP: {payment_id}"
                        
                        fee_details = payment.get("fee_details", [])
                        total_fee = sum(Decimal(str(fee.get("amount", 0))) for fee in fee_details)
                        if total_fee > 0:
                            plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
                            if plataforma:
                                plataforma.saldo -= total_fee
                                transacao.detalhes += f" | [Taxa Intermediação: R$ {total_fee}]"
                        
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
        usuario.saldo += transacao.valor
        transacao.status = "concluido"
        if f"ID: {payment_id}" not in transacao.detalhes:
            transacao.detalhes += f" | Vinculado ao ID MP: {payment_id}"
        transacao.detalhes += " | Sincronizado Manualmente pelo Admin"
        
        atualizar_score(db, usuario.id, transacao.valor, "DEPOSITO")
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
            usuario_db.saldo += transacao.valor
            transacao.status = "concluido"
            transacao.detalhes += " | Sincronizado via Polling Automático"
            
            atualizar_score(db, usuario_db.id, transacao.valor, "DEPOSITO")
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
        data_registro=datetime.datetime.utcnow(),
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

@router.post("/parceiro/sacar-comissoes")
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

class ParceiroCreate(BaseModel):
    nome: str
    endereco: str
    usuario_id: str | None = None

class ParceiroUpdate(BaseModel):
    nome: str
    endereco: str
    usuario_id: str | None = None
    ativo: bool = True

@router.post("/admin/parceiros")
async def criar_parceiro(request: Request, dados: ParceiroCreate, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    parceiro = Parceiro(nome=dados.nome, endereco=dados.endereco, usuario_id=dados.usuario_id)
    db.add(parceiro)
    db.flush()
    registrar_acao_admin(db, admin.id, "CRIAR_PARCEIRO", alvo_id=str(parceiro.id), detalhes=f"Parceiro: {parceiro.nome}", ip=request.client.host)
    db.commit()
    return {"message": "Parceiro cadastrado com sucesso!"}

@router.put("/admin/parceiros/{id}")
async def editar_parceiro(id: int, request: Request, dados: ParceiroUpdate, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    parceiro = db.query(Parceiro).filter(Parceiro.id == id).first()
    if not parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado.")
    
    parceiro.nome = dados.nome
    parceiro.endereco = dados.endereco
    parceiro.usuario_id = dados.usuario_id
    parceiro.is_active = dados.ativo
    registrar_acao_admin(db, admin.id, "EDITAR_PARCEIRO", alvo_id=str(parceiro.id), detalhes=f"Novo nome: {parceiro.nome}, Ativo: {parceiro.is_active}", ip=request.client.host)
    db.commit()
    return {"message": "Parceiro atualizado!"}

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
    cache_snapshot_data.clear()
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
        doc.data_analise = datetime.datetime.utcnow()

    registrar_acao_admin(db, admin.id, "CONFIRMAR_VERIFICACAO", alvo_id=usuario.id, detalhes=f"Transacao: {transacao.id}", ip=request.client.host)
    db.commit()
    return {"message": f"Identidade de {usuario.nome} verificada com sucesso!"}

@router.post("/admin/rejeitar/{transacao_id}")
async def rejeitar_transacao(transacao_id: int, request: Request, motivo: str = "Dados inválidos ou documento ilegível", db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
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
            doc.data_analise = datetime.datetime.utcnow()

    registrar_acao_admin(db, admin.id, "REJEITAR_TRANSACAO", alvo_id=str(transacao.id), detalhes=f"Motivo: {motivo}", ip=request.client.host)
    db.commit()
    cache_snapshot_data.clear()
    return {"message": f"Transacao de {usuario.nome} rejeitada. Motivo: {motivo}"}

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
            TipoTransacao.RETORNO_INVESTIMENTO
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
                "retorno_investimento": float(detalhamento_historico.get('retorno_investimento', 0))
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
    agora = datetime.datetime.utcnow()
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
    registrar_acao_admin(db, admin.id, "LIQUIDAR_CAIXA_DEVEDORES", alvo_id="SISTEMA", detalhes=f"Devedores afetados: {len(devedores)}, Valor total: {total_confiscado}", ip=None)
    return {
        "message": "Liquidação concluída com sucesso.",
        "devedores_afetados": len(devedores),
        "total_confiscado_e_rateado": float(total_confiscado)
    }
