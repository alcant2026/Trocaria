from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
import datetime
from database import get_db
from modelos.modelos_db import (
    Usuario, ExtratoPontos, ResgatePontos, ConfirmacaoVenda,
    OfertaAnuncio, LinkAfiliado, TipoTransacao, Transacao
)
from rotas.rotas_auth import obter_usuario_logado, exigir_admin

router = APIRouter(prefix="/pontos", tags=["Pontos e Beneficios"])

PONTOS_POR_REAL = 1000
BONUS_VENDEDOR_PTS = 1000
COMISSAO_PERCENTUAL = Decimal("0.03")  # 3% de comissão sobre vendas

BENEFICIOS_CATALOGO = {
    "destaque_7d": {"nome": "Destaque por 7 dias", "pontos": 5000, "descricao": "Seu anúncio fica destacado por 7 dias"},
    "boost_100": {"nome": "100 Views extras", "pontos": 1000, "descricao": "100 visualizações extras no seu anúncio"},
    "boost_500": {"nome": "500 Views extras", "pontos": 5000, "descricao": "500 visualizações extras no seu anúncio"},
    "premium_1m": {"nome": "1 mês de Premium", "pontos": 20000, "descricao": "Acesso Premium por 30 dias"},
    "kyc_gratis": {"nome": "Verificação KYC grátis", "pontos": 15000, "descricao": "Isenção da taxa de verificação de identidade"},
}


def saldo_usuario(db: Session, usuario_id: str) -> int:
    entradas = db.query(ExtratoPontos).filter(
        ExtratoPontos.usuario_id == usuario_id, ExtratoPontos.pontos > 0
    ).with_entities(ExtratoPontos.pontos).all()
    saidas = db.query(ResgatePontos).filter(
        ResgatePontos.usuario_id == usuario_id, ResgatePontos.status == "concluido"
    ).with_entities(ResgatePontos.pontos).all()
    saidas_venda = db.query(ConfirmacaoVenda).filter(
        ConfirmacaoVenda.comprador_id == usuario_id,
        ConfirmacaoVenda.pontos_queimados == True
    ).with_entities(ConfirmacaoVenda.pontos_usados).all()
    total = sum(p[0] for p in entradas) if entradas else 0
    total -= sum(p[0] for p in saidas) if saidas else 0
    total -= sum(p[0] for p in saidas_venda) if saidas_venda else 0
    return max(total, 0)


@router.get("/saldo")
async def meu_saldo(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    pts = saldo_usuario(db, usuario.id)
    return {"pontos": pts, "valor_equivalente": round(pts / PONTOS_POR_REAL, 2)}


@router.get("/extrato")
async def meu_extrato(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    entradas = db.query(ExtratoPontos).filter(ExtratoPontos.usuario_id == usuario.id).order_by(ExtratoPontos.data_criacao.desc()).limit(50).all()
    saidas = db.query(ResgatePontos).filter(ResgatePontos.usuario_id == usuario.id, ResgatePontos.status == "concluido").order_by(ResgatePontos.data_solicitacao.desc()).limit(50).all()
    return {
        "entradas": [{"id": e.id, "tipo": e.tipo, "pontos": e.pontos, "detalhes": e.detalhes, "data": e.data_criacao.isoformat()} for e in entradas],
        "saidas": [{"id": r.id, "tipo": r.tipo_beneficio, "pontos": r.pontos, "detalhes": r.detalhes, "data": r.data_solicitacao.isoformat()} for r in saidas],
    }


@router.get("/catalogo")
async def catalogo_beneficios():
    return BENEFICIOS_CATALOGO


@router.post("/resgatar")
async def resgatar_beneficio(dados: dict, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    tipo = dados.get("tipo")
    alvo_id = dados.get("alvo_id")
    beneficio = BENEFICIOS_CATALOGO.get(tipo)
    if not beneficio:
        raise HTTPException(status_code=400, detail="Beneficio invalido")

    pts = saldo_usuario(db, usuario.id)
    if pts < beneficio["pontos"]:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente. Necessario {beneficio['pontos']} pts, voce tem {pts}")

    if tipo == "destaque_7d":
        link = db.query(LinkAfiliado).filter(LinkAfiliado.id == alvo_id, LinkAfiliado.usuario_id == usuario.id).first()
        if not link:
            raise HTTPException(status_code=400, detail="Anuncio nao encontrado ou nao pertence a voce")
        link.is_boosted = True
        link.visualizacoes_restantes = (link.visualizacoes_restantes or 0) + 500
        link.data_expiracao = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=7)

    elif tipo in ("boost_100", "boost_500"):
        views = 100 if tipo == "boost_100" else 500
        link = db.query(LinkAfiliado).filter(LinkAfiliado.id == alvo_id, LinkAfiliado.usuario_id == usuario.id).first()
        if not link:
            raise HTTPException(status_code=400, detail="Anuncio nao encontrado ou nao pertence a voce")
        link.visualizacoes_restantes = (link.visualizacoes_restantes or 0) + views
        link.data_expiracao = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)

    elif tipo == "premium_1m":
        usuario.is_subscriber = True
        if usuario.assinatura_expira_em and usuario.assinatura_expira_em > datetime.datetime.now(datetime.timezone.utc):
            usuario.assinatura_expira_em += datetime.timedelta(days=30)
        else:
            usuario.assinatura_expira_em = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)

    elif tipo == "kyc_gratis":
        usuario.is_verified = True

    resgate = ResgatePontos(
        usuario_id=usuario.id, pontos=beneficio["pontos"],
        tipo_beneficio=tipo, alvo_id=alvo_id,
        status="concluido", detalhes=beneficio["nome"],
        data_processamento=datetime.datetime.now(datetime.timezone.utc)
    )
    db.add(resgate)
    db.commit()
    return {"message": f"Beneficio '{beneficio['nome']}' ativado!", "pontos_gastos": beneficio["pontos"]}


@router.post("/ofertar")
async def ofertar_com_pontos(dados: dict, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    link_id = dados.get("link_id")
    valor_pix = Decimal(str(dados.get("valor_pix", 0)))
    pontos_usar = int(dados.get("pontos_usar", 0))

    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == link_id, LinkAfiliado.is_active == True).first()
    if not link:
        raise HTTPException(status_code=404, detail="Anuncio nao encontrado")
    if link.usuario_id == usuario.id:
        raise HTTPException(status_code=400, detail="Voce nao pode fazer oferta no seu proprio anuncio")

    pts = saldo_usuario(db, usuario.id)
    if pts < pontos_usar:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente. Voce tem {pts} pontos")

    valor_pontos = round(pontos_usar / PONTOS_POR_REAL, 2)
    valor_total = valor_pix + Decimal(str(valor_pontos))

    oferta = OfertaAnuncio(
        link_id=link_id, ofertante_id=usuario.id,
        valor_oferta=valor_total, pontos_usar=pontos_usar, valor_pix=valor_pix,
        status="pendente",
        data_expiracao=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)
    )
    db.add(oferta)
    db.commit()
    return {
        "message": "Oferta enviada!",
        "oferta_id": oferta.id,
        "valor_pix": float(valor_pix),
        "pontos_usar": pontos_usar,
        "valor_equivalente_pontos": valor_pontos,
        "valor_total_oferta": float(valor_total)
    }


@router.post("/oferta/{oferta_id}/aceitar")
async def aceitar_oferta_com_pontos(oferta_id: int, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    oferta = db.query(OfertaAnuncio).filter(OfertaAnuncio.id == oferta_id).first()
    if not oferta or oferta.status != "pendente":
        raise HTTPException(status_code=404, detail="Oferta nao encontrada")
    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == oferta.link_id).first()
    if link.usuario_id != usuario.id:
        raise HTTPException(status_code=403, detail="Este anuncio nao e seu")

    oferta.status = "aceita"

    confirmacao = ConfirmacaoVenda(
        link_id=oferta.link_id, vendedor_id=usuario.id, comprador_id=oferta.ofertante_id,
        pontos_usados=oferta.pontos_usar, pontos_bonus_vendedor=BONUS_VENDEDOR_PTS,
        status="aguardando_pagamento",
        data_expiracao=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=48)
    )
    db.add(confirmacao)
    db.commit()

    return {
        "message": "Oferta aceita! Instrucoes enviadas ao comprador.",
        "confirmacao_id": confirmacao.id,
        "valor_pix": float(oferta.valor_pix),
        "pix_vendedor": usuario.chave_pix,
        "instrucao": f"Pague R$ {float(oferta.valor_pix):.2f} via PIX para {usuario.chave_pix} e confirme na plataforma"
    }


@router.post("/confirmar-pagamento/{confirmacao_id}")
async def comprador_confirmar_pagamento(confirmacao_id: int, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    conf = db.query(ConfirmacaoVenda).filter(ConfirmacaoVenda.id == confirmacao_id).first()
    if not conf or conf.status not in ("aguardando_pagamento", "vendedor_confirmou"):
        raise HTTPException(status_code=404, detail="Confirmacao nao encontrada")
    if conf.comprador_id != usuario.id:
        raise HTTPException(status_code=403, detail="Voce nao e o comprador")

    conf.comprador_confirmou = True
    conf.data_confirmacao_comprador = datetime.datetime.now(datetime.timezone.utc)
    conf.status = "comprador_confirmou"

    if conf.vendedor_confirmou:
        await _finalizar_venda(db, conf)

    db.commit()
    return {"message": "Pagamento confirmado! Aguardando confirmacao do vendedor."}


@router.post("/confirmar-recebimento/{confirmacao_id}")
async def vendedor_confirmar_recebimento(confirmacao_id: int, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    conf = db.query(ConfirmacaoVenda).filter(ConfirmacaoVenda.id == confirmacao_id).first()
    if not conf or conf.status not in ("aguardando_pagamento", "comprador_confirmou"):
        raise HTTPException(status_code=404, detail="Confirmacao nao encontrada")
    if conf.vendedor_id != usuario.id:
        raise HTTPException(status_code=403, detail="Voce nao e o vendedor")

    conf.vendedor_confirmou = True
    conf.data_confirmacao_vendedor = datetime.datetime.now(datetime.timezone.utc)
    conf.status = "vendedor_confirmou"

    if conf.comprador_confirmou:
        await _finalizar_venda(db, conf)

    db.commit()
    return {"message": "Recebimento confirmado! Venda concluida."}


async def _finalizar_venda(db: Session, conf: ConfirmacaoVenda):
    conf.status = "concluido"
    conf.pontos_queimados = True

    if conf.pontos_usados > 0:
        extrato = ExtratoPontos(
            usuario_id=conf.comprador_id, tipo="gasto_venda",
            pontos=-conf.pontos_usados,
            valor_referencia=Decimal(str(round(conf.pontos_usados / PONTOS_POR_REAL, 2))),
            detalhes=f"Usados na compra do anuncio #{conf.link_id}"
        )
        db.add(extrato)

    if conf.pontos_bonus_vendedor > 0:
        bonus = ExtratoPontos(
            usuario_id=conf.vendedor_id, tipo="bonus_venda",
            pontos=conf.pontos_bonus_vendedor,
            valor_referencia=Decimal(str(round(conf.pontos_bonus_vendedor / PONTOS_POR_REAL, 2))),
            detalhes=f"Bonus por aceitar pontos na venda do anuncio #{conf.link_id}"
        )
        db.add(bonus)

    vendedor = db.query(Usuario).filter(Usuario.id == conf.vendedor_id).first()
    if vendedor:
        vendedor.vendas_completadas = (vendedor.vendas_completadas or 0) + 1

    link = db.query(LinkAfiliado).filter(LinkAfiliado.id == conf.link_id).first()
    if link:
        link.is_active = False

    # Aplicar comissão sobre o valor do anúncio
    if link and vendedor:
        valor_venda = link.valor or Decimal("0")
        comissao = (valor_venda * COMISSAO_PERCENTUAL).quantize(Decimal("0.01"))
        if comissao > 0:
            vendedor.comissao_devida = (vendedor.comissao_devida or Decimal("0")) + comissao
            transacao = Transacao(
                usuario_id=vendedor.id,
                valor=comissao,
                tipo=TipoTransacao.TAXA_SERVICO,
                status="pendente",
                metodo="pix",
                detalhes=f"Comissão 3% venda anúncio #{conf.link_id} - R$ {float(link.valor):.2f}"
            )
            db.add(transacao)


@router.get("/admin/resgates-pendentes")
async def admin_resgates_pendentes(admin: Usuario = Depends(exigir_admin), db: Session = Depends(get_db)):
    resgates = db.query(ResgatePontos).filter(ResgatePontos.status == "pendente").order_by(ResgatePontos.data_solicitacao.desc()).all()
    return [{"id": r.id, "usuario_id": r.usuario_id, "tipo": r.tipo_beneficio, "pontos": r.pontos, "detalhes": r.detalhes, "data": r.data_solicitacao} for r in resgates]


@router.get("/ranking")
async def ranking_pontos(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    ranking = db.query(
        Usuario.id, Usuario.nome, Usuario.foto_perfil, Usuario.pontos_marketplace
    ).filter(Usuario.is_active == True).order_by(Usuario.pontos_marketplace.desc()).limit(20).all()

    posicao = 0
    minha_posicao = None
    for i, u in enumerate(ranking):
        if u.id == usuario.id:
            posicao = i + 1
            minha_posicao = {
                "posicao": posicao, "nome": u.nome, "foto": u.foto_perfil,
                "premio": _premio_ranking(posicao)
            }
            break

    return {
        "ranking": [
            {"posicao": i + 1, "nome": u.nome, "foto": u.foto_perfil, "pontos": u.pontos_marketplace or 0, "premio": _premio_ranking(i + 1)}
            for i, u in enumerate(ranking)
        ],
        "minha_posicao": minha_posicao
    }


def _premio_ranking(posicao: int) -> dict:
    premios = {
        1: {"badge": "🥇 Top 1", "beneficio": "Destaque grátis 14 dias", "pontos": 5000},
        2: {"badge": "🥈 Top 2", "beneficio": "Destaque grátis 7 dias", "pontos": 3000},
        3: {"badge": "🥉 Top 3", "beneficio": "Destaque grátis 3 dias", "pontos": 1000},
    }
    return premios.get(posicao, {"badge": "", "beneficio": "", "pontos": 0})


# =============================================================================
# RESGATE DE PRODUTOS (Top 20)
# =============================================================================

from modelos.modelos_db import ProdutoResgate, SolicitacaoResgateProduto
from utils_ranking import (
    usuario_esta_no_top20, janela_resgate_aberta,
    obter_posicao_usuario, proximo_fechamento,
    WHATSAPP_PLATAFORMA, calcular_pontos_minimos
)


@router.get("/produtos")
async def listar_produtos_resgate(
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Lista produtos disponiveis para resgate (só aparece pro Top 20 antes do sabado 18h)."""
    if not usuario_esta_no_top20(usuario.id, db):
        raise HTTPException(status_code=403, detail="Apenas usuarios no Top 20 podem ver os produtos")

    if not janela_resgate_aberta():
        return {
            "janela_fechada": True,
            "mensagem": "O resgate encerrou. O proximo abre segunda-feira.",
            "whatsapp": WHATSAPP_PLATAFORMA,
            "proximo_fechamento": proximo_fechamento(),
        }

    produtos = db.query(ProdutoResgate).filter(
        ProdutoResgate.status == "ativo",
        ProdutoResgate.quantidade_disponivel > 0,
    ).order_by(ProdutoResgate.pontos_minimos.asc()).all()

    return {
        "janela_fechada": False,
        "proximo_fechamento": proximo_fechamento(),
        "minha_posicao": obter_posicao_usuario(usuario.id, db),
        "produtos": [
            {
                "id": p.id,
                "nome": p.nome,
                "descricao": p.descricao,
                "foto_url": p.foto_url,
                "pontos_minimos": p.pontos_minimos,
            }
            for p in produtos
        ],
    }


@router.get("/produtos/status")
async def status_resgate(
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Status da janela de resgate e info do usuario."""
    no_top20 = usuario_esta_no_top20(usuario.id, db)
    aberta = janela_resgate_aberta()
    posicao = obter_posicao_usuario(usuario.id, db) if no_top20 else 0

    return {
        "no_top20": no_top20,
        "posicao": posicao,
        "janela_aberta": aberta,
        "proximo_fechamento": proximo_fechamento(),
        "whatsapp": WHATSAPP_PLATAFORMA if not aberta else None,
    }


@router.post("/produtos/{produto_id}/resgatar")
async def resgatar_produto(
    produto_id: int,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Usuario no Top 20 resgata um produto com seus pontos."""
    if not usuario_esta_no_top20(usuario.id, db):
        raise HTTPException(status_code=403, detail="Apenas usuarios no Top 20 podem resgatar")
    if not janela_resgate_aberta():
        raise HTTPException(
            status_code=400,
            detail=f"Janela de resgate encerrada. Contate o WhatsApp: {WHATSAPP_PLATAFORMA}"
        )

    produto = db.query(ProdutoResgate).filter(
        ProdutoResgate.id == produto_id,
        ProdutoResgate.status == "ativo",
        ProdutoResgate.quantidade_disponivel > 0,
    ).first()

    if not produto:
        raise HTTPException(status_code=404, detail="Produto indisponivel")

    pts = saldo_usuario(db, usuario.id)
    if pts < produto.pontos_minimos:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente. Voce tem {pts} pts, precisa de {produto.pontos_minimos} pts"
        )

    # Debita os pontos
    extrato = ExtratoPontos(
        usuario_id=usuario.id,
        tipo="resgate_produto",
        pontos=-produto.pontos_minimos,
        valor_referencia=produto.valor_reais,
        detalhes=f"Resgateu: {produto.nome}"
    )
    db.add(extrato)

    # Cria solicitacao
    solicitacao = SolicitacaoResgateProduto(
        produto_id=produto.id,
        usuario_id=usuario.id,
        pontos_gastos=produto.pontos_minimos,
        status="pendente",
    )
    db.add(solicitacao)

    # Reduz quantidade
    produto.quantidade_disponivel -= 1

    db.commit()
    db.refresh(solicitacao)

    return {
        "message": f"Produto '{produto.nome}' resgatado! Entre em contato pelo WhatsApp para combinar a entrega.",
        "solicitacao_id": solicitacao.id,
        "produto": produto.nome,
        "pontos_gastos": produto.pontos_minimos,
        "whatsapp": WHATSAPP_PLATAFORMA,
    }
