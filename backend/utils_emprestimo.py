from sqlalchemy.orm import Session
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, GarantiaSocial
from decimal import Decimal
import datetime
from utils_data import adicionar_mes

def calcular_divida_total(solicitacao: SolicitacaoEmprestimo):
    """
    Calcula o valor total devedor de um empréstimo, incluindo principal, juros e mora.
    """
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    valor_parcela_base = total_com_juros / solicitacao.prazo_meses
    
    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    valor_quittance_base = valor_parcela_base * parcelas_restantes
    
    # Adicionar taxas adicionais pendentes (conveniência)
    valor_quittance_base += (solicitacao.taxas_adicionais or Decimal("0.00"))

    # Lógica de Mora (Multa 2% + 0.1% a.d.)
    agora = datetime.datetime.utcnow()
    mora_atraso = Decimal("0.00")
    if solicitacao.proximo_vencimento and agora > solicitacao.proximo_vencimento:
        delta = agora - solicitacao.proximo_vencimento
        if delta.days > 0:
            # Mora aplicada sobre uma parcela (padrão)
            mora_atraso = valor_parcela_base * Decimal("0.02") + (valor_parcela_base * Decimal("0.001") * delta.days)

    return valor_quittance_base + mora_atraso

def tentar_liberar_emprestimo(solicitacao_id: int, db: Session, ignore_guarantors: bool = False):
    """
    Tenta liberar o valor do empréstimo para o tomador.
    Verifica se:
    1. A arrecadação atingiu 100%.
    2. Todos os garantidores aceitaram a garantia social (pulado se ignore_guarantors=True).
    """
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id
    ).first()

    if not solicitacao or solicitacao.status not in [StatusSolicitacao.PENDENTE, StatusSolicitacao.AGUARDANDO_AVALIACAO]:
        return False

    # 1. Verificar Arrecadação
    if solicitacao.valor_arrecadado < solicitacao.valor:
        return False

    # 2. Orquestração de Garantias
    if not ignore_guarantors:
        # Fluxo de Garantia Física ou Híbrida (Etapa Inicial)
        if solicitacao.tipo_garantia in ["fisica", "hibrida"] and solicitacao.status == StatusSolicitacao.PENDENTE:
            solicitacao.status = StatusSolicitacao.AGUARDANDO_AVALIACAO
            db.commit()
            print(f"DEBUG: [Liberacao #{solicitacao_id}] STATUS -> AGUARDANDO_AVALIACAO.")
            return False

        # Fluxo de Garantia Social (Etapa Inicial)
        if solicitacao.tipo_garantia == "social" and solicitacao.status == StatusSolicitacao.PENDENTE:
            solicitacao.status = StatusSolicitacao.AGUARDANDO_GARANTIDORES
            db.commit()
            print(f"DEBUG: [Liberacao #{solicitacao_id}] STATUS -> AGUARDANDO_GARANTIDORES.")
            # Não retornamos False aqui, seguimos para verificar os garantidores abaixo

        # Verificação de Garantidores (para 'social' ou 'hibrida' após avaliação física)
        if solicitacao.tipo_garantia in ["social", "hibrida"]:
            # Se for híbrida, só chega aqui se o parceiro já aprovou (status mudou de AGUARDANDO_AVALIACAO para AGUARDANDO_GARANTIDORES)
            # Se for social, chega aqui direto do bloco acima
            garantias = db.query(GarantiaSocial).filter(
                GarantiaSocial.solicitacao_id == solicitacao_id
            ).all()
            
            if len(garantias) < 2:
                # Se não tem garantidores ainda (e deveria ter), volta para aguardar
                if solicitacao.status == StatusSolicitacao.PENDENTE:
                     solicitacao.status = StatusSolicitacao.AGUARDANDO_GARANTIDORES
                     db.commit()
                return False
                
            if any(not g.aceito for g in garantias):
                return False
    else:
        print(f"DEBUG: [Liberacao #{solicitacao_id}] BYPASS - Ignorando garantidores por ordem administrativa ou avaliação física.")

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

def processar_expiracoes_interna(db: Session):
    """
    Função helper pra varredura lazy de expirações 4h/5d durante o /snapshot.
    """
    from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao
    import datetime

    agora = datetime.datetime.utcnow()
    
    # 1. Regra das 4h: Ninguém investiu nada -> APAGAR
    expirados_4h = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.valor_arrecadado == 0,
        SolicitacaoEmprestimo.data_expiracao_4h <= agora
    ).all()

    for s in expirados_4h:
        estornar_e_limpar_solicitacao(s.id, db)

    # 2. Regra dos 5d: Tem investimentos mas não atingiu meta OU atingiu e não assinou
    expirados_5d = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.data_expiracao_5d <= agora
    ).all()

    for s in expirados_5d:
        estornar_e_limpar_solicitacao(s.id, db)

    # 3. Regra de 1h: Garantia Física REPROVADA e não regularizada -> APAGAR
    limite_1h = agora - datetime.timedelta(hours=1)
    reprovados_expirados = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.REPROVADO_GARANTIA,
        SolicitacaoEmprestimo.data_reprovacao_garantia <= limite_1h
    ).all()

    for s in reprovados_expirados:
        estornar_e_limpar_solicitacao(s.id, db)

    # Se teve limpeza ou estorno estornar_e_limpar_solicitacao ja fez commit individual, 
    # mas garantimos flush.
    db.commit()
    return len(expirados_4h) + len(expirados_5d)

def liquidar_emprestimo_via_pool(usuario, solicitacao, valor_liquidação, db: Session):
    """
    Executa a liquidação (total ou parcial) de um empréstimo usando o saldo do Pool do próprio tomador.
    O valor é distribuído pro-rata para os OUTROS participantes do Pool.
    """
    from sqlalchemy import func
    from modelos.modelos_db import Usuario, Transacao, TipoTransacao, StatusSolicitacao
    
    if valor_liquidação <= 0:
        return False
        
    # 1. Deduzir do saldo_caixa do tomador
    usuario.saldo_caixa -= valor_liquidação
    
    # 2. Rateio Proporcional entre os outros participantes do Pool
    # Importante: O próprio tomador NÃO recebe fatia da sua própria liquidação
    total_caixa_outros = db.query(func.sum(Usuario.saldo_caixa)).filter(Usuario.id != usuario.id).scalar() or Decimal("1.00")
    outros_participantes = db.query(Usuario).filter(Usuario.saldo_caixa > 0, Usuario.id != usuario.id).all()
    
    for p_caixa in outros_participantes:
        fatia = (p_caixa.saldo_caixa / total_caixa_outros) * valor_liquidação
        p_caixa.saldo_caixa += fatia
        db.add(p_caixa)
        
    # 3. Atualizar o empréstimo
    solicitacao.valor_amortizado += valor_liquidação
    
    # Se liquidou tudo ou o bastante para as parcelas
    # (Simplificação: trata como pagamento avulso que abate o montante)
    if valor_liquidação >= calcular_divida_total(solicitacao):
        solicitacao.status = StatusSolicitacao.CONCLUIDO
        solicitacao.parcelas_pagas = solicitacao.prazo_meses
        # Desbloquear garantidores se estiverem vinculados
        valor_bloqueio = solicitacao.valor * Decimal("0.50")
        for g in solicitacao.garantias_sociais:
            if g.aceito:
                garante = g.garante
                garante.saldo_bloqueado -= valor_bloqueio
                garante.saldo += valor_bloqueio

    # 4. Registrar transações
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor_liquidação,
        tipo=TipoTransacao.RESGATE_CAIXA,
        status="concluido",
        detalhes=f"Liquidação Automática de Dívida (Anti-calote) - Pedido #{solicitacao.id}"
    ))
    
    # Transação para a plataforma (auditoria do rateio)
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    if plataforma:
        db.add(Transacao(
            usuario_id=plataforma.id,
            valor=valor_liquidação,
            tipo=TipoTransacao.RETORNO_POOL,
            status="concluido",
            detalhes=f"Rateio de Liquidação Forçada | Tomador: {usuario.id} | Pedido #{solicitacao.id}"
        ))
    
    db.commit()
    return True
