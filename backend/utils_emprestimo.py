from sqlalchemy.orm import Session
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, Usuario
from decimal import Decimal
import datetime


def calcular_mora(solicitacao: SolicitacaoEmprestimo, valor_parcela: Decimal) -> Decimal:
    agora = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
    if not solicitacao.proximo_vencimento or agora <= solicitacao.proximo_vencimento:
        return Decimal("0.00")
    atraso = (agora - solicitacao.proximo_vencimento).days
    return valor_parcela * Decimal("0.02") + (valor_parcela * Decimal("0.001") * atraso)


def calcular_divida_total(solicitacao: SolicitacaoEmprestimo):
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    total_com_juros += (solicitacao.taxas_adicionais or Decimal("0.00"))
    valor_parcela_base = total_com_juros / solicitacao.prazo_meses
    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    valor_quittance_base = valor_parcela_base * parcelas_restantes
    mora = calcular_mora(solicitacao, valor_parcela_base)
    return valor_quittance_base + mora


def confirmar_pagamento_externo(db: Session, solicitacao_id: int, pagador_id: str, valor_pago: Decimal) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == pagador_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()
    if not solicitacao:
        raise ValueError("Emprestimo nao encontrado.")
    hoje = datetime.datetime.now(datetime.timezone.utc)
    db.add(Transacao(
        usuario_id=pagador_id, valor=valor_pago, tipo=TipoTransacao.CONFIRMACAO_PAGAMENTO,
        status="pendente", data_criacao=hoje,
        detalhes=f"Pagamento de R$ {valor_pago} — Pedido #{solicitacao.id}. Aguardando confirmacao."
    ))
    solicitacao.confirmacao_pagamento_data = hoje
    db.commit()
    return {"message": "Pagamento registrado! Credor precisa confirmar.", "solicitacao_id": solicitacao.id, "credor_id": solicitacao.credor_id}


def confirmar_recebimento_externo(db: Session, solicitacao_id: int, credor_id: str, tipo_pagamento: str = "parcela") -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.credor_id == credor_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()
    if not solicitacao:
        raise ValueError("Emprestimo nao encontrado.")

    if tipo_pagamento == "quitacao":
        solicitacao.parcelas_pagas = solicitacao.prazo_meses
        solicitacao.status = StatusSolicitacao.CONCLUIDO
    elif tipo_pagamento == "avulso":
        pass
    else:
        solicitacao.parcelas_pagas += 1
        if solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
            solicitacao.status = StatusSolicitacao.CONCLUIDO
        else:
            solicitacao.proximo_vencimento += datetime.timedelta(days=30)

    detalhes_pgto = {"parcela": "Parcela", "avulso": "Pagamento parcial", "quitacao": "Quitacao total"}
    db.add(Transacao(
        usuario_id=credor_id, valor=Decimal("0.00"), tipo=TipoTransacao.CONFIRMACAO_RECEBIMENTO,
        status="concluido",
        detalhes=f"Recebimento confirmado — {detalhes_pgto.get(tipo_pagamento, 'Parcela')} {solicitacao.parcelas_pagas}/{solicitacao.prazo_meses}"
    ))
    db.commit()
    return {
        "message": "Recebimento confirmado!",
        "quitado": solicitacao.status == StatusSolicitacao.CONCLUIDO,
        "tipo_pagamento": tipo_pagamento,
        "parcelas_pagas": solicitacao.parcelas_pagas,
        "total_parcelas": solicitacao.prazo_meses
    }


def aplicar_calote(solicitacao_id: int, db: Session) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()
    if not solicitacao:
        raise ValueError("Emprestimo nao encontrado.")
    tomador = db.query(Usuario).filter(Usuario.id == solicitacao.usuario_id).first()
    tomador.score = max(Decimal("0.00"), (tomador.score or Decimal("0.00")) - Decimal("200"))
    solicitacao.status = StatusSolicitacao.CANCELADO
    db.commit()
    return {"message": f"Calote registrado para {tomador.nome}.", "score_perdido": -200}
