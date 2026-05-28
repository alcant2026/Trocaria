from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Body, Form
from sqlalchemy.orm import Session
from decimal import Decimal
import logging
from modelos.modelos_db import Usuario

PONTOS_POR_REAL_COMPRADOR = 3

def conceder_pontos_compra(db: Session, usuario: Usuario, valor_pago: Decimal, descricao: str):
    from utils_ranking import pontos_cashback
    tipo_map = {
        "assinatura premium": "assinatura",
        "verificacao KYC": "kyc_pago",
        "destaque de anuncio": "taxa_destaque",
        "boost de anuncio": "taxa_boost",
    }
    tipo = "taxa_publicacao"
    for key in tipo_map:
        if key in descricao.lower():
            tipo = tipo_map[key]
            break
    pontos_cashback(usuario.id, tipo, valor_pago, db)

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
import os
import mercadopago

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
import datetime
from datetime import timezone, timedelta
import uuid
import httpx
from modelos.modelos_db import (
    Usuario, Transacao, TipoTransacao, RegistroAuditoria
)
from database import get_db
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from limitador import limiter
from utils_seguranca import registrar_acao_admin
from rotas.rotas_snapshot import cache_snapshot_data

router = APIRouter(prefix="/financeiro", tags=["Financeiro"])

class AssinarPlanoRequest(BaseModel):
    plano: str

class SuspenderRequest(BaseModel):
    motivo: str

class DepositoPixRequest(BaseModel):
    valor: Decimal = Field(gt=0)

@router.get("/transacao/{transacao_id}/status")
async def status_transacao(transacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id, Transacao.usuario_id == usuario.id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transacao nao encontrada")
    return {"status": transacao.status, "id": transacao.id, "metodo": transacao.metodo}

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

@router.post("/webhook/mercadopago")
@limiter.limit("10/minute")
async def webhook_mercadopago(request: Request, db: Session = Depends(get_db)):
    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Payload invalido"}

    action = payload.get("action")
    type_ = payload.get("type")
    logger.info(f"WEBHOOK MP: Action={action}, Type={type_}")

    if (action and "payment" in action) or type_ == "payment":
        payment_id = payload.get("data", {}).get("id")
        if not payment_id:
            return {"status": "ignored"}

        sdk = get_sdk()
        if not sdk:
            return {"status": "error", "message": "MP nao configurado"}

        payment_info = sdk.payment().get(payment_id)
        if payment_info.get("status") == 200:
            payment = payment_info.get("response", {})
            status_mp = payment.get("status")
            valor_mp = Decimal(str(payment.get("transaction_amount")))

            if status_mp == "approved":
                transacao = db.query(Transacao).filter(Transacao.payment_id == str(payment_id)).first()
                if not transacao:
                    transacao = db.query(Transacao).filter(
                        Transacao.valor == valor_mp,
                        Transacao.status == "pendente",
                        Transacao.metodo == "pix"
                    ).order_by(Transacao.id.desc()).first()

                if transacao and transacao.status == "pendente":
                    usuario = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).with_for_update().first()
                    if not usuario:
                        return {"status": "error"}

                    agora = datetime.datetime.now(datetime.timezone.utc)

                    if transacao.tipo == TipoTransacao.ASSINATURA:
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
                        conceder_pontos_compra(db, usuario, valor_mp, "assinatura premium")
                        db.commit()
                        logger.info(f"ASSINATURA: Premium ativado para {usuario.nome}")
                        cache_snapshot_data.pop(usuario.id, None)

                    elif transacao.tipo == TipoTransacao.DESBLOQUEIO_DADOS:
                        usuario.is_verified = True
                        transacao.status = "concluido"
                        if not transacao.payment_id:
                            transacao.payment_id = str(payment_id)
                        transacao.detalhes = "Conta verificada apos pagamento KYC"
                        conceder_pontos_compra(db, usuario, valor_mp, "verificacao KYC")
                        db.commit()
                        logger.info(f"KYC: {usuario.nome} verificado")
                        cache_snapshot_data.pop(usuario.id, None)

                    elif transacao.tipo == TipoTransacao.TAXA_POSTAGEM:
                        from modelos.modelos_db import LinkAfiliado
                        if transacao.detalhes and "DESTAQUE_LINK:" in transacao.detalhes:
                            link_id = int(transacao.detalhes.split(":")[1])
                            link = db.query(LinkAfiliado).filter(LinkAfiliado.id == link_id).first()
                            if link:
                                link.is_boosted = True
                                link.visualizacoes_restantes += 1000
                                link.data_expiracao = agora + datetime.timedelta(days=7)
                                link.ponto_min = 1
                                link.ponto_max = 5
                            transacao.status = "concluido"
                            if not transacao.payment_id:
                                transacao.payment_id = str(payment_id)
                            conceder_pontos_compra(db, usuario, valor_mp, "destaque de anuncio")
                            db.commit()
                            logger.info(f"DESTAQUE: Link #{link_id} destacado")
                            cache_snapshot_data.pop(usuario.id, None)

                        elif transacao.detalhes and "BOOST_LINK:" in transacao.detalhes:
                            partes = transacao.detalhes.split(":")
                            link_id = int(partes[1])
                            pacote_id = int(partes[2])
                            from rotas.rotas_comunidade import PRECO_VIEWS
                            link = db.query(LinkAfiliado).filter(LinkAfiliado.id == link_id).first()
                            pacote = PRECO_VIEWS.get(pacote_id)
                            if link and pacote:
                                link.visualizacoes_restantes += pacote["views"]
                                link.data_expiracao = agora + datetime.timedelta(days=30)
                            transacao.status = "concluido"
                            if not transacao.payment_id:
                                transacao.payment_id = str(payment_id)
                            conceder_pontos_compra(db, usuario, valor_mp, "boost de anuncio")
                            db.commit()
                            logger.info(f"BOOST: Link #{link_id} + views")
                            cache_snapshot_data.pop(usuario.id, None)

                    elif transacao.tipo == TipoTransacao.TAXA_SERVICO:
                        transacao.status = "concluido"
                        if not transacao.payment_id:
                            transacao.payment_id = str(payment_id)
                        transacao.detalhes = (transacao.detalhes or "") + f" | Pago MP: {payment_id}"
                        # Reduzir comissao_devida do vendedor
                        if usuario.comissao_devida and usuario.comissao_devida > 0:
                            novo_saldo = max(usuario.comissao_devida - transacao.valor, Decimal("0"))
                            usuario.comissao_devida = novo_saldo
                            if novo_saldo == 0:
                                usuario.comissao_paga_em = agora
                        db.commit()
                        logger.info(f"COMISSAO: {usuario.nome} pagou R$ {float(transacao.valor):.2f}")
                        cache_snapshot_data.pop(usuario.id, None)

                    else:
                        transacao.status = "concluido"
                        if not transacao.payment_id:
                            transacao.payment_id = str(payment_id)
                        if f"ID: {payment_id}" not in (transacao.detalhes or ""):
                            transacao.detalhes = (transacao.detalhes or "") + f" | Vinculado ao ID MP: {payment_id}"
                        db.commit()
                        cache_snapshot_data.pop(usuario.id, None)

    return {"status": "success"}

@router.get("/admin/kyc-pendentes")
async def listar_kyc_pendentes(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import DocumentoVerificacao
    docs = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.status == "pendente").all()
    resultado = []
    for d in docs:
        resultado.append({
            "id": d.id,
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
        raise HTTPException(status_code=401, detail="Token ausente ou invalido")
    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Acesso negado")

    doc = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == usuario_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documentos nao encontrados")

    path = None
    if tipo_doc == "rg": path = doc.caminho_rg
    elif tipo_doc == "renda": path = doc.caminho_renda
    elif tipo_doc == "residencia": path = doc.caminho_residencia

    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado")
    return FileResponse(path)

@router.post("/admin/suspender/{usuario_id}")
async def suspender_usuario(usuario_id: str, dados: SuspenderRequest, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    if usuario.is_admin:
        raise HTTPException(status_code=403, detail="Nao e possivel suspender administradores.")
    usuario.is_active = False
    usuario.motivo_suspensao = dados.motivo
    usuario.data_suspensao = datetime.datetime.now(datetime.timezone.utc)
    registrar_acao_admin(db, admin.id, "SUSPENDER_USUARIO", alvo_id=usuario.id, detalhes=f"Motivo: {dados.motivo}", ip="admin")
    db.commit()
    return {"message": f"Usuario {usuario.nome} suspenso.", "is_active": False}

@router.post("/admin/reativar/{usuario_id}")
async def reativar_usuario(usuario_id: str, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    usuario.is_active = True
    usuario.motivo_suspensao = None
    usuario.data_suspensao = None
    registrar_acao_admin(db, admin.id, "REATIVAR_USUARIO", alvo_id=usuario.id, detalhes="Usuario reativado", ip="admin")
    db.commit()
    return {"message": f"Usuario {usuario.nome} reativado.", "is_active": True}

@router.get("/admin/denuncias")
async def listar_denuncias(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import DenunciaUsuario
    denuncias = db.query(DenunciaUsuario).filter(
        DenunciaUsuario.status == "pendente"
    ).order_by(DenunciaUsuario.data_denuncia.desc()).limit(50).all()
    return [{
        "id": d.id,
        "denunciante_nome": d.denunciante.nome,
        "denunciante_id": d.denunciante_id,
        "denunciado_nome": d.denunciado.nome,
        "denunciado_id": d.denunciado_id,
        "denunciado_is_active": d.denunciado.is_active,
        "motivo": d.motivo,
        "data": d.data_denuncia.isoformat()
    } for d in denuncias]

@router.post("/admin/denuncias/{denuncia_id}/revisar")
async def revisar_denuncia(denuncia_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import DenunciaUsuario
    denuncia = db.query(DenunciaUsuario).filter(DenunciaUsuario.id == denuncia_id).first()
    if not denuncia:
        raise HTTPException(status_code=404, detail="Denuncia nao encontrada.")
    denuncia.status = "revisado"
    db.commit()
    return {"message": "Denuncia marcada como revisada."}


@router.post("/admin/confirmar/{transacao_id}")
async def admin_confirmar_kyc(transacao_id: int, dados: dict = {}, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import Transacao, TipoTransacao, DocumentoVerificacao
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transacao nao encontrada.")
    if transacao.status != "pendente":
        raise HTTPException(status_code=400, detail="Transacao ja processada.")

    usuario = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

    agota_local = datetime.datetime.now(datetime.timezone.utc)
    usuario.is_verified = True
    transacao.status = "concluido"
    if not transacao.payment_id:
        transacao.payment_id = f"admin_{transacao_id}"

    doc = db.query(DocumentoVerificacao).filter(
        DocumentoVerificacao.usuario_id == usuario.id
    ).order_by(DocumentoVerificacao.id.desc()).first()
    if doc:
        doc.status = "aprovado"
        doc.data_analise = agota_local

    conceder_pontos_compra(db, usuario, transacao.valor, "verificacao KYC")

    from rotas.rotas_snapshot import cache_snapshot_data
    cache_snapshot_data.pop(usuario.id, None)

    db.commit()
    logger.info(f"✅ ADMIN: KYC aprovado para {usuario.nome} (transacao #{transacao_id})")
    return {"message": f"KYC de {usuario.nome} aprovado!"}


@router.post("/admin/rejeitar/{transacao_id}")
async def admin_rejeitar_kyc(transacao_id: int, dados: dict = {}, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    from modelos.modelos_db import Transacao, TipoTransacao, DocumentoVerificacao
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transacao nao encontrada.")
    if transacao.status != "pendente":
        raise HTTPException(status_code=400, detail="Transacao ja processada.")

    usuario = db.query(Usuario).filter(Usuario.id == transacao.usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

    agota_local = datetime.datetime.now(datetime.timezone.utc)
    transacao.status = "cancelado"
    motivo = dados.get("motivo", "Documento rejeitado pelo administrador.")

    doc = db.query(DocumentoVerificacao).filter(
        DocumentoVerificacao.usuario_id == usuario.id
    ).order_by(DocumentoVerificacao.id.desc()).first()
    if doc:
        doc.status = "rejeitado"
        doc.motivo_rejeicao = motivo
        doc.data_analise = agota_local

    from rotas.rotas_snapshot import cache_snapshot_data
    cache_snapshot_data.pop(usuario.id, None)

    db.commit()
    logger.info(f"❌ ADMIN: KYC rejeitado para {usuario.nome}: {motivo}")
    return {"message": f"KYC de {usuario.nome} rejeitado.", "motivo": motivo}
