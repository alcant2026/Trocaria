from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from decimal import Decimal
import datetime
import os
import secrets
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, DocumentoVerificacao
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
        
        
    # Salvar Arquivos Localmente de forma segura
    def salvar_arquivo(arquivo: UploadFile, tipo_doc: str) -> str:
        if not arquivo or not arquivo.filename: return None
        token = secrets.token_hex(8)
        extensao = arquivo.filename.split('.')[-1][:5]
        nome_seguro = f"{usuario.id}_{tipo_doc}_{token}.{extensao}"
        caminho_completo = os.path.join("uploads", nome_seguro)
        try:
            with open(caminho_completo, "wb") as f:
                f.write(arquivo.file.read())
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
        docs_existentes.data_envio = datetime.datetime.utcnow()
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
    return {"message": "Documentos enviados com sucesso! Aguarde a análise do administrador.", "saldo": float(usuario.saldo)}

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
