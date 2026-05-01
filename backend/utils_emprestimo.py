from sqlalchemy.orm import Session
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, Usuario
from decimal import Decimal
import datetime
from typing import Optional


def calcular_mora(solicitacao: SolicitacaoEmprestimo, valor_parcela: Decimal) -> Decimal:
    agora = datetime.datetime.now(datetime.timezone.utc)
    if not solicitacao.proximo_vencimento or agora <= solicitacao.proximo_vencimento:
        return Decimal("0.00")
    atraso = (agora - solicitacao.proximo_vencimento).days
    return valor_parcela * Decimal("0.02") + (valor_parcela * Decimal("0.001") * atraso)


def creditar_plataforma(db: Session, valor: Decimal, solicitacao_id: int, descricao: str) -> Optional[Usuario]:
    admin = db.query(Usuario).filter(Usuario.is_admin == True).first()
    if admin:
        db.add(Transacao(
            usuario_id=admin.id,
            valor=valor,
            tipo=TipoTransacao.TAXA_ORIGEM,
            status="concluido",
            detalhes=f"{descricao} - Pedido #{solicitacao_id}"
        ))
    return admin


def limpar_cache(cache: dict, *user_ids: str):
    for uid in user_ids:
        cache.pop(uid, None)


def calcular_divida_total(solicitacao: SolicitacaoEmprestimo):
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    valor_parcela_base = total_com_juros / solicitacao.prazo_meses
    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    valor_quittance_base = valor_parcela_base * parcelas_restantes
    valor_quittance_base += (solicitacao.taxas_adicionais or Decimal("0.00"))
    mora_atraso = calcular_mora(solicitacao, valor_parcela_base)
    return valor_quittance_base + mora_atraso


def confirmar_pagamento_externo(db: Session, solicitacao_id: int, pagador_id: str, valor_pago: Decimal) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == pagador_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao:
        raise ValueError("Empréstimo não encontrado ou não está ativo.")

    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    if parcelas_restantes <= 0:
        raise ValueError("Empréstimo já está totalmente pago.")

    hoje = datetime.datetime.now(datetime.timezone.utc)

    db.add(Transacao(
        usuario_id=pagador_id,
        valor=valor_pago,
        tipo=TipoTransacao.CONFIRMACAO_PAGAMENTO,
        status="pendente",
        data_criacao=hoje,
        detalhes=f"Pagamento confirmado pelo tomador — Pedido #{solicitacao.id}. Aguardando confirmação do credor."
    ))

    solicitacao.confirmacao_pagamento_data = hoje
    db.commit()

    return {
        "message": "Pagamento registrado! O credor precisa confirmar o recebimento.",
        "solicitacao_id": solicitacao.id,
        "credor_id": solicitacao.credor_id
    }


def confirmar_recebimento_externo(db: Session, solicitacao_id: int, credor_id: str) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.credor_id == credor_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao:
        raise ValueError("Empréstimo não encontrado ou não está ativo.")

    credor = db.query(Usuario).filter(Usuario.id == credor_id).first()
    tomador = db.query(Usuario).filter(Usuario.id == solicitacao.usuario_id).first()

    solicitacao.parcelas_pagas += 1

    if solicitacao.parcelas_pagas == 1:
        credor.credito_virtual = (credor.credito_virtual or Decimal("0.00")) + solicitacao.valor

    juros_parcela = solicitacao.valor * (solicitacao.taxa_juros / 100)
    credor.credito_virtual = (credor.credito_virtual or Decimal("0.00")) + juros_parcela

    if solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
        solicitacao.status = StatusSolicitacao.CONCLUIDO
        solicitacao.data_quitacao = datetime.datetime.now(datetime.timezone.utc)
        tomador.inadimplente = False
        credor.emprestimos_ativos = max(0, (credor.emprestimos_ativos or 1) - 1)
        tomador.emprestimos_concluidos = (tomador.emprestimos_concluidos or 0) + 1
    else:
        solicitacao.proximo_vencimento += datetime.timedelta(days=30)

    db.add(Transacao(
        usuario_id=credor_id,
        valor=Decimal("0.00"),
        tipo=TipoTransacao.CONFIRMACAO_RECEBIMENTO,
        status="concluido",
        detalhes=f"Recebimento confirmado — Parcela {solicitacao.parcelas_pagas}/{solicitacao.prazo_meses}"
    ))

    db.commit()
    return {
        "message": "Recebimento confirmado! Parcela registrada.",
        "parcelas_pagas": solicitacao.parcelas_pagas,
        "total_parcelas": solicitacao.prazo_meses,
        "quitado": solicitacao.status == StatusSolicitacao.CONCLUIDO
    }


def aplicar_calote(solicitacao_id: int, db: Session) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao:
        raise ValueError("Empréstimo não encontrado ou não está ativo.")

    tomador = db.query(Usuario).filter(Usuario.id == solicitacao.usuario_id).first()
    credor = db.query(Usuario).filter(Usuario.id == solicitacao.credor_id).first()

    tomador.inadimplente = True
    tomador.qtd_calotes = (tomador.qtd_calotes or 0) + 1
    tomador.score = max(Decimal("0.00"), (tomador.score or Decimal("0.00")) - Decimal("200"))

    juros_perdidos = solicitacao.valor * (solicitacao.taxa_juros / 100) * (solicitacao.prazo_meses - solicitacao.parcelas_pagas)
    credor.credito_virtual = (credor.credito_virtual or Decimal("0.00")) + solicitacao.valor + juros_perdidos

    solicitacao.status = StatusSolicitacao.CANCELADO

    db.add(Transacao(
        usuario_id=tomador.id,
        valor=solicitacao.valor,
        tipo=TipoTransacao.CONFIRMACAO_PAGAMENTO,
        status="cancelado",
        detalhes=f"CALOTE — Empréstimo #{solicitacao.id} marcado como inadimplente"
    ))

    db.commit()

    return {
        "message": f"Calote registrado. {tomador.nome} marcado como inadimplente.",
        "score_perdido": -200,
        "credor_reembolsado": float(solicitacao.valor)
    }
