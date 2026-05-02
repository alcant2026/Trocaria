from sqlalchemy.orm import Session
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao
from decimal import Decimal
import datetime


def criar_solicitacao_p2p(usuario_id: str, valor: Decimal, prazo: int, taxa: Decimal, db: Session, ip_cliente: str = None) -> SolicitacaoEmprestimo:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise ValueError("Usuário não encontrado.")

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

    credor = db.query(Usuario).filter(Usuario.id == credor_id).first()
    tomador = db.query(Usuario).filter(Usuario.id == solicitacao.usuario_id).first()

    if not credor:
        raise ValueError("Usuário não encontrado.")

    # Taxa de match: 2% do valor (min R$ 2, max R$ 20)
    taxa_match = solicitacao.valor * Decimal("0.02")
    if taxa_match < Decimal("2.00"):
        taxa_match = Decimal("2.00")
    if taxa_match > Decimal("20.00"):
        taxa_match = Decimal("20.00")

    solicitacao.taxas_adicionais = (solicitacao.taxas_adicionais or Decimal("0.00")) + taxa_match
    solicitacao.status = StatusSolicitacao.APROVADO
    solicitacao.credor_id = credor.id
    solicitacao.chave_pix_credor = credor.chave_pix_publica or credor.chave_pix
    solicitacao.proximo_vencimento = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)

    # Registrar transação da taxa
    db.add(Transacao(
        usuario_id=tomador.id,
        valor=taxa_match,
        tipo=TipoTransacao.TAXA_MATCH,
        status="concluido",
        detalhes=f"Taxa de match de R$ {taxa_match} — Pedido #{solicitacao.id}"
    ))

    db.commit()

    return {
        "message": "Oferta aceita! Envie o valor via PIX para o tomador.",
        "tomador_nome": tomador.nome,
        "chave_pix_tomador": tomador.chave_pix_publica or tomador.chave_pix,
        "valor": float(solicitacao.valor),
        "taxa_match": float(taxa_match),
        "total_com_taxa": float(solicitacao.valor + taxa_match),
        "parcelas": solicitacao.prazo_meses,
    }
