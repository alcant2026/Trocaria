from sqlalchemy.orm import Session
from sqlalchemy import func
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao
from decimal import Decimal
import datetime


def calcular_limite_credito(usuario: Usuario, db: Session) -> Decimal:
    if usuario.limite_credito_personalizado is not None:
        return usuario.limite_credito_personalizado

    if not usuario.is_verified:
        return Decimal("10.00")

    score = usuario.score or Decimal("0.00")
    limite = Decimal("20.00")

    if score >= Decimal("900.00"):
        limite = Decimal("500.00")
    elif score >= Decimal("800.00"):
        limite = Decimal("200.00")
    elif score >= Decimal("700.00"):
        bonus = ((score - Decimal("700.00")) / Decimal("100.00")) * Decimal("50.00")
        limite = min(Decimal("200.00"), Decimal("50.00") + bonus)
    elif score >= Decimal("500.00"):
        bonus = ((score - Decimal("500.00")) / Decimal("100.00")) * Decimal("10.00")
        limite = Decimal("20.00") + bonus

    return limite


def verificar_isencao_taxa(usuario: Usuario) -> bool:
    return True


def saldo_disponivel_pool(db: Session) -> Decimal:
    total = db.query(func.sum(Usuario.credito_virtual)).filter(
        Usuario.credito_virtual > 0
    ).scalar() or Decimal("0.00")
    return total


def adicionar_credito_virtual(usuario_id: str, valor: Decimal, db: Session) -> dict:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise ValueError("Usuário não encontrado.")

    taxa = valor * Decimal("0.02")
    credito = valor

    usuario.credito_virtual = (usuario.credito_virtual or Decimal("0.00")) + credito

    db.add(Transacao(
        usuario_id=usuario.id,
        valor=credito,
        tipo=TipoTransacao.DEPOSITO,
        status="concluido",
        detalhes=f"Depósito virtual de R$ {credito} (taxa de {taxa} já paga via PIX)"
    ))
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=taxa,
        tipo=TipoTransacao.TAXA_DEPOSITO_VIRTUAL,
        status="concluido",
        detalhes=f"Taxa de 2% sobre depósito virtual de R$ {valor}"
    ))
    db.commit()

    return {
        "credito_virtual": float(usuario.credito_virtual),
        "taxa_paga": float(taxa)
    }


def resgatar_credito_virtual(usuario_id: str, valor: Decimal, db: Session) -> dict:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).with_for_update().first()
    if not usuario:
        raise ValueError("Usuário não encontrado.")

    saldo_atual = usuario.credito_virtual or Decimal("0.00")
    if valor > saldo_atual:
        raise ValueError(f"Saldo virtual insuficiente. Disponível: R$ {saldo_atual}")

    usuario.credito_virtual -= valor

    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor,
        tipo=TipoTransacao.SAQUE,
        status="pendente",
        detalhes=f"Resgate de crédito virtual — enviaremos PIX no valor de R$ {valor}"
    ))
    db.commit()

    return {"message": "Resgate solicitado. O valor será enviado via PIX.", "novo_saldo": float(usuario.credito_virtual)}


def criar_solicitacao_p2p(usuario_id: str, valor: Decimal, prazo: int, taxa: Decimal, db: Session, ip_cliente: str = None) -> SolicitacaoEmprestimo:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    pool_total = saldo_disponivel_pool(db)

    if valor > pool_total:
        raise ValueError(
            f"Saldo do fundo coletivo insuficiente. Disponível: R$ {pool_total:.2f}. "
            f"Aguarde mais investidores aportarem."
        )

    agora = datetime.datetime.now(datetime.timezone.utc)
    nova_solicitacao = SolicitacaoEmprestimo(
        usuario_id=usuario.id,
        valor=valor,
        taxa_juros=taxa,
        prazo_meses=prazo,
        status=StatusSolicitacao.PENDENTE,
        data_criacao=agora,
        proximo_vencimento=agora + datetime.timedelta(days=30),
        aceite_termos=True,
        data_aceite=agora,
        ip_aceite=ip_cliente,
        cpf_aceite=usuario.cpf
    )
    db.add(nova_solicitacao)
    db.flush()

    db.commit()
    return nova_solicitacao


def aceitar_oferta(solicitacao_id: int, credor_id: str, db: Session) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).first()

    if not solicitacao:
        raise ValueError("Solicitação não encontrada ou já foi aceita.")

    credor = db.query(Usuario).filter(Usuario.id == credor_id).with_for_update().first()
    if not credor:
        raise ValueError("Investidor não encontrado.")

    score_credor = credor.score or Decimal("0.00")
    if score_credor < Decimal("850.00"):
        raise ValueError(
            f"Score mínimo para investir é 850. Seu score atual é {score_credor}. "
            f"Complete seu cadastro, pague taxas em dia e aumente seu score."
        )

    credito_atual = credor.credito_virtual or Decimal("0.00")
    if credito_atual < solicitacao.valor:
        raise ValueError(
            f"Saldo virtual insuficiente. Você tem R$ {credito_atual} disponíveis "
            f"para emprestar."
        )

    tomador = db.query(Usuario).filter(Usuario.id == solicitacao.usuario_id).first()

    credor.credito_virtual -= solicitacao.valor
    credor.valor_emprestado = (credor.valor_emprestado or Decimal("0.00")) + solicitacao.valor
    credor.emprestimos_ativos = (credor.emprestimos_ativos or 0) + 1

    solicitacao.status = StatusSolicitacao.APROVADO
    solicitacao.credor_id = credor.id
    solicitacao.chave_pix_credor = credor.chave_pix_publica or credor.chave_pix
    solicitacao.proximo_vencimento = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)

    db.commit()

    return {
        "message": "Oferta aceita! Envie o valor via PIX para o tomador.",
        "tomador_nome": tomador.nome,
        "chave_pix_tomador": tomador.chave_pix_publica or tomador.chave_pix,
        "valor": float(solicitacao.valor),
        "parcelas": solicitacao.prazo_meses,
        "score_tomador": float(tomador.score),
        "inadimplente": tomador.inadimplente
    }
