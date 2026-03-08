from sqlalchemy.orm import Session
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, GarantiaSocial
from decimal import Decimal
import datetime
from utils_data import adicionar_mes

def tentar_liberar_emprestimo(solicitacao_id: int, db: Session, ignore_guarantors: bool = False):
    """
    Tenta liberar o valor do empréstimo para o tomador.
    Verifica se:
    1. A arrecadação atingiu 100%.
    2. Todos os garantidores aceitaram a garantia social (pulado se ignore_guarantors=True).
    """
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).first()

    if not solicitacao:
        return False

    # 1. Verificar Arrecadação
    if solicitacao.valor_arrecadado < solicitacao.valor:
        return False

    # 2. Verificar Garantidores (Pular se for liberação especial de Admin)
    if not ignore_guarantors:
        garantias = db.query(GarantiaSocial).filter(
            GarantiaSocial.solicitacao_id == solicitacao_id
        ).all()
        
        print(f"DEBUG: [Liberacao #{solicitacao_id}] Garantidores encontrados: {len(garantias)}")

        # Exigamos exatamente 2 garantidores conforme a regra de negócio
        if len(garantias) < 2:
            print(f"DEBUG: [Liberacao #{solicitacao_id}] BLOQUEIO - Menos de 2 garantidores ({len(garantias)}).")
            return False
            
        for g in garantias:
            print(f"DEBUG: [Liberacao #{solicitacao_id}] Garantidor ID {g.garante_id}: Aceito={g.aceito}")

        if any(not g.aceito for g in garantias):
            print(f"DEBUG: [Liberacao #{solicitacao_id}] BLOQUEIO - Nem todos os garantidores aceitaram.")
            return False
    else:
        print(f"DEBUG: [Liberacao #{solicitacao_id}] BYPASS - Ignorando garantidores por ordem administrativa.")

    # Se chegou aqui, libera!
    print(f"DEBUG: [Liberacao #{solicitacao_id}] SUCESSO! Liberando empréstimo...")
    solicitacao.status = StatusSolicitacao.APROVADO
    agora = datetime.datetime.utcnow()
    solicitacao.proximo_vencimento = adicionar_mes(agora)
    
    tomador = solicitacao.usuario
    tomador.saldo += solicitacao.valor
    
    # Registrar transação de recebimento para o Tomador
    transacao_recebimento = Transacao(
        usuario_id=tomador.id,
        valor=solicitacao.valor,
        tipo=TipoTransacao.RECEBIMENTO,
        status="concluido",
        detalhes=f"Recebimento de empréstimo (Meta + Garantias Atingidas) - ID #{solicitacao_id}"
    )
    db.add(transacao_recebimento)
    
    db.commit()
    return True

def estornar_e_limpar_solicitacao(solicitacao_id: int, db: Session):
    """
    Cancela a solicitação, devolve o dinheiro aos investidores e apaga os dados vinculados
    para economizar espaço no banco de dados.
    """
    from modelos.modelos_db import Investimento, AcessoInvestidor, Transacao, TipoTransacao, SolicitacaoEmprestimo
    
    solicitacao = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.id == solicitacao_id).first()
    if not solicitacao:
        return False

    # 1. Estornar Investidores
    investimentos = db.query(Investimento).filter(Investimento.solicitacao_id == solicitacao_id).all()
    for inv in investimentos:
        investidor = inv.investidor
        investidor.saldo += inv.valor_investido
        
        # Registrar o estorno
        db.add(Transacao(
            usuario_id=investidor.id,
            valor=inv.valor_investido,
            tipo=TipoTransacao.RECEBIMENTO,
            status="concluido",
            detalhes=f"Estorno: Pedido #{solicitacao_id} cancelado/rejeitado."
        ))

    # 2. Devolver Saldo Bloqueado aos Garantidores
    garantias = db.query(GarantiaSocial).filter(GarantiaSocial.solicitacao_id == solicitacao_id).all()
    valor_bloqueio = solicitacao.valor * Decimal("0.50")
    
    for g in garantias:
        if g.aceito:
            garante = g.garante
            if garante.saldo_bloqueado >= valor_bloqueio:
                garante.saldo_bloqueado -= valor_bloqueio
                garante.saldo += valor_bloqueio
                print(f"DEBUG: [Estorno #{solicitacao_id}] Saldo devolvido para garantidor {garante.id}")

    # 3. Limpeza Agressiva (Economia de BD)
    # Deletar acessos de dados
    db.query(AcessoInvestidor).filter(AcessoInvestidor.solicitacao_id == solicitacao_id).delete()
    
    # Deletar garantias
    db.query(GarantiaSocial).filter(GarantiaSocial.solicitacao_id == solicitacao_id).delete()
    
    # Deletar investimentos (já estornados)
    db.query(Investimento).filter(Investimento.solicitacao_id == solicitacao_id).delete()
    
    # Deletar a solicitação
    db.delete(solicitacao)
    
    db.commit()
    return True
