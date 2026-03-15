from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, Investimento, AcessoInvestidor, GarantiaSocial, RegistroAuditoria
from database import get_db
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from utils_data import adicionar_mes
from utils_emprestimo import tentar_liberar_emprestimo, estornar_e_limpar_solicitacao
from utils_seguranca import registrar_acao_admin
from rotas.rotas_snapshot import cache_snapshot_data

router = APIRouter(prefix="/emprestimos", tags=["Empréstimos"])

class SolicitacaoRequest(BaseModel):
    valor: Decimal = Field(gt=0)
    taxa_juros: Decimal = Field(gt=0)
    parcelas: int = Field(gt=0)
    aceite_termos: bool
    tipo_garantia: str = "social"
    garantia_descricao: Optional[str] = None
    parceiro_id: Optional[int] = None
    garantidores_ids: list[str] = []

def validar_limites_solicitacao(usuario: Usuario):
    agora = datetime.datetime.utcnow()
    
    # 0. Resetar contador diário se for um novo dia (UTC)
    if usuario.ultima_solicitacao:
        if usuario.ultima_solicitacao.date() < agora.date():
            usuario.solicitacoes_hoje = 0

    # 1. Regra base: 1 pedido a cada 15 dias
    if usuario.ultima_solicitacao:
        dias_passados = (agora - usuario.ultima_solicitacao).days
        if dias_passados < 15:
            # Se atingiu o limite de 5 mesmo com upgrade, bloqueia
            if usuario.solicitacoes_hoje >= 5:
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Limite de 5 solicitações diárias atingido (Upgrade de Score ativo)."
                )
            
            # Se não tem score >= 1.5, cai na trava obrigatória de 15 dias
            if usuario.score < Decimal("1.5"):
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Você só pode realizar um novo pedido em {15 - dias_passados} dias. Compre Score para liberar até 5 pedidos por dia!"
                )

    return True

@router.post("/solicitar")
async def criar_solicitacao(
    dados: SolicitacaoRequest, 
    request: Request,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    valor = dados.valor
    taxa_juros = dados.taxa_juros
    parcelas = dados.parcelas
    
    if valor <= Decimal("0"):
        raise HTTPException(status_code=400, detail="O valor solicitado deve ser maior que zero.")

    if taxa_juros <= Decimal("0"):
        raise HTTPException(status_code=400, detail="A taxa de juros deve ser maior que zero.")

    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    # Validação de valor e parcelas (Novas Regras)
    if valor > Decimal("1000"):
        if parcelas > 60:
            raise HTTPException(status_code=400, detail="Prazo máximo para valores acima de R$ 1.000,00 é 60x.")
    else:
        if parcelas > 12:
            raise HTTPException(status_code=400, detail="Prazo máximo para valores até R$ 1.000,00 é 12x.")

    # Validar limites de tempo e score
    validar_limites_solicitacao(usuario)

    # Regra: 1 pedido por mês é isento de taxa.
    # A partir do 2º pedido no mesmo mês, cobra R$ 4,00.
    agora = datetime.datetime.utcnow()
    inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    pedidos_no_mes = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.data_criacao >= inicio_mes
    ).count()

    primeiro_do_mes = pedidos_no_mes == 0
    custo_pedido = Decimal("0.00") if primeiro_do_mes else Decimal("4.00")

    if custo_pedido > Decimal("0") and usuario.saldo < custo_pedido:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para postar pedido (Custo: R$ 4,00).")

    if not dados.aceite_termos:
        raise HTTPException(status_code=400, detail="Você deve aceitar os termos de uso e taxas da plataforma.")

    usuario.saldo -= custo_pedido

    # Criar registro de auditoria
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        municipio=f"{usuario.cidade}/{usuario.estado}" if usuario.cidade else "Localização não informada",
        user_agent=request.headers.get("user-agent"),
        data_registro=agora
    )
    db.add(auditoria)
    db.flush()

    nova_solicitacao = SolicitacaoEmprestimo(
        usuario_id=usuario.id,
        valor=valor,
        taxa_juros=taxa_juros,
        prazo_meses=parcelas,
        status=StatusSolicitacao.PENDENTE,
        data_criacao=agora,
        data_expiracao_4h=agora + datetime.timedelta(hours=4),
        data_expiracao_5d=agora + datetime.timedelta(days=5),
        aceite_termos=True,
        auditoria_id=auditoria.id,
        cpf_aceite=usuario.cpf,
        data_aceite=agora,
        tipo_garantia=dados.tipo_garantia,
        garantia_descricao=dados.garantia_descricao,
        parceiro_id=dados.parceiro_id
    )

    # Lógica de Sugestão de Aporte do Pool (Caixa) baseada em Score/KYC
    sugestao_percentual = Decimal("0.10") # 10% base
    if usuario.is_verified:
        sugestao_percentual = Decimal("0.30") # 30% se verificado
        if usuario.score >= Decimal("600"):
            sugestao_percentual = Decimal("0.50") # 50% se verificado e score bom
        if usuario.score >= Decimal("900"):
            sugestao_percentual = Decimal("0.80") # 80% se verificado e score excelente
    
    nova_solicitacao.sugestao_pool = valor * sugestao_percentual

    # Registrar custo apenas se houver cobânça
    transacao_custo = None
    if custo_pedido > Decimal("0"):
        # Creditar lucro à plataforma (000PL)
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if plataforma:
            plataforma.saldo += custo_pedido

        transacao_custo = Transacao(
            usuario_id=usuario.id,
            valor=custo_pedido,
            tipo=TipoTransacao.TAXA_POSTAGEM,
            status="concluido",
            detalhes="Taxa de postagem de empréstimo (2º+ pedido do mês)"
        )

    usuario.ultima_solicitacao = agora
    usuario.solicitacoes_hoje += 1

    db.add(nova_solicitacao)
    db.flush() # Para gerar o ID

    if dados.garantidores_ids and dados.tipo_garantia in ["social", "hibrida"]:
        for g_id in dados.garantidores_ids:
            if g_id != usuario.id:
                db.add(GarantiaSocial(solicitacao_id=nova_solicitacao.id, garante_id=g_id, aceito=False))

    db.commit()
    db.refresh(nova_solicitacao)

    msg = (
        "Solicitação criada! Quando atingir a meta, você deverá indicar 2 garantidores."
        if primeiro_do_mes
        else "Solicitação criada! Taxa de R$ 4,00 descontada. Quando atingir a meta, você deverá indicar 2 garantidores."
    )
    return {"message": msg, "id": nova_solicitacao.id}

class VincularGarantidoresRequest(BaseModel):
    user_ids: list[int] = Field(..., min_items=2, max_items=2)

@router.post("/vincular-garantidores/{solicitacao_id}")
async def vincular_garantidores(
    solicitacao_id: int,
    dados: VincularGarantidoresRequest,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    """
    Tomador vincula 2 garantidores após a meta de arrecadação ser batida.
    """
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")

    if solicitacao.valor_arrecadado < solicitacao.valor:
        raise HTTPException(status_code=400, detail="Você só pode indicar garantidores após atingir 100% da meta de arrecadação.")

    if len(dados.user_ids) != 2:
        raise HTTPException(status_code=400, detail="Você deve indicar exatamente 2 amigos.")

    # Limpar garantias anteriores se houver (para permitir correção)
    db.query(GarantiaSocial).filter(GarantiaSocial.solicitacao_id == solicitacao_id).delete()

    for user_id in dados.user_ids:
        if user_id <= 0:
            raise HTTPException(status_code=400, detail="ID de usuário inválido (deve ser positivo).")
            
        if user_id == usuario.id:
             raise HTTPException(status_code=400, detail="Você não pode ser seu próprio garantidor.")
        
        garante = db.query(Usuario).filter(Usuario.id == user_id).first()
        if not garante:
             raise HTTPException(status_code=404, detail=f"Usuário com ID {user_id} não encontrado na plataforma.")

        nova_garantia = GarantiaSocial(
            solicitacao_id=solicitacao_id,
            garante_id=garante.id,
            aceito=False
        )
        db.add(nova_garantia)

    db.commit()
    return {"message": "Garantidores vinculados! Agora eles precisam aceitar a garantia para liberar o valor."}

@router.post("/aceitar-garantia/{solicitacao_id}")
async def aceitar_garantia(
    solicitacao_id: int, 
    request: Request,
    db: Session = Depends(get_db), 
    usuario: Usuario = Depends(obter_usuario_logado)
):
    """
    Rota para o indicado aceitar ser garantia do tomador.
    Verifica score >= 500 e registra IP/Município.
    """
    if usuario.score < Decimal("500"):
        raise HTTPException(status_code=403, detail="Seu score é insuficiente para ser garantidor (Mínimo 500).")

    garantia = db.query(GarantiaSocial).filter(
        GarantiaSocial.solicitacao_id == solicitacao_id,
        GarantiaSocial.garante_id == usuario.id
    ).first()

    if not garantia:
        raise HTTPException(status_code=404, detail="Você não foi indicado para este empréstimo.")

    if garantia.aceito:
        return {"message": "Você já aceitou esta garantia."}

    # NOVA REGRA: Bloqueio de 50% do valor do empréstimo no saldo do garantidor
    solicitacao = garantia.solicitacao
    valor_bloqueio = solicitacao.valor * Decimal("0.50")

    if usuario.saldo < valor_bloqueio:
        raise HTTPException(
            status_code=400, 
            detail=f"Saldo insuficiente para ser garantidor. Você precisa de pelo menos R$ {valor_bloqueio:,.2f} em conta (50% do valor do empréstimo)."
        )

    # Bloquear o saldo
    usuario.saldo -= valor_bloqueio
    usuario.saldo_bloqueado += valor_bloqueio

    # Registrar aceite via auditoria
    agora = datetime.datetime.utcnow()
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        municipio=f"{usuario.cidade}/{usuario.estado}" if usuario.cidade else "Localização não informada",
        user_agent=request.headers.get("user-agent"),
        data_registro=agora
    )
    db.add(auditoria)
    db.flush()

    garantia.aceito = True
    garantia.data_aceite = agora
    garantia.auditoria_id = auditoria.id

    db.commit()

    # Verificar se todos os garantidores aceitaram
    todas_garantias = db.query(GarantiaSocial).filter(GarantiaSocial.solicitacao_id == solicitacao_id).all()
    faltam_aceites = any(not g.aceito for g in todas_garantias)

    if not faltam_aceites:
        # Se todos aceitaram e o valor arrecadado for 100%, libera o valor para o tomador
        tentar_liberar_emprestimo(solicitacao_id, db)

    return {"message": "Garantia aceita com sucesso!"}

@router.get("/garantias-pendentes")
async def listar_garantias_pendentes(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Lista solicitações onde o usuário atual foi convidado a ser garantidor.
    """
    pendencias = db.query(GarantiaSocial).filter(
        GarantiaSocial.garante_id == usuario.id,
        GarantiaSocial.aceito == False
    ).all()
    
    resultado = []
    for g in pendencias:
        s = g.solicitacao
        u = s.usuario
        resultado.append({
            "solicitacao_id": s.id,
            "valor": float(s.valor),
            "tomador": u.nome.split()[0],
            "taxa": float(s.taxa_juros),
            "parcelas": s.prazo_meses
        })
    return resultado

@router.post("/rejeitar-garantia/{solicitacao_id}")
async def rejeitar_garantia(solicitacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Garantidor recusa o convite. Isso cancela o empréstimo e estorna investidores.
    """
    garantia = db.query(GarantiaSocial).filter(
        GarantiaSocial.solicitacao_id == solicitacao_id,
        GarantiaSocial.garante_id == usuario.id
    ).first()
    
    if not garantia:
        raise HTTPException(status_code=404, detail="Convite de garantia não encontrado.")
        
    # Se um recusar, o empréstimo cai por terra.
    sucesso = estornar_e_limpar_solicitacao(solicitacao_id, db)
    
    if sucesso:
        return {"message": "Você recusou a garantia. O empréstimo foi cancelado e os investidores estornados."}
    else:
        raise HTTPException(status_code=500, detail="Erro ao processar cancelamento.")

@router.get("/listar")
async def listar_solicitacoes(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    # Listagem simplificada para investidores (sem dados sensíveis)
    solicitacoes = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).all()
    
    # Buscar IDs de solicitações que este investidor já desbloqueou
    acessos_investidor = []
    if usuario:
        acessos_investidor = [a.solicitacao_id for a in db.query(AcessoInvestidor).filter(AcessoInvestidor.investidor_id == usuario.id).all()]
    
    resultado = []
    for s in solicitacoes:
        foi_desbloqueado = s.id in acessos_investidor
        u = s.usuario
        
        # LGPD: Só mostramos o primeiro nome e score se foi desbloqueado (pago R$ 15)
        primeiro_nome = u.nome.split()[0] if u.nome else "Usuário"
        
        resultado.append({
            "id": s.id,
            "valor": float(s.valor),
            "valor_arrecadado": float(s.valor_arrecadado),
            "parcelas": s.prazo_meses,
            "taxa": float(s.taxa_juros),
            # Dados ocultos globalmente (Sempre)
            "nome": primeiro_nome if foi_desbloqueado else "Anônimo",
            "score": float(u.score) if foi_desbloqueado else "●●●",
            # Selo de Verificado é público (Conforme pedido)
            "verified": u.is_verified,
            "unlocked": foi_desbloqueado,
            "expira_4h": s.data_expiracao_4h.isoformat() if s.data_expiracao_4h else None,
            "expira_5d": s.data_expiracao_5d.isoformat() if s.data_expiracao_5d else None,
        })
    
    return resultado

@router.post("/desbloquear-dados/{solicitacao_id}")
async def desbloquear_dados(solicitacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    O investidor paga R$ 15,00 para ver o primeiro nome e o score do tomador.
    """
    custo = Decimal("15.00")
    if usuario.saldo < custo:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para desbloquear dados (R$ 15,00).")

    # Verificar se já desbloqueou
    ja_desbloqueou = db.query(AcessoInvestidor).filter(
        AcessoInvestidor.investidor_id == usuario.id,
        AcessoInvestidor.solicitacao_id == solicitacao_id
    ).first()
    
    if ja_desbloqueou:
        return {"message": "Dados já desbloqueados para este pedido."}

    # Deduzir saldo
    usuario.saldo -= custo
    
    # Registrar acesso
    novo_acesso = AcessoInvestidor(
        investidor_id=usuario.id,
        solicitacao_id=solicitacao_id
    )
    
    # Registrar transação
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=custo,
        tipo=TipoTransacao.DESBLOQUEIO_DADOS,
        status="concluido",
        detalhes=f"Desbloqueio de dados do pedido ID {solicitacao_id}"
    )

    db.add(novo_acesso)
    db.add(transacao)
    db.commit()

    return {"message": "Dados desbloqueados com sucesso!", "saldo": float(usuario.saldo)}

@router.get("/meus-emprestimos")
async def listar_meus_emprestimos(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacoes = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).all()
    
    resultado = []
    for s in solicitacoes:
        # Cálculo de Juros Simples Mensais: Total = Capital * (1 + i*n)
        taxa_mensal = s.taxa_juros / 100
        total_com_juros = s.valor * (Decimal("1") + (taxa_mensal * s.prazo_meses))
        valor_parcela = total_com_juros / s.prazo_meses
        
        total_pago_real = (valor_parcela * s.parcelas_pagas) + s.valor_amortizado
        if s.status == StatusSolicitacao.CONCLUIDO:
            valor_total_restante = 0.00
        else:
            valor_total_restante = max(0, float((total_com_juros + s.taxas_adicionais) - total_pago_real))

        resultado.append({
            "id": s.id,
            "valor": float(s.valor),
            "valor_arrecadado": float(s.valor_arrecadado),
            "taxa_juros": float(s.taxa_juros),
            "parcelas": s.prazo_meses,
            "parcelas_pagas": s.parcelas_pagas,
            "valor_parcela": round(float(valor_parcela), 2),
            "valor_total_restante": round(valor_total_restante, 2),
            "status": s.status.value,
            "data_creacao": s.data_criacao,
            "data_expiracao_4h": s.data_expiracao_4h,
            "data_expiracao_5d": s.data_expiracao_5d,
            "proximo_vencimento": s.proximo_vencimento,
            "garantidores": [
                {
                    "nome": g.garante.nome.split()[0],
                    "aceito": g.aceito
                } for g in s.garantias_sociais
            ]
        })
    
    return resultado

class PagamentoRequest(BaseModel):
    valor_pagamento: Decimal = Field(gt=0)

@router.post("/pagar-parcela/{solicitacao_id}")
async def pagar_parcela(solicitacao_id: int, dados: PagamentoRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    valor_pagamento = dados.valor_pagamento
    
    if not usuario or usuario.saldo < valor_pagamento:
        raise HTTPException(status_code=400, detail="Saldo insuficiente ou usuário não encontrado.")

    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao or solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
        raise HTTPException(status_code=404, detail="Empréstimo ativo não encontrado ou já quitado.")

    # LÓGICA DE MORA (Multa 2% + 0.1% ao dia de atraso)
    agora = datetime.datetime.utcnow()
    multa_atraso = Decimal("0.00")
    juros_atraso = Decimal("0.00")
    
    if solicitacao.proximo_vencimento and agora > solicitacao.proximo_vencimento:
        delta = agora - solicitacao.proximo_vencimento
        if delta.days > 0:
            multa_atraso = valor_pagamento * Decimal("0.02")
            juros_atraso = valor_pagamento * (Decimal("0.001") * delta.days)
    
    valor_total_devido = valor_pagamento + multa_atraso + juros_atraso
    
    if usuario.saldo < valor_total_devido:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para pagar parcela com juros de mora: R$ {valor_total_devido:,.2f}")

    # Deduzir saldo do tomador
    usuario.saldo -= valor_total_devido
    
    # Incrementar parcelas e aumentar score
    solicitacao.parcelas_pagas += 1
    
    # BÔNUS CAIXA: Se o tomador tem saldo no Caixa (Pool), ganha um incentivo por pagar em dia
    bonus_caixa = Decimal("0.00")
    if multa_atraso == 0 and usuario.saldo_caixa > 0:
        # Dá 0.1% do valor da parcela como bônus direto no Caixa dele
        bonus_caixa = valor_pagamento * Decimal("0.001")
        usuario.saldo_caixa += bonus_caixa
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=bonus_caixa,
            tipo=TipoTransacao.BONUS_PAGADOR_CAIXA,
            status="concluido",
            detalhes=f"Bônus pontualidade no seu Caixa - Pedido #{solicitacao_id}"
        ))

    if multa_atraso == 0:
        usuario.score = min(Decimal("1000"), usuario.score + Decimal("2.0"))
    else:
        # Atraso penaliza o ganho de score, mas se ele pagou, recupera o score anterior se estava zerado
        if usuario.score == 0 and usuario.score_anterior > 0:
            usuario.score = usuario.score_anterior
            usuario.score_anterior = Decimal("0") # Limpa a memória
        else:
            usuario.score = min(Decimal("1000"), usuario.score + Decimal("0.5"))
            
        # RESTAURA SCORE DOS GARANTIDORES: Se o tomador pagou o atraso, os amigos voltam ao patamar original
        for g in solicitacao.garantias_sociais:
            garante = g.garante
            if garante.score == 0 and garante.score_anterior > 0:
                garante.score = garante.score_anterior
                garante.score_anterior = Decimal("0") # Limpa a memória

    # Atualizar próximo vencimento (Mantendo o dia fixo do mês)
    if solicitacao.proximo_vencimento:
        solicitacao.proximo_vencimento = adicionar_mes(solicitacao.proximo_vencimento)
    else:
        # Fallback caso não tenha data (não deve ocorrer se aprovado pelo fluxo correto)
        solicitacao.proximo_vencimento = adicionar_mes(agora)

    # LÓGICA DE RATEIO (DISTRIBUIÇÃO) COM PROTEÇÃO DE PRINCIPAL
    total_emprestado = solicitacao.valor
    valor_restante_rateio = valor_total_devido
    
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    
    # 1. Passo: Devolver o Principal da Parcela (Pro-rata)
    # Valor que cada investidor deveria receber de principal nesta parcela
    principal_total_na_parcela = Decimal("0.00")
    pagamentos_investidores = []
    
    for inv in solicitacao.investimentos:
        proporcao = inv.valor_investido / total_emprestado
        principal_devido_inv = inv.valor_investido / solicitacao.prazo_meses
        principal_total_na_parcela += principal_devido_inv
        pagamentos_investidores.append({
            "investimento": inv,
            "principal_devido": principal_devido_inv,
            "proporcao": proporcao,
            "valor_liquido": Decimal("0.00")
        })

    # Pagar o principal primeiro
    pagamento_principal = min(valor_restante_rateio, principal_total_na_parcela)
    for p in pagamentos_investidores:
        fatia_principal = (p["principal_devido"] / principal_total_na_parcela) * pagamento_principal
        p["valor_liquido"] += fatia_principal
    
    valor_restante_rateio -= pagamento_principal

    # 2. Passo: Plataforma recebe Taxa de Conveniência (o que sobrar após o principal)
    lucro_conveniencia_plataforma = Decimal("0.00")
    if solicitacao.taxas_adicionais > 0 and valor_restante_rateio > 0:
        lucro_conveniencia_plataforma = min(valor_restante_rateio, solicitacao.taxas_adicionais)
        solicitacao.taxas_adicionais -= lucro_conveniencia_plataforma
        valor_restante_rateio -= lucro_conveniencia_plataforma
        
        if plataforma and lucro_conveniencia_plataforma > 0:
            plataforma.saldo += lucro_conveniencia_plataforma
            db.add(Transacao(
                usuario_id=plataforma.id,
                valor=lucro_conveniencia_plataforma,
                tipo=TipoTransacao.TAXA_INTERMEDIACAO,
                status="concluido",
                detalhes=f"Recebimento Taxa Conveniência - Pedido #{solicitacao_id}"
            ))

    # 3. Passo: Juros do Investidor + Taxa de Performance (o que sobrar após conveniência)
    lucro_performance_total = Decimal("0.00")
    if valor_restante_rateio > 0:
        for p in pagamentos_investidores:
            fatia_juros_bruta = valor_restante_rateio * p["proporcao"]
            taxa_perf = fatia_juros_bruta * Decimal("0.10")
            lucro_performance_total += taxa_perf
            p["valor_liquido"] += (fatia_juros_bruta - taxa_perf)

    # Efetivar pagamentos aos investidores
    for p in pagamentos_investidores:
        inv = p["investimento"]
        investidor = inv.investidor
        valor_final = p["valor_liquido"]
        
        # LÓGICA DE DESTINO: Se for Pool, distribui o CAPITAL e o LUCRO pro-rata para todos
        if hasattr(inv, 'is_pool') and inv.is_pool:
            # 1. Identificar o valor total a ser distribuído (Principal + Juros Líquidos)
            valor_final_pool = p["valor_liquido"]
            fatia_principal = p["principal_devido"]
            lucro_liquido_desta_parcela = valor_final_pool - fatia_principal
            
            # 2. Rateio Proporcional entre todos os participantes do Pool
            total_caixa_global = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("1.00")
            participantes_caixa = db.query(Usuario).filter(Usuario.saldo_caixa > 0).all()
            
            for p_caixa in participantes_caixa:
                # Cada um recebe sua fatia proporcional do retorno total (Cap + Juros)
                fatia = (p_caixa.saldo_caixa / total_caixa_global) * valor_final_pool
                p_caixa.saldo_caixa += fatia
                db.add(p_caixa)
                
            inv.pago_para_investidor += valor_final_pool
            
            db.add(Transacao(
                usuario_id=plataforma.id,
                valor=valor_final_pool,
                tipo=TipoTransacao.RETORNO_POOL,
                status="concluido",
                detalhes=f"Retorno Pro-rata Pool | Total: {valor_final_pool} | Capital: {fatia_principal} | Juros: {lucro_liquido_desta_parcela} | Pedido #{solicitacao_id}"
            ))
        else:
            investidor.saldo += valor_final
            inv.pago_para_investidor += valor_final
            db.add(Transacao(
                usuario_id=investidor.id,
                valor=valor_final,
                tipo=TipoTransacao.RECEBIMENTO,
                status="concluido",
                detalhes=f"Recebimento de parcela do pedido ID {solicitacao_id} (Net)"
            ))

    # 3. Creditar Taxa de Performance ao Admin
    if plataforma and lucro_performance_total > 0:
        plataforma.saldo += lucro_performance_total
        db.add(Transacao(
            usuario_id=plataforma.id,
            valor=lucro_performance_total,
            tipo=TipoTransacao.TAXA_INTERMEDIACAO,
            status="concluido",
            detalhes=f"Lucro Performance (10%) - Pedido #{solicitacao_id} (Tomador: {usuario.nome})"
        ))
    # Registrar pagamento do tomador no histórico dele
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor_total_devido,
        tipo=TipoTransacao.PAGAMENTO_PARCELA,
        status="concluido",
        detalhes=f"Pagamento de parcela #{solicitacao.parcelas_pagas} - Pedido #{solicitacao_id}"
    ))

    # Se todas as parcelas foram pagas, marcar como CONCLUIDO e DESBLOQUEAR garantidores
    if solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
        solicitacao.status = StatusSolicitacao.CONCLUIDO
        
        # Desbloquear Garantidores
        valor_bloqueio = solicitacao.valor * Decimal("0.50")
        for g in solicitacao.garantias_sociais:
            if g.aceito:
                garante = g.garante
                garante.saldo_bloqueado -= valor_bloqueio
                garante.saldo += valor_bloqueio

    db.commit()
    
    # Invalida o cache global para que os novos saldos reflitam imediatamente
    cache_snapshot_data.clear()

    return {
        "message": f"Parcela paga! Multa: R$ {multa_atraso:.2f}",
        "novo_saldo": float(usuario.saldo),
        "valor_pago": float(valor_total_devido)
    }

@router.post("/quitar-total/{solicitacao_id}")
async def quitar_total(solicitacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()
    
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo ativo não encontrado.")

    # 1. Cálculo do valor base para quitação
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    valor_parcela_base = total_com_juros / solicitacao.prazo_meses
    
    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    if parcelas_restantes <= 0:
        raise HTTPException(status_code=400, detail="Este empréstimo já não possui parcelas pendentes.")
        
    valor_quitação_base = valor_parcela_base * parcelas_restantes

    # Buscar usuário admin para operações de Pool
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()

    # 2. Lógica de Mora (Apenas sobre a parcela atual se estiver atrasada)
    agora = datetime.datetime.utcnow()
    mora_atraso = Decimal("0.00")
    if solicitacao.proximo_vencimento and agora > solicitacao.proximo_vencimento:
        delta = agora - solicitacao.proximo_vencimento
        if delta.days > 0:
            # Multa 2% + 0.1% ao dia sobre UMA parcela
            mora_atraso = valor_parcela_base * Decimal("0.02") + (valor_parcela_base * Decimal("0.001") * delta.days)

    total_final_devedor = valor_quitação_base + mora_atraso

    if usuario.saldo < total_final_devedor:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para quitação: R$ {total_final_devedor:,.2f}")

    # 3. Processar Pagamento
    usuario.saldo -= total_final_devedor
    
    # Restaura score original se estava penalizado
    if usuario.score == 0 and usuario.score_anterior > 0:
        usuario.score = usuario.score_anterior
        usuario.score_anterior = Decimal("0")
    else:
        usuario.score = min(Decimal("1000"), usuario.score + Decimal("5.0")) # Bônus por quitação
        
    # RESTAURA SCORE DOS GARANTIDORES
    for g in solicitacao.garantias_sociais:
        garante = g.garante
        if garante.score == 0 and garante.score_anterior > 0:
            garante.score = garante.score_anterior
            garante.score_anterior = Decimal("0")
    
    # Salvar fotos antes da mudança
    parcelas_pagas_antes = solicitacao.parcelas_pagas
    solicitacao.parcelas_pagas = solicitacao.prazo_meses
    solicitacao.status = StatusSolicitacao.CONCLUIDO
    solicitacao.valor_amortizado += total_final_devedor
    
    # DESBLOQUEAR Garantidores na quitação total
    valor_bloqueio = solicitacao.valor * Decimal("0.50")
    for g in solicitacao.garantias_sociais:
        if g.aceito:
            garante = g.garante
            garante.saldo_bloqueado -= valor_bloqueio
            garante.saldo += valor_bloqueio
    
    # 4. Rateio com Investidores
    total_emprestado = solicitacao.valor
    lucro_total_plataforma = Decimal("0.00")
    
    for inv in solicitacao.investimentos:
        proporcao = inv.valor_investido / total_emprestado
        valor_bruto_investidor = total_final_devedor * proporcao
        
        # Principal que faltava receber: (Investimento Inicial / Prazo) * Parcelas Pendentes
        principal_pendente = (inv.valor_investido / solicitacao.prazo_meses) * parcelas_restantes
        lucro_na_quitacao = valor_bruto_investidor - principal_pendente
        
        if lucro_na_quitacao > 0:
            taxa_performance = lucro_na_quitacao * Decimal("0.10")
            lucro_total_plataforma += taxa_performance
            valor_liquido_investidor = valor_bruto_investidor - taxa_performance
        else:
            valor_liquido_investidor = valor_bruto_investidor

        # Pagar investidor
        investidor = inv.investidor
        
        if hasattr(inv, 'is_pool') and inv.is_pool:
            # Rateio Proporcional Integral (Capital + Juros) na Quitação
            total_caixa_global = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("1.00")
            participantes_caixa = db.query(Usuario).filter(Usuario.saldo_caixa > 0).all()
            
            for p_caixa in participantes_caixa:
                fatia = (p_caixa.saldo_caixa / total_caixa_global) * valor_liquido_investidor
                p_caixa.saldo_caixa += fatia
                db.add(p_caixa)
                # Cálculo de juros para o log administrativo (baseado na proporção da plataforma)
            lucro_pool_global = valor_liquido_investidor - principal_pendente
            proporcao_admin = plataforma.saldo_caixa / total_caixa_global if total_caixa_global > 0 else Decimal("0")
            juros_admin_quitacao = lucro_pool_global * proporcao_admin
            capital_admin_quitacao = principal_pendente * proporcao_admin

            inv.pago_para_investidor += valor_liquido_investidor
            tipo_trans = TipoTransacao.RETORNO_POOL
            detalhes_trans = f"Quitação Pro-rata Pool | Total: {valor_liquido_investidor} | Juros Est. Admin: {juros_admin_quitacao} | Pedido #{solicitacao_id}"
            u_id = plataforma.id
        else:
            investidor.saldo += valor_liquido_investidor
            inv.pago_para_investidor += valor_liquido_investidor
            u_id = investidor.id
            tipo_trans = TipoTransacao.RECEBIMENTO
            detalhes_trans = f"Quitação Total (Net) - Pedido #{solicitacao_id}"
            
            if hasattr(inv, 'is_institutional') and inv.is_institutional:
                tipo_trans = TipoTransacao.RETORNO_INVESTIMENTO
                detalhes_trans = f"RETORNO INVESTIMENTO (LUCRO) - Pedido #{solicitacao_id}"

        db.add(Transacao(
            usuario_id=u_id,
            valor=valor_liquido_investidor,
            tipo=tipo_trans,
            status="concluido",
            detalhes=detalhes_trans
        ))

    # 5. Registro Empresa e Tomador
    if plataforma and lucro_total_plataforma > 0:
        plataforma.saldo += lucro_total_plataforma
        db.add(Transacao(
            usuario_id=plataforma.id,
            valor=lucro_total_plataforma,
            tipo=TipoTransacao.TAXA_INTERMEDIACAO,
            status="concluido",
            detalhes=f"Performance Fee Quitação (10%) - Pedido #{solicitacao_id}"
        ))

    db.add(Transacao(
        usuario_id=usuario.id,
        valor=total_final_devedor,
        tipo=TipoTransacao.PAGAMENTO_PARCELA,
        status="concluido",
        detalhes=f"Quitação Integral do Empréstimo #{solicitacao_id}"
    ))

    db.commit()
    
    # Invalida o cache global
    cache_snapshot_data.clear()

    return {
        "message": "Empréstimo quitado com sucesso!",
        "novo_saldo": float(usuario.saldo),
        "total_pago": float(total_final_devedor)
    }

@router.post("/pagamento-avulso/{solicitacao_id}")
async def pagamento_avulso(solicitacao_id: int, dados: PagamentoRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Permite pagar qualquer valor. 
    Regra: Adiciona R$ 1,50 à dívida total como taxa de conveniência.
    """
    valor_pago = dados.valor_pagamento
    taxa_conveniencia = Decimal("1.50")

    if not usuario or usuario.saldo < valor_pago:
        raise HTTPException(status_code=400, detail="Saldo insuficiente.")

    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo aprovado não encontrado.")

    # 1. Processar Pagamento
    usuario.saldo -= valor_pago
    solicitacao.taxas_adicionais += taxa_conveniencia
    
    # Bônus de score proporcional ou restauração se estava zerado
    if usuario.score == 0 and usuario.score_anterior > 0:
        usuario.score = usuario.score_anterior
        usuario.score_anterior = Decimal("0")
    else:
        usuario.score = min(Decimal("1000"), usuario.score + Decimal("0.5"))
        
    # RESTAURA SCORE DOS GARANTIDORES (Se o valor pago for suficiente para cobrir o atraso ou amortizar significativamente)
    # Por segurança, restauramos sempre que houver um pagamento avulso em conta zerada
    for g in solicitacao.garantias_sociais:
        garante = g.garante
        if garante.score == 0 and garante.score_anterior > 0:
            garante.score = garante.score_anterior
            garante.score_anterior = Decimal("0")

    # 2. Rateio com Investidores (Proteção de Principal Pró-rata)
    total_emprestado = solicitacao.valor
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    
    valor_restante_rateio = valor_pago
    
    # 1. Passo: Principal (Amortizar o que foi investido)
    # Como é pagamento avulso, não temos 'principal da parcela', mas sim o saldo devedor principal
    # Calculamos quanto de principal cada um ainda tem a receber (Total investido - Já recebido de principal)
    # Por simplicidade em pagamentos AVULSOS, devolvemos pro-rata do valor total investido até cobrir o principal total
    
    pagamentos_investidores = []
    total_principal_devido = Decimal("0.00")
    
    for inv in solicitacao.investimentos:
        # Principal que falta receber para este investimento específico
        # Simplificamos: proporção do valor pago vai para o principal pro-rata
        pagamentos_investidores.append({
            "investimento": inv,
            "proporcao": inv.valor_investido / total_emprestado,
            "valor_liquido": Decimal("0.00")
        })

    # Aqui no avulso, distribuímos pro-rata o valor pago priorizando o capital
    # Empréstimos são de curto prazo, então tratamos o pagamento avulso como amortização de capital primeiro
    # e o que sobrar de taxas e juros depois.
    
    # Estimativa de quanto desse pagamento é CAPITAL (proporção baseada no valor total com juros)
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros_total = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    percentual_capital = solicitacao.valor / total_com_juros_total
    
    valor_capital_no_pagamento = min(valor_restante_rateio, valor_pago * percentual_capital)
    
    for p in pagamentos_investidores:
        p["valor_liquido"] += valor_capital_no_pagamento * p["proporcao"]
    
    valor_restante_rateio -= valor_capital_no_pagamento

    # 2. Passo: Taxa de Conveniência (Livre)
    lucro_conveniencia_total = Decimal("0.00")
    if solicitacao.taxas_adicionais > 0 and valor_restante_rateio > 0:
        lucro_conveniencia_total = min(valor_restante_rateio, solicitacao.taxas_adicionais)
        solicitacao.taxas_adicionais -= lucro_conveniencia_total
        valor_restante_rateio -= lucro_conveniencia_total
        
        if plataforma and lucro_conveniencia_total > 0:
            plataforma.saldo += lucro_conveniencia_total
            db.add(Transacao(
                usuario_id=plataforma.id,
                valor=lucro_conveniencia_total,
                tipo=TipoTransacao.TAXA_INTERMEDIACAO,
                status="concluido",
                detalhes=f"Taxa Conveniência Pagto Avulso - Pedido #{solicitacao_id}"
            ))

    # 3. Passo: Juros + Performance
    lucro_performance_total = Decimal("0.00")
    if valor_restante_rateio > 0:
        for p in pagamentos_investidores:
            fatia_juros_bruta = valor_restante_rateio * p["proporcao"]
            taxa_perf = fatia_juros_bruta * Decimal("0.10")
            lucro_performance_total += taxa_perf
            p["valor_liquido"] += (fatia_juros_bruta - taxa_perf)

    # 4. Efetivar pagamentos aos investidores (Capital + Juros Líquidos)
    for p in pagamentos_investidores:
        inv = p["investimento"]
        investidor = inv.investidor
        valor_final = p["valor_liquido"]
        
        if hasattr(inv, 'is_pool') and inv.is_pool:
            # Separar capital de lucro no pagamento avulso
            # Como p["valor_liquido"] no avulso já acumulou capital e lucro, precisamos identificar
            # O capital_no_pool já foi calculado proporcionalmente na lógica anterior do avulso
            # Para simplificar o rateio do lucro no avulso:
            fatia_principal_avulso = valor_capital_no_pagamento * p["proporcao"]
            lucro_liquido_avulso = valor_final - fatia_principal_avulso
            
            # 1. Rateio Proporcional Integral (Capital + Juros) no Avulso
            total_caixa_global = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("1.00")
            participantes_caixa = db.query(Usuario).filter(Usuario.saldo_caixa > 0).all()
            
            for p_caixa in participantes_caixa:
                fatia = (p_caixa.saldo_caixa / total_caixa_global) * valor_final
                p_caixa.saldo_caixa += fatia
            
            # Cálculo de juros estimados para o admin (transparência)
            proporcao_admin = plataforma.saldo_caixa / total_caixa_global if total_caixa_global > 0 else Decimal("0")
            juros_admin_avulso = lucro_liquido_avulso * proporcao_admin

            inv.pago_para_investidor += valor_final
            tipo_trans = TipoTransacao.RETORNO_POOL
            detalhes_trans = f"Retorno Avulso Pro-rata Pool | Total: {valor_final} | Juros Est. Admin: {juros_admin_avulso} | Pedido #{solicitacao_id}"
            u_id = plataforma.id
        else:
            investidor.saldo += valor_final
            inv.pago_para_investidor += valor_final
            u_id = investidor.id
            tipo_trans = TipoTransacao.RECEBIMENTO
            detalhes_trans = f"Recebimento Avulso (Net) - Pedido #{solicitacao_id}"
            
            if hasattr(inv, 'is_institutional') and inv.is_institutional:
                tipo_trans = TipoTransacao.RETORNO_INVESTIMENTO
                detalhes_trans = f"RETORNO INVESTIMENTO (LUCRO) - Pedido #{solicitacao_id}"

        db.add(Transacao(
            usuario_id=u_id,
            valor=valor_final,
            tipo=tipo_trans,
            status="concluido",
            detalhes=detalhes_trans
        ))

    # 5. Creditar Taxas à Plataforma Admin
    if plataforma:
        total_taxas_admin = lucro_conveniencia_total + lucro_performance_total
        if total_taxas_admin > 0:
            plataforma.saldo += total_taxas_admin
            db.add(Transacao(
                usuario_id=plataforma.id,
                valor=total_taxas_admin,
                tipo=TipoTransacao.TAXA_INTERMEDIACAO,
                status="concluido",
                detalhes=f"Taxas Intermediação (Conven+Perf) Pagto Avulso - Pedido #{solicitacao_id} (Tomador: {usuario.nome})"
            ))

    # 4. Amortizar Dívida Principal (Líquido)
    # A dívida total diminui pelo valor bruto pago menos apenas a taxa de conveniência da plataforma
    reducao_divida = valor_pago - lucro_conveniencia_total
    solicitacao.valor_amortizado += reducao_divida

    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor_pago,
        tipo=TipoTransacao.PAGAMENTO_PARCELA,
        status="concluido",
        detalhes=f"Pagamento Avulso (Livre) - Pedido #{solicitacao_id}"
    ))


    # Verificar se quitou (considerando taxas adicionais pendentes se houver)
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros_total = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    valor_parcela_base = total_com_juros_total / solicitacao.prazo_meses
    
    divida_total = total_com_juros_total + solicitacao.taxas_adicionais
    total_pago = (valor_parcela_base * solicitacao.parcelas_pagas) + solicitacao.valor_amortizado
    
    if total_pago >= divida_total:
        solicitacao.status = StatusSolicitacao.CONCLUIDO
        solicitacao.parcelas_pagas = solicitacao.prazo_meses

    db.commit()
    return {
        "message": f"Pagamento de R$ {valor_pago:.2f} processado! Taxa de conveniência de R$ 1,50 adicionada ao saldo devedor.",
        "novo_saldo": float(usuario.saldo),
        "valor_pago": float(valor_pago)
    }

@router.get("/contrato/pdf/{solicitacao_id}")
async def gerar_contrato_pdf(solicitacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Gera um PDF profissional de contrato de mútuo.
    - Tomador: Vê detalhes do empréstimo e nomes de quem o financiou.
    - Investidor: Vê detalhes do seu aporte e o nome do tomador.
    """
    from fpdf import FPDF
    from fastapi import Response
    from datetime import timedelta
    
    # Função auxiliar para limpar strings (o PDF padrão só aceita latin-1)
    def limpar(txt):
        if not txt: return ""
        return str(txt).encode('latin-1', 'replace').decode('latin-1')

    # Subclasse para suportar rotação e marca d'água
    class PDFContrato(FPDF):
        def watermark(self):
            self.set_font('helvetica', 'B', 40)
            self.set_text_color(225, 225, 225) # Cinza mais visível (RGB 225)
            self.rotate(45, 100, 150)
            # Centralizar melhor o texto diagonal
            self.text(10, 150, limpar("PEER - DOCUMENTO AUTENTICADO")) 
            self.rotate(0)

        def rotate(self, angle, x=None, y=None):
            if x is None: x = self.x
            if y is None: y = self.y
            if self.angle != 0: self._out('Q')
            self.angle = angle
            if angle != 0:
                import math
                angle *= math.pi / 180
                c = math.cos(angle)
                s = math.sin(angle)
                cx = x * self.k
                cy = (self.h - y) * self.k
                self._out(f'q 1 0 0 1 {cx:.5f} {cy:.5f} cm {c:.5f} {s:.5f} {-s:.5f} {c:.5f} cm 1 0 0 1 {-cx:.5f} {-cy:.5f} cm')

        def header(self):
            self.watermark()

    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id
    ).first()
    
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")

    # Verificar permissão: Deve ser o tomador OU um dos investidores
    e_tomador = solicitacao.usuario_id == usuario.id
    investimento_usuario = db.query(Investimento).filter(
        Investimento.solicitacao_id == solicitacao_id,
        Investimento.investidor_id == usuario.id
    ).first()

    if not e_tomador and not investimento_usuario:
        raise HTTPException(status_code=403, detail="Você não tem permissão para acessar este contrato.")

    # Só gerar se estiver APROVADO ou CONCLUIDO (Dívida em aberto ou encerrada)
    if solicitacao.status not in [StatusSolicitacao.APROVADO, StatusSolicitacao.CONCLUIDO]:
        raise HTTPException(status_code=400, detail="Contrato disponível apenas para empréstimos ativos ou concluídos.")

    # Ajuste de data para Brasília
    data_brasilia = solicitacao.data_criacao - timedelta(hours=3)
    data_formatada = data_brasilia.strftime('%d/%m/%Y %H:%M')
    
    # Configuração do PDF usando a nova classe
    pdf = PDFContrato()
    pdf.angle = 0 # Inicializar atributo de ângulo
    pdf.add_page()
    pdf.set_font("helvetica", "B", 16)
    
    # Cabeçalho
    pdf.set_text_color(0, 0, 0) # Reset cor do texto do contrato
    pdf.cell(0, 10, limpar("PEER - INTERMEDIAÇÃO FINANCEIRA"), ln=True, align="C")
    pdf.set_font("helvetica", "", 10)
    pdf.cell(0, 5, limpar("Sistema de Empréstimos Peer-to-Peer (P2P)"), ln=True, align="C")
    pdf.ln(10)
    
    # Título do Contrato
    pdf.set_font("helvetica", "B", 12)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(0, 10, limpar(f"CONTRATO DE MÚTUO FINANCEIRO - ID #{solicitacao.id}"), ln=True, align="L", fill=True)
    pdf.ln(5)
    
    # Seção 1: Partes
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, limpar("1. PARTES"), ln=True)
    pdf.set_font("helvetica", "", 10)
    
    tomador = solicitacao.usuario
    garantidores_nomes = ", ".join([g.garante.nome for g in solicitacao.garantias_sociais if g.garante]) or "NENHUM"
    
    if e_tomador:
        nomes_investidores = []
        for inv in solicitacao.investimentos:
            if inv.investidor:
                if hasattr(inv, 'is_institutional') and inv.is_institutional:
                    nomes_investidores.append("Peer Tecnologia Ltda. (Institucional)")
                else:
                    nomes_investidores.append(inv.investidor.nome)
        investidores_nomes = ", ".join(nomes_investidores)
        if not investidores_nomes and solicitacao.status == StatusSolicitacao.PENDENTE:
            investidores_nomes = "EM CAPTAÇÃO"
            
        texto_partes = (
            f"MUTUÁRIO (TOMADOR): {tomador.nome}\n"
            f"CPF: {tomador.cpf}\n"
            f"MUTUANTES (INVESTIDORES): {investidores_nomes}\n"
            f"GARANTIDORES: {garantidores_nomes}\n"
            f"TIPO DE GARANTIA: {solicitacao.tipo_garantia.upper()}\n"
            f"INTERMEDIADORA: Peer Tecnologia Ltda."
        )
    else:
        # Se investidor está vendo seu contrato
        nome_investidor_pdf = usuario.nome
        if investimento_usuario and hasattr(investimento_usuario, 'is_institutional') and investimento_usuario.is_institutional:
            nome_investidor_pdf = "Peer Tecnologia Ltda. (Institucional)"
        
        texto_partes = (
            f"MUTUÁRIO (TOMADOR): {tomador.nome}\n"
            f"MUTUANTE (INVESTIDOR): {nome_investidor_pdf}\n"
            f"CPF INVESTIDOR: {usuario.cpf}\n"
            f"GARANTIDORES: {garantidores_nomes}\n"
            f"TIPO DE GARANTIA: {solicitacao.tipo_garantia.upper()}\n"
            f"INTERMEDIADORA: Peer Tecnologia Ltda."
        )
    
    pdf.multi_cell(0, 5, limpar(texto_partes))
    pdf.ln(5)
    
    # Seção 2: Objeto
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, limpar("2. OBJETO E CONDIÇÕES"), ln=True)
    pdf.set_font("helvetica", "", 10)
    
    valor_contrato = float(solicitacao.valor) if e_tomador else float(investimento_usuario.valor_investido)
    texto_objeto = (
        f"VALOR APORTADO: R$ {valor_contrato:,.2f}\n"
        f"TAXA DE JUROS: {solicitacao.taxa_juros}% ao mês (Juros Simples)\n"
        f"PRAZO TOTAL: {solicitacao.prazo_meses} meses\n"
        f"DATA DE ORIGINAÇÃO: {data_formatada}"
    )
    
    if solicitacao.tipo_garantia in ["fisica", "hibrida"]:
        texto_objeto += f"\nDESCRIÇÃO DO BEM: {solicitacao.garantia_descricao or 'Não informado'}"
        if solicitacao.parceiro:
            texto_objeto += f"\nLOCAL DE CUSTÓDIA: {solicitacao.parceiro.nome} - {solicitacao.parceiro.endereco}"
    elif solicitacao.tipo_garantia == "nenhuma":
        texto_objeto += f"\nGARANTIA: SEM GARANTIA REAL/COLETIVA (CRÉDITO SOB RITMO DE ANÁLISE RIGOROSA)"

    pdf.multi_cell(0, 5, limpar(texto_objeto))
    pdf.ln(5)
    
    # Seção 3: Cláusulas
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, limpar("3. CLÁUSULAS DE SEGURANÇA"), ln=True)
    pdf.set_font("helvetica", "", 9)
    clausulas = (
        "O MUTUÁRIO declara-se ciente que o não pagamento de parcelas acarretará em redução do score interno "
        "e restrições de novos créditos. O MUTUANTE declara ciência dos riscos inerentes ao investimento P2P. "
        "A plataforma Peer atua apenas como facilitadora técnica e intermediadora."
    )
    if solicitacao.tipo_garantia in ["fisica", "hibrida"]:
        clausulas += (
            " O MUTUÁRIO declara ciência que o bem alienado oferecido como garantia poderá ser LIQUIDADO para "
            "quitação da dívida em caso de inadimplência superior a 30 dias, conforme regras da plataforma."
        )
    pdf.multi_cell(0, 5, limpar(clausulas))
    pdf.ln(10)
    
    # Seção 4: Assinaturas Eletrônicas (Auditoria)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(0, 7, limpar("4. ASSINATURAS E RASTREABILIDADE"), ln=True)
    pdf.set_font("helvetica", "", 8)
    pdf.set_text_color(0, 0, 0)

    # Helper: converter UTC -> Brasília
    def fmt_brasilia(dt):
        if not dt: return "PENDENTE"
        return (dt - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M')

    # 4.1 Tomador
    pdf.set_font("helvetica", "B", 8)
    pdf.cell(0, 5, limpar(f"TOMADOR: {tomador.nome} ({tomador.cpf})"), ln=True)
    pdf.set_font("helvetica", "", 8)
    data_aceite = fmt_brasilia(solicitacao.data_aceite)
    pdf.cell(0, 4, limpar(f"Status: ASSINADO em {solicitacao.auditoria.municipio if solicitacao.auditoria else 'N/A'} via IP {solicitacao.auditoria.ip if solicitacao.auditoria else 'N/A'} às {data_aceite}"), ln=True)
    pdf.ln(2)

    # 4.2 Garantidores
    from modelos.modelos_db import GarantiaSocial
    garantias = db.query(GarantiaSocial).filter(GarantiaSocial.solicitacao_id == solicitacao.id).all()
    for g in garantias:
        if not g.garante: continue
        pdf.set_font("helvetica", "B", 8)
        pdf.cell(0, 5, limpar(f"GARANTIDOR: {g.garante.nome} ({g.garante.cpf})"), ln=True)
        pdf.set_font("helvetica", "", 8)
        data_g = fmt_brasilia(g.data_aceite)
        status_g = f"ASSINADO em {g.auditoria.municipio if g.auditoria else 'N/A'} via IP {g.auditoria.ip if g.auditoria else 'N/A'} às {data_g}" if g.aceito else "PENDENTE"
        pdf.cell(0, 4, limpar(f"Status: {status_g}"), ln=True)
        pdf.ln(2)

    # 4.3 Investidores
    for inv in solicitacao.investimentos:
        if not inv.investidor: continue
        pdf.set_font("helvetica", "B", 8)
        if hasattr(inv, 'is_institutional') and inv.is_institutional:
            pdf.cell(0, 5, limpar(f"INVESTIDOR: Peer Tecnologia Ltda. (Institucional)"), ln=True)
        else:
            pdf.cell(0, 5, limpar(f"INVESTIDOR: {inv.investidor.nome} ({inv.investidor.cpf})"), ln=True)
        pdf.set_font("helvetica", "", 8)
        data_i = fmt_brasilia(inv.data_investimento)
        status_i = f"ASSINADO em {inv.auditoria.municipio if inv.auditoria else 'N/A'} via IP {inv.auditoria.ip if inv.auditoria else 'N/A'} às {data_i}"
        pdf.cell(0, 4, limpar(f"Status: {status_i}"), ln=True)
        pdf.ln(2)

    pdf.ln(5)
    
    # Selo de Autenticidade
    pdf.set_draw_color(0, 200, 0)
    pdf.set_line_width(0.5)
    pdf.rect(10, pdf.get_y(), 190, 20)
    pdf.set_xy(15, pdf.get_y() + 3)
    pdf.set_font("helvetica", "B", 10)
    pdf.set_text_color(0, 150, 0)
    pdf.cell(0, 5, limpar("DOCUMENTO AUTENTICADO DIGITALMENTE"), ln=True)
    pdf.set_font("helvetica", "", 8)
    import hashlib
    hash_base = f"peer-{solicitacao.id}-{solicitacao.data_criacao}"
    hash_seguranca = hashlib.sha256(hash_base.encode()).hexdigest()[:16].upper()

    pdf.cell(0, 4, limpar(f"Hash de Segurança: {hash_seguranca}"), ln=True)
    pdf.cell(0, 4, limpar(f"Certificação de Origem: {data_formatada} (Horário de Brasília)"), ln=True)
    
    # Saída
    pdf_content = bytes(pdf.output())
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=contrato_peer_{solicitacao.id}.pdf"}
    )

@router.get("/contrato/{solicitacao_id}")
async def gerar_contrato_texto(solicitacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    # Mantendo a rota de texto para retrocompatibilidade se necessário
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).first()
    
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")
    
    data_formatada = solicitacao.data_criacao.strftime('%d/%m/%Y')
    return {"contrato_id": solicitacao.id, "texto": "Use a rota /pdf para baixar o documento oficial."}

@router.post("/admin/verificar-inadimplencia")
async def verificar_inadimplencia(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Varre todos os empréstimos ativos e, se houver atraso superior a 1 dia,
    zera o score do tomador e de seus garantidores (Garantia Social).
    """
    from rotas.rotas_auth import exigir_admin
    agora = datetime.datetime.utcnow()
    limite_atraso = agora - datetime.timedelta(days=1)

    atrasados = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO,
        SolicitacaoEmprestimo.proximo_vencimento < limite_atraso
    ).all()

    penalizados = 0
    for s in atrasados:
        tomador = s.usuario
        # Penaliza Tomador
        if tomador.score > 0:
            tomador.score_anterior = tomador.score
            tomador.score = Decimal("0")
        
        # Penaliza Garantidores
        for g in s.garantias_sociais:
            garante = g.garante
            if garante.score > 0:
                garante.score_anterior = garante.score
                garante.score = Decimal("0")
                penalizados += 1
    
    db.commit()
    registrar_acao_admin(db, admin.id, "VERIFICAR_INADIMPLENCIA", alvo_id="SISTEMA", detalhes=f"Emprestimos: {len(atrasados)}, Penalizados: {penalizados}", ip=None)
    return {"message": f"Verificação concluída. {len(atrasados)} empréstimos em atraso encontrados. {penalizados} garantidores penalizados com score 0."}

@router.post("/admin/liberar-especial/{solicitacao_id}")
async def liberacao_especial_admin(solicitacao_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Liberação de FORÇA BRUTA pelo Admin.
    Ignora a necessidade de 2 garantidores, mas ainda exige 100% de arrecadação.
    """
    try:
        sucesso = tentar_liberar_emprestimo(solicitacao_id, db, ignore_guarantors=True)
        if sucesso:
            registrar_acao_admin(db, admin.id, "LIBERACAO_ESPECIAL", alvo_id=str(solicitacao_id), detalhes="Bypass de garantidores", ip=None)
            return {"message": "Empréstimo liberado com sucesso (Bypass de Garantidores)!"}
        else:
            raise HTTPException(status_code=400, detail="Não foi possível liberar. Verifique se a meta de 100% foi atingida.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/confirmar-pool/{solicitacao_id}")
async def confirmar_aporte_pool(
    solicitacao_id: int,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Rota Administrativa para confirmar o aporte sugerido pelo sistema usando o saldo do Pool.
    """
    solicitacao = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.id == solicitacao_id).first()
    if not solicitacao or solicitacao.status != StatusSolicitacao.PENDENTE:
        raise HTTPException(status_code=404, detail="Solicitação pendente não encontrada.")

    valor_aporte = solicitacao.sugestao_pool
    if valor_aporte <= 0:
        raise HTTPException(status_code=400, detail="Não há sugestão de aporte válida para este pedido.")

    # Verificar se o Pool tem saldo (soma total do saldo_caixa dos usuários)
    total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")
    
    if total_pool < valor_aporte:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente no Pool (Disponível: R$ {total_pool})")

    # Registrar o Investimento Automático do Pool
    novo_investimento = Investimento(
        investidor_id=admin.id, # O Admin atua em nome do fundo no MVP
        solicitacao_id=solicitacao.id,
        valor_investido=valor_aporte,
        is_institutional=True,
        is_pool=True,
        data_investimento=datetime.datetime.utcnow(),
        ciencia_risco=True
    )

    # Deduzimos o valor de forma pro-rata de todos os participantes do Pool
    total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("1.00")
    participantes_caixa = db.query(Usuario).filter(Usuario.saldo_caixa > 0).all()
    
    for p_caixa in participantes_caixa:
        fatia_debito = (p_caixa.saldo_caixa / total_pool) * valor_aporte
        p_caixa.saldo_caixa -= fatia_debito
        db.add(p_caixa)

    solicitacao.valor_arrecadado += valor_aporte
    
    # Zerar a sugestão após o uso
    solicitacao.sugestao_pool = Decimal("0.00")

    db.add(novo_investimento)
    db.add(Transacao(
        usuario_id=admin.id,
        valor=valor_aporte,
        tipo=TipoTransacao.INVESTIMENTO,
        status="concluido",
        detalhes=f"Aporte Pool Aprovado - Pedido #{solicitacao_id}"
    ))

    registrar_acao_admin(db, admin.id, "APROVAR_APORTE_POOL", alvo_id=str(solicitacao_id), detalhes=f"Valor: {valor_aporte}", ip=None)
    db.commit()
    
    # Tenta liberar o empréstimo se atingiu 100% (o que é o caso após aporte do Pool)
    from utils_emprestimo import tentar_liberar_emprestimo
    tentar_liberar_emprestimo(solicitacao.id, db, ignore_guarantors=False)

    # Invalida o cache global
    cache_snapshot_data.clear()
    
    return {"message": f"Aporte do Pool de R$ {valor_aporte} confirmado e empréstimo processado!"}
