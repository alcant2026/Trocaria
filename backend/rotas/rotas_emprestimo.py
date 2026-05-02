from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import Optional, List
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
import hashlib
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao
from database import get_db
from rotas.rotas_auth import obter_usuario_logado
from utils_fintech import calcular_limite_credito, verificar_isencao_taxa, criar_solicitacao_p2p, aceitar_oferta, saldo_disponivel_pool, adicionar_credito_virtual, resgatar_credito_virtual
from utils_score import atualizar_score
from utils_emprestimo import calcular_divida_total, confirmar_pagamento_externo, confirmar_recebimento_externo, creditar_plataforma, aplicar_calote
from fastapi.responses import StreamingResponse
import io
from fpdf import FPDF
from rotas.rotas_snapshot import cache_snapshot_data
from limitador import limiter

router = APIRouter(prefix="/emprestimos", tags=["Pedidos de Apoio"])

class SolicitacaoRequest(BaseModel):
    valor: Decimal = Field(gt=0, le=10000)
    parcelas: int = Field(ge=1, le=12)
    aceite_termos: bool

class PagamentoRequest(BaseModel):
    valor_pagamento: Decimal = Field(gt=0)

@router.get("/oportunidades")
async def listar_oportunidades(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacoes = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).order_by(SolicitacaoEmprestimo.data_criacao.desc()).all()

    pool_total = saldo_disponivel_pool(db)
    resultado = []
    for s in solicitacoes:
        resultado.append({
            "id": s.id,
            "tomador_nome": s.usuario.nome,
            "chave_pix_tomador": s.usuario.chave_pix_publica or s.usuario.chave_pix,
            "valor": float(s.valor),
            "parcelas": s.prazo_meses,
            "taxa_juros": float(s.taxa_juros),
            "score_tomador": float(s.usuario.score),
            "inadimplente": s.usuario.inadimplente,
            "data_criacao": s.data_criacao.isoformat()
        })
    return {"oportunidades": resultado, "pool_disponivel": float(pool_total)}

@router.post("/calote/{id}")
@limiter.limit("5/minute")
async def registrar_calote(request: Request, id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.usuario_id == usuario_logado.id
    ).first()

    if not solicitacao:
        solicitacao = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.id == id,
            SolicitacaoEmprestimo.credor_id == usuario_logado.id
        ).first()

    if not solicitacao or solicitacao.status != StatusSolicitacao.APROVADO:
        raise HTTPException(status_code=404, detail="Empréstimo não encontrado.")

    try:
        result = aplicar_calote(id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result

@router.get("/limite")
async def consultar_limite(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    limite = calcular_limite_credito(usuario, db)
    isento = verificar_isencao_taxa(usuario)
    return {
        "limite_disponivel": float(limite),
        "score_atual": float(usuario.score),
        "emprestimos_ativos": usuario.emprestimos_ativos or 0,
        "isento_taxa": isento,
        "mensagem": "Crédito disponível!" if limite > 0 else "Complete seu cadastro e aumente seu score para liberar crédito."
    }

@router.post("/solicitar")
@limiter.limit("3/minute")
async def solicitar_emprestimo(
    request: Request,
    dados: SolicitacaoRequest, 
    db: Session = Depends(get_db),
    usuario_logado: Usuario = Depends(obter_usuario_logado)
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_logado.id).first()
    
    if not usuario.is_verified:
        raise HTTPException(status_code=403, detail="Sua conta precisa estar VERIFICADA.")

    if not dados.aceite_termos:
        raise HTTPException(status_code=400, detail="Aceite os termos.")

    if dados.valor > Decimal("10000"):
        raise HTTPException(status_code=400, detail="Valor máximo: R$ 10.000")

    taxa_juros_padrao = Decimal("5.0")
    
    try:
        nova_solicitacao = criar_solicitacao_p2p(
            usuario_id=usuario.id,
            valor=dados.valor,
            prazo=dados.parcelas,
            taxa=taxa_juros_padrao,
            db=db,
            ip_cliente=request.client.host
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    cache_snapshot_data.pop(usuario.id, None)

    return {
        "message": "Solicitação criada! Aguardando um investidor aceitar.",
        "id": nova_solicitacao.id,
        "valor": float(dados.valor),
        "status": "pendente"
    }

@router.post("/aceitar-oferta/{id}")
@limiter.limit("5/minute")
async def aceitar_oferta_endpoint(request: Request, id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = aceitar_oferta(id, usuario_logado.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result

@router.get("/meus")
async def listar_meus_emprestimos(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    como_tomador = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).order_by(SolicitacaoEmprestimo.data_criacao.desc()).all()

    como_credor = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.credor_id == usuario.id
    ).order_by(SolicitacaoEmprestimo.data_criacao.desc()).all()

    resultado = []
    for s in como_tomador + como_credor:
        taxa_mensal = s.taxa_juros / 100
        total_com_juros = s.valor * (Decimal("1") + (taxa_mensal * s.prazo_meses))
        valor_parcela = total_com_juros / s.prazo_meses
        
        credor_nome = s.credor.nome if s.credor else "Aguardando investidor"
        chave_pix_pagamento = s.chave_pix_credor if s.usuario_id == usuario.id else (s.usuario.chave_pix_publica or s.usuario.chave_pix)
        resultado.append({
            "id": s.id,
            "tipo": "tomador" if s.usuario_id == usuario.id else "credor",
            "contraparte": credor_nome if s.usuario_id == usuario.id else s.usuario.nome,
            "chave_pix_pagamento": chave_pix_pagamento,
            "score_contraparte": float(s.credor.score if s.credor else 0) if s.usuario_id == usuario.id else float(s.usuario.score or 0),
            "valor_principal": float(s.valor),
            "taxa_juros": float(s.taxa_juros),
            "prazo": s.prazo_meses,
            "valor_parcela": round(float(valor_parcela), 2),
            "total_devedor": float(total_com_juros),
            "status": s.status.value,
            "parcelas_pagas": s.parcelas_pagas,
            "parcelas_totais": s.prazo_meses,
            "proximo_vencimento": s.proximo_vencimento.isoformat() if s.proximo_vencimento else None,
            "data_criacao": s.data_criacao.isoformat()
        })
    return resultado

@router.post("/confirmar-pagamento/{id}")
async def confirmar_pagamento(id: int, dados: PagamentoRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = confirmar_pagamento_externo(db, id, usuario_logado.id, dados.valor_pagamento)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result

@router.post("/confirmar-recebimento/{id}")
async def confirmar_recebimento(id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = confirmar_recebimento_externo(db, id, usuario_logado.id)
        if result.get("quitado"):
            atualizar_score(db, usuario_logado.id, Decimal("5.0"), "PAGAMENTO_EM_DIA")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result

@router.post("/gerar-taxa/{id}")
async def gerar_taxa_origem(id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.usuario_id == usuario_logado.id,
        SolicitacaoEmprestimo.status.in_([StatusSolicitacao.APROVADO, StatusSolicitacao.PENDENTE])
    ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada.")

    isento = verificar_isencao_taxa(usuario_logado)
    valor_taxa = Decimal("0.00") if isento else (Decimal("2.00") if solicitacao.valor <= 50 else Decimal("4.00"))

    if valor_taxa == 0:
        return {"message": "Isento de taxa.", "valor": 0}

    from rotas.rotas_financeiro import sdk
    if not sdk:
        raise HTTPException(status_code=500, detail="Pagamento não configurado.")

    payment_data = {
        "transaction_amount": float(valor_taxa),
        "description": f"Taxa Psy Pay - Pedido #{solicitacao.id}",
        "payment_method_id": "pix",
        "payer": {"email": usuario_logado.email}
    }

    result = sdk.payment().create(payment_data)
    payment = result.get("response", {})
    
    if result.get("status") not in [200, 201]:
        raise HTTPException(status_code=400, detail="Erro ao gerar PIX da taxa.")

    qr_code = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code")
    qr_code_base64 = payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64")
    payment_id = payment.get("id")

    db.add(Transacao(
        usuario_id=usuario_logado.id,
        valor=valor_taxa,
        tipo=TipoTransacao.TAXA_ORIGEM,
        status="pendente",
        payment_id=str(payment_id),
        detalhes=f"Taxa de origem - Pedido #{solicitacao.id}"
    ))
    db.commit()

    return {
        "message": "QR Code gerado! Pague a taxa para concluir.",
        "valor": float(valor_taxa),
        "qr_code": qr_code,
        "qr_code_base64": qr_code_base64,
        "payment_id": payment_id
    }

@router.post("/gerar-taxa-solicitacao")
@limiter.limit("3/minute")
async def gerar_taxa_solicitacao(dados: SolicitacaoRequest, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    valor_taxa = Decimal("2.00")

    from rotas.rotas_financeiro import sdk
    if not sdk:
        return {"message": "Ambiente sem PIX configurado.", "valor": float(valor_taxa), "simulacao": True}

    payment_data = {
        "transaction_amount": float(valor_taxa),
        "description": f"Taxa de solicitação - R$ {dados.valor}",
        "payment_method_id": "pix",
        "payer": {"email": usuario_logado.email}
    }
    result = sdk.payment().create(payment_data)
    payment = result.get("response", {})
    if result.get("status") not in [200, 201]:
        raise HTTPException(status_code=400, detail="Erro ao gerar PIX.")

    db.add(Transacao(
        usuario_id=usuario_logado.id,
        valor=valor_taxa,
        tipo=TipoTransacao.TAXA_SOLICITACAO,
        status="pendente",
        payment_id=str(payment.get("id")),
        detalhes=f"Taxa de 3% sobre solicitação de R$ {dados.valor}"
    ))
    db.commit()

    return {
        "message": "Pague a taxa de 3% para solicitar o empréstimo.",
        "valor": float(valor_taxa),
        "qr_code": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code"),
        "qr_code_base64": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64"),
        "payment_id": payment.get("id")
    }

@router.post("/depositar-virtual")
@limiter.limit("3/minute")
async def depositar_virtual(dados: PagamentoRequest, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    if dados.valor_pagamento < Decimal("10.00"):
        raise HTTPException(status_code=400, detail="Valor mínimo: R$ 10,00")

    # Impedir múltiplos depósitos pendentes
    dep_pendente = db.query(Transacao).filter(
        Transacao.usuario_id == usuario_logado.id,
        Transacao.tipo == TipoTransacao.TAXA_DEPOSITO_VIRTUAL,
        Transacao.status == "pendente"
    ).first()
    if dep_pendente:
        raise HTTPException(status_code=400, detail="Você já tem um depósito virtual pendente. Aguarde ou cancele antes de criar outro.")

    taxa = dados.valor_pagamento * Decimal("0.02")

    from rotas.rotas_financeiro import sdk
    if sdk:
        payment_data = {
            "transaction_amount": float(taxa),
            "description": f"Taxa de 2% sobre depósito virtual de R$ {dados.valor_pagamento}",
            "payment_method_id": "pix",
            "payer": {"email": usuario_logado.email}
        }
        result = sdk.payment().create(payment_data)
        payment = result.get("response", {})
        if result.get("status") not in [200, 201]:
            raise HTTPException(status_code=400, detail="Erro ao gerar PIX da taxa.")
    else:
        payment = {"id": "simulado"}

    # Cria transação pendente - o crédito só é liberado quando o webhook confirmar o pagamento
    transacao = Transacao(
        usuario_id=usuario_logado.id,
        valor=dados.valor_pagamento,
        tipo=TipoTransacao.TAXA_DEPOSITO_VIRTUAL,
        status="pendente",
        payment_id=str(payment.get("id")),
        metodo="pix",
        detalhes=f"Depósito virtual de R$ {dados.valor_pagamento} (taxa de R$ {taxa}) - aguardando pagamento"
    )
    db.add(transacao)
    db.commit()

    return {
        "message": "Pague a taxa via PIX para liberar o crédito virtual.",
        "valor_credito": float(dados.valor_pagamento),
        "taxa": float(taxa),
        "qr_code": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code") if sdk else None,
        "qr_code_base64": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64") if sdk else None,
        "payment_id": payment.get("id")
    }

@router.post("/cancelar-pendente")
@limiter.limit("3/minute")
async def cancelar_pendente(request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    transacao = db.query(Transacao).filter(
        Transacao.usuario_id == usuario_logado.id,
        Transacao.tipo.in_([TipoTransacao.TAXA_DEPOSITO_VIRTUAL, TipoTransacao.TAXA_SOLICITACAO]),
        Transacao.status == "pendente"
    ).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Nenhuma transação pendente encontrada.")
    transacao.status = "cancelado"
    transacao.detalhes += " | Cancelado pelo usuário"
    db.commit()
    return {"message": "Transação pendente cancelada."}

@router.post("/resgatar-virtual")
@limiter.limit("3/minute")
async def resgatar_virtual(dados: PagamentoRequest, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = resgatar_credito_virtual(usuario_logado.id, dados.valor_pagamento, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result

@router.get("/pool-saldo")
async def pool_saldo(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    total = saldo_disponivel_pool(db)
    return {
        "pool_disponivel": float(total),
        "meu_credito_virtual": float(usuario.credito_virtual or 0),
        "meu_valor_emprestado": float(usuario.valor_emprestado or 0),
        "meus_emprestimos_ativos": usuario.emprestimos_ativos or 0
    }

class ContratoPDF(FPDF):
    def header(self):
        try:
            logo_path = "/home/josias/Área de trabalho/projetos/psy pay/frontend/public/logo.png"
            self.image(logo_path, x=85, y=10, w=40)
            self.ln(30)
        except:
            self.set_font('Helvetica', 'B', 22)
            self.set_text_color(255, 204, 0)
            self.cell(0, 15, 'PSY PAY', 0, 1, 'C')
        
        self.set_font('Helvetica', 'I', 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, 'Rede de Apoio entre Pares', 0, 1, 'C')
        self.ln(5)
        self.set_draw_color(255, 204, 0)
        self.line(10, 35, 200, 35)

    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Página {self.page_no()} | Psy Pay | Documento entre Particulares', 0, 0, 'C')

@router.get("/contrato/pdf/{id}")
async def baixar_contrato_pdf(id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).first()

    if not solicitacao:
        solicitacao = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.id == id,
            SolicitacaoEmprestimo.credor_id == usuario.id
        ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")

    taxa_mensal = solicitacao.taxa_juros / 100
    total_com_juros = solicitacao.valor * (Decimal("1") + (taxa_mensal * solicitacao.prazo_meses))
    total_final = total_com_juros + (solicitacao.taxas_adicionais or Decimal("0.00"))
    valor_parcela = total_final / solicitacao.prazo_meses

    credor = solicitacao.credor
    tomador = solicitacao.usuario

    pdf = ContratoPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    
    pdf.set_font('Helvetica', 'B', 16)
    pdf.set_text_color(0, 0, 0)
    pdf.cell(0, 10, f'TERMO DE APOIO ENTRE PARTICULARES - #{solicitacao.id}', 0, 1, 'L')
    pdf.ln(5)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '1. IDENTIFICAÇÃO DAS PARTES', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 10)
    cpf_tomador = f"***.{tomador.cpf[-4:]}" if len(tomador.cpf) >= 4 else "***"
    cpf_credor = f"***.{credor.cpf[-4:]}" if credor and len(credor.cpf) >= 4 else "***"
    pdf.multi_cell(0, 6, f"APOIADOR: {credor.nome if credor else 'A definir'} (CPF: {cpf_credor})\n"
                         f"RECEBEDOR: {tomador.nome} (CPF: {cpf_tomador})")
    pdf.ln(5)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '2. VALORES COMBINADOS', 0, 1, 'L')
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(95, 8, 'DESCRIÇÃO', 1, 0, 'L', True)
    pdf.cell(95, 8, 'VALOR', 1, 1, 'L', True)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(95, 8, 'Valor do Apoio', 1, 0, 'L')
    pdf.cell(95, 8, f'R$ {solicitacao.valor:,.2f}', 1, 1, 'L')
    pdf.cell(95, 8, 'Taxa de Compensação Mensal', 1, 0, 'L')
    pdf.cell(95, 8, f'{solicitacao.taxa_juros}%', 1, 1, 'L')
    pdf.cell(95, 8, 'Prazo', 1, 0, 'L')
    pdf.cell(95, 8, f'{solicitacao.prazo_meses} Retribuições', 1, 1, 'L')
    pdf.cell(95, 8, 'Valor de Cada Retribuição', 1, 0, 'L')
    pdf.cell(95, 8, f'R$ {valor_parcela:,.2f}', 1, 1, 'L')
    pdf.cell(95, 8, 'TOTAL A RETRIBUIR', 1, 0, 'L')
    pdf.cell(95, 8, f'R$ {total_final:,.2f}', 1, 1, 'L')
    pdf.ln(10)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '3. CONDIÇÕES', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 9)
    termos = (
        "3.1. O valor do apoio é transferido diretamente entre as partes via PIX, sem intermediação da plataforma.\n\n"
        "3.2. A retribuição das parcelas é realizada via PIX diretamente ao apoiador. A plataforma apenas registra as confirmações.\n\n"
        "3.3. O atraso na retribuição acarreta multa de 2% e compensação de 0.1% ao dia.\n\n"
        "3.4. Este termo possui validade digital mediante o aceite eletrônico das partes no sistema."
    )
    pdf.multi_cell(0, 5, termos)
    pdf.ln(10)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '4. AUTENTICAÇÃO', 0, 1, 'L')
    pdf.set_font('Helvetica', 'I', 9)
    pdf.set_text_color(50, 50, 50)
    hash_id = hashlib.sha256(f"{solicitacao.id}{tomador.cpf}{solicitacao.data_criacao.isoformat()}".encode()).hexdigest()[:16]
    pdf.multi_cell(0, 5, f"Documento gerado em {datetime.datetime.now(datetime.timezone.utc).strftime('%d/%m/%Y %H:%M:%S')}.\n"
                         f"Hash: {hash_id}")

    output = io.BytesIO()
    pdf_out = pdf.output(dest='S')
    output.write(pdf_out)
    output.seek(0)

    return StreamingResponse(
        output, 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=Contrato_PsyPay_{solicitacao.id}.pdf"}
    )
