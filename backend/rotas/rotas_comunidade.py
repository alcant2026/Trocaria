from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from typing import Optional, List
from sqlalchemy.orm import Session, joinedload
from database import get_db
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, LinkAfiliado, DenunciaLink, AvaliacaoLink, HistoricoClique
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
import pyotp
import random
from limitador import limiter

router = APIRouter(prefix="/comunidade", tags=["Comunidade"])

class LinkCreate(BaseModel):
    nome_produto: str
    descricao: Optional[str] = ""
    categoria: Optional[str] = "Geral"
    url_afiliado: str
    url_imagem: str
    valor: float = 0.00
    nota: float = 0.0
    vendas_texto: str = ""
    codigo_2fa: str = ""

class DenunciaRequest(BaseModel):
    link_id: int
    motivo: str = ""

class AvaliarRequest(BaseModel):
    link_id: int
    nota: int = Field(..., ge=1, le=5)

class CompraViewsRequest(BaseModel):
    link_id: int
    pacote_id: int # 1: 100 views (R$ 1), 2: 500 views (R$ 5), 3: 1500 views (R$ 12), 4: 5000 views (R$ 35)

PRECO_VIEWS = {
    1: {"views": 100, "preco": Decimal("1.00"), "label": "Basico"},
    2: {"views": 500, "preco": Decimal("5.00"), "label": "Popular"},
    3: {"views": 1500, "preco": Decimal("12.00"), "label": "Intermediario"},
    4: {"views": 5000, "preco": Decimal("35.00"), "label": "Avancado"},
}

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
        raise HTTPException(status_code=400, detail="Pagamento pendente ja existe para este link.")
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    if not sdk:
        import secrets
        pid = secrets.randbelow(999999999)
        t = Transacao(usuario_id=usuario.id, valor=DESTAQUE_PRECO, tipo=TipoTransacao.TAXA_POSTAGEM, status="pendente", metodo="pix", detalhes=f"DESTAQUE_LINK:{link.id}")
        db.add(t); db.commit()
        return {"payment_id": str(pid), "transacao_id": t.id, "qr_code": "00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-12d1-a456-4266141740005204000053039865802BR5913PLATAFORMA6008BRASILIA62070503***6304", "qr_code_base64": None, "valor": float(DESTAQUE_PRECO), "simulado": True}
    try:
        p = sdk.payment().create({"transaction_amount": float(DESTAQUE_PRECO), "description": f"Destaque Link #{link.id}", "payment_method_id": "pix", "payer": {"email": usuario.email}})
        if not p or p.get("status") not in ("approved", "pending", "in_process"):
            raise HTTPException(status_code=502, detail="Erro ao gerar PIX.")
        t = Transacao(usuario_id=usuario.id, valor=DESTAQUE_PRECO, tipo=TipoTransacao.TAXA_POSTAGEM, status="pendente", payment_id=str(p["id"]), metodo="pix", detalhes=f"DESTAQUE_LINK:{link.id}")
        db.add(t); db.commit()
        qr = p.get("point_of_interaction", {}).get("transaction_data", {})
        return {"payment_id": p["id"], "transacao_id": t.id, "qr_code": qr.get("qr_code"), "qr_code_base64": qr.get("qr_code_base64"), "valor": float(DESTAQUE_PRECO)}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

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
        raise HTTPException(status_code=400, detail="Pagamento pendente ja existe para este link.")
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    if not sdk:
        import secrets
        pid = secrets.randbelow(999999999)
        t = Transacao(usuario_id=usuario.id, valor=pacote["preco"], tipo=TipoTransacao.TAXA_POSTAGEM, status="pendente", metodo="pix", detalhes=f"BOOST_LINK:{link.id}:{dados.pacote_id}")
        db.add(t); db.commit()
        return {"payment_id": str(pid), "transacao_id": t.id, "qr_code": "00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-12d1-a456-4266141740005204000053039865802BR5913PLATAFORMA6008BRASILIA62070503***6304", "qr_code_base64": None, "valor": float(pacote["preco"]), "views": pacote["views"], "simulado": True}
    try:
        p = sdk.payment().create({"transaction_amount": float(pacote["preco"]), "description": f"{pacote['views']} views - Link #{link.id}", "payment_method_id": "pix", "payer": {"email": usuario.email}})
        if not p or p.get("status") not in ("approved", "pending", "in_process"):
            raise HTTPException(status_code=502, detail="Erro ao gerar PIX.")
        t = Transacao(usuario_id=usuario.id, valor=pacote["preco"], tipo=TipoTransacao.TAXA_POSTAGEM, status="pendente", payment_id=str(p["id"]), metodo="pix", detalhes=f"BOOST_LINK:{link.id}:{dados.pacote_id}")
        db.add(t); db.commit()
        qr = p.get("point_of_interaction", {}).get("transaction_data", {})
        return {"payment_id": p["id"], "transacao_id": t.id, "qr_code": qr.get("qr_code"), "qr_code_base64": qr.get("qr_code_base64"), "valor": float(pacote["preco"]), "views": pacote["views"]}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.post("/comprar-views")
async def comprar_views_ads(dados: CompraViewsRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """
    Impulsiona um link (estilo Meta Ads) cobrando do saldo do usuário.
    """
    # LOCK no usuário para evitar race condition
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id, LinkAfiliado.usuario_id == usuario.id).first()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link não encontrado ou não pertence a você.")
    
    pacote = PRECO_VIEWS.get(dados.pacote_id)
    if not pacote:
        raise HTTPException(status_code=400, detail="Pacote de visualizações inválido.")
    
    custo = pacote["preco"]
    views = pacote["views"]
    
    if usuario.saldo < custo:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para impulsionar.")
    
    # 1. Deduzir saldo do usuário
    usuario.saldo -= custo
    
    # 2. Direcionar Lucro para a Empresa (Plataforma ID 000PL - Lucro Livre)
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if plataforma:
        plataforma.saldo += custo

    # 3. Atualizar Link
    link.visualizacoes_restantes += views
    link.is_boosted = True
    link.ponto_min = pacote["ponto_min"]
    link.ponto_max = pacote["ponto_max"]
    # Estender expiração para longa duração (ex: +30 dias de vida no banco)
    link.data_expiracao = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
    
    # 4. Registrar Transação de Saída
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=custo,
        tipo=TipoTransacao.TAXA_POSTAGEM, # Log da receita Ads
        status="concluido",
        detalhes=f"IMPULSIONAMENTO ADS: {views} views para o link #{link.id}"
    )
    db.add(transacao)

    # NOVO: Acumular no gasto total de taxas para dividendos
    if usuario.gasto_total_taxas is None: usuario.gasto_total_taxas = Decimal("0.00")
    usuario.gasto_total_taxas += custo
    
    db.commit()
    
    return {"message": f"Sucesso! {views} visualizações adicionadas ao seu link.", "saldo_restante": float(usuario.saldo)}

@router.get("/meus-links")
async def obter_meus_links(page: int = 1, limit: int = 12, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Retorna os links postados pelo usuário logado com suas estatísticas e paginação.
    """
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
            "valor": float(l.valor) if l.valor else 0.00,
            "url_imagem": l.url_imagem,
            "url_afiliado": l.url_afiliado,
            "views_restantes": l.visualizacoes_restantes,
            "views_totais": l.visualizacoes_totais,
            "is_boosted": l.is_boosted,
            "ponto_max": int(l.ponto_max or 1),
            "nota": float(l.nota) if l.nota else 0.0,
            "vendas_texto": l.vendas_texto or "",
            "expires_at": l.data_expiracao.isoformat() if l.data_expiracao else None,
            "is_active": l.is_active
        } for l in links],
        "total": total,
        "page": page,
        "has_more": (offset + len(links)) < total
    }

@router.get("/explorar")
async def explorar_comunidade(categoria: Optional[str] = None, page: int = 1, limit: int = 12, db: Session = Depends(get_db)):
    """
    Retorna links ativos da comunidade com paginação. 
    Boosted links aparecem primeiro, misturados com os grátis (24h).
    Filtra por categoria se fornecido.
    """
    offset = (page - 1) * limit
    query = db.query(LinkAfiliado).options(joinedload(LinkAfiliado.usuario)).filter(
        LinkAfiliado.is_active == True,
        LinkAfiliado.visualizacoes_restantes > 0
    )
    
    if categoria and categoria != "Geral":
        query = query.filter(LinkAfiliado.categoria == categoria)
        
    total = query.count()
    links = query.order_by(LinkAfiliado.is_boosted.desc(), LinkAfiliado.data_criacao.desc()).offset(offset).limit(limit).all()
    
    resultado = []
    for l in links:
        anunciante = l.usuario
        resultado.append({
            "id": l.id,
            "nome_produto": l.nome_produto,
            "descricao": l.descricao or "",
            "categoria": l.categoria or "Geral",
            "valor": float(l.valor) if l.valor else 0.00,
            "url_afiliado": l.url_afiliado,
            "url_imagem": l.url_imagem,
            "patrocinado": l.is_boosted,
            "nota": float(l.nota) if l.nota else 0.0,
            "total_avaliacoes": l.total_avaliacoes or 0,
            "vendas_texto": l.vendas_texto or "",
            "views_totais": l.visualizacoes_totais,
            "ponto_max": int(l.ponto_max or 1),
            "anunciante": anunciante.nome.split(' ')[0] if anunciante else "Anônimo",
            "anunciante_vendas": anunciante.vendas_completadas if anunciante else 0,
            "anunciante_desde": anunciante.data_aceite.strftime("%m/%Y") if anunciante and anunciante.data_aceite else "N/D",
            "anunciante_verificado": anunciante.is_verified if anunciante else False,
            "usuario_id": l.usuario_id,
            "expires_at": l.data_expiracao.isoformat() if l.data_expiracao else None
        })
    
    return {
        "links": resultado,
        "total": total,
        "page": page,
        "has_more": (offset + len(links)) < total
    }

class RegistrarViewRequest(BaseModel):
    link_id: int

@router.post("/registrar-view")
async def registrar_view(dados: RegistrarViewRequest, db: Session = Depends(get_db), authorization: Optional[str] = Header(None)):
    """
    Registra um clique real no link do produto.
    Consome 1 view restante e incrementa o total.
    """
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    link = db.query(LinkAfiliado).filter(
        LinkAfiliado.id == dados.link_id,
        LinkAfiliado.is_active == True
    ).first()
    
    if not link:
        return {"ok": True}

    # LOGICA DE PONTOS (Membro Premium)
    # Tenta obter o usuário via token manualmente se fornecido (para evitar erro se deslogado)
    usuario_id = None
    if token:
        from rotas.rotas_auth import verificar_token_manual
        usuario_id = verificar_token_manual(token)
    
    if usuario_id:
        usuario = db.query(Usuario).filter(Usuario.id == usuario_id).with_for_update().first()
        
        # SEGURANÇA: Bloquear se for o próprio dono do link
        is_proprio_link = link.usuario_id == usuario.id
        
        if usuario and not is_proprio_link:
            # SEGURANÇA: Verificar se já clicou neste link nas últimas 24 horas
            vinte_quatro_horas_atras = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=24)
            ja_clicou = db.query(HistoricoClique).filter(
                HistoricoClique.usuario_id == usuario.id,
                HistoricoClique.link_id == link.id,
                HistoricoClique.data_clique >= vinte_quatro_horas_atras
            ).first()

            if not ja_clicou:
                # Registro novo clique no histórico para trava de 24h
                novo_clique = HistoricoClique(usuario_id=usuario.id, link_id=link.id)
                db.add(novo_clique)

                # REGRA DE PONTOS:
                # - Gratuito: 1 ponto fixo
                # - Premium: sorteio tipo TikTok (1 a 5 pontos aleatórios)
                if usuario.is_subscriber:
                    pontos_ganhos = random.randint(1, 5)
                else:
                    pontos_ganhos = 1

                usuario.pontos_marketplace = (usuario.pontos_marketplace or 0) + pontos_ganhos
                usuario.pontos_semanais = (usuario.pontos_semanais or 0) + pontos_ganhos

                # Registrar transação de pontos
                db.add(Transacao(
                    usuario_id=usuario.id,
                    valor=Decimal(str(pontos_ganhos)),
                    tipo=TipoTransacao.BONUS,
                    status="concluido",
                    detalhes=f"{pontos_ganhos} ponto(s) por clique no link #{link.id}" + (" (Premium Bonus)" if usuario.is_subscriber else "")
                ))
                pontos_info = pontos_ganhos
            else:
                pontos_info = 0
        else:
            pontos_info = 0
    else:
        pontos_info = 0

    # Consumir 1 view
    if link.visualizacoes_restantes > 0:
        link.visualizacoes_restantes -= 1
        link.visualizacoes_totais = (link.visualizacoes_totais or 0) + 1
    
    # Se views acabaram, aplicar regra
    if link.visualizacoes_restantes <= 0:
        if not link.is_boosted:
            db.delete(link)
        else:
            link.is_active = False
    
    db.commit()
    return {"ok": True, "views_restantes": link.visualizacoes_restantes, "pontos_ganhos": pontos_info}

@router.post("/denunciar-link")
async def denunciar_link(dados: DenunciaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Registra uma denúncia contra um link.
    Se atingir 5 denúncias, o link é desativado para revisão.
    """
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado.")

    if link.usuario_id == usuario.id:
        raise HTTPException(status_code=400, detail="Você não pode denunciar seu próprio anúncio.")

    # Verificar se já denunciou
    ja_denunciou = db.query(DenunciaLink).filter(
        DenunciaLink.link_id == dados.link_id,
        DenunciaLink.usuario_id == usuario.id
    ).first()
    
    if ja_denunciou:
        raise HTTPException(status_code=400, detail="Você já denunciou este anúncio.")

    # Registrar denúncia
    nova_denuncia = DenunciaLink(
        link_id=dados.link_id,
        usuario_id=usuario.id,
        motivo=dados.motivo
    )
    db.add(nova_denuncia)
    
    # Incrementar contador
    link.denuncias_count = (link.denuncias_count or 0) + 1
    
    # Regra de Auto-Moderação: 5 denúncias = Desativação
    if link.denuncias_count >= 5:
        link.is_active = False
        # Log de segurança opcional aqui seria bom
    
    db.commit()
    
    return {"message": "Denúncia registrada com sucesso. Nossa equipe irá analisar.", "analise_imediata": link.denuncias_count >= 5}

@router.post("/avaliar-link")
async def avaliar_link(dados: AvaliarRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Registra ou atualiza a nota de um usuário para um link.
    Recalcula a média aritmética real no LinkAfiliado.
    """
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == dados.link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado.")

    if link.usuario_id == usuario.id:
        raise HTTPException(status_code=400, detail="Você não pode avaliar seu próprio anúncio.")

    # Tentar encontrar avaliação existente deste usuário
    avaliacao = db.query(AvaliacaoLink).filter(
        AvaliacaoLink.link_id == dados.link_id,
        AvaliacaoLink.usuario_id == usuario.id
    ).first()

    if avaliacao:
        avaliacao.nota = dados.nota
    else:
        nova_avaliacao = AvaliacaoLink(
            link_id=dados.link_id,
            usuario_id=usuario.id,
            nota=dados.nota
        )
        db.add(nova_avaliacao)

    db.commit() # Salvar o voto para calcular a média

    # Recalcular média
    todas_notas = db.query(AvaliacaoLink.nota).filter(AvaliacaoLink.link_id == dados.link_id).all()
    if todas_notas:
        notas_list = [n[0] for n in todas_notas]
        media = sum(notas_list) / len(notas_list)
        link.nota = Decimal(str(round(media, 1)))
        link.total_avaliacoes = len(notas_list)
        db.commit()

    return {
        "message": "Avaliação registrada!", 
        "nova_media": float(link.nota), 
        "total_avaliacoes": link.total_avaliacoes
    }
