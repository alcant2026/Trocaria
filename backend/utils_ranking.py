"""
utils_ranking.py - Sistema de Fidelidade por Pontos (acumulativo, nunca reseta)

Modelo: Plataforma de pesquisa/engajamento (tipo Toluna, LifePoints, Kwai)
- Usuario ganha pontos por acoes na plataforma (engajamento + gasto)
- Pontos acumulam para sempre (nao reseta)
- Resgate minimo: R$ 20,00 (20.000 pts)
- Resgate via PIX direto da conta da empresa (CNPJ)
- NAO E sorteio — e remuneração por servico prestado / cashback
"""

import datetime
from datetime import timezone, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from modelos.modelos_db import Usuario, ExtratoPontos, ResgatePontos

# =============================================================================
# CONFIGURACAO
# =============================================================================

# Taxa de conversao: 1.000 pontos = R$ 1,00
PONTOS_POR_REAL = 1000

# Resgate minimo
RESGATE_MINIMO_PONTOS = 20000  # R$ 20,00
RESGATE_MINIMO_REAIS = Decimal("20.00")

# Taxa de resgate (R$ 2,99 por saque)
TAXA_RESGATE_REAIS = Decimal("2.99")
TAXA_RESGATE_PONTOS = _reais_para_pontos(TAXA_RESGATE_REAIS)

# Pontos por engajamento (acoes gratuitas do usuario)
PONTOS_VIEW_ANUNCIO = 1           # Abrir anuncio
PONTOS_CONVERSA = 5               # Iniciar conversa com vendedor
PONTOS_INDICACAO_CADASTRO = 10    # Indicou amigo que se cadastrou
PONTOS_POSTAGEM_ANUNCIO = 20      # Postou anuncio no marketplace
PONTOS_KYC = 50                   # Fez verificacao KYC

# Cashback por gasto (% do valor pago)
CASHBACK_TAXA_PUBLICACAO = Decimal("0.10")   # 10% do valor da taxa
CASHBACK_TAXA_MATCH = Decimal("0.10")        # 10% do valor da taxa
CASHBACK_TAXA_DESTAQUE = Decimal("0.10")     # 10% do valor
CASHBACK_TAXA_BOOST = Decimal("0.10")        # 10% do valor
CASHBACK_ASSINATURA = Decimal("0.15")        # 15% do valor da assinatura
CASHBACK_KYC = Decimal("0.10")               # 10% do valor do KYC


# =============================================================================
# FUNCOES AUXILIARES
# =============================================================================

def _pontos_para_reais(pontos: int) -> Decimal:
    """Converte pontos em reais."""
    return Decimal(str(pontos)) / Decimal(str(PONTOS_POR_REAL))

def _reais_para_pontos(reais: Decimal) -> int:
    """Converte reais em pontos (arredonda para baixo)."""
    return int(reais * Decimal(str(PONTOS_POR_REAL)))


def calcular_saldo_pontos(usuario_id: str, db: Session) -> int:
    """Calcula saldo atual de pontos do usuario (soma de todos os creditos - debitos)."""
    resultado = db.query(func.sum(ExtratoPontos.pontos)).filter(
        ExtratoPontos.usuario_id == usuario_id
    ).scalar()
    return int(resultado or 0)


def adicionar_pontos(
    usuario_id: str,
    tipo: str,
    pontos: int,
    db: Session,
    valor_referencia: Decimal = None,
    detalhes: str = None
) -> ExtratoPontos:
    """Adiciona pontos ao extrato do usuario."""
    if pontos <= 0:
        return None
    
    extrato = ExtratoPontos(
        usuario_id=usuario_id,
        tipo=tipo,
        pontos=pontos,
        valor_referencia=valor_referencia,
        detalhes=detalhes
    )
    db.add(extrato)
    db.commit()
    db.refresh(extrato)
    return extrato


# =============================================================================
# PONTOS POR ENGAJAMENTO (acoes gratuitas)
# =============================================================================

def pontos_view_anuncio(usuario_id: str, link_id: int, db: Session) -> ExtratoPontos:
    """Usuario ganha pontos ao abrir/visualizar um anuncio."""
    # Verifica se ja ganhou pontos por este anuncio nas ultimas 24h
    from modelos.modelos_db import HistoricoClique
    ja_clicou = db.query(HistoricoClique).filter(
        HistoricoClique.usuario_id == usuario_id,
        HistoricoClique.link_id == link_id
    ).first()
    
    if ja_clicou:
        return None  # So ganha uma vez por anuncio
    
    # Registra o clique
    clique = HistoricoClique(usuario_id=usuario_id, link_id=link_id)
    db.add(clique)
    
    return adicionar_pontos(
        usuario_id=usuario_id,
        tipo="view_anuncio",
        pontos=PONTOS_VIEW_ANUNCIO,
        db=db,
        detalhes=f"Visualizou anuncio #{link_id}"
    )


def pontos_conversa(usuario_id: str, link_id: int, db: Session) -> ExtratoPontos:
    """Usuario ganha pontos ao iniciar conversa com vendedor."""
    return adicionar_pontos(
        usuario_id=usuario_id,
        tipo="conversa",
        pontos=PONTOS_CONVERSA,
        db=db,
        detalhes=f"Iniciou conversa sobre anuncio #{link_id}"
    )


def pontos_indicacao_cadastro(indicador_id: str, indicado_id: str, db: Session) -> ExtratoPontos:
    """Quem indicou ganha pontos quando o indicado se cadastra."""
    return adicionar_pontos(
        usuario_id=indicador_id,
        tipo="indicacao",
        pontos=PONTOS_INDICACAO_CADASTRO,
        db=db,
        detalhes=f"Indicou usuario #{indicado_id}"
    )


def pontos_postagem_anuncio(usuario_id: str, link_id: int, db: Session) -> ExtratoPontos:
    """Usuario ganha pontos ao postar anuncio no marketplace."""
    return adicionar_pontos(
        usuario_id=usuario_id,
        tipo="postagem",
        pontos=PONTOS_POSTAGEM_ANUNCIO,
        db=db,
        detalhes=f"Postou anuncio #{link_id}"
    )


def pontos_kyc(usuario_id: str, db: Session) -> ExtratoPontos:
    """Usuario ganha pontos ao completar verificacao KYC."""
    return adicionar_pontos(
        usuario_id=usuario_id,
        tipo="kyc",
        pontos=PONTOS_KYC,
        db=db,
        detalhes="Completou verificacao de identidade (KYC)"
    )


# =============================================================================
# PONTOS POR GASTO (cashback proporcional)
# =============================================================================

def pontos_cashback(usuario_id: str, tipo: str, valor_pago: Decimal, db: Session) -> ExtratoPontos:
    """
    Da pontos como cashback proporcional ao valor gasto.
    tipo: 'taxa_publicacao', 'taxa_match', 'taxa_destaque', 'taxa_boost', 'assinatura', 'kyc_pago'
    """
    taxas = {
        "taxa_publicacao": CASHBACK_TAXA_PUBLICACAO,
        "taxa_match": CASHBACK_TAXA_MATCH,
        "taxa_destaque": CASHBACK_TAXA_DESTAQUE,
        "taxa_boost": CASHBACK_TAXA_BOOST,
        "assinatura": CASHBACK_ASSINATURA,
        "kyc_pago": CASHBACK_KYC,
    }
    
    taxa = taxas.get(tipo, Decimal("0.05"))  # Default 5%
    valor_cashback = valor_pago * taxa
    pontos = _reais_para_pontos(valor_cashback)
    
    if pontos <= 0:
        return None
    
    labels = {
        "taxa_publicacao": "Cashback - Taxa de Publicacao",
        "taxa_match": "Cashback - Taxa de Match",
        "taxa_destaque": "Cashback - Destaque",
        "taxa_boost": "Cashback - Boost",
        "assinatura": "Cashback - Assinatura Premium",
        "kyc_pago": "Cashback - Verificacao KYC",
    }
    
    return adicionar_pontos(
        usuario_id=usuario_id,
        tipo=f"cashback_{tipo}",
        pontos=pontos,
        db=db,
        valor_referencia=valor_pago,
        detalhes=f"{labels.get(tipo, tipo)} | R$ {valor_pago:.2f} x {float(taxa)*100:.0f}% = {pontos} pts"
    )


# =============================================================================
# RESGATE DE PONTOS
# =============================================================================

def verificar_saldo_resgate(usuario_id: str, db: Session) -> dict:
    """Verifica se usuario tem saldo suficiente para resgatar (considerando taxa)."""
    saldo = calcular_saldo_pontos(usuario_id, db)
    valor_bruto = _pontos_para_reais(saldo)
    valor_liquido = max(Decimal("0.00"), valor_bruto - TAXA_RESGATE_REAIS)
    
    # Minimo: saldo deve cobrir o resgate minimo + taxa
    minimo_total = RESGATE_MINIMO_REAIS + TAXA_RESGATE_REAIS
    minimo_pontos_total = _reais_para_pontos(minimo_total)
    pode_resgatar = saldo >= minimo_pontos_total
    
    return {
        "saldo_pontos": saldo,
        "saldo_reais_bruto": float(valor_bruto),
        "saldo_reais_liquido": float(valor_liquido),
        "taxa_resgate": float(TAXA_RESGATE_REAIS),
        "pode_resgatar": pode_resgatar,
        "minimo_pontos": minimo_pontos_total,
        "minimo_reais": float(minimo_total),
        "falta_pontos": max(0, minimo_pontos_total - saldo),
    }


def solicitar_resgate(usuario_id: str, chave_pix: str, db: Session) -> dict:
    """
    Usuario solicita resgate de TODOS os pontos acumulados.
    Gera um PIX de saida da conta da empresa (CNPJ) para o usuario.
    """
    saldo_info = verificar_saldo_resgate(usuario_id, db)
    
    if not saldo_info["pode_resgatar"]:
        return {
            "sucesso": False,
            "mensagem": f"Saldo insuficiente. Voce precisa de {RESGATE_MINIMO_PONTOS} pts (R$ {float(RESGATE_MINIMO_REAIS):.2f}) para resgatar.",
            "saldo_atual": saldo_info["saldo_pontos"],
            "saldo_reais": saldo_info["saldo_reais"],
        }
    
    # Verifica se ja tem resgate pendente
    resgate_pendente = db.query(ResgatePontos).filter(
        ResgatePontos.usuario_id == usuario_id,
        ResgatePontos.status.in_(["pendente", "processando"])
    ).first()
    
    if resgate_pendente:
        return {
            "sucesso": False,
            "mensagem": "Voce ja tem um resgate em andamento. Aguarde o pagamento.",
            "resgate_id": resgate_pendente.id,
        }
    
    pontos = saldo_info["saldo_pontos"]
    valor_bruto = _pontos_para_reais(pontos)
    
    # Aplica taxa de resgate (R$ 2,99)
    valor_liquido = max(Decimal("0.00"), valor_bruto - TAXA_RESGATE_REAIS)
    
    # Verifica se o valor liquido e suficiente para cobrir a taxa
    if valor_liquido <= Decimal("0.00"):
        return {
            "sucesso": False,
            "mensagem": f"Saldo insuficiente para cobrir a taxa de resgate (R$ {float(TAXA_RESGATE_REAIS):.2f}). Acumule mais pontos.",
            "saldo_atual": saldo_info["saldo_pontos"],
            "taxa_resgate": float(TAXA_RESGATE_REAIS),
        }
    
    # Debita os pontos do extrato (valor bruto)
    debito = ExtratoPontos(
        usuario_id=usuario_id,
        tipo="resgate",
        pontos=-pontos,  # Negativo = debito
        valor_referencia=valor_bruto,
        detalhes=f"Solicitacao de resgate #{None} - R$ {float(valor_bruto):.2f} (taxa R$ {float(TAXA_RESGATE_REAIS):.2f})"
    )
    db.add(debito)
    db.flush()  # Para pegar o ID do debito
    
    # Atualiza detalhes com o ID real
    debito.detalhes = f"Solicitacao de resgate #{debito.id} - R$ {float(valor_bruto):.2f} (taxa R$ {float(TAXA_RESGATE_REAIS):.2f})"
    
    # Cria a solicitacao de resgate (valor liquido que o usuario recebe)
    resgate = ResgatePontos(
        usuario_id=usuario_id,
        pontos=pontos,
        valor=valor_liquido,
        chave_pix=chave_pix,
        status="pendente",
        detalhes=f"Resgate solicitado. Bruto: R$ {float(valor_bruto):.2f} | Taxa: R$ {float(TAXA_RESGATE_REAIS):.2f} | Liquido: R$ {float(valor_liquido):.2f} | Debito extrato #{debito.id}"
    )
    db.add(resgate)
    db.commit()
    db.refresh(resgate)
    
    # Atualiza o debito com o ID do resgate
    debito.detalhes = f"Solicitacao de resgate #{resgate.id} - R$ {float(valor_bruto):.2f} (taxa R$ {float(TAXA_RESGATE_REAIS):.2f})"
    db.commit()
    
    return {
        "sucesso": True,
        "mensagem": f"Resgate solicitado! Valor bruto: R$ {float(valor_bruto):.2f}. Taxa de resgate: R$ {float(TAXA_RESGATE_REAIS):.2f}. Voce recebera: R$ {float(valor_liquido):.2f} via PIX em ate 48h.",
        "resgate_id": resgate.id,
        "pontos_resgatados": pontos,
        "valor_bruto": float(valor_bruto),
        "taxa_resgate": float(TAXA_RESGATE_REAIS),
        "valor_liquido": float(valor_liquido),
        "chave_pix": chave_pix,
        "status": "pendente",
    }


def processar_resgate_pix(resgate_id: int, db: Session) -> dict:
    """
    [ADMIN] Processa o resgate gerando um PIX de saida.
    Em producao, isso usaria a API do Mercado Pago ou do banco da empresa.
    """
    resgate = db.query(ResgatePontos).filter(ResgatePontos.id == resgate_id).first()
    if not resgate:
        return {"sucesso": False, "mensagem": "Resgate nao encontrado."}
    
    if resgate.status != "pendente":
        return {"sucesso": False, "mensagem": f"Resgate ja esta {resgate.status}."}
    
    # Aqui voce integraria com o banco da empresa para gerar o PIX de saida
    # Por enquanto, simulamos
    resgate.status = "processando"
    db.commit()
    
    # TODO: Integrar com API do banco da empresa para gerar PIX de saida
    # Exemplo: SDK do Mercado Pago com access_token da conta da empresa (CNPJ)
    # payment_data = {
    #     "transaction_amount": float(resgate.valor),
    #     "description": f"Resgate de pontos - {resgate.usuario.nome}",
    #     "payment_method_id": "pix",
    #     "payer": {"email": resgate.usuario.email}
    # }
    # result = sdk.payment().create(payment_data)
    
    return {
        "sucesso": True,
        "mensagem": "Resgate em processamento. O PIX sera gerado em breve.",
        "resgate_id": resgate.id,
        "valor": float(resgate.valor),
        "chave_pix_destino": resgate.chave_pix,
    }


def confirmar_pagamento_resgate(resgate_id: int, payment_id: str, db: Session) -> dict:
    """[ADMIN ou Webhook] Confirma que o PIX de resgate foi pago."""
    resgate = db.query(ResgatePontos).filter(ResgatePontos.id == resgate_id).first()
    if not resgate:
        return {"sucesso": False, "mensagem": "Resgate nao encontrado."}
    
    resgate.status = "pago"
    resgate.payment_id = payment_id
    resgate.data_pagamento = datetime.datetime.now(timezone.utc)
    db.commit()
    
    return {
        "sucesso": True,
        "mensagem": f"Resgate #{resgate_id} pago com sucesso! R$ {float(resgate.valor):.2f} enviados.",
    }


# =============================================================================
# EXTRATO
# =============================================================================

def obter_extrato_completo(usuario_id: str, db: Session, limit: int = 100) -> list:
    """Retorna extrato completo de pontos do usuario."""
    registros = db.query(ExtratoPontos).filter(
        ExtratoPontos.usuario_id == usuario_id
    ).order_by(ExtratoPontos.data_criacao.desc()).limit(limit).all()
    
    resultado = []
    for r in registros:
        valor_reais = _pontos_para_reais(abs(r.pontos))
        resultado.append({
            "id": r.id,
            "tipo": r.tipo,
            "pontos": r.pontos,
            "valor_reais": float(valor_reais),
            "detalhes": r.detalhes,
            "data": r.data_criacao.isoformat(),
        })
    return resultado


def obter_hall_da_fama(db: Session, limit: int = 20) -> list:
    """
    Retorna os usuarios com mais pontos acumulados (lifetime).
    Nao ha premio automatico — e so um ranking de prestigio.
    """
    from sqlalchemy import func
    
    top = db.query(
        ExtratoPontos.usuario_id,
        func.sum(ExtratoPontos.pontos).label("total_pontos")
    ).group_by(ExtratoPontos.usuario_id).order_by(func.sum(ExtratoPontos.pontos).desc()).limit(limit).all()
    
    resultado = []
    for i, (uid, total) in enumerate(top, 1):
        usuario = db.query(Usuario).filter(Usuario.id == uid).first()
        if usuario:
            resultado.append({
                "posicao": i,
                "usuario_id": uid,
                "nome": usuario.nome,
                "pontos_acumulados": int(total or 0),
                "valor_acumulado": float(_pontos_para_reais(int(total or 0))),
            })
    return resultado


# =============================================================================
# ROTINA LEGACY (mantida para compatibilidade mas nao faz nada)
# =============================================================================

async def rotina_reset_ranking():
    """
    LEGACY: Mantida para compatibilidade, mas nao faz nada.
    O sistema de pontos agora e acumulativo (nao reseta).
    """
    print("🏆 Sistema de pontos acumulativo ativo. Reset semanal desativado.")
    while True:
        await asyncio.sleep(86400)  # Dorme 24h


import asyncio
