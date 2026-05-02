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
from utils_score import atualizar_score
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

class PagamentoRequest(BaseModel):
    valor_pagamento: Decimal = Field(gt=0)

@router.get("/oportunidades")
async def listar_oportunidades(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    solicitacoes = db.query(SolicitacaoEmprestimo).options(
        joinedload(SolicitacaoEmprestimo.usuario)
    ).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).order_by(SolicitacaoEmprestimo.data_criacao.desc()).limit(50).all()
    resultado = []
    for s in solicitacoes:
        resultado.append({
            "id": s.id,
            "tomador_nome": s.usuario.nome,
            "chave_pix_tomador": s.usuario.chave_pix_publica or s.usuario.chave_pix,
            "valor": float(s.valor),
            "taxa_match_estimada": round(float(max(Decimal("2.00"), min(Decimal("20.00"), s.valor * Decimal("0.02")))), 2),
            "parcelas": s.prazo_meses,
            "taxa_compensacao": float(s.taxa_juros),
            "score_tomador": float(s.usuario.score),
            "verificado": s.usuario.is_verified,
            "inadimplente": s.usuario.inadimplente,
            "data_criacao": s.data_criacao.isoformat()
        })
    return {"oportunidades": resultado}

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
        raise HTTPException(status_code=403, detail="Conta precisa estar verificada.")
    if not dados.aceite_termos:
        raise HTTPException(status_code=400, detail="Aceite os termos.")

    try:
        nova = criar_solicitacao_p2p(
            usuario_id=usuario.id, valor=dados.valor,
            prazo=dados.parcelas, taxa=dados.taxa_compensacao,
            db=db, ip_cliente=request.client.host
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": "Pedido de apoio criado!", "id": nova.id, "valor": float(dados.valor), "status": "pendente"}

@router.post("/gerar-taxa-solicitacao")
@limiter.limit("3/minute")
async def gerar_taxa_solicitacao(dados: SolicitacaoRequest, request: Request, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    from rotas.rotas_financeiro import get_sdk
    sdk = get_sdk()
    valor_taxa = Decimal("2.00")

    if sdk:
        payment_data = {
            "transaction_amount": float(valor_taxa),
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
        "valor": float(dados.valor),
        "parcelas": dados.parcelas,
        "taxa": float(dados.taxa_compensacao)
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
        "valor": float(valor_taxa),
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
async def aceitar_oferta_endpoint(request: Request, id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = aceitar_oferta(id, usuario_logado.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result

@router.get("/meus")
async def listar_meus(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    como_tomador = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id
    ).order_by(SolicitacaoEmprestimo.data_criacao.desc()).all()
    como_credor = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.credor_id == usuario.id,
        SolicitacaoEmprestimo.usuario_id != usuario.id
    ).order_by(SolicitacaoEmprestimo.data_criacao.desc()).all()
    resultado = []
    for s in como_tomador + como_credor:
        taxas_extra = s.taxas_adicionais or Decimal("0.00")
        total = s.valor * (1 + (s.taxa_juros / 100) * s.prazo_meses) + taxas_extra
        vp = total / s.prazo_meses
        resultado.append({
            "id": s.id, "tipo": "tomador" if s.usuario_id == usuario.id else "credor",
            "contraparte": s.credor.nome if s.credor else "Aguardando",
            "chave_pix_pagamento": s.chave_pix_credor if s.usuario_id == usuario.id else (s.usuario.chave_pix_publica or s.usuario.chave_pix),
            "valor": float(s.valor), "taxa": float(s.taxa_juros),
            "taxa_match": float(taxas_extra),
            "parcelas": s.prazo_meses, "pagas": s.parcelas_pagas,
            "valor_parcela": round(float(vp), 2),
            "total": round(float(total), 2),
            "status": s.status.value,
            "pagamento_pendente": bool(s.confirmacao_pagamento_data) and not s.confirmacao_recebimento_data,
            "vencimento": s.proximo_vencimento.isoformat() if s.proximo_vencimento else None
        })
    return resultado

@router.post("/confirmar-pagamento/{id}")
async def confirmar_pagamento(id: int, dados: PagamentoRequest, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        return confirmar_pagamento_externo(db, id, usuario_logado.id, dados.valor_pagamento)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/confirmar-recebimento/{id}")
async def confirmar_recebimento(id: int, db: Session = Depends(get_db), usuario_logado: Usuario = Depends(obter_usuario_logado)):
    try:
        result = confirmar_recebimento_externo(db, id, usuario_logado.id)
        if result.get("quitado"):
            atualizar_score(db, usuario_logado.id, Decimal("5.0"), "PAGAMENTO_EM_DIA")
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
