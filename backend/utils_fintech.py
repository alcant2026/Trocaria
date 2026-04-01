from sqlalchemy.orm import Session
from sqlalchemy import func
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, Investimento
from decimal import Decimal
import datetime

def calcular_limite_credito(usuario: Usuario, db: Session) -> Decimal:
    """
    Calcula o limite de crédito progressivo do usuário.
    Regras:
    - Se limite_credito_personalizado estiver definido, usa ele (Override).
    - Se Score >= 700 e is_verified, ganha crédito progressivo mesmo sem saldo no pool.
    - Mínimo R$ 100 no Pool para ter crédito base se as condições acima não atendidas.
    """
    if usuario.limite_credito_personalizado is not None:
        return usuario.limite_credito_personalizado

    saldo_pool = usuario.saldo_caixa or Decimal("0.00")
    score = usuario.score or Decimal("0.00")
    
    # Regra: Microcrédito Progressivo (Zero Pool)
    if usuario.is_verified and score >= Decimal("700.00"):
        if score >= Decimal("900.00"):
            return Decimal("500.00")
        elif score >= Decimal("800.00"):
            return Decimal("200.00")
        else:
            return Decimal("50.00")

    if saldo_pool <= Decimal("1.00"):
        return Decimal("0.00")

    # NOVO: Trava de Segurança KYC
    # Se não for verificado, o limite é estritamente o que ele tem no Pool (Garantia 1:1)
    if not usuario.is_verified:
        return saldo_pool

    # Regra: Limite Base de R$ 20,00 se tiver saldo no Pool (Apenas para VERIFICADOS)
    limite_base = Decimal("20.00")

    # Se o score for excelente (Ex: VIP), libera o multiplicador de 1.2x o capital
    if score >= Decimal("800.00"):
        return max(limite_base, saldo_pool * Decimal("1.2"))
    
    # Lógica de progressão adicional: +10 reais para cada 100 pontos de score acima de 500
    if score > Decimal("500.00"):
        bonus_score = ((score - Decimal("500.00")) / Decimal("100.00")) * Decimal("10.00")
        limite_base += bonus_score

    return limite_base

def verificar_isencao_taxa(usuario: Usuario) -> bool:
    """
    Verifica se o usuário é isento da taxa de postagem/solicitação.
    Regra: Score >= 500 e Saldo Pool > 100.
    """
    saldo_pool = usuario.saldo_caixa or Decimal("0.00")
    score = usuario.score or Decimal("0.00")
    
    if score >= Decimal("500.0") and saldo_pool > Decimal("100.00"):
        return True
    return False

def aprovar_emprestimo_instantaneo(usuario_id: str, valor: Decimal, prazo: int, taxa: Decimal, db: Session, taxa_adesao: Decimal = Decimal("0.00")) -> SolicitacaoEmprestimo:
    """
    Cria e aprova instantaneamente um empréstimo usando o dinheiro da plataforma (Pool).
    A taxa_adesao (se houver) é somada como custos financeiros (taxas_adicionais).
    """
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).with_for_update().first()
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    
    # 0. Verificar Liquidez Global do Pool (Regra de 30% de Reserva)
    total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")
    # Apenas 70% da liquidez total pode ser emprestada (30% reservado para saques)
    reservado = total_pool * Decimal("0.30")
    disponivel_emprestimo = total_pool - reservado
    
    if valor > disponivel_emprestimo:
        raise ValueError(
            f"Liquidez insuficiente no Pool. Para segurança do sistema, mantemos uma reserva de 30% para resgates. "
            f"Disponível para novos empréstimos: R$ {disponivel_emprestimo:,.2f}"
        )

    if plataforma.saldo < valor:
         # Se a plataforma não tem saldo direto, tenta usar o saldo_caixa da plataforma (Pool)
         if plataforma.saldo_caixa >= valor:
             plataforma.saldo_caixa -= valor
             plataforma.saldo += valor # Move para o saldo para processar a transferência
         else:
             # Se mesmo assim não for no saldo da 000PL, mas houver no pool global, 
             # o saldo da 000PL pode ficar temporariamente negativo (lastreado pelos outros usuários)
             # pois a cooperativa garante a operação.
             plataforma.saldo += valor 

    # 1. Criar a Solicitação já APROVADA
    nova_solicitacao = SolicitacaoEmprestimo(
        usuario_id=usuario.id,
        valor=valor,
        taxa_juros=taxa,
        prazo_meses=prazo,
        status=StatusSolicitacao.APROVADO,
        data_criacao=datetime.datetime.utcnow(),
        proximo_vencimento=datetime.datetime.utcnow() + datetime.timedelta(days=30),
        aceite_termos=True,
        taxas_adicionais=taxa_adesao # A taxa de abertura é somada à dívida
    )
    db.add(nova_solicitacao)
    db.flush()

    # 2. Registrar o "Investimento" Único do Sistema
    investimento_sistema = Investimento(
        investidor_id=plataforma.id,
        solicitacao_id=nova_solicitacao.id,
        valor_investido=valor,
        is_pool=True
    )
    db.add(investimento_sistema)

    # 3. Transferir dinheiro para o tomador
    plataforma.saldo -= valor
    usuario.saldo += valor

    # 4. Registrar Transações
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor,
        tipo=TipoTransacao.RECEBIMENTO,
        status="concluido",
        detalhes=f"Empréstimo Fintech Aprovado Instantaneamente - Pedido #{nova_solicitacao.id}"
    ))
    
    db.add(Transacao(
        usuario_id=plataforma.id,
        valor=valor,
        tipo=TipoTransacao.INVESTIMENTO,
        status="concluido",
        detalhes=f"Aporte Cooperativa para Usuário {usuario.id} - Pedido #{nova_solicitacao.id}"
    ))

    db.commit()
    return nova_solicitacao
