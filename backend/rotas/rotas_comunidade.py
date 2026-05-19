from fastapi import APIRouter, Depends, HTTPException, status, Request, Header, UploadFile, File
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, func
from database import get_db
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import (
    Usuario, Transacao, TipoTransacao, LinkAfiliado, DenunciaLink, 
    AvaliacaoLink, HistoricoClique, DenunciaUsuario, ImagemAnuncio,
    OfertaAnuncio, BloqueioUsuario, ConfirmacaoVenda, AcordoTroca
)
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
import pyotp
import random
import os
import uuid
import hashlib
from limitador import limiter
from PIL import Image
import io

CATEGORIAS_VALIDAS = [
    "Geral", "Eletronicos", "Veiculos", "Imoveis", "Moda", 
    "Casa e Jardim", "Esportes", "Infantil", "Servicos", 
    "Empregos", "Animais", "Agro", "Industria"
]

LIMITE_TITULO = 90
LIMITE_DESCRICAO = 6000
MAX_IMAGENS = 6
MAX_IMAGEM_BYTES = 500 * 1024  # 500KB

router = APIRouter(prefix="/comunidade", tags=["Comunidade"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "anuncios")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _desativar_expirados(db: Session):
    agora = datetime.datetime.now(datetime.timezone.utc)
    db.query(LinkAfiliado).filter(
        LinkAfiliado.is_active == True,
        LinkAfiliado.data_expiracao != None,
        LinkAfiliado.data_expiracao < agora
    ).update({LinkAfiliado.is_active: False}, synchronize_session=False)
    db.commit()

def _detectar_duplicata(db: Session, usuario_id: str, nome_produto: str) -> bool:
    """Verifica se usuario ja tem anuncio ativo com titulo similar (case-insensitive, sem espacos extras)."""
    nome_normalizado = " ".join(nome_produto.lower().split())
    anuncios_ativos = db.query(LinkAfiliado).filter(
        LinkAfiliado.usuario_id == usuario_id,
        LinkAfiliado.is_active == True
    ).all()
    for a in anuncios_ativos:
        if " ".join(a.nome_produto.lower().split()) == nome_normalizado:
            return True
    return False

def _comprimir_imagem(file_bytes: bytes, filename: str) -> tuple:
    """Comprime imagem para max 500KB, max 1920px. Retorna (bytes_comprimidos, extensao)."""
    try:
        img = Image.open(io.BytesIO(file_bytes))
    except Exception:
        raise HTTPException(status_code=400, detail="Arquivo nao e uma imagem valida.")
    
    # Converter para RGB se necessario (PNG com transparencia)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    
    # Redimensionar se muito grande
    max_dim = 1920
    if max(img.size) > max_dim:
        ratio = max_dim / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    
    # Salvar com qualidade decrescente ate ficar < 500KB
    ext = "jpeg"
    quality = 85
    output = io.BytesIO()
    
    while quality > 20:
        output.seek(0)
        output.truncate()
        img.save(output, format="JPEG", quality=quality, optimize=True)
        if output.tell() <= MAX_IMAGEM_BYTES:
            break
        quality -= 10
    
    return output.getvalue(), ".jpg"


class LinkCreate(BaseModel):
    nome_produto: str = Field(..., min_length=3, max_length=LIMITE_TITULO)
    descricao: Optional[str] = ""
    categoria: Optional[str] = "Geral"
    url_afiliado: str
    valor: float = Field(..., gt=0)
    codigo_2fa: str = ""


class LinkUpdate(BaseModel):
    nome_produto: Optional[str] = None
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    url_afiliado: Optional[str] = None
    valor: Optional[float] = None


class DenunciaRequest(BaseModel):
    link_id: int
    motivo: str = ""


class AvaliarRequest(BaseModel):
    link_id: int
    nota: int = Field(..., ge=1, le=5)


class CompraViewsRequest(BaseModel):
    link_id: int
    pacote_id: int


class OfertaRequest(BaseModel):
    link_id: int
    valor_oferta: float = Field(..., gt=0)


class RespostaOfertaRequest(BaseModel):
    oferta_id: int
    acao: str  # "aceitar" ou "recusar"


class BloqueioRequest(BaseModel):
    usuario_bloqueado_id: str


PRECO_VIEWS = {
    1: {"views": 100, "preco": Decimal("1.00"), "label": "Basico", "ponto_min": 1, "ponto_max": 1},
    2: {"views": 500, "preco": Decimal("5.00"), "label": "Popular", "ponto_min": 1, "ponto_max": 2},
    3: {"views": 1500, "preco": Decimal("12.00"), "label": "Intermediario", "ponto_min": 1, "ponto_max": 3},
    4: {"views": 5000, "preco": Decimal("35.00"), "label": "Avancado", "ponto_min": 2, "ponto_max": 5},
}


# ==================== UPLOAD DE IMAGENS ====================

@router.post("/upload-imagem")
async def upload_imagem_anuncio(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    """Upload de imagem para anuncio. Comprime automaticamente. Max 6 imagens por anuncio."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Nome do arquivo e obrigatorio.")
    
    extensao = file.filename.lower().split('.')[-1] if '.' in file.filename else ''
    if extensao not in ('jpg', 'jpeg', 'png', 'gif', 'webp'):
        raise HTTPException(status_code=400, detail="Apenas imagens JPG, PNG, GIF ou WebP sao aceitas.")
    
    file_bytes = await file.read()
    if len(file_bytes) < 100:
        raise HTTPException(status_code=400, detail="Arquivo muito pequeno ou corrompido.")
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande. Maximo 5MB.")
    
    img_comprimida, ext = _comprimir_imagem(file_bytes, file.filename)
    
    nome_arquivo = f"{uuid.uuid4().hex}{ext}"
    caminho = os.path.join(UPLOAD_DIR, nome_arquivo)
    
    with open(caminho, "wb") as f:
        f.write(img_comprimida)
    
    url_imagem = f"/uploads/anuncios/{nome_arquivo}"
    
    return {"url_imagem": url_imagem, "tamanho_kb": len(img_comprimida) // 1024}


# ==================== POSTAR ANUNCIO ====================

@router.post("/postar-link")
@limiter.limit("2/minute")
async def postar_link_comunidade(request: Request, dados: LinkCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if dados.categoria not in CATEGORIAS_VALIDAS:
        raise HTTPException(status_code=400, detail=f"Categoria invalida. Opcoes: {', '.join(CATEGORIAS_VALIDAS)}")
    
    if len(dados.nome_produto) > LIMITE_TITULO:
        raise HTTPException(status_code=400, detail=f"Titulo muito longo. Maximo {LIMITE_TITULO} caracteres.")
    
    if dados.descricao and len(dados.descricao) > LIMITE_DESCRICAO:
        raise HTTPException(status_code=400, detail=f"Descricao muito longa. Maximo {LIMITE_DESCRICAO} caracteres.")
    
    if dados.valor <= 0:
        raise HTTPException(status_code=400, detail="Preco deve ser maior que zero.")
    
    if _detectar_duplicata(db, usuario.id, dados.nome_produto):
        raise HTTPException(status_code=400, detail="Voce ja possui um anuncio ativo com este titulo. Edite o existente ou aguarde a expiracao.")
    
    url_final = dados.url_afiliado.strip()
    if not url_final.lower().startswith(('http://', 'https://')):
        so_numeros = "".join(filter(str.isdigit, url_final))
        if 8 <= len(so_numeros) <= 13:
            if not so_numeros.startswith('55') and len(so_numeros) <= 11:
                so_numeros = '55' + so_numeros
            url_final = f"https://wa.me/{so_numeros}"

    if not usuario.two_factor_enabled or not usuario.totp_secret:
        raise HTTPException(status_code=403, detail="Para anunciar no Marketplace, ative a Autenticacao de Dois Fatores (Google Authenticator).")
    
    if not dados.codigo_2fa:
        raise HTTPException(status_code=400, detail="Codigo 2FA obrigatoria para postar anuncio.")
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if not totp.verify(dados.codigo_2fa):
        raise HTTPException(status_code=401, detail="Codigo 2FA invalido ou expirado.")
    
    total_ativos = db.query(LinkAfiliado).filter(LinkAfiliado.usuario_id == usuario.id, LinkAfiliado.is_active == True).count()
    if total_ativos >= 3:
        raise HTTPException(status_code=400, detail="Voce ja possui 3 links ativos. Impulsione um ou aguarde a expiracao.")

    hoje_inicio = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    anuncios_hoje = db.query(LinkAfiliado).filter(
        LinkAfiliado.usuario_id == usuario.id,
        LinkAfiliado.data_criacao >= hoje_inicio
    ).count()

    if anuncios_hoje >= 3:
        raise HTTPException(status_code=400, detail="Limite diario atingido. Maximo 3 anuncios por dia.")

    pontos_por_anuncio = [20, 10, 5]
    pontos_ganhos = pontos_por_anuncio[anuncios_hoje] if anuncios_hoje < len(pontos_por_anuncio) else 0

    novo_link = LinkAfiliado(
        nome_produto=dados.nome_produto.strip(),
        descricao=dados.descricao.strip() if dados.descricao else "",
        categoria=dados.categoria,
        url_afiliado=url_final,
        valor=Decimal(str(dados.valor)),
        usuario_id=usuario.id,
        cidade=usuario.cidade,
        estado=usuario.estado,
        visualizacoes_restantes=50,
        is_boosted=False,
        data_expiracao=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24)
    )
    
    db.add(novo_link)
    db.commit()
    db.refresh(novo_link)

    if pontos_ganhos > 0:
        from utils_ranking import adicionar_pontos
        adicionar_pontos(
            usuario_id=usuario.id,
            tipo="postagem",
            pontos=pontos_ganhos,
            db=db,
            detalhes=f"Postou anuncio #{novo_link.id} ({anuncios_hoje + 1}º do dia)"
        )

    return {
        "message": "Link postado com sucesso! Voce tem 24h e 50 visualizacoes de bonus.",
        "id": novo_link.id,
        "pontos_ganhos": pontos_ganhos,
        "anuncios_hoje": anuncios_hoje + 1,
        "limite_diario": 3
    }


# ==================== GERENCIAR IMAGENS DO ANUNCIO ====================

class AdicionarImagemRequest(BaseModel):
    link_id: int
    url_imagem: str

@router.post("/adicionar-imagem")
async def adicionar_imagem(dados: AdicionarImagemRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Adiciona URL de imagem a um anuncio (max 6)."""
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id, LinkAfiliado.usuario_id == usuario.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anuncio nao encontrado.")
    
    total_imagens = db.query(ImagemAnuncio).filter(ImagemAnuncio.link_id == link.id).count()
    if total_imagens >= MAX_IMAGENS:
        raise HTTPException(status_code=400, detail=f"Maximo de {MAX_IMAGENS} imagens por anuncio.")
    
    nova_imagem = ImagemAnuncio(
        link_id=link.id,
        caminho_arquivo=dados.url_imagem,
        ordem=total_imagens
    )
    db.add(nova_imagem)
    db.commit()
    
    return {"message": "Imagem adicionada!", "total_imagens": total_imagens + 1}


@router.delete("/remover-imagem/{imagem_id}")
async def remover_imagem(imagem_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Remove imagem de um anuncio."""
    imagem = db.query(ImagemAnuncio).filter(ImagemAnuncio.id == imagem_id).first()
    if not imagem:
        raise HTTPException(status_code=404, detail="Imagem nao encontrada.")
    
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == imagem.link_id, LinkAfiliado.usuario_id == usuario.id).first()
    if not link:
        raise HTTPException(status_code=403, detail="Voce nao pode remover esta imagem.")
    
    # Remover arquivo fisico
    caminho_completo = os.path.join(os.path.dirname(os.path.dirname(__file__)), imagem.caminho_arquivo.lstrip("/"))
    if os.path.exists(caminho_completo):
        os.remove(caminho_completo)
    
    db.delete(imagem)
    db.commit()
    
    return {"message": "Imagem removida!"}


# ==================== DESTAQUE E BOOST ====================

DESTAQUE_PRECO = Decimal("5.00")

class PixDestaqueRequest(BaseModel):
    link_id: int

@router.post("/gerar-pix-destaque")
async def gerar_pix_destaque(dados: PixDestaqueRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id, LinkAfiliado.usuario_id == usuario.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link nao encontrado.")
    pendente = db.query(Transacao).filter(Transacao.detalhes == f"DESTAQUE_LINK:{link.id}", Transacao.status == "pendente").first()
    if pendente:
        if pendente.payment_id:
            return {"payment_id": pendente.payment_id, "transacao_id": pendente.id, "qr_code": None, "qr_code_base64": None, "valor": float(DESTAQUE_PRECO or 0), "ja_existente": True}
        pendente.status = "cancelado"
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    if not sdk:
        raise HTTPException(status_code=503, detail="Gateway de pagamento indisponivel.")
    result = sdk.payment().create({"transaction_amount": float(DESTAQUE_PRECO or 0), "description": f"Destaque Link #{link.id}", "payment_method_id": "pix", "payer": {"email": usuario.email}})
    if result.get("status") not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Erro MP: {result.get('response', {}).get('message', 'erro desconhecido')}")
    payment = result["response"]
    t = Transacao(usuario_id=usuario.id, valor=DESTAQUE_PRECO, tipo=TipoTransacao.TAXA_POSTAGEM, status="pendente", payment_id=str(payment["id"]), metodo="pix", detalhes=f"DESTAQUE_LINK:{link.id}")
    db.add(t); db.commit()
    qr = payment.get("point_of_interaction", {}).get("transaction_data", {})
    return {"payment_id": payment["id"], "transacao_id": t.id, "qr_code": qr.get("qr_code"), "qr_code_base64": qr.get("qr_code_base64"), "valor": float(DESTAQUE_PRECO or 0)}


class PixBoostRequest(BaseModel):
    link_id: int
    pacote_id: int

@router.post("/gerar-pix-boost")
async def gerar_pix_boost(dados: PixBoostRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id, LinkAfiliado.usuario_id == usuario.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link nao encontrado.")
    pacote = PRECO_VIEWS.get(dados.pacote_id)
    if not pacote:
        raise HTTPException(status_code=400, detail="Pacote invalido.")
    pendente = db.query(Transacao).filter(Transacao.detalhes == f"BOOST_LINK:{link.id}:{dados.pacote_id}", Transacao.status == "pendente").first()
    if pendente:
        if pendente.payment_id:
            return {"payment_id": pendente.payment_id, "transacao_id": pendente.id, "qr_code": None, "qr_code_base64": None, "valor": float(pacote["preco"] or 0), "views": pacote["views"], "ja_existente": True}
        pendente.status = "cancelado"
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    if not sdk:
        raise HTTPException(status_code=503, detail="Gateway de pagamento indisponivel.")
    result = sdk.payment().create({"transaction_amount": float(pacote["preco"] or 0), "description": f"{pacote['views']} views - Link #{link.id}", "payment_method_id": "pix", "payer": {"email": usuario.email}})
    if result.get("status") not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Erro MP: {result.get('response', {}).get('message', 'erro desconhecido')}")
    payment = result["response"]
    t = Transacao(usuario_id=usuario.id, valor=pacote["preco"], tipo=TipoTransacao.TAXA_POSTAGEM, status="pendente", payment_id=str(payment["id"]), metodo="pix", detalhes=f"BOOST_LINK:{link.id}:{dados.pacote_id}")
    db.add(t); db.commit()
    qr = payment.get("point_of_interaction", {}).get("transaction_data", {})
    return {"payment_id": payment["id"], "transacao_id": t.id, "qr_code": qr.get("qr_code"), "qr_code_base64": qr.get("qr_code_base64"), "valor": float(pacote["preco"] or 0), "views": pacote["views"]}


@router.post("/comprar-views")
async def comprar_views_ads(dados: CompraViewsRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id, LinkAfiliado.usuario_id == usuario.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link nao encontrado.")
    pacote = PRECO_VIEWS.get(dados.pacote_id)
    if not pacote:
        raise HTTPException(status_code=400, detail="Pacote invalido.")
    raise HTTPException(status_code=410, detail="Sistema de saldo descontinuado. Use pagamento via PIX direto.")


# ==================== MEUS LINKS ====================

@router.get("/meus-links")
async def obter_meus_links(page: int = 1, limit: int = 12, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    _desativar_expirados(db)
    offset = (page - 1) * limit
    query = db.query(LinkAfiliado).filter(LinkAfiliado.usuario_id == usuario.id)
    total = query.count()
    links = query.order_by(LinkAfiliado.data_criacao.desc()).offset(offset).limit(limit).all()
    
    return {
        "links": [{
            "id": l.id,
            "nome_produto": l.nome_produto,
            "descricao": l.descricao or "",
            "categoria": l.categoria or "Geral",
            "valor": float(l.valor or 0) if l.valor else 0.00,
            "url_afiliado": l.url_afiliado,
            "imagens": [img.caminho_arquivo for img in sorted(l.imagens, key=lambda x: x.ordem)],
            "views_restantes": l.visualizacoes_restantes,
            "views_totais": l.visualizacoes_totais,
            "is_boosted": l.is_boosted,
            "ponto_max": int(l.ponto_max or 1),
            "nota": float(l.nota or 0) if l.nota else 0.0,
            "vendas_texto": l.vendas_texto or "",
            "expires_at": l.data_expiracao.isoformat() if l.data_expiracao else None,
            "is_active": l.is_active,
            "venda_pendente": db.query(ConfirmacaoVenda).filter(
                ConfirmacaoVenda.link_id == l.id,
                ConfirmacaoVenda.status == "pendente"
            ).first() is not None
        } for l in links],
        "total": total,
        "page": page,
        "has_more": (offset + len(links)) < total
    }


@router.post("/marcar-vendido/{link_id}")
async def marcar_como_vendido(link_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Vendedor inicia processo de venda. Aguarda confirmacao do comprador."""
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == link_id, LinkAfiliado.usuario_id == usuario.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anuncio nao encontrado.")
    
    # Verificar se ja existe confirmacao pendente
    existente = db.query(ConfirmacaoVenda).filter(
        ConfirmacaoVenda.link_id == link_id,
        ConfirmacaoVenda.status == "pendente"
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ja existe uma venda pendente para este anuncio.")
    
    link.is_active = False
    
    agora = datetime.datetime.now(datetime.timezone.utc)
    confirmacao = ConfirmacaoVenda(
        link_id=link_id,
        vendedor_id=usuario.id,
        comprador_id="system",  # Sera atualizado quando comprador confirmar
        vendedor_confirmou=True,
        data_confirmacao_vendedor=agora,
        data_expiracao=agora + datetime.timedelta(hours=48)
    )
    db.add(confirmacao)
    db.commit()
    
    return {
        "message": "Venda iniciada! Compartilhe o codigo de confirmacao com o comprador.",
        "codigo_confirmacao": confirmacao.id,
        "expira_em": confirmacao.data_expiracao.isoformat()
    }


class ConfirmarRecebimentoRequest(BaseModel):
    confirmacao_id: int
    avaliacao: int = Field(..., ge=1, le=5)

@router.post("/confirmar-recebimento")
async def confirmar_recebimento(dados: ConfirmarRecebimentoRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Comprador confirma que recebeu o produto. Completa a venda bilateral."""
    confirmacao = db.query(ConfirmacaoVenda).filter(ConfirmacaoVenda.id == dados.confirmacao_id).first()
    if not confirmacao:
        raise HTTPException(status_code=404, detail="Confirmacao nao encontrada.")
    
    if confirmacao.status != "pendente":
        raise HTTPException(status_code=400, detail="Esta confirmacao ja foi processada.")
    
    if confirmacao.data_expiracao < datetime.datetime.now(datetime.timezone.utc):
        confirmacao.status = "expirada"
        db.commit()
        raise HTTPException(status_code=400, detail="Codigo de confirmacao expirou (48h).")
    
    if confirmacao.comprador_id != "system" and confirmacao.comprador_id != usuario.id:
        raise HTTPException(status_code=403, detail="Apenas o comprador pode confirmar este recebimento.")
    
    # Registrar confirmacao do comprador
    confirmacao.comprador_confirmou = True
    confirmacao.comprador_id = usuario.id
    confirmacao.data_confirmacao_comprador = datetime.datetime.now(datetime.timezone.utc)
    confirmacao.avaliacao_comprador = dados.avaliacao
    confirmacao.status = "confirmada"
    
    # Atualizar score do vendedor (+3 por venda confirmada)
    vendedor = db.query(Usuario).filter(Usuario.id == confirmacao.vendedor_id).first()
    if vendedor:
        vendedor.score = min((vendedor.score or 0) + 3, 1000)
        vendedor.vendas_completadas = (vendedor.vendas_completadas or 0) + 1
    
    # Atualizar score do comprador (+2 por boa faith)
    usuario.score = min((usuario.score or 0) + 2, 1000)
    
    # Atualizar nota do anuncio com a avaliacao do comprador
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == confirmacao.link_id).first()
    if link:
        if link.total_avaliacoes and link.total_avaliacoes > 0:
            nova_media = ((float(link.nota or 0) * link.total_avaliacoes) + dados.avaliacao) / (link.total_avaliacoes + 1)
            link.nota = Decimal(str(round(nova_media, 1)))
            link.total_avaliacoes += 1
        else:
            link.nota = Decimal(str(dados.avaliacao))
            link.total_avaliacoes = 1
    
    db.commit()
    
    return {
        "message": "Recebimento confirmado! Venda concluida com sucesso.",
        "score_vendedor": float(vendedor.score or 0) if vendedor else 0,
        "seu_score": float(usuario.score or 0)
    }


class AvaliarVendedorRequest(BaseModel):
    confirmacao_id: int
    avaliacao: int = Field(..., ge=1, le=5)

@router.post("/avaliar-venda")
async def avaliar_venda(dados: AvaliarVendedorRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Vendedor avalia o comprador apos confirmacao bilateral."""
    confirmacao = db.query(ConfirmacaoVenda).filter(ConfirmacaoVenda.id == dados.confirmacao_id).first()
    if not confirmacao:
        raise HTTPException(status_code=404, detail="Confirmacao nao encontrada.")
    
    if confirmacao.status != "confirmada":
        raise HTTPException(status_code=400, detail="Venda ainda nao foi confirmada pelo comprador.")
    
    if confirmacao.vendedor_id != usuario.id:
        raise HTTPException(status_code=403, detail="Apenas o vendedor pode avaliar.")
    
    if confirmacao.avaliacao_vendedor:
        raise HTTPException(status_code=400, detail="Voce ja avaliou este comprador.")
    
    confirmacao.avaliacao_vendedor = dados.avaliacao
    
    # Bonus score para comprador se avaliacao for positiva
    if dados.avaliacao >= 4:
        comprador = db.query(Usuario).filter(Usuario.id == confirmacao.comprador_id).first()
        if comprador:
            comprador.score = min((comprador.score or 0) + 1, 1000)
    
    db.commit()
    return {"message": "Avaliacao registrada!"}


@router.get("/minhas-vendas-pendentes")
async def minhas_vendas_pendentes(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Retorna vendas pendentes do usuario (como vendedor ou comprador)."""
    agora = datetime.datetime.now(datetime.timezone.utc)
    
    # Expirar pendentes
    db.query(ConfirmacaoVenda).filter(
        ConfirmacaoVenda.status == "pendente",
        ConfirmacaoVenda.data_expiracao < agora
    ).update({"status": "expirada"}, synchronize_session=False)
    db.commit()
    
    # Como vendedor
    como_vendedor = db.query(ConfirmacaoVenda).options(
        joinedload(ConfirmacaoVenda.link)
    ).filter(
        ConfirmacaoVenda.vendedor_id == usuario.id,
        ConfirmacaoVenda.status.in_(["pendente", "confirmada"])
    ).order_by(ConfirmacaoVenda.data_criacao.desc()).all()
    
    # Como comprador
    como_comprador = db.query(ConfirmacaoVenda).options(
        joinedload(ConfirmacaoVenda.link)
    ).filter(
        ConfirmacaoVenda.comprador_id == usuario.id,
        ConfirmacaoVenda.status.in_(["pendente", "confirmada"])
    ).order_by(ConfirmacaoVenda.data_criacao.desc()).all()
    
    return {
        "como_vendedor": [{
            "id": c.id,
            "link_id": c.link_id,
            "produto": c.link.nome_produto if c.link else "N/D",
            "status": c.status,
            "comprador_confirmou": c.comprador_confirmou,
            "avaliacao_comprador": c.avaliacao_comprador,
            "avaliacao_vendedor": c.avaliacao_vendedor,
            "data_criacao": c.data_criacao.isoformat(),
            "expira_em": c.data_expiracao.isoformat()
        } for c in como_vendedor],
        "como_comprador": [{
            "id": c.id,
            "link_id": c.link_id,
            "produto": c.link.nome_produto if c.link else "N/D",
            "vendedor_confirmou": c.vendedor_confirmou,
            "status": c.status,
            "avaliacao_comprador": c.avaliacao_comprador,
            "avaliacao_vendedor": c.avaliacao_vendedor,
            "data_criacao": c.data_criacao.isoformat(),
            "expira_em": c.data_expiracao.isoformat()
        } for c in como_comprador]
    }


@router.get("/nivel-confianca/{usuario_id}")
async def obter_nivel_confianca(usuario_id: str, db: Session = Depends(get_db)):
    """Retorna nivel de confianca e badge visual do usuario."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    
    score = float(usuario.score or 0)
    
    if score >= 900:
        nivel = "elite"
        label = "Elite Trocaria"
        cor = "#FFD700"
        icone = "Gem"
    elif score >= 700:
        nivel = "confiavel"
        label = "Confiavel"
        cor = "#25D366"
        icone = "BadgeCheck"
    elif score >= 300:
        nivel = "em_construcao"
        label = "Em Construcao"
        cor = "#FFD600"
        icone = "Sprout"
    else:
        nivel = "risco"
        label = "Risco"
        cor = "#FF3D00"
        icone = "AlertTriangle"
    
    # Verificar se esta no top 10 do ranking
    from utils_ranking import calcular_ranking_completo
    ranking = calcular_ranking_completo(db)
    posicao = None
    for i, r in enumerate(ranking):
        if r["usuario_id"] == usuario_id:
            posicao = i + 1
            break
    
    is_lenda = posicao is not None and posicao <= 10
    
    return {
        "score": score,
        "nivel": nivel,
        "label": "Lenda" if is_lenda else label,
        "cor": cor,
        "icone": "Crown" if is_lenda else icone,
        "vendas": usuario.vendas_completadas or 0,
        "ranking_posicao": posicao
    }


# ==================== EXPLORAR (BUSCA + FILTROS) ====================

@router.get("/explorar")
async def explorar_comunidade(
    categoria: Optional[str] = None,
    cidade: Optional[str] = None,
    busca: Optional[str] = None,
    preco_min: Optional[float] = None,
    preco_max: Optional[float] = None,
    page: int = 1,
    limit: int = 12,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    _desativar_expirados(db)
    offset = (page - 1) * limit
    
    # Obter usuario logado para filtrar bloqueios
    usuario_logado_id = None
    if authorization and authorization.startswith("Bearer "):
        from rotas.rotas_auth import verificar_token_manual
        usuario_logado_id = verificar_token_manual(authorization.split(" ")[1])
    
    query = db.query(LinkAfiliado).options(joinedload(LinkAfiliado.usuario)).filter(
        LinkAfiliado.is_active == True,
        or_(LinkAfiliado.visualizacoes_restantes > 0, LinkAfiliado.is_boosted == True)
    )
    
    # Filtrar anuncios de usuarios bloqueados
    if usuario_logado_id:
        bloqueados = db.query(BloqueioUsuario.bloqueado_id).filter(
            BloqueioUsuario.bloqueador_id == usuario_logado_id
        ).subquery()
        query = query.filter(LinkAfiliado.usuario_id.notin_(db.query(bloqueados)))
    
    if categoria and categoria != "Geral":
        query = query.filter(LinkAfiliado.categoria == categoria)
    
    if cidade and cidade != "Todas":
        query = query.filter(LinkAfiliado.cidade == cidade)
    
    # Busca textual no titulo e descricao
    if busca:
        termo = f"%{busca}%"
        query = query.filter(or_(
            LinkAfiliado.nome_produto.ilike(termo),
            LinkAfiliado.descricao.ilike(termo)
        ))
    
    # Filtro faixa de preco
    if preco_min is not None:
        query = query.filter(LinkAfiliado.valor >= Decimal(str(preco_min)))
    if preco_max is not None:
        query = query.filter(LinkAfiliado.valor <= Decimal(str(preco_max)))
        
    total = query.count()
    links = query.order_by(LinkAfiliado.is_boosted.desc(), LinkAfiliado.data_criacao.desc()).offset(offset).limit(limit).all()
    
    resultado = []
    for l in links:
        anunciante = l.usuario
        score_vendedor = float(anunciante.score or 0) if anunciante else 0
        
        if score_vendedor >= 900:
            nivel_confianca = "elite"
            cor_confianca = "#FFD700"
            icone_confianca = "Gem"
            label_confianca = "Elite Trocaria"
        elif score_vendedor >= 700:
            nivel_confianca = "confiavel"
            cor_confianca = "#25D366"
            icone_confianca = "BadgeCheck"
            label_confianca = "Confiavel"
        elif score_vendedor >= 300:
            nivel_confianca = "em_construcao"
            cor_confianca = "#FFD600"
            icone_confianca = "Sprout"
            label_confianca = "Em Construcao"
        else:
            nivel_confianca = "risco"
            cor_confianca = "#FF3D00"
            icone_confianca = "AlertTriangle"
            label_confianca = "Risco"
        
        resultado.append({
            "id": l.id,
            "nome_produto": l.nome_produto,
            "descricao": l.descricao or "",
            "categoria": l.categoria or "Geral",
            "valor": float(l.valor or 0) if l.valor else 0.00,
            "url_afiliado": l.url_afiliado,
            "imagens": [img.caminho_arquivo for img in sorted(l.imagens, key=lambda x: x.ordem)],
            "patrocinado": l.is_boosted,
            "nota": float(l.nota or 0) if l.nota else 0.0,
            "total_avaliacoes": l.total_avaliacoes or 0,
            "vendas_texto": l.vendas_texto or "",
            "views_totais": l.visualizacoes_totais,
            "ponto_max": int(l.ponto_max or 1),
            "anunciante": anunciante.nome.split(' ')[0] if anunciante else "Anonimo",
            "anunciante_vendas": anunciante.vendas_completadas if anunciante else 0,
            "anunciante_desde": anunciante.data_aceite.strftime("%m/%Y") if anunciante and anunciante.data_aceite else "N/D",
            "anunciante_verificado": anunciante.is_verified if anunciante else False,
            "cidade": l.cidade or "",
            "estado": l.estado or "",
            "usuario_id": l.usuario_id,
            "expires_at": l.data_expiracao.isoformat() if l.data_expiracao else None,
            "total_imagens": len(l.imagens),
            "score_vendedor": score_vendedor,
            "nivel_confianca": nivel_confianca,
            "cor_confianca": cor_confianca,
            "icone_confianca": icone_confianca,
            "label_confianca": label_confianca
        })
    
    return {
        "links": resultado,
        "total": total,
        "page": page,
        "has_more": (offset + len(links)) < total
    }


# ==================== REGISTRAR VIEW ====================

class RegistrarViewRequest(BaseModel):
    link_id: int

@router.post("/registrar-view")
async def registrar_view(dados: RegistrarViewRequest, db: Session = Depends(get_db), authorization: Optional[str] = Header(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    link = db.query(LinkAfiliado).filter(
        LinkAfiliado.id == dados.link_id,
        LinkAfiliado.is_active == True
    ).first()
    
    if not link:
        return {"ok": True}

    usuario_id = None
    if token:
        from rotas.rotas_auth import verificar_token_manual
        usuario_id = verificar_token_manual(token)
    
    if usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).with_for_update().first()
        is_proprio_link = link.usuario_id == usuario.id
        
        if usuario and not is_proprio_link:
            vinte_quatro_horas_atras = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
            ja_clicou = db.query(HistoricoClique).filter(
                HistoricoClique.usuario_id == usuario.id,
                HistoricoClique.link_id == link.id,
                HistoricoClique.data_clique >= vinte_quatro_horas_atras
            ).first()

            if not ja_clicou:
                novo_clique = HistoricoClique(usuario_id=usuario.id, link_id=link.id)
                db.add(novo_clique)

                if usuario.is_subscriber:
                    pontos_ganhos = random.randint(1, 5)
                else:
                    pontos_ganhos = 1

                from utils_ranking import adicionar_pontos
                adicionar_pontos(
                    usuario_id=usuario.id,
                    tipo="view_anuncio",
                    pontos=pontos_ganhos,
                    db=db,
                    detalhes=f"Visualizou anuncio #{link.id}" + (" (Premium)" if usuario.is_subscriber else "")
                )
                pontos_info = pontos_ganhos
            else:
                pontos_info = 0
        else:
            pontos_info = 0
    else:
        pontos_info = 0

    if link.visualizacoes_restantes > 0:
        link.visualizacoes_restantes -= 1
        link.visualizacoes_totais = (link.visualizacoes_totais or 0) + 1

    if link.visualizacoes_restantes <= 0 and not link.is_boosted:
        link.is_active = False

    if link.data_expiracao and link.data_expiracao < datetime.datetime.now(datetime.timezone.utc):
        link.is_active = False
    
    db.commit()
    return {"ok": True, "views_restantes": link.visualizacoes_restantes, "pontos_ganhos": pontos_info}


# ==================== DENUNCIAS ====================

@router.post("/denunciar-link")
async def denunciar_link(dados: DenunciaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anuncio nao encontrado.")
    if link.usuario_id == usuario.id:
        raise HTTPException(status_code=400, detail="Voce nao pode denunciar seu proprio anuncio.")
    ja_denunciou = db.query(DenunciaLink).filter(
        DenunciaLink.link_id == dados.link_id,
        DenunciaLink.usuario_id == usuario.id
    ).first()
    if ja_denunciou:
        raise HTTPException(status_code=400, detail="Voce ja denunciou este anuncio.")
    nova_denuncia = DenunciaLink(link_id=dados.link_id, usuario_id=usuario.id, motivo=dados.motivo)
    db.add(nova_denuncia)
    link.denuncias_count = (link.denuncias_count or 0) + 1
    if link.denuncias_count >= 5:
        link.is_active = False
    db.commit()
    return {"message": "Denuncia registrada.", "analise_imediata": link.denuncias_count >= 5}


class DenunciarUsuarioRequest(BaseModel):
    denunciado_id: str
    motivo: str | None = None

@router.post("/denunciar-usuario")
@limiter.limit("3/minute")
async def denunciar_usuario(request: Request, dados: DenunciarUsuarioRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if dados.denunciado_id == usuario.id:
        raise HTTPException(status_code=400, detail="Voce nao pode denunciar a si mesmo.")
    denunciado = db.query(Usuario).filter(Usuario.id == dados.denunciado_id, Usuario.is_active == True).first()
    if not denunciado:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    existente = db.query(DenunciaUsuario).filter(
        DenunciaUsuario.denunciante_id == usuario.id,
        DenunciaUsuario.denunciado_id == dados.denunciado_id,
        DenunciaUsuario.status == "pendente"
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Voce ja denunciou este usuario.")
    denuncia = DenunciaUsuario(denunciante_id=usuario.id, denunciado_id=dados.denunciado_id, motivo=dados.motivo)
    db.add(denuncia)
    db.commit()
    total_denuncias = db.query(DenunciaUsuario).filter(
        DenunciaUsuario.denunciado_id == dados.denunciado_id,
        DenunciaUsuario.status == "pendente"
    ).count()
    if total_denuncias >= 3:
        denunciado.is_active = False
        denunciado.motivo_suspensao = f"Suspensao automatica: {total_denuncias} denuncias"
        denunciado.data_suspensao = datetime.datetime.now(datetime.timezone.utc)
        db.commit()
        return {"message": "Denuncia registrada. Usuario suspenso.", "suspenso": True}
    return {"message": "Denuncia registrada.", "suspenso": False}


# ==================== AVALIACOES ====================

@router.post("/avaliar-link")
async def avaliar_link(dados: AvaliarRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anuncio nao encontrado.")
    if link.usuario_id == usuario.id:
        raise HTTPException(status_code=400, detail="Voce nao pode avaliar seu proprio anuncio.")
    avaliacao = db.query(AvaliacaoLink).filter(
        AvaliacaoLink.link_id == dados.link_id,
        AvaliacaoLink.usuario_id == usuario.id
    ).first()
    if avaliacao:
        avaliacao.nota = dados.nota
    else:
        nova_avaliacao = AvaliacaoLink(link_id=dados.link_id, usuario_id=usuario.id, nota=dados.nota)
        db.add(nova_avaliacao)
    db.commit()
    todas_notas = db.query(AvaliacaoLink.nota).filter(AvaliacaoLink.link_id == dados.link_id).all()
    if todas_notas:
        notas_list = [n[0] for n in todas_notas]
        media = sum(notas_list) / len(notas_list)
        link.nota = Decimal(str(round(media, 1)))
        link.total_avaliacoes = len(notas_list)
        db.commit()
    return {"message": "Avaliacao registrada!", "nova_media": float(link.nota or 0), "total_avaliacoes": link.total_avaliacoes}


# ==================== SISTEMA DE OFERTAS ====================

@router.post("/fazer-oferta")
async def fazer_oferta(dados: OfertaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Comprador faz oferta de preco. Minimo R$10, deve ser menor que o preco do anuncio."""
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id, LinkAfiliado.is_active == True).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anuncio nao encontrado ou inativo.")
    
    if link.usuario_id == usuario.id:
        raise HTTPException(status_code=400, detail="Voce nao pode fazer oferta no seu proprio anuncio.")
    
    valor = Decimal(str(dados.valor_oferta))
    if valor < Decimal("10.00"):
        raise HTTPException(status_code=400, detail="Valor minimo de oferta e R$ 10,00.")
    
    if valor >= link.valor:
        raise HTTPException(status_code=400, detail="Oferta deve ser menor que o preco do anuncio.")
    
    # Verificar se ja tem oferta pendente deste usuario
    oferta_pendente = db.query(OfertaAnuncio).filter(
        OfertaAnuncio.link_id == link.id,
        OfertaAnuncio.ofertante_id == usuario.id,
        OfertaAnuncio.status == "pendente"
    ).first()
    if oferta_pendente:
        raise HTTPException(status_code=400, detail="Voce ja fez uma oferta pendente neste anuncio.")
    
    agora = datetime.datetime.now(datetime.timezone.utc)
    nova_oferta = OfertaAnuncio(
        link_id=link.id,
        ofertante_id=usuario.id,
        valor_oferta=valor,
        data_expiracao=agora + datetime.timedelta(hours=48)
    )
    db.add(nova_oferta)
    db.commit()
    
    return {
        "message": "Oferta enviada! O vendedor tem 48h para responder.",
        "oferta_id": nova_oferta.id,
        "valor_oferta": float(valor),
        "expira_em": nova_oferta.data_expiracao.isoformat()
    }


@router.post("/responder-oferta")
async def responder_oferta(dados: RespostaOfertaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Vendedor aceita ou recusa oferta."""
    oferta = db.query(OfertaAnuncio).filter(OfertaAnuncio.id == dados.oferta_id).first()
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta nao encontrada.")
    
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == oferta.link_id).first()
    if not link or link.usuario_id != usuario.id:
        raise HTTPException(status_code=403, detail="Apenas o dono do anuncio pode responder ofertas.")
    
    if oferta.status != "pendente":
        raise HTTPException(status_code=400, detail="Esta oferta ja foi respondida ou expirou.")
    
    if oferta.data_expiracao < datetime.datetime.now(datetime.timezone.utc):
        oferta.status = "expirada"
        db.commit()
        raise HTTPException(status_code=400, detail="Oferta expirou (48h).")
    
    oferta.data_resposta = datetime.datetime.now(datetime.timezone.utc)
    
    if dados.acao == "aceitar":
        oferta.status = "aceita"
        link.valor = oferta.valor_oferta
        return {"message": "Oferta aceita! O preco do anuncio foi atualizado.", "novo_valor": float(oferta.valor_oferta)}
    elif dados.acao == "recusar":
        oferta.status = "recusada"
        return {"message": "Oferta recusada."}
    else:
        raise HTTPException(status_code=400, detail="Acao invalida. Use 'aceitar' ou 'recusar'.")


@router.get("/minhas-ofertas")
async def minhas_ofertas(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Retorna ofertas recebidas e enviadas pelo usuario."""
    agora = datetime.datetime.now(datetime.timezone.utc)
    
    # Expirar ofertas pendentes
    db.query(OfertaAnuncio).filter(
        OfertaAnuncio.status == "pendente",
        OfertaAnuncio.data_expiracao < agora
    ).update({"status": "expirada"}, synchronize_session=False)
    db.commit()
    
    # Ofertas recebidas (como vendedor)
    ofertas_recebidas = db.query(OfertaAnuncio).options(
        joinedload(OfertaAnuncio.ofertante),
        joinedload(OfertaAnuncio.anuncio)
    ).join(LinkAfiliado).filter(
        LinkAfiliado.usuario_id == usuario.id,
        OfertaAnuncio.status != "expirada"
    ).order_by(OfertaAnuncio.data_oferta.desc()).all()
    
    # Ofertas enviadas (como comprador)
    ofertas_enviadas = db.query(OfertaAnuncio).options(
        joinedload(OfertaAnuncio.anuncio)
    ).filter(
        OfertaAnuncio.ofertante_id == usuario.id,
        OfertaAnuncio.status != "expirada"
    ).order_by(OfertaAnuncio.data_oferta.desc()).all()
    
    return {
        "recebidas": [{
            "id": o.id,
            "valor_oferta": float(o.valor_oferta),
            "status": o.status,
            "ofertante": o.ofertante.nome.split(' ')[0] if o.ofertante else "Anonimo",
            "anuncio": o.anuncio.nome_produto,
            "anuncio_id": o.anuncio.id,
            "data_oferta": o.data_oferta.isoformat(),
            "expira_em": o.data_expiracao.isoformat()
        } for o in ofertas_recebidas],
        "enviadas": [{
            "id": o.id,
            "valor_oferta": float(o.valor_oferta),
            "status": o.status,
            "anuncio": o.anuncio.nome_produto,
            "anuncio_id": o.anuncio.id,
            "anunciante": o.anuncio.usuario.nome.split(' ')[0] if o.anuncio.usuario else "Anonimo",
            "data_oferta": o.data_oferta.isoformat(),
            "expira_em": o.data_expiracao.isoformat()
        } for o in ofertas_enviadas]
    }


# ==================== BLOQUEAR USUARIO ====================

@router.post("/bloquear-usuario")
async def bloquear_usuario(dados: BloqueioRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Bloqueia usuario. Anuncios dele nao aparecem mais."""
    if dados.usuario_bloqueado_id == usuario.id:
        raise HTTPException(status_code=400, detail="Voce nao pode bloquear a si mesmo.")
    
    bloqueado = db.query(Usuario).filter(Usuario.id == dados.usuario_bloqueado_id).first()
    if not bloqueado:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")
    
    # Verificar se ja bloqueou
    existente = db.query(BloqueioUsuario).filter(
        BloqueioUsuario.bloqueador_id == usuario.id,
        BloqueioUsuario.bloqueado_id == dados.usuario_bloqueado_id
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Voce ja bloqueou este usuario.")
    
    bloqueio = BloqueioUsuario(bloqueador_id=usuario.id, bloqueado_id=dados.usuario_bloqueado_id)
    db.add(bloqueio)
    db.commit()
    
    return {"message": f"{bloqueado.nome.split(' ')[0]} foi bloqueado. Anuncios dele nao apareceram mais."}


@router.post("/desbloquear-usuario")
async def desbloquear_usuario(dados: BloqueioRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Desbloqueia usuario."""
    bloqueio = db.query(BloqueioUsuario).filter(
        BloqueioUsuario.bloqueador_id == usuario.id,
        BloqueioUsuario.bloqueado_id == dados.usuario_bloqueado_id
    ).first()
    if not bloqueio:
        raise HTTPException(status_code=404, detail="Bloqueio nao encontrado.")
    
    db.delete(bloqueio)
    db.commit()
    return {"message": "Usuario desbloqueado."}


@router.get("/usuarios-bloqueados")
async def listar_bloqueados(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Lista usuarios bloqueados."""
    bloqueios = db.query(BloqueioUsuario).options(joinedload(BloqueioUsuario.bloqueado)).filter(
        BloqueioUsuario.bloqueador_id == usuario.id
    ).all()
    
    return {
        "bloqueados": [{
            "id": b.bloqueado.id,
            "nome": b.bloqueado.nome,
            "data_bloqueio": b.data_bloqueio.isoformat()
        } for b in bloqueios]
    }


# ==================== SISTEMA DE TROCAS ====================

class ProporTrocaRequest(BaseModel):
    anuncio_alvo_id: int
    meu_anuncio_id: int

@router.post("/propor-troca")
async def propor_troca(dados: ProporTrocaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Usuario A propoe troca do seu anuncio pelo anuncio do Usuario B."""
    anuncio_a = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.meu_anuncio_id, LinkAfiliado.usuario_id == usuario.id).first()
    if not anuncio_a:
        raise HTTPException(status_code=404, detail="Seu anuncio nao encontrado.")
    
    anuncio_b = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.anuncio_alvo_id, LinkAfiliado.is_active == True).first()
    if not anuncio_b:
        raise HTTPException(status_code=404, detail="Anuncio alvo nao encontrado ou inativo.")
    
    if anuncio_b.usuario_id == usuario.id:
        raise HTTPException(status_code=400, detail="Voce nao pode trocar com seu proprio anuncio.")
    
    # Verificar se ja existe troca pendente envolvendo estes anuncios
    existente = db.query(AcordoTroca).filter(
        or_(
            and_(AcordoTroca.anuncio_a_id == anuncio_a.id, AcordoTroca.anuncio_b_id == anuncio_b.id),
            and_(AcordoTroca.anuncio_a_id == anuncio_b.id, AcordoTroca.anuncio_b_id == anuncio_a.id)
        ),
        AcordoTroca.status.in_(["pendente", "aceita", "em_andamento"])
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ja existe uma proposta de troca pendente entre estes anuncios.")
    
    agora = datetime.datetime.now(datetime.timezone.utc)
    acordo = AcordoTroca(
        anuncio_a_id=anuncio_a.id,
        anuncio_b_id=anuncio_b.id,
        usuario_a_id=usuario.id,
        usuario_b_id=anuncio_b.usuario_id,
        data_expiracao=agora + datetime.timedelta(hours=48)
    )
    db.add(acordo)
    db.commit()
    
    return {
        "message": "Proposta de troca enviada!",
        "acordo_id": acordo.id,
        "expira_em": acordo.data_expiracao.isoformat()
    }


class AceitarTrocaRequest(BaseModel):
    acordo_id: int

@router.post("/aceitar-troca")
async def aceitar_troca(dados: AceitarTrocaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Usuario B aceita a proposta de troca."""
    acordo = db.query(AcordoTroca).filter(AcordoTroca.id == dados.acordo_id).first()
    if not acordo:
        raise HTTPException(status_code=404, detail="Acordo nao encontrado.")
    
    if acordo.usuario_b_id != usuario.id:
        raise HTTPException(status_code=403, detail="Apenas o destinatario pode aceitar esta troca.")
    
    if acordo.status != "pendente":
        raise HTTPException(status_code=400, detail="Este acordo ja foi respondido ou expirou.")
    
    if acordo.data_expiracao < datetime.datetime.now(datetime.timezone.utc):
        acordo.status = "cancelada"
        db.commit()
        raise HTTPException(status_code=400, detail="Proposta expirou.")
    
    acordo.status = "aceita"
    db.commit()
    
    return {"message": "Troca aceita! Combine a entrega com o outro usuario."}


class EtapaTrocaRequest(BaseModel):
    acordo_id: int

@router.post("/confirmar-etapa-troca")
async def confirmar_etapa_troca(dados: EtapaTrocaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Avanca etapa da troca. Fluxo: A entrega -> B recebe/entrega -> A recebe."""
    acordo = db.query(AcordoTroca).filter(AcordoTroca.id == dados.acordo_id).first()
    if not acordo:
        raise HTTPException(status_code=404, detail="Acordo nao encontrado.")
    
    if acordo.status not in ["aceita", "em_andamento"]:
        raise HTTPException(status_code=400, detail="Troca nao esta ativa.")
    
    # ETAPA 1: Usuario A confirma que entregou
    if usuario.id == acordo.usuario_a_id and not acordo.etapa_a_entregou:
        acordo.etapa_a_entregou = True
        acordo.status = "em_andamento"
        db.commit()
        return {"message": "Entrega registrada! Aguarde o Usuario B confirmar o recebimento e a entrega dele.", "proxima_etapa": "b_recebe_entrega"}
    
    # ETAPA 2: Usuario B confirma que recebeu E entregou o dele
    if usuario.id == acordo.usuario_b_id and acordo.etapa_a_entregou and not acordo.etapa_b_recebeu_entregou:
        acordo.etapa_b_recebeu_entregou = True
        db.commit()
        return {"message": "Confirmado! Aguarde o Usuario A confirmar o recebimento final.", "proxima_etapa": "a_recebe"}
    
    # ETAPA 3: Usuario A confirma que recebeu o item do B (Conclusao)
    if usuario.id == acordo.usuario_a_id and acordo.etapa_b_recebeu_entregou and not acordo.etapa_a_recebeu:
        acordo.etapa_a_recebeu = True
        acordo.status = "concluida"
        
        # Desativar anuncios
        anuncio_a = db.query(LinkAfiliado).filter(LinkAfiliado.id == acordo.anuncio_a_id).first()
        anuncio_b = db.query(LinkAfiliado).filter(LinkAfiliado.id == acordo.anuncio_b_id).first()
        if anuncio_a: anuncio_a.is_active = False
        if anuncio_b: anuncio_b.is_active = False
        
        # Bonus de score para ambos (+5 por troca segura)
        user_a = db.query(Usuario).filter(Usuario.id == acordo.usuario_a_id).first()
        user_b = db.query(Usuario).filter(Usuario.id == acordo.usuario_b_id).first()
        if user_a: user_a.score = min((user_a.score or 0) + 5, 1000)
        if user_b: user_b.score = min((user_b.score or 0) + 5, 1000)
        
        db.commit()
        return {"message": "Troca concluida com sucesso! Ambos ganharam +5 de score.", "concluida": True}
    
    raise HTTPException(status_code=400, detail="Acao invalida ou etapa ja concluida.")


@router.post("/recusar-troca")
async def recusar_troca(dados: AceitarTrocaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Usuario B recusa a proposta."""
    acordo = db.query(AcordoTroca).filter(AcordoTroca.id == dados.acordo_id).first()
    if not acordo:
        raise HTTPException(status_code=404, detail="Acordo nao encontrado.")
    
    if acordo.usuario_b_id != usuario.id:
        raise HTTPException(status_code=403, detail="Apenas o destinatario pode recusar.")
    
    if acordo.status != "pendente":
        raise HTTPException(status_code=400, detail="Acordo ja respondido.")
    
    acordo.status = "recusada"
    db.commit()
    return {"message": "Troca recusada."}


@router.get("/minhas-trocas")
async def minhas_trocas(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Retorna trocas do usuario."""
    agora = datetime.datetime.now(datetime.timezone.utc)
    
    # Expirar pendentes
    db.query(AcordoTroca).filter(
        AcordoTroca.status == "pendente",
        AcordoTroca.data_expiracao < agora
    ).update({"status": "cancelada"}, synchronize_session=False)
    db.commit()
    
    # Como proponente
    como_a = db.query(AcordoTroca).options(
        joinedload(AcordoTroca.anuncio_a),
        joinedload(AcordoTroca.anuncio_b)
    ).filter(
        AcordoTroca.usuario_a_id == usuario.id,
        AcordoTroca.status.in_(["pendente", "aceita", "em_andamento", "concluida"])
    ).order_by(AcordoTroca.data_criacao.desc()).all()
    
    # Como aceitante
    como_b = db.query(AcordoTroca).options(
        joinedload(AcordoTroca.anuncio_a),
        joinedload(AcordoTroca.anuncio_b)
    ).filter(
        AcordoTroca.usuario_b_id == usuario.id,
        AcordoTroca.status.in_(["pendente", "aceita", "em_andamento", "concluida"])
    ).order_by(AcordoTroca.data_criacao.desc()).all()
    
    def format_troca(t):
        return {
            "id": t.id,
            "meu_anuncio": t.anuncio_a.nome_produto if t.usuario_a_id == usuario.id else t.anuncio_b.nome_produto,
            "outro_anuncio": t.anuncio_b.nome_produto if t.usuario_a_id == usuario.id else t.anuncio_a.nome_produto,
            "status": t.status,
            "etapa_a_entregou": t.etapa_a_entregou,
            "etapa_b_recebeu_entregou": t.etapa_b_recebeu_entregou,
            "etapa_a_recebeu": t.etapa_a_recebeu,
            "expira_em": t.data_expiracao.isoformat()
        }
    
    return {
        "propostas_enviadas": [format_troca(t) for t in como_a],
        "propostas_recebidas": [format_troca(t) for t in como_b]
    }
