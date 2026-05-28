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

# =============================================================================
# PRODUTOS PARA RESGATE (Top 20)
# =============================================================================

WHATSAPP_PLATAFORMA = "91980177874"

def calcular_pontos_minimos(valor_reais: Decimal) -> int:
    """Converte valor em R$ para pontos minimos necessarios."""
    return int(valor_reais * Decimal(str(PONTOS_POR_REAL)))


def usuario_esta_no_top20(usuario_id: str, db: Session) -> bool:
    """Verifica se o usuario esta entre os 20 com mais pontos."""
    from sqlalchemy import func
    top = db.query(
        ExtratoPontos.usuario_id,
        func.sum(ExtratoPontos.pontos).label("total_pontos")
    ).group_by(ExtratoPontos.usuario_id).order_by(
        func.sum(ExtratoPontos.pontos).desc()
    ).limit(20).all()
    ids_top = [uid for uid, _ in top]
    return usuario_id in ids_top


def janela_resgate_aberta() -> bool:
    """
    Retorna True se ainda nao deu sabado 18h (horario de Brasilia).
    O resgate abre automaticamente e fecha sabado as 18:00.
    """
    agora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3)))
    if agora.weekday() == 5 and agora.hour >= 18:
        return False
    return True


def obter_posicao_usuario(usuario_id: str, db: Session) -> int:
    """Retorna a posicao do usuario no ranking geral (0 se nao estiver no top)."""
    from sqlalchemy import func
    ranking = db.query(
        ExtratoPontos.usuario_id,
        func.sum(ExtratoPontos.pontos).label("total_pontos")
    ).group_by(ExtratoPontos.usuario_id).order_by(
        func.sum(ExtratoPontos.pontos).desc()
    ).limit(20).all()
    for i, (uid, _) in enumerate(ranking, 1):
        if uid == usuario_id:
            return i
    return 0


def proximo_fechamento() -> str:
    """Retorna string com data do proximo fechamento (sabado 18h BRT)."""
    agora = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3)))
    dias_ate_sabado = (5 - agora.weekday()) % 7
    if dias_ate_sabado == 0 and agora.hour >= 18:
        dias_ate_sabado = 7
    proximo = agora + datetime.timedelta(days=dias_ate_sabado)
    proximo = proximo.replace(hour=18, minute=0, second=0, microsecond=0)
    return proximo.strftime("%d/%m/%Y %H:%M")
