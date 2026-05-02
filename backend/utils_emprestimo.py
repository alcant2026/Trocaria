from sqlalchemy.orm import Session
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, Usuario
from decimal import Decimal
import datetime
from typing import Optional


def calcular_mora(solicitacao: SolicitacaoEmprestimo, valor_parcela: Decimal) -> Decimal:
    agora = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
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


def calcular_valor_parcela(solicitacao: SolicitacaoEmprestimo) -> dict:
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    valor_parcela_base = total_com_juros / solicitacao.prazo_meses
    mora = calcular_mora(solicitacao, valor_parcela_base)
    return {
        "parcela": float(valor_parcela_base),
        "juros": float(total_com_juros - solicitacao.valor) / solicitacao.prazo_meses,
        "mora": float(mora),
        "total": float(valor_parcela_base + mora)
    }


def confirmar_pagamento_externo(db: Session, solicitacao_id: int, pagador_id: str, valor_pago: Decimal) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == pagador_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao:
        raise ValueError("Emprestimo nao encontrado ou nao esta ativo.")

    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    if parcelas_restantes <= 0:
        raise ValueError("Emprestimo ja esta totalmente pago.")

    hoje = datetime.datetime.now(datetime.timezone.utc)

    # Calcular mora se estiver atrasado
    detalhes_parcela = calcular_valor_parcela(solicitacao)
    tem_mora = detalhes_parcela["mora"] > 0

    db.add(Transacao(
        usuario_id=pagador_id,
        valor=valor_pago,
        tipo=TipoTransacao.CONFIRMACAO_PAGAMENTO,
        status="pendente",
        data_criacao=hoje,
        detalhes=f"Pagamento de R$ {valor_pago} confirmado pelo tomador — Pedido #{solicitacao.id}. {('Mora: R$ ' + str(detalhes_parcela["mora"])) if tem_mora else 'Em dia.'} Aguardando confirmacao do credor."
    ))

    solicitacao.confirmacao_pagamento_data = hoje
    db.commit()

    return {
        "message": "Pagamento registrado! O credor precisa confirmar o recebimento.",
        "solicitacao_id": solicitacao.id,
        "credor_id": solicitacao.credor_id,
        "valor_pago": float(valor_pago),
        "mora_aplicada": detalhes_parcela["mora"],
        "em_dia": not tem_mora
    }


def confirmar_recebimento_externo(db: Session, solicitacao_id: int, credor_id: str) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.credor_id == credor_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao:
        raise ValueError("Emprestimo nao encontrado ou nao esta ativo.")

    credor = db.query(Usuario).filter(Usuario.id == credor_id).first()
    tomador = db.query(Usuario).filter(Usuario.id == solicitacao.usuario_id).first()

    solicitacao.parcelas_pagas += 1

    # Calcular valores
    taxa_mensal = solicitacao.taxa_juros / 100
    principal_parcela = solicitacao.valor / solicitacao.prazo_meses
    juros_parcela = solicitacao.valor * taxa_mensal
    valor_parcela = principal_parcela + juros_parcela
    mora = calcular_mora(solicitacao, valor_parcela)
    tem_mora = mora > 0

    # Liberar para o credor: principal + juros + mora
    credor.credito_virtual = (credor.credito_virtual or Decimal("0.00")) + valor_parcela + mora

    tipo_pagamento = "parcela"
    if solicitacao.valor_amortizado is None:
        solicitacao.valor_amortizado = Decimal("0.00")

    if solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
        solicitacao.status = StatusSolicitacao.CONCLUIDO
        solicitacao.data_quitacao = datetime.datetime.now(datetime.timezone.utc)
        tomador.inadimplente = False
        credor.emprestimos_ativos = max(0, (credor.emprestimos_ativos or 1) - 1)
        tomador.emprestimos_concluidos = (tomador.emprestimos_concluidos or 0) + 1
        tipo_pagamento = "quitacao"
    else:
        solicitacao.proximo_vencimento += datetime.timedelta(days=30)

    # Score
    if not tem_mora:
        tomador.score = (tomador.score or Decimal("0.00")) + Decimal("5.0")
        if tomador.score > Decimal("1000"):
            tomador.score = Decimal("1000")

    db.add(Transacao(
        usuario_id=credor_id,
        valor=valor_parcela + mora,
        tipo=TipoTransacao.CONFIRMACAO_RECEBIMENTO,
        status="concluido",
        detalhes=f"Recebimento confirmado — {tipo_pagamento.upper()} {solicitacao.parcelas_pagas}/{solicitacao.prazo_meses}" + (f" (Mora: R$ {mora})" if tem_mora else "")
    ))

    db.commit()
    return {
        "message": "Recebimento confirmado! Parcela registrada.",
        "parcelas_pagas": solicitacao.parcelas_pagas,
        "total_parcelas": solicitacao.prazo_meses,
        "quitado": solicitacao.status == StatusSolicitacao.CONCLUIDO,
        "tipo_pagamento": tipo_pagamento,
        "valor_recebido": float(valor_parcela + mora),
        "mora_aplicada": float(mora),
        "em_dia": not tem_mora
    }


def aplicar_calote(solicitacao_id: int, db: Session) -> dict:
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao:
        raise ValueError("Emprestimo nao encontrado ou nao esta ativo.")

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
        detalhes=f"CALOTE — Pedido #{solicitacao.id} marcado como inadimplente"
    ))

    db.commit()

    return {
        "message": f"Calote registrado. {tomador.nome} marcado como inadimplente.",
        "score_perdido": -200,
        "credor_reembolsado": float(solicitacao.valor)
    }
