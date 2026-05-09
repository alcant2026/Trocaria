from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
import hashlib
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao
from database import get_db
from rotas.rotas_auth import obter_usuario_logado
from utils_fintech import criar_solicitacao_p2p, aceitar_oferta
from utils_emprestimo import confirmar_pagamento_externo, confirmar_recebimento_externo, aplicar_calote
from fastapi.responses import StreamingResponse
import io
from fpdf import FPDF
from rotas.rotas_snapshot import cache_snapshot_data
from limitador import limiter

router = APIRouter(prefix="/emprestimos", tags=["Pedidos de Apoio"])

class SolicitacaoRequest(BaseModel):
    valor: Decimal = Field(gt=0, le=10000)
    parcelas: int = Field(ge=1, le=12)
    taxa_compensacao: Decimal = Field(ge=0, le=100)
    aceite_termos: bool
    aceite_termos_plataforma: bool = False

class PagamentoRequest(BaseModel):
    valor_pagamento: Decimal = Field(gt=0)

class AceiteRequest(BaseModel):
    aceite_termos_plataforma: bool = False

class ConfirmacaoRequest(BaseModel):
    tipo: str = "parcela"  # parcela, avulso, quitacao

@router.get("/oportunidades")
async def listar_oportunidades(page: int = 1, limit: int = 10, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    offset = (page - 1) * limit
    query = db.query(SolicitacaoEmprestimo).options(
        joinedload(SolicitacaoEmprestimo.usuario)
    ).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    )
    total = query.count()
    solicitacoes = query.order_by(SolicitacaoEmprestimo.data_criacao.desc()).offset(offset).limit(limit).all()
    resultado = []
    for s in solicitacoes:
        valor_emprestimo = float(s.valor or 0)
        taxa_juros = float(s.taxa_juros or 0)
        juros = valor_emprestimo * (taxa_juros / 100)
        valor_total = valor_emprestimo + juros
        valor_parcela = valor_total / s.prazo_meses if s.prazo_meses > 0 else valor_total
        
        resultado.append({
            "id": s.id,
            "tomador_nome": s.usuario.nome,
            "chave_pix_tomador": s.usuario.chave_pix,
            "valor": valor_emprestimo,
            "taxa_juros": taxa_juros,
            "juros": round(juros, 2),
            "valor_total": round(valor_total, 2),
            "valor_parcela": round(valor_parcela, 2),
            "parcelas": s.prazo_meses,
            "taxa_match_estimada": round(float(max(Decimal("2.00"), min(Decimal("20.00"), s.valor * Decimal("0.02")))), 2),
            "taxa_compensacao": taxa_juros,
            "score_tomador": float(s.usuario.score or 0),
            "verificado": s.usuario.is_verified,
            "inadimplente": s.usuario.inadimplente,
            "data_criacao": s.data_criacao.isoformat()
        })
    return {"oportunidades": resultado, "total": total, "page": page, "has_more": (offset + len(solicitacoes)) < total}

@router.post("/gerar-taxa-solicitacao")
@limiter.limit("3/minute")
async def gerar_taxa_solicitacao(dados: SolicitacaoRequest, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    pendente = db.query(Transacao).filter(Transacao.usuario_id == usuario_logado.id, Transacao.tipo == TipoTransacao.TAXA_SOLICITACAO, Transacao.status == "pendente").first()
    if pendente:
        raise HTTPException(status_code=400, detail="Voce ja tem um pagamento pendente. Aguarde ou cancele antes de gerar outro.")
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    valor_taxa = Decimal("2.00")

    if sdk:
        payment_data = {
            "transaction_amount": float(valor_taxa or 0),
            "description": f"Taxa de publicacao - {usuario_logado.nome}",
            "payment_method_id": "pix",
            "payer": {"email": usuario_logado.email}
        }
        result = sdk.payment().create(payment_data)
        payment = result.get("response", {})
        if result.get("status") not in [200, 201]:
            raise HTTPException(status_code=400, detail="Erro ao gerar PIX.")
    else:
        payment = {"id": "simulado"}

    import json as _json
    dados_solicitacao = _json.dumps({
        "valor": float(dados.valor or 0),
        "parcelas": dados.parcelas,
        "taxa": float(dados.taxa_compensacao or 0)
    })

    transacao = Transacao(
        usuario_id=usuario_logado.id,
        valor=valor_taxa,
        tipo=TipoTransacao.TAXA_SOLICITACAO,
        status="pendente",
        payment_id=str(payment.get("id")),
        metodo="pix",
        detalhes=f"PENDENTE_SOLICITACAO:{dados_solicitacao}"
    )
    db.add(transacao)
    db.commit()

    return {
        "message": "Pague R$ 2,00 via PIX para publicar seu pedido.",
        "valor": float(valor_taxa or 0),
        "qr_code": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code") if sdk else None,
        "qr_code_base64": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64") if sdk else None,
        "payment_id": payment.get("id"),
        "transacao_id": transacao.id
    }

@router.get("/verificar-transacao/{transacao_id}")
async def verificar_transacao(transacao_id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    transacao = db.query(Transacao).filter(
        Transacao.id == transacao_id,
        Transacao.usuario_id == usuario_logado.id
    ).first()
    if not transacao:
        raise HTTPException(status_code=404, detail="Transacao nao encontrada.")
    return {"status": transacao.status, "tipo": transacao.tipo.value}

@router.post("/aceitar-oferta/{id}")
@limiter.limit("5/minute")
async def aceitar_oferta_endpoint(request: Request, id: int, dados: AceiteRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = aceitar_oferta(id, usuario_logado.id, db, ip_cliente=request.client.host, aceite_plataforma=dados.aceite_termos_plataforma)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result

@router.post("/confirmar-pagamento/{id}")
async def confirmar_pagamento(id: int, dados: PagamentoRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        return confirmar_pagamento_externo(db, id, usuario_logado.id, dados.valor_pagamento)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/confirmar-recebimento/{id}")
async def confirmar_recebimento(id: int, dados: ConfirmacaoRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = confirmar_recebimento_externo(db, id, usuario_logado.id, tipo_pagamento=dados.tipo)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/calote/{id}")
@limiter.limit("5/minute")
async def registrar_calote(request: Request, id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.credor_id == usuario_logado.id
    ).first()
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Emprestimo nao encontrado.")
    try:
        return aplicar_calote(id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

TAXA_COBRANCA = Decimal("2.00")

@router.post("/cobrar/{id}")
@limiter.limit("2/minute")
async def cobrar_devedor(request: Request, id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        SolicitacaoEmprestimo.credor_id == usuario.id,
        SolicitacaoEmprestimo.status.in_([StatusSolicitacao.APROVADO, StatusSolicitacao.CANCELADO])
    ).first()
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado ou voce nao e o credor.")
    tomador = db.query(Usuario).filter(Usuario.id == solicitacao.usuario_id).first()
    if not tomador:
        raise HTTPException(status_code=404, detail="Tomador nao encontrado.")
    tem_calote = tomador.score == 0 or solicitacao.status == StatusSolicitacao.CANCELADO
    if not tem_calote:
        raise HTTPException(status_code=400, detail="Este contrato nao esta em situacao de cobranca.")
    debito_total = calcular_divida_total(solicitacao)
    pendente = db.query(Transacao).filter(Transacao.detalhes == f"COBRANCA:{solicitacao.id}", Transacao.status == "pendente").first()
    if pendente:
        raise HTTPException(status_code=400, detail="Voce ja tem uma cobranca pendente para este contrato. Aguarde o pagamento.")
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    if not sdk:
        raise HTTPException(status_code=503, detail="Gateway de pagamento indisponivel.")
    result = sdk.payment().create({"transaction_amount": float(TAXA_COBRANCA or 0), "description": f"Cobranca Contrato #{solicitacao.id}", "payment_method_id": "pix", "payer": {"email": usuario.email}})
    if result.get("status") not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Erro MP: {result.get('response', {}).get('message', 'erro')}")
    payment = result["response"]
    t = Transacao(usuario_id=usuario.id, valor=TAXA_COBRANCA, tipo=TipoTransacao.TAXA_SOLICITACAO, status="pendente", payment_id=str(payment["id"]), metodo="pix", detalhes=f"COBRANCA:{solicitacao.id}")
    db.add(t)
    db.commit()
    qr = payment.get("point_of_interaction", {}).get("transaction_data", {})
    return {
        "payment_id": payment["id"], "transacao_id": t.id,
        "qr_code": qr.get("qr_code"), "qr_code_base64": qr.get("qr_code_base64"),
        "valor": float(TAXA_COBRANCA or 0),
        "tomador_nome": tomador.nome, "tomador_email": tomador.email, "tomador_telefone": tomador.telefone,
        "debito": float(debito_total or 0)
    }


class ContratoPDF(FPDF):
    def header(self):
        try:
            self.image("/home/josias/Área de trabalho/projetos/psy pay/frontend/public/logo.png", x=85, y=10, w=40)
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
        self.cell(0, 10, 'Pagina {} | Psy Pay | Documento entre Particulares'.format(self.page_no()), 0, 0, 'C')

@router.get("/contrato/pdf/{id}")
async def baixar_contrato_pdf(id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == id,
        (SolicitacaoEmprestimo.usuario_id == usuario.id) | (SolicitacaoEmprestimo.credor_id == usuario.id)
    ).first()
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Contrato nao encontrado.")
    credor = solicitacao.credor or solicitacao.usuario
    tomador = solicitacao.usuario
    taxa = solicitacao.taxa_juros
    total = solicitacao.valor * (1 + (taxa / 100) * solicitacao.prazo_meses)
    vp = total / solicitacao.prazo_meses

    pdf = ContratoPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font('Helvetica', 'B', 16)
    pdf.cell(0, 10, 'TERMO DE APOIO ENTRE PARTICULARES - #{}'.format(solicitacao.id), 0, 1, 'L')
    pdf.ln(5)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '1. PARTES', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 10)
    cpf_t = '***.{}'.format(tomador.cpf[-4:]) if tomador.cpf else '***'
    cpf_c = '***.{}'.format(credor.cpf[-4:]) if credor and credor.cpf else '***'
    pdf.multi_cell(0, 6, 'APOIADOR: {} (CPF: {})\nRECEBEDOR: {} (CPF: {})'.format(
        credor.nome or 'A definir', cpf_c, tomador.nome, cpf_t))
    pdf.ln(5)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '2. VALORES', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 6, 'Valor do Apoio: R$ {:.2f}'.format(solicitacao.valor), 0, 1)
    pdf.cell(0, 6, 'Taxa de Compensacao: {}% ao mes'.format(taxa), 0, 1)
    pdf.cell(0, 6, 'Prazo: {} retribuicoes'.format(solicitacao.prazo_meses), 0, 1)
    pdf.cell(0, 6, 'Valor de Cada Retribuicao: R$ {:.2f}'.format(vp), 0, 1)
    pdf.cell(0, 6, 'Total a Retribuir: R$ {:.2f}'.format(total), 0, 1)
    pdf.ln(10)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '3. CONDICOES', 0, 1, 'L')
    pdf.set_font('Helvetica', '', 9)
    pdf.multi_cell(0, 5, (
        "3.1. O valor do apoio e transferido diretamente entre as partes via PIX.\n\n"
        "3.2. A retribuicao e realizada via PIX diretamente ao apoiador.\n\n"
        "3.3. A plataforma apenas registra as confirmacoes. O nao pagamento acarreta multa de 2% e 0.1% ao dia.\n\n"
        "3.4. Este termo possui validade digital pelo aceite eletronico das partes."
    ))
    pdf.ln(10)

    pdf.set_font('Helvetica', 'B', 12)
    pdf.cell(0, 10, '4. AUTENTICACAO', 0, 1, 'L')
    pdf.set_font('Helvetica', 'I', 9)
    hash_id = hashlib.sha256('{}{}{}'.format(solicitacao.id, tomador.cpf, solicitacao.data_criacao.isoformat()).encode()).hexdigest()[:16]
    pdf.cell(0, 6, 'Documento gerado em {}'.format(datetime.datetime.now(datetime.timezone.utc).strftime('%d/%m/%Y %H:%M:%S')), 0, 1)
    pdf.cell(0, 6, 'Hash: {}'.format(hash_id), 0, 1)

    buf = io.BytesIO()
    pdf.output(dest='S', name=buf)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=Termo_PsyPay_{}.pdf".format(solicitacao.id)})

@router.post("/cancelar-pendente/{transacao_id}")
async def cancelar_transacao_pendente(transacao_id: int, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    t = db.query(Transacao).filter(Transacao.id == transacao_id, Transacao.usuario_id == usuario.id, Transacao.status == "pendente").first()
    if not t:
        raise HTTPException(status_code=404, detail="Transacao pendente nao encontrada.")
    t.status = "cancelado"
    db.commit()
    return {"message": "Transacao cancelada."}
