from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from decimal import Decimal
import datetime
import os
import secrets
import re
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, DocumentoVerificacao
from database import get_db

from rotas.rotas_auth import obter_usuario_logado

router = APIRouter(prefix="/score", tags=["Score"])

TAXA_VERIFICACAO = Decimal("14.99")

import logging
logger = logging.getLogger(__name__)

def validar_email(email: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email))

def validar_telefone_br(telefone: str) -> bool:
    apenas_digitos = re.sub(r'\D', '', telefone)
    return len(apenas_digitos) in (10, 11)

class SolicitacaoVerificacao(BaseModel):
    detalhes: str = ""

@router.post("/solicitar-verificacao")
async def solicitar_verificacao_com_docs(
    detalhes: str = Form(""),
    foto_rg: UploadFile = File(None),
    foto_renda: UploadFile = File(None),
    foto_residencia: UploadFile = File(None),
    db: Session = Depends(get_db), 
    usuario_logado: Usuario = Depends(obter_usuario_logado)
):
    """
    O tomador solicita a verificação humana (Selo Verificado) de forma GRATUITA,
    submetendo os comprovantes de forma criptografada para análise do Admin.
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()

    if usuario.is_verified:
        raise HTTPException(status_code=400, detail="Sua conta já está verificada.")
        
    # Verificar se já existe documento pendente
    doc_pendente = db.query(DocumentoVerificacao).filter(
        DocumentoVerificacao.usuario_id == usuario.id,
        DocumentoVerificacao.status == "pendente"
    ).first()
    if doc_pendente:
        raise HTTPException(status_code=400, detail="Você já tem uma solicitação em análise.")

    # Verificação agora é gratuita para evitar atrito (Padrão Nubank/Inter)
    custo = Decimal("0.00")
    detalhe_pagamento = "Solicitação de Verificação (Grátis)"
        
        
    MAX_UPLOAD_SIZE = 5 * 1024 * 1024
    ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "application/pdf"}
    MAGIC_BYTES = {
        b'\x89PNG\r\n\x1a\n': 'image/png',
        b'\xff\xd8\xff': 'image/jpeg',
        b'%PDF': 'application/pdf',
    }

    def validar_magic_bytes(conteudo: bytes, content_type: str) -> bool:
        for magic, tipo in MAGIC_BYTES.items():
            if conteudo.startswith(magic):
                expected = {'image/png', 'image/jpeg', 'image/jpg'}.union({'application/pdf'})
                if content_type in {'image/png'} and tipo == 'image/png': return True
                if content_type in {'image/jpeg', 'image/jpg'} and tipo == 'image/jpeg': return True
                if content_type in {'application/pdf'} and tipo == 'application/pdf': return True
        return False

    def salvar_arquivo(arquivo: UploadFile, tipo_doc: str) -> str:
        if not arquivo or not arquivo.filename: return None
        if arquivo.content_type not in ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail=f"Formato nao permitido: {arquivo.content_type}. Use PNG, JPG ou PDF.")
        conteudo = arquivo.file.read()
        if len(conteudo) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail="Arquivo muito grande. Maximo de 5MB por arquivo.")
        if not validar_magic_bytes(conteudo, arquivo.content_type):
            raise HTTPException(status_code=400, detail="Arquivo invalido ou corrompido.")
        token = secrets.token_hex(8)
        extensao = arquivo.filename.split('.')[-1][:5]
        nome_seguro = f"{usuario.id}_{tipo_doc}_{token}.{extensao}"
        caminho_completo = os.path.join("uploads", nome_seguro)
        try:
            with open(caminho_completo, "wb") as f:
                f.write(conteudo)
            return caminho_completo
        except Exception as e:
            print("Erro ao salvar arquivo:", e)
            return None

    path_rg = salvar_arquivo(foto_rg, "rg")
    path_renda = salvar_arquivo(foto_renda, "renda")
    path_residencia = salvar_arquivo(foto_residencia, "residencia")

    # Registrar Transação (Histórico apenas)
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=Decimal("0.00"),
        tipo=TipoTransacao.DESBLOQUEIO_DADOS, 
        status="pendente",
        detalhes=f"{detalhe_pagamento}: {detalhes}" if detalhes else f"{detalhe_pagamento}"
    )
    db.add(nova_transacao)
    
    # Criar ou Atualizar Registro de Documento para o Painel Admin
    docs_existentes = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == usuario.id).first()
    
    if docs_existentes:
        docs_existentes.caminho_rg = path_rg
        docs_existentes.caminho_renda = path_renda
        docs_existentes.caminho_residencia = path_residencia
        docs_existentes.status = "pendente"
        docs_existentes.data_envio = datetime.datetime.now(datetime.timezone.utc)
        docs_existentes.data_analise = None
        docs_existentes.motivo_rejeicao = None
    else:
        novo_doc = DocumentoVerificacao(
            usuario_id=usuario.id,
            caminho_rg=path_rg,
            caminho_renda=path_renda,
            caminho_residencia=path_residencia,
            status="pendente"
        )
        db.add(novo_doc)

    db.commit()
    return {"message": "Documentos enviados com sucesso! Aguarde a analise do administrador.", "saldo": float(usuario.saldo or 0)}

@router.post("/gerar-taxa-verificacao")
async def gerar_taxa_verificacao(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    u = db.query(Usuario).filter(Usuario.id == usuario.id).first()
    if u.is_verified:
        raise HTTPException(status_code=400, detail="Conta ja verificada.")
    pendente = db.query(Transacao).filter(Transacao.usuario_id == u.id, Transacao.tipo == TipoTransacao.DESBLOQUEIO_DADOS, Transacao.status == "pendente").first()
    if pendente:
        raise HTTPException(status_code=400, detail="Pagamento pendente ja existe.")
    from utils_fintech import get_sdk
    sdk = get_sdk()
    if not sdk:
        raise HTTPException(status_code=503, detail="Gateway indisponivel.")
    try:
        p = sdk.payment().create({"transaction_amount": 14.99, "description": "Verificacao de Conta", "payment_method_id": "pix", "payer": {"email": u.email}})
        if not p or p.get("status") not in ("approved", "pending", "in_process"):
            raise HTTPException(status_code=502, detail="Erro ao gerar PIX.")
        t = Transacao(usuario_id=u.id, valor=Decimal("14.99"), tipo=TipoTransacao.DESBLOQUEIO_DADOS, status="pendente", payment_id=str(p["id"]), metodo="pix", detalhes="Taxa Verificacao KYC R$14,99")
        db.add(t); db.commit()
        qr = p.get("point_of_interaction", {}).get("transaction_data", {})
        return {"payment_id": p["id"], "transacao_id": t.id, "qr_code": qr.get("qr_code"), "qr_code_base64": qr.get("qr_code_base64"), "valor": 14.99}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

