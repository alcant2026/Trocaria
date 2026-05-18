from sqlalchemy.orm import Session
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao
from decimal import Decimal
import datetime
import json


def criar_solicitacao_p2p(usuario_id: str, valor: Decimal, prazo: int, taxa: Decimal, db: Session, ip_cliente: str = None, aceite_plataforma: bool = False) -> SolicitacaoEmprestimo:
    if not aceite_plataforma:
        raise ValueError("Voce precisa aceitar as regras da plataforma.")

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise ValueError("Usuário não encontrado.")

    # Anti-fraude: verifica tomador antes de criar pedido
    from utils_seguranca import verificar_conta_suspeita
    risco = verificar_conta_suspeita(db, usuario)
    if risco["bloquear_operacoes"]:
        raise ValueError(f"Operacao bloqueada: conta em analise. Motivo: {', '.join(risco['flags'])}")

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
        aceite_termos_plataforma=True,
        ip_aceite_plataforma=ip_cliente,
        data_aceite_plataforma=agora,
        data_aceite=agora,
        ip_aceite=ip_cliente,
        cpf_aceite=usuario.cpf
    )
    db.add(nova_solicitacao)
    db.flush()
    db.commit()
    return nova_solicitacao


def calcular_taxa_solicitacao(valor: Decimal) -> Decimal:
    taxa = valor * Decimal("0.02")
    if taxa < Decimal("2.00"):
        taxa = Decimal("2.00")
    if taxa > Decimal("20.00"):
        taxa = Decimal("20.00")
    return taxa


def calcular_taxa_match(valor: Decimal) -> Decimal:
    return Decimal("2.00")


def aceitar_oferta(solicitacao_id: int, credor_id: str, db: Session, ip_cliente: str = None, aceite_plataforma: bool = False) -> dict:
    if not aceite_plataforma:
        raise ValueError("Voce precisa aceitar as regras da plataforma antes de apoiar.")

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

    # Anti-fraude: verifica credor e tomador
    from utils_seguranca import verificar_conta_suspeita
    risco_credor = verificar_conta_suspeita(db, credor)
    if risco_credor["bloquear_operacoes"]:
        raise ValueError(f"Operacao bloqueada: conta do apoiador em analise. Motivo: {', '.join(risco_credor['flags'])}")
    risco_tomador = verificar_conta_suspeita(db, tomador)
    if risco_tomador["bloquear_operacoes"]:
        raise ValueError(f"Operacao bloqueada: conta do tomador em analise. Motivo: {', '.join(risco_tomador['flags'])}")

    taxa_match = calcular_taxa_match(solicitacao.valor)
    agora = datetime.datetime.now(datetime.timezone.utc)

    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    payment_id = "pendente"

    if sdk:
        payment_data = {
            "transaction_amount": float(taxa_match),
            "description": f"Taxa de match - Pedido #{solicitacao.id}",
            "payment_method_id": "pix",
            "payer": {"email": credor.email}
        }
        result = sdk.payment().create(payment_data)
        payment = result.get("response", {})
        if result.get("status") in [200, 201]:
            payment_id = str(payment.get("id"))

    dados_match = json.dumps({
        "solicitacao_id": solicitacao.id,
        "credor_id": credor.id,
        "tomador_id": tomador.id
    })

    transacao = Transacao(
        usuario_id=credor.id,
        valor=taxa_match,
        tipo=TipoTransacao.TAXA_MATCH,
        status="pendente",
        payment_id=payment_id,
        metodo="pix",
        detalhes=f"MATCH_PENDENTE:{dados_match}"
    )
    db.add(transacao)
    db.commit()

    return {
        "message": "Pague a taxa de match via PIX para confirmar o apoio.",
        "tomador_nome": tomador.nome,
        "chave_pix_tomador": tomador.chave_pix,
        "tomador_telefone": tomador.telefone,
        "valor": float(solicitacao.valor),
        "taxa_match": float(taxa_match),
        "parcelas": solicitacao.prazo_meses,
        "qr_code": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code") if sdk else None,
        "qr_code_base64": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64") if sdk else None,
        "payment_id": payment_id,
        "transacao_id": transacao.id
    }


def confirmar_match(db: Session, transacao_id: int) -> dict:
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.tipo == TipoTransacao.TAXA_MATCH,
        Transacao.status == "pendente"
    ).first()
    if not transacao:
        raise ValueError("Transacao nao encontrada.")

    import json as _json
    dados_str = transacao.detalhes.replace("MATCH_PENDENTE:", "") if transacao.detalhes else None
    if not dados_str:
        raise ValueError("Dados do match nao encontrados.")

    dados = _json.loads(dados_str)
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == dados["solicitacao_id"],
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).first()
    if not solicitacao:
        raise ValueError("Solicitacao nao encontrada ou ja foi aceita.")

    credor = db.query(Usuario).filter(Usuario.id == dados["credor_id"]).first()
    tomador = db.query(Usuario).filter(Usuario.id == dados["tomador_id"]).first()

    taxa_match = calcular_taxa_match(solicitacao.valor)
    solicitacao.taxas_adicionais = (solicitacao.taxas_adicionais or Decimal("0.00")) + taxa_match
    solicitacao.status = StatusSolicitacao.APROVADO
    solicitacao.credor_id = credor.id
    solicitacao.chave_pix_credor = credor.chave_pix
    solicitacao.proximo_vencimento = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
    solicitacao.aceite_termos_plataforma = True
    solicitacao.ip_aceite_plataforma = transacao.id

    transacao.status = "concluido"
    transacao.detalhes = f"Match confirmado - Pedido #{solicitacao.id} - Taxa R$ {taxa_match}"

    db.commit()

    return {
        "message": "Match confirmado! Envie o valor via PIX para o tomador.",
        "tomador_nome": tomador.nome,
        "chave_pix_tomador": tomador.chave_pix,
        "tomador_telefone": tomador.telefone,
        "valor": float(solicitacao.valor),
        "taxa_match": float(taxa_match),
        "parcelas": solicitacao.prazo_meses
    }
