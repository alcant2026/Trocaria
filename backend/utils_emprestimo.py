from sqlalchemy.orm import Session
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, Usuario
from decimal import Decimal
import datetime

def calcular_divida_total(solicitacao: SolicitacaoEmprestimo):
    """
    Calcula o valor total devedor de um empréstimo, incluindo principal, juros e mora.
    """
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    valor_parcela_base = total_com_juros / solicitacao.prazo_meses
    
    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    valor_quittance_base = valor_parcela_base * parcelas_restantes
    
    # Adicionar taxas adicionais pendentes
    valor_quittance_base += (solicitacao.taxas_adicionais or Decimal("0.00"))

    # Lógica de Mora (Multa 2% + 0.1% a.d.)
    agora = datetime.datetime.utcnow()
    mora_atraso = Decimal("0.00")
    if solicitacao.proximo_vencimento and agora > solicitacao.proximo_vencimento:
        delta = agora - solicitacao.proximo_vencimento
        if delta.days > 0:
            mora_atraso = valor_parcela_base * Decimal("0.02") + (valor_parcela_base * Decimal("0.001") * delta.days)

    return valor_quittance_base + mora_atraso

def liquidar_emprestimo_via_pool(usuario, solicitacao, valor_liquidacao, db: Session):
    """
    Executa a liquidação automática de um empréstimo usando o saldo do Pool do devedor.
    O lucro é distribuído para os outros membros da cooperativa.
    """
    from sqlalchemy import func
    
    if valor_liquidacao <= 0:
        return False
        
    # 1. Deduzir do saldo_caixa do devedor
    usuario.saldo_caixa -= valor_liquidacao
    
    # 2. Rateio entre os outros participantes do Pool (Cooperativa)
    total_caixa_outros = db.query(func.sum(Usuario.saldo_caixa)).filter(Usuario.id != usuario.id).scalar() or Decimal("0.00")
    
    if total_caixa_outros > 0:
        outros_participantes = db.query(Usuario).filter(Usuario.saldo_caixa > 0, Usuario.id != usuario.id).all()
        for p_caixa in outros_participantes:
            fatia = (p_caixa.saldo_caixa / total_caixa_outros) * valor_liquidacao
            p_caixa.saldo_caixa += fatia
    else:
        # Se estiver sozinho no pool, o dinheiro volta para a reserva da plataforma
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if plataforma:
            plataforma.saldo_caixa += valor_liquidacao
        
    # 3. Atualizar o empréstimo
    solicitacao.valor_amortizado += valor_liquidacao
    if valor_liquidacao >= calcular_divida_total(solicitacao):
        solicitacao.status = StatusSolicitacao.CONCLUIDO
        solicitacao.parcelas_pagas = solicitacao.prazo_meses

    # 4. Registrar transações
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor_liquidacao,
        tipo=TipoTransacao.RESGATE_CAIXA,
        status="concluido",
        detalhes=f"Liquidação Automática (Anti-calote) - Pedido #{solicitacao.id}"
    ))
    
    db.commit()
    return True

def processar_expiracoes_interna(db: Session):
    """
    Identifica e cancela solicitações que expiraram o prazo de 4h ou 5d.
    """
    agora = datetime.datetime.utcnow()
    
    # 1. Solicitações que expiraram a janela de conferência física (4h)
    expiradas_4h = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.data_expiracao_4h != None,
        SolicitacaoEmprestimo.data_expiracao_4h < agora
    ).all()
    
    # 2. Solicitações que expiraram o prazo total de captação (5d)
    expiradas_5d = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.data_expiracao_5d != None,
        SolicitacaoEmprestimo.data_expiracao_5d < agora
    ).all()
    
    usuarios_afetados = set()
    for s in (expiradas_4h + expiradas_5d):
        s.status = StatusSolicitacao.CANCELADO
        usuarios_afetados.add(s.usuario_id)
        
    if usuarios_afetados:
        db.commit()
        
    return usuarios_afetados

def obter_multiplicador_fidelidade(usuario_id: str, db: Session) -> Decimal:
    """
    Retorna o multiplicador de lucro baseados no histórico de crédito.
    Regra: 
    - 1.5x (Bônus 50%) se tiver empréstimo ativo/pago e estiver rigorosamente em dia.
    - 1.0x caso contrário.
    """
    agora = datetime.datetime.utcnow()
    
    # Verifica todos os empréstimos do usuário
    vincuo_credito = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario_id,
        SolicitacaoEmprestimo.status.in_([StatusSolicitacao.APROVADO, StatusSolicitacao.CONCLUIDO])
    ).all()

    if not vincuo_credito:
        return Decimal("1.0")

    tem_pagamento = any(s.parcelas_pagas > 0 or s.status == StatusSolicitacao.CONCLUIDO for s in vincuo_credito)
    tem_atraso = any(s.status == StatusSolicitacao.APROVADO and s.proximo_vencimento < agora for s in vincuo_credito)

    if tem_pagamento and not tem_atraso:
        return Decimal("1.5")
    
    return Decimal("1.0")

def processar_inadimplencia_coletiva_automatica(db: Session):
    """
    Varredura automática para execução da Cláusula 3.3 do Contrato.
    Regra: Atraso > 5 dias -> Liquidação Automática via Pool (devedor paga com seu capital investido).
    """
    agora = datetime.datetime.utcnow()
    limite_tolerancia = agora - datetime.timedelta(days=5)
    
    # 1. Buscar empréstimos aprovados com vencimento vencido há mais de 5 dias
    atrasados = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO,
        SolicitacaoEmprestimo.proximo_vencimento < limite_tolerancia
    ).all()
    
    logs = []
    for s in atrasados:
        divida_total = calcular_divida_total(s)
        usuario = s.usuario
        
        # Só podemos liquidar se o usuário tiver saldo no Pool (saldo_caixa)
        if usuario.saldo_caixa > 0:
            # Tenta liquidar o máximo possível (ou o total da dívida, ou o total do saldo no pool)
            valor_liquidacao = min(usuario.saldo_caixa, divida_total)
            
            sucesso = liquidar_emprestimo_via_pool(usuario, s, valor_liquidacao, db)
            if sucesso:
                logs.append(f"✅ Execução Cláusula 3.3: Usuário {usuario.id} liquidou R$ {valor_liquidacao:.2f} via Pool (Atraso > 5 dias)")
            else:
                logs.append(f"❌ Falha na liquidação do Usuário {usuario.id}")
        else:
            logs.append(f"⚠️ Usuário {usuario.id} inadimplente, mas sem saldo no Pool para execução da Cláusula 3.3")
            
    return logs
