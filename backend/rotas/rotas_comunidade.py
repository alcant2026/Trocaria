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
    pacote_id: int # 1: 500 views (R$ 5), 2: 1500 views (R$ 12), 3: 5000 views (R$ 35)

PRECO_VIEWS = {
    1: {"views": 500, "preco": Decimal("5.00"), "ponto_min": 1, "ponto_max": 5},
    2: {"views": 1500, "preco": Decimal("12.00"), "ponto_min": 5, "ponto_max": 15},
    3: {"views": 5000, "preco": Decimal("35.00"), "ponto_min": 15, "ponto_max": 50},
}

@router.post("/postar-link")
@limiter.limit("2/minute")
async def postar_link_comunidade(request: Request, dados: LinkCreate, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Postagem gratuita por 24 horas (Carência inicial).
    Exige 2FA (Google Authenticator) para prevenir spam.
    """
    url_final = dados.url_afiliado.strip()
    
    # Lógica de WhatsApp Inteligente
    if not url_final.lower().startswith(('http://', 'https://')):
        # Remove caracteres de formatação (espaços, parênteses, traços)
        so_numeros = "".join(filter(str.isdigit, url_final))
        if 8 <= len(so_numeros) <= 13:
            # Se não tiver DDI 55 e for um número brasileiro plausível (DDD + número)
            if not so_numeros.startswith('55') and len(so_numeros) <= 11:
                so_numeros = '55' + so_numeros
            url_final = f"https://wa.me/{so_numeros}"

    # ANTI-SPAM: Exigir 2FA ativo
    if not usuario.two_factor_enabled or not usuario.totp_secret:
        raise HTTPException(
            status_code=403,
            detail="Para anunciar no Marketplace, ative a Autenticação de Dois Fatores (Google Authenticator) nas configurações."
        )
    
    if not dados.codigo_2fa:
        raise HTTPException(status_code=400, detail="Código 2FA obrigatório para postar anúncio.")
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if not totp.verify(dados.codigo_2fa):
        raise HTTPException(status_code=401, detail="Código 2FA inválido ou expirado.")
    
    # Limite de 3 links ativos por usuário para evitar spam gratuito
    total_ativos = db.query(LinkAfiliado).filter(LinkAfiliado.usuario_id == usuario.id, LinkAfiliado.is_active == True).count()
    if total_ativos >= 3:
        raise HTTPException(status_code=400, detail="Você já possui 3 links ativos. Impulsione um ou aguarde a expiração.")

    novo_link = LinkAfiliado(
        nome_produto=dados.nome_produto,
        descricao=dados.descricao,
        categoria=dados.categoria,
        url_afiliado=url_final,
        url_imagem=dados.url_imagem,
        valor=dados.valor,
        nota=dados.nota,
        vendas_texto=dados.vendas_texto,
        usuario_id=usuario.id,
        visualizacoes_restantes=50,
        is_boosted=False,
        data_expiracao=datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    )
    
    db.add(novo_link)
    db.commit()
    db.refresh(novo_link)
    
    return {"message": "Link postado com sucesso! Você tem 24h e 50 visualizações de bônus.", "id": novo_link.id}

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
    link.data_expiracao = datetime.datetime.utcnow() + datetime.timedelta(days=30)
    
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
        
        if usuario and usuario.is_subscriber and not is_proprio_link:
            # SEGURANÇA: Verificar se já clicou neste link nas últimas 24 horas
            vinte_quatro_horas_atras = datetime.datetime.utcnow() - datetime.timedelta(hours=24)
            ja_clicou = db.query(HistoricoClique).filter(
                HistoricoClique.usuario_id == usuario.id,
                HistoricoClique.link_id == link.id,
                HistoricoClique.data_clique >= vinte_quatro_horas_atras
            ).first()

            if not ja_clicou:
                # Registro novo clique no histórico para trava de 24h
                novo_clique = HistoricoClique(usuario_id=usuario.id, link_id=link.id)
                db.add(novo_clique)
                
                # Regra de Pontos Aleatórios
                pontos_ganhos = 1
                if link.is_boosted and link.ponto_max > 1:
                    pontos_ganhos = random.randint(link.ponto_min, link.ponto_max)
                
                usuario.pontos_marketplace += pontos_ganhos
                
                # CONVERSÃO AUTOMÁTICA: 1000 pontos = R$ 0,10
                if usuario.pontos_marketplace >= 1000:
                    valor_credito = Decimal("0.10")
                    
                    # Tira do lucro da plataforma (000PL)
                    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
                    if plataforma and plataforma.saldo >= valor_credito:
                        plataforma.saldo -= valor_credito
                        usuario.saldo += valor_credito
                        usuario.pontos_marketplace -= 1000
                        
                        # Registrar transação de bonificação
                        db.add(Transacao(
                            usuario_id=usuario.id,
                            valor=valor_credito,
                            tipo=TipoTransacao.RETORNO_POOL,
                            status="concluido",
                            detalhes="Conversão Automática: 1.000 Pontos Marketplace → Saldo"
                        ))
    
    # Consumir 1 view
    if link.visualizacoes_restantes > 0:
        link.visualizacoes_restantes -= 1
        link.visualizacoes_totais += 1
    
    # Se views acabaram, aplicar regra
    if link.visualizacoes_restantes <= 0:
        if not link.is_boosted:
            db.delete(link)
        else:
            link.is_active = False
    
    db.commit()
    return {"ok": True, "views_restantes": link.visualizacoes_restantes}

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
