from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal
import datetime
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, Investimento, AcessoInvestidor
from database import get_db
from rotas.rotas_auth import obter_usuario_logado

router = APIRouter(prefix="/emprestimos", tags=["Empréstimos"])

class SolicitacaoRequest(BaseModel):
    valor: Decimal
    taxa_juros: Decimal
    parcelas: int

def validar_limites_solicitacao(usuario: Usuario):
    agora = datetime.datetime.utcnow()
    
    # Regra 1: 1 pedido a cada 15 dias (padrão)
    if usuario.ultima_solicitacao:
        dias_passados = (agora - usuario.ultima_solicitacao).days
        if dias_passados < 15:
            # Se o score for menor que um certo limite ou não comprou upgrade, bloqueia
            # Aqui assumimos que o score influencia o limite diário conforme pedido
            if usuario.solicitacoes_hoje >= 5:
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Limite de 5 solicitações diárias atingido (Requer Upgrade de Score)."
                )
            
            # Se não tem score suficiente para o upgrade diário, cai na trava de 15 dias
            if usuario.score < Decimal("1.5"):
                 raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Você só pode realizar um novo pedido em {15 - dias_passados} dias ou comprando Score."
                )

    # Resetar contador diário se for um novo dia
    # (Lógica simplificada, idealmente seria via cron ou middleware)
    # if usuario.ultima_solicitacao and usuario.ultima_solicitacao.date() < agora.date():
    #     usuario.solicitacoes_hoje = 0

    return True

@router.post("/solicitar")
async def criar_solicitacao(
    dados: SolicitacaoRequest, 
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(obter_usuario_logado)
):
    valor = dados.valor
    taxa_juros = dados.taxa_juros
    parcelas = dados.parcelas
    
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

    # Regra: Cada pedido custa R$ 4,00
    custo_pedido = Decimal("4.00")
    if usuario.saldo < custo_pedido:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para postar pedido (Custo: R$ 4,00).")

    usuario.saldo -= custo_pedido
    
    agora = datetime.datetime.utcnow()
    nova_solicitacao = SolicitacaoEmprestimo(
        usuario_id=usuario.id,
        valor=valor,
        taxa_juros=taxa_juros,
        prazo_meses=parcelas,
        status=StatusSolicitacao.PENDENTE,
        data_criacao=agora,
        data_expiracao_4h=agora + datetime.timedelta(hours=4),
        data_expiracao_5d=agora + datetime.timedelta(days=5)
    )

    # Registrar transação do custo
    transacao_custo = Transacao(
        usuario_id=usuario.id,
        valor=custo_pedido,
        tipo=TipoTransacao.DESBLOQUEIO_DADOS, # Reutilizando ou criando um novo tipo como CUSTO_POSTAGEM
        status="concluido",
        detalhes="Custo de postagem de empréstimo"
    )

    usuario.ultima_solicitacao = agora
    usuario.solicitacoes_hoje += 1
    
    db.add(nova_solicitacao)
    db.add(transacao_custo)
    db.commit()
    db.refresh(nova_solicitacao)
    
    return {"message": "Solicitação criada com sucesso! Custo de R$ 4,00 descontado.", "id": nova_solicitacao.id}

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
            "expira_em": "4h / 5d" 
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
        
        resultado.append({
            "id": s.id,
            "valor": float(s.valor),
            "valor_arrecadado": float(s.valor_arrecadado),
            "taxa_juros": float(s.taxa_juros),
            "parcelas": s.prazo_meses,
            "parcelas_pagas": s.parcelas_pagas,
            "valor_parcela": round(float(valor_parcela), 2),
            "valor_total_restante": round(float(total_com_juros - (valor_parcela * s.parcelas_pagas)), 2),
            "status": s.status.value,
            "data_criacao": s.data_criacao,
            "data_expiracao_4h": s.data_expiracao_4h,
            "data_expiracao_5d": s.data_expiracao_5d
        })
    
    return resultado

class PagamentoRequest(BaseModel):
    valor_pagamento: Decimal

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

    # Deduzir saldo do tomador
    usuario.saldo -= valor_pagamento
    
    # Incrementar parcelas e aumentar score (+1.0 por bom pagamento)
    solicitacao.parcelas_pagas += 1
    usuario.score = min(Decimal("1000"), usuario.score + Decimal("1.0"))

    # LÓGICA DE RATEIO (DISTRIBUIÇÃO)
    # A parcela paga pelo tomador (que inclui juros) deve ser dividida proporcionalmente
    total_emprestado = solicitacao.valor
    
    for inv in solicitacao.investimentos:
        # Calcular proporção: (Valor que este investidor colocou / Total do empréstimo)
        proporcao = inv.valor_investido / total_emprestado
        
        # Valor a receber: (Proporção * Valor do Pagamento do Tomador)
        parte_investidor = valor_pagamento * proporcao
        
        # Atualizar saldo do investidor
        investidor = inv.investidor
        investidor.saldo += parte_investidor
        inv.pago_para_investidor += parte_investidor
        
        # Registrar recebimento
        rec_transacao = Transacao(
            usuario_id=investidor.id,
            valor=parte_investidor,
            tipo=TipoTransacao.RECEBIMENTO,
            status="concluido",
            detalhes=f"Recebimento de parcela do pedido ID {solicitacao_id} (Rateio Proporcional)"
        )
        db.add(rec_transacao)

    # Registrar pagamento do tomador
    pag_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor_pagamento,
        tipo=TipoTransacao.RECEBIMENTO, # Ou criar um tipo PAGAMENTO_EMPRESTIMO
        status="concluido",
        detalhes=f"Pagamento de parcela do empréstimo ID {solicitacao_id}"
    )
    db.add(pag_transacao)

    # Se todas as parcelas foram pagas, marcar como CONCLUIDO
    if solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
        solicitacao.status = StatusSolicitacao.CONCLUIDO

    db.commit()
    return {"message": f"Parcela paga! Score atualizado: {usuario.score}", "novo_saldo": float(usuario.saldo)}

@router.post("/quitar-total/{solicitacao_id}")
async def quitar_total(solicitacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).first()
    
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")

    # Cálculo do Total Restante (Principal + Juros Acumulados)
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (1 + (taxa_mensal * solicitacao.prazo_meses))
    valor_parcela = total_com_juros / solicitacao.prazo_meses
    total_restante = total_com_juros - (valor_parcela * solicitacao.parcelas_pagas)

    if usuario.saldo < total_restante:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para quitação total (R$ {total_restante})")

    # Deduzir saldo e quitar
    usuario.saldo -= total_restante
    usuario.score = min(Decimal("1000"), usuario.score + Decimal("5.0")) # Bônus maior por quitação total
    solicitacao.parcelas_pagas = solicitacao.prazo_meses
    solicitacao.status = StatusSolicitacao.CONCLUIDO
    
    # Rateio para investidores
    total_emprestado = solicitacao.valor
    for inv in solicitacao.investimentos:
        proporcao = inv.valor_investido / total_emprestado
        parte_investidor = total_restante * proporcao
        inv.investidor.saldo += parte_investidor
        inv.pago_para_investidor += parte_investidor
        
        db.add(Transacao(
            usuario_id=inv.investidor.id,
            valor=parte_investidor,
            tipo=TipoTransacao.RECEBIMENTO,
            status="concluido",
            detalhes=f"Quitação total do pedido ID {solicitacao_id}"
        ))

    db.add(Transacao(
        usuario_id=usuario.id,
        valor=total_restante,
        tipo=TipoTransacao.RECEBIMENTO,
        status="concluido",
        detalhes=f"Quitação integral do empréstimo ID {solicitacao_id}"
    ))

    db.commit()
    return {"message": "Empréstimo quitado com sucesso! Ganhou +5.0 de score.", "novo_saldo": float(usuario.saldo)}

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

    if solicitacao.status not in [StatusSolicitacao.APROVADO, StatusSolicitacao.CONCLUIDO]:
        raise HTTPException(status_code=400, detail="Contrato disponível apenas para empréstimos aprovados ou concluídos.")

    # Ajuste de data para Brasília
    data_brasilia = solicitacao.data_criacao - timedelta(hours=3)
    data_formatada = data_brasilia.strftime('%d/%m/%Y %H:%M')
    agora_brasilia = (datetime.datetime.utcnow() - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M')

    # Configuração do PDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 16)
    
    # Cabeçalho
    pdf.cell(0, 10, "PEER - INTERMEDIAÇÃO FINANCEIRA", ln=True, align="C")
    pdf.set_font("Arial", "", 10)
    pdf.cell(0, 5, "Sistema de Empréstimos Peer-to-Peer (P2P)", ln=True, align="C")
    pdf.ln(10)
    
    # Título do Contrato
    pdf.set_font("Arial", "B", 12)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(0, 10, f"CONTRATO DE MÚTUO FINANCEIRO - ID #{solicitacao.id}", ln=True, align="L", fill=True)
    pdf.ln(5)
    
    # Seção 1: Partes
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 7, "1. PARTES", ln=True)
    pdf.set_font("Arial", "", 10)
    
    tomador = solicitacao.usuario
    if e_tomador:
        # Tomador vê a lista de quem o financiou
        investidores_nomes = ", ".join([inv.investidor.nome for inv in solicitacao.investimentos])
        texto_partes = (
            f"MUTUÁRIO (TOMADOR): {tomador.nome}\n"
            f"CPF: {tomador.cpf}\n"
            f"MUTUANTES (INVESTIDORES): {investidores_nomes}\n"
            f"INTERMEDIADORA: Peer Tecnologia Ltda."
        )
    else:
        # Investidor vê apenas o Tomador e ele mesmo
        texto_partes = (
            f"MUTUÁRIO (TOMADOR): {tomador.nome}\n"
            f"MUTUANTE (INVESTIDOR): {usuario.nome}\n"
            f"CPF INVESTIDOR: {usuario.cpf}\n"
            f"INTERMEDIADORA: Peer Tecnologia Ltda."
        )
    
    pdf.multi_cell(0, 5, texto_partes)
    pdf.ln(5)
    
    # Seção 2: Objeto
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 7, "2. OBJETO E CONDIÇÕES", ln=True)
    pdf.set_font("Arial", "", 10)
    
    valor_contrato = solicitacao.valor if e_tomador else investimento_usuario.valor_investido
    texto_objeto = (
        f"VALOR APORTADO: R$ {valor_contrato:,.2f}\n"
        f"TAXA DE JUROS: {solicitacao.taxa_juros}% ao mês (Juros Simples)\n"
        f"PRAZO TOTAL: {solicitacao.prazo_meses} meses\n"
        f"DATA DE ORIGINAÇÃO: {data_formatada}"
    )
    pdf.multi_cell(0, 5, texto_objeto)
    pdf.ln(5)
    
    # Seção 3: Cláusulas
    pdf.set_font("Arial", "B", 10)
    pdf.cell(0, 7, "3. CLÁUSULAS DE SEGURANÇA", ln=True)
    pdf.set_font("Arial", "", 9)
    clausulas = (
        "O MUTUÁRIO declara-se ciente que o não pagamento de parcelas acarretará em redução do score interno "
        "e restrições de novos créditos. O MUTUANTE declara ciência dos riscos inerentes ao investimento P2P. "
        "A plataforma Peer atua apenas como facilitadora técnica e intermediadora."
    )
    pdf.multi_cell(0, 5, clausulas)
    pdf.ln(10)
    
    # Selo de Autenticidade
    pdf.set_draw_color(0, 200, 0)
    pdf.set_line_width(0.5)
    pdf.rect(10, pdf.get_y(), 190, 25)
    pdf.set_xy(15, pdf.get_y() + 5)
    pdf.set_font("Arial", "B", 10)
    pdf.set_text_color(0, 150, 0)
    pdf.cell(0, 5, "ASSINADO ELETRONICAMENTE", ln=True)
    pdf.set_font("Arial", "", 8)
    pdf.cell(0, 5, f"Autenticação via conta Peer: {usuario.email}", ln=True)
    pdf.cell(0, 5, f"Emissão do Documento: {agora_brasilia} (Horário de Brasília)", ln=True)
    
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
