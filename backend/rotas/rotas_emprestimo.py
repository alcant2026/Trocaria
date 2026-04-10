from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, RegistroAuditoria
from database import get_db
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from utils_fintech import calcular_limite_credito, verificar_isencao_taxa, aprovar_emprestimo_instantaneo
from utils_score import atualizar_score
from fastapi.responses import StreamingResponse
import io
from fpdf import FPDF
from rotas.rotas_snapshot import cache_snapshot_data

router = APIRouter(prefix="/emprestimos", tags=["Empréstimos Fintech"])

class SolicitacaoRequest(BaseModel):
    valor: Decimal = Field(gt=0, le=10000)
    parcelas: int = Field(ge=1, le=12)
    aceite_termos: bool

@router.get("/limite")
async def consultar_limite(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Retorna o limite de crédito atual do usuário baseado no Pool e Score."""
    limite = calcular_limite_credito(usuario, db)
    isento = verificar_isencao_taxa(usuario)
    
    return {
        "limite_disponivel": float(limite),
        "score_atual": float(usuario.score),
        "saldo_pool": float(usuario.saldo_caixa),
        "isento_taxa": isento,
        "mensagem": "Você tem crédito disponível!" if limite > 0 else "Aumente seu saldo no Pool para liberar crédito."
    }

@router.post("/solicitar")
async def solicitar_emprestimo(
    dados: SolicitacaoRequest, 
    request: Request,
    db: Session = Depends(get_db),
    usuario_logado: Usuario = Depends(obter_usuario_logado)
):
    """Solicita e aprova instantaneamente um empréstimo se houver limite."""
    # LOCK no usuário
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    
    if not usuario.is_verified:
        raise HTTPException(status_code=403, detail="Sua conta precisa estar VERIFICADA para solicitar crédito.")
    
    limite = calcular_limite_credito(usuario, db)
    if dados.valor > limite:
        raise HTTPException(status_code=400, detail=f"Valor solicitado (R$ {dados.valor}) excede seu limite disponível (R$ {limite}).")

    if not dados.aceite_termos:
        raise HTTPException(status_code=400, detail="Você deve aceitar os termos de uso.")

    # Verificação de Taxa (Regra: Score 500+ e Pool 100+ é ISENTO)
    isento = verificar_isencao_taxa(usuario)
    # Taxa reduzida para R$ 2,00 em microcréditos. Agora ela será SOMADA à dívida.
    taxa_solicitacao = Decimal("0.00") if isento else (Decimal("2.00") if dados.valor <= 50 else Decimal("4.00"))

    # Aprovação instantânea via Cooperativa (Sistema)
    # Taxa de juros padrão da plataforma (ex: 5%)
    taxa_juros_padrao = Decimal("5.0")
    
    try:
        nova_solicitacao = aprovar_emprestimo_instantaneo(
            usuario_id=usuario.id,
            valor=dados.valor,
            prazo=dados.parcelas,
            taxa=taxa_juros_padrao,
            db=db,
            taxa_adesao=taxa_solicitacao, # A taxa agora é financiada
            ip_cliente=request.client.host # CAPTURA DO IP PARA CLAUSULA 3.4
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)

    return {
        "message": "Empréstimo Aprovado e Creditado na sua conta!",
        "id": nova_solicitacao.id,
        "valor_liberado": float(dados.valor)
    }

@router.get("/meus")
async def listar_meus_emprestimos(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Lista o histórico de empréstimos do usuário."""
    solicitacoes = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).order_by(SolicitacaoEmprestimo.data_criacao.desc()).all()
    
    resultado = []
    for s in solicitacoes:
        # Cálculo total da dívida: (Principal + Juros Acumulados) + Taxas Financiadas
        taxa_mensal = s.taxa_juros / 100
        total_com_juros = s.valor * (Decimal("1") + (taxa_mensal * s.prazo_meses))
        total_final = total_com_juros + (s.taxas_adicionais or Decimal("0.00"))
        valor_parcela = total_final / s.prazo_meses
        
        resultado.append({
            "id": s.id,
            "valor_principal": float(s.valor),
            "taxa_juros": float(s.taxa_juros),
            "prazo": s.prazo_meses,
            "valor_parcela": round(float(valor_parcela), 2),
            "total_devedor": float(total_final),
            "status": s.status.value,
            "proximo_vencimento": s.proximo_vencimento.isoformat() if s.proximo_vencimento else None,
            "data_criacao": s.data_criacao.isoformat()
        })
    return resultado

class PagamentoRequest(BaseModel):
    valor_pagamento: Decimal = Field(gt=0)

@router.post("/pagar-parcela/{id}")
async def pagar_parcela(id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """Processa o pagamento de uma parcela com distribuição de lucro para o Pool."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id, 
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).with_for_update().first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo ativo não encontrado.")

    # Calcular valor da parcela (Principal + Juros + Taxa Financiada)
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (Decimal("1") + (taxa_mensal * solicitacao.prazo_meses))
    total_final = total_com_juros + (solicitacao.taxas_adicionais or Decimal("0.00"))
    valor_parcela = total_final / solicitacao.prazo_meses
    
    # Adicionar mora se estiver atrasado
    agora = datetime.datetime.utcnow()
    mora = Decimal("0.00")
    if solicitacao.proximo_vencimento and agora > solicitacao.proximo_vencimento:
        atraso = (agora - solicitacao.proximo_vencimento).days
        mora = valor_parcela * Decimal("0.02") + (valor_parcela * Decimal("0.001") * atraso)

    total_a_pagar = valor_parcela + mora

    if usuario.saldo < total_a_pagar:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente. Necessário: R$ {total_a_pagar:,.2f}")

    # 1. Deduzir saldo
    usuario.saldo -= total_a_pagar
    
    # 2. Distribuição Financeira (Cooperativa 2.0)
    # Regra: 100% do juro e taxas entram no cofre da plataforma (000PL).
    # O rateio para o Pool deixa de ser instantâneo e passa a ser periódico via Rota de Dividendos.
    
    juro_da_parcela = (solicitacao.valor * taxa_mensal)
    principal_da_parcela = solicitacao.valor / solicitacao.prazo_meses
    
    # Taxa diluída é o que foi financiado no início
    taxa_diluida = (solicitacao.taxas_adicionais or Decimal("0.00")) / solicitacao.prazo_meses
    receita_total_plataforma = juro_da_parcela + taxa_diluida + mora

    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if plataforma:
        # Retorno de Principal volta para o capital giro (saldo_caixa)
        plataforma.saldo_caixa += principal_da_parcela
        # Juros e Taxas entram no lucro bruto (saldo) para acumulo de dividendos
        plataforma.saldo += receita_total_plataforma
        
        # Auditoria da Receita
        db.add(Transacao(
            usuario_id="000PL",
            valor=receita_total_plataforma,
            tipo=TipoTransacao.TAXA_ADM_EMPRESTIMO,
            status="concluido",
            detalhes=f"Receita Bruta (Cooperativa 2.0) - Parc. Empréstimo #{solicitacao.id}"
        ))

    # 3. Atualizar Empréstimo
    solicitacao.parcelas_pagas += 1
    if solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
        solicitacao.status = StatusSolicitacao.CONCLUIDO
    else:
        # Pular para o próximo mês
        solicitacao.proximo_vencimento += datetime.timedelta(days=30)

    # 4. Aumentar Score do Bom Pagador
    if mora == 0:
        atualizar_score(db, usuario.id, Decimal("5.0"), "PAGAMENTO_EM_DIA")
    
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=total_a_pagar,
        tipo=TipoTransacao.PAGAMENTO_PARCELA,
        status="concluido",
        detalhes=f"Pagamento parcela #{solicitacao.parcelas_pagas} - Pedido #{id}"
    ))

    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": "Pagamento realizado com sucesso!", "novo_saldo": float(usuario.saldo)}

@router.post("/pagamento-avulso/{id}")
async def pagamento_avulso(id: int, dados: PagamentoRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """Realiza um pagamento parcial para amortizar a dívida."""
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).with_for_update().first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")

    valor_pagamento = dados.valor_pagamento
    if usuario.saldo < valor_pagamento:
        raise HTTPException(status_code=400, detail="Saldo insuficiente.")

    # Deduzir saldo
    usuario.saldo -= valor_pagamento
    
    # 2. Distribuição Financeira (Cooperativa 2.0)
    # 100% dos juros da amortização entram no cofre central.
    # Recalculamos as proporções baseado na parcela base
    taxa_mensal = solicitacao.taxa_juros / 100
    juro_mensal = solicitacao.valor * taxa_mensal
    principal_mensal = solicitacao.valor / solicitacao.prazo_meses
    total_base = juro_mensal + principal_mensal
    
    prop_juros = juro_mensal / total_base
    valor_juros = valor_pagamento * prop_juros
    valor_principal = valor_pagamento - valor_juros

    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if plataforma:
        # Principal volta para capital giro (saldo_caixa)
        plataforma.saldo_caixa += valor_principal
        # Juros da amortização entram no lucro bruto (saldo)
        plataforma.saldo += valor_juros
        
        db.add(Transacao(
            usuario_id="000PL",
            valor=valor_juros,
            tipo=TipoTransacao.TAXA_ADM_EMPRESTIMO,
            status="concluido",
            detalhes=f"Receita Bruta Amortização (Cooperativa 2.0) - Empréstimo #{solicitacao.id}"
        ))

    # Registrar amortização
    solicitacao.valor_amortizado += valor_pagamento
    
    from utils_emprestimo import calcular_divida_total
    divida_restante = calcular_divida_total(solicitacao)
    
    if divida_restante <= 0:
        solicitacao.status = StatusSolicitacao.CONCLUIDO
        solicitacao.parcelas_pagas = solicitacao.prazo_meses

    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor_pagamento,
        tipo=TipoTransacao.PAGAMENTO_PARCELA,
        status="concluido",
        detalhes=f"Pagamento Avulso - Pedido #{id}"
    ))

    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": "Pagamento avulso processado!", "novo_saldo": float(usuario.saldo)}

@router.post("/quitar-total/{id}")
async def quitar_total(id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    """Liquida o empréstimo integralmente."""
    from utils_emprestimo import calcular_divida_total
    
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).with_for_update().first()
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).with_for_update().first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")

    total_quitar = calcular_divida_total(solicitacao)
    
    if usuario.saldo < total_quitar:
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para quitação. Necessário R$ {total_quitar:,.2f}")

    # 1. Pagar
    usuario.saldo -= total_quitar
    
    # 2. Quitação e Distribuição (Cooperativa 2.0)
    # Todo o excedente de juros e taxas vai para o cofre central
    parcelas_restantes = solicitacao.prazo_meses - solicitacao.parcelas_pagas
    taxa_mensal = solicitacao.taxa_juros / 100
    
    # Lucro é o juro das parcelas restantes + taxas pendentes
    juros_restantes = (solicitacao.valor * taxa_mensal) * parcelas_restantes
    taxas_pendentes = solicitacao.taxas_adicionais or Decimal("0.00") 
    principal_restante = (solicitacao.valor / solicitacao.prazo_meses) * parcelas_restantes
    
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if plataforma:
        # Principal volta para capital giro
        plataforma.saldo_caixa += principal_restante
        # Juros restantes e taxas pendentes entram no lucro bruto
        plataforma.saldo += (juros_restantes + taxas_pendentes)
        
        db.add(Transacao(
            usuario_id="000PL",
            valor=(juros_restantes + taxas_pendentes),
            tipo=TipoTransacao.TAXA_ADM_EMPRESTIMO,
            status="concluido",
            detalhes=f"Receita Bruta Quitação (Cooperativa 2.0) - Empréstimo #{solicitacao.id}"
        ))

    # 3. Encerrar contrato
    solicitacao.status = StatusSolicitacao.CONCLUIDO
    solicitacao.parcelas_pagas = solicitacao.prazo_meses
    
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=total_quitar,
        tipo=TipoTransacao.PAGAMENTO_PARCELA,
        status="concluido",
        detalhes=f"Quitação Integral - Pedido #{id}"
    ))

    db.commit()
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop("000PL", None)
    return {"message": "Crédito liquidado integralmente!", "novo_saldo": float(usuario.saldo)}


class ContratoPDF(FPDF):
    def header(self):
        # Logo Oficial
        try:
            logo_path = "/home/josias/Área de trabalho/projetos/psy pay/frontend/public/logo.png"
            self.image(logo_path, x=85, y=10, w=40)
            self.ln(30)
        except:
            # Cabeçalho com branding Psy Pay (Fallback)
            self.set_font('Helvetica', 'B', 22)
            self.set_text_color(255, 204, 0)
            self.cell(0, 15, 'PSY PAY', 0, 1, 'C')
        
        self.set_font('Helvetica', 'I', 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, 'Fintech de Crédito Digital & Fomento', 0, 1, 'C')
        self.ln(5)
        # Linha decorativa
        self.set_draw_color(255, 204, 0)
        self.line(10, 35, 200, 35)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Página {self.page_no()} | Motor de Crédito Digital e Fomento (Fase Beta) | Autenticado Digitalmente', 0, 0, 'C')

@router.get("/contrato/pdf/{id}")
async def baixar_contrato_pdf(id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Gera um PDF profissional do contrato de empréstimo."""
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    # Cálculos para o PDF
    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (Decimal("1") + (taxa_mensal * solicitacao.prazo_meses))
    total_final = total_com_juros + (solicitacao.taxas_adicionais or Decimal("0.00"))
    valor_parcela = total_final / solicitacao.prazo_meses

    # Geração do PDF
    pdf = ContratoPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    # 1. Título do Documento
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, f'CÉDULA DE CRÉDITO BANCÁRIO (DIGITAL) - #{solicitacao.id}', 0, 1, 'L')
    pdf.ln(5)

    # 2. Dados das Partes
    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '1. IDENTIFICAÇÃO DAS PARTES', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 10)
    pdf.multi_cell(0, 6, f"CREDOR: PSY PAY PLATAFORMA DE CRÉDITO (Fundo de Liquidez Cooperativo)\n"
                         f"DEVEDOR(A): {usuario.nome}\n"
                         f"CPF: {usuario.cpf}\n"
                         f"CHAVE PIX REGISTRADA: {usuario.chave_pix}")
    pdf.ln(5)

    # 3. Dados do Empréstimo (Quadro Resumo)
    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '2. QUADRO RESUMO DO CRÉDITO', 0, 1, 'L')
    
    # Tabela Simples
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(95, 8, 'DESCRIÇÃO', 1, 0, 'L', True)
    pdf.cell(95, 8, 'VALOR / INFO', 1, 1, 'L', True)
    
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(95, 8, 'Valor Principal Liberado', 1, 0, 'L')
    pdf.cell(95, 8, f'R$ {solicitacao.valor:,.2f}', 1, 1, 'L')
    
    pdf.cell(95, 8, 'Taxa de Juros Mensal', 1, 0, 'L')
    pdf.cell(95, 8, f'{solicitacao.taxa_juros}% a.m.', 1, 1, 'L')
    
    pdf.cell(95, 8, 'Prazo de Pagamento', 1, 0, 'L')
    pdf.cell(95, 8, f'{solicitacao.prazo_meses} Parcelas', 1, 1, 'L')
    
    pdf.cell(95, 8, 'Valor da Parcela Mensal', 1, 0, 'L')
    pdf.cell(95, 8, f'R$ {valor_parcela:,.2f}', 1, 1, 'L')
    
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(95, 8, 'TOTAL DEVEDOR FINAL', 1, 0, 'L')
    pdf.cell(95, 8, f'R$ {total_final:,.2f}', 1, 1, 'L')
    pdf.ln(10)

    # 4. Cláusulas e Termos
    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '3. CLÁUSULAS CONTRATUAIS', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 9)
    termos = (
        "3.1. O devedor declara ter recebido o valor principal em sua conta digital Psy Pay no ato da aprovação deste contrato.\n\n"
        "3.2. O pagamento das parcelas será realizado via débito em conta ou boleto/pix conforme disponibilidade no sistema. "
        "Atrasos superiores a 24h acarretam em multa de 2% e juros de mora de 0.1% ao dia.\n\n"
        "3.3. O devedor autoriza a plataforma a utilizar o saldo de sua 'Carteira de Liquidez' (Pool) para quitação automática "
        "das parcelas em caso de inadimplência superior a 5 dias, conforme os Termos de Uso aceitos no cadastro.\n\n"
        "3.4. Este contrato possui validade digital mediante o aceite eletrônico realizado pelo usuário sob o IP registrado no sistema."
    )
    pdf.multi_cell(0, 5, termos)
    pdf.ln(10)

    # 5. Assinatura e Autenticação
    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '4. AUTENTICAÇÃO DO SISTEMA', 0, 1, 'L')
    pdf.set_font('Helvetica', 'I', 9)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 5, f"Documento gerado e autenticado eletronicamente em {datetime.datetime.now().strftime('%d/%m/%Y %H:%M:%S')}.\n"
                         f"O devedor concordou com estes termos via aplicativo móvel/web.\n"
                         f"Hash de Identificação: {abs(hash(str(solicitacao.id) + usuario.cpf))}")

    # Retornar o PDF como stream
    output = io.BytesIO()
    pdf_out = pdf.output(dest='S')
    output.write(pdf_out)
    output.seek(0)

    return StreamingResponse(
        output, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=Contrato_PsyPay_{solicitacao.id}.pdf"}
    )
