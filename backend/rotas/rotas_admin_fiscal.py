from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
import datetime
import io
from fpdf import FPDF
from database import get_db
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from decimal import Decimal

router = APIRouter(prefix="/admin/fiscal", tags=["Admin - Fiscal"])

class FiscalPDF(FPDF):
    def header(self):
        # Logo Oficial
        try:
            logo_path = "frontend/public/logo.png"
            self.image(logo_path, x=85, y=10, w=40)
            self.ln(35)
        except:
            self.set_font('Arial', 'B', 22)
            self.set_text_color(41, 121, 255)
            self.cell(0, 15, 'PSY PAY', 0, 1, 'C')
            self.ln(5)
        
        self.set_font('Arial', 'B', 14)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, 'DEMONSTRATIVO DE INTERMEDIAÇÃO FINANCEIRA (CPF)', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Gerado em {datetime.datetime.now().strftime("%d/%m/%Y %H:%M")} | Página {self.page_no()}', 0, 0, 'C')

@router.get("/pdf")
async def gerar_relatorio_fiscal_admin(
    inicio: str = Query(..., description="Data de início (YYYY-MM-DD)"),
    fim: str = Query(..., description="Data de fim (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    try:
        data_ini = datetime.datetime.strptime(inicio, "%Y-%m-%d")
        data_fim = datetime.datetime.strptime(fim, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        
        # 1. CUSTÓDIA TOTAL - DEPRECATED: A Psy Pay nao segura dinheiro de usuarios.
        # Sistema de saldo/saldo_caixa descontinuado.
        custodia_total = Decimal("0.00")
        
        # 2. FATURAMENTO REAL (Taxas e Comissões - Sujeito a Carnê-Leão)
        tipos_faturamento = [
            TipoTransacao.COMPRA_SCORE, 
            TipoTransacao.DESBLOQUEIO_DADOS, 
            TipoTransacao.TAXA_SAQUE, 
            TipoTransacao.TAXA_INTERMEDIACAO,
            TipoTransacao.TAXA_ADM_EMPRESTIMO,
            TipoTransacao.ASSINATURA
        ]
        
        faturamento_bruto = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_faturamento),
            Transacao.status == "concluido",
            Transacao.data_criacao >= data_ini,
            Transacao.data_criacao <= data_fim
        ).scalar() or Decimal("0.00")
        
        # 3. DEDUÇÕES OPERACIONAIS (Taxas Gateway Estimadas 1% ou fixa)
        # Buscamos depósitos confirmados no período para calcular o custo do Mercado Pago
        total_entradas_pix = db.query(func.sum(Transacao.valor)).filter(
            Transacao.metodo == "pix",
            Transacao.status == "concluido",
            Transacao.data_criacao >= data_ini,
            Transacao.data_criacao <= data_fim
        ).scalar() or Decimal("0.00")
        
        custo_gateway = total_entradas_pix * Decimal("0.01") # Taxa média 1.0% do Pix Checkout
        
        # 4. LUCRO LÍQUIDO TRIBUTÁVEL
        faturamento_liquido = max(Decimal("0.00"), faturamento_bruto - custo_gateway)
        
        # --- GERAÇÃO DO PDF ---
        pdf = FiscalPDF()
        pdf.add_page()
        
        # Info Admin (Pessoa Física)
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 10, f'ADMINISTRADOR: {admin.nome.upper()}', 0, 1)
        pdf.set_font('Arial', '', 10)
        pdf.cell(0, 8, f'CPF RESPONSÁVEL: {admin.cpf}', 0, 1)
        pdf.cell(0, 8, f'PERÍODO DE APURAÇÃO: {inicio} a {fim}', 0, 1)
        pdf.ln(10)
        
        # SEÇÃO A: PATRIMÔNIO DE TERCEIROS (NÃO TRIBUTÁVEL)
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(0, 10, ' A. RECURSOS CONSIGNADOS EM CUSTÓDIA (POOL)', 0, 1, 'L', True)
        pdf.ln(2)
        pdf.set_font('Arial', '', 10)
        pdf.multi_cell(0, 5, 'Dinheiro de investidores e tomadores mantido em custódia na plataforma. Estes valores não compõem a receita bruta da pessoa física intermediadora.')
        pdf.ln(2)
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(100, 10, 'TOTAL EM CUSTÓDIA ATUAL:', 0, 0)
        pdf.cell(0, 10, f'R$ {custodia_total:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), 0, 1, 'R')
        pdf.ln(10)
        
        # SEÇÃO B: RECEITA DE INTERMEDIAÇÃO (TRIBUTÁVEL)
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(0, 10, ' B. FATURAMENTO POR PRESTAÇÃO DE SERVIÇOS', 0, 1, 'L', True)
        pdf.ln(2)
        pdf.set_font('Arial', '', 10)
        pdf.cell(100, 8, 'Faturamento Bruto de Taxas (Score, KYC, Limites):', 0, 0)
        pdf.cell(0, 8, f'R$ {faturamento_bruto:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), 0, 1, 'R')
        
        pdf.set_text_color(200, 0, 0)
        pdf.cell(100, 8, '(-) Deduções Operacionais (Taxas Gateway):', 0, 0)
        pdf.cell(0, 8, f'- R$ {custo_gateway:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), 0, 1, 'R')
        
        pdf.ln(4)
        pdf.set_text_color(0, 0, 0)
        pdf.set_font('Arial', 'B', 12)
        pdf.set_fill_color(220, 255, 220)
        pdf.cell(100, 12, 'LUCRO LÍQUIDO TRIBUTÁVEL:', 1, 0, 'L', True)
        pdf.cell(0, 12, f'R$ {faturamento_liquido:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), 1, 1, 'R', True)
        
        pdf.ln(20)
        pdf.set_font('Arial', 'I', 8)
        pdf.multi_cell(0, 5, 'Nota Legal: Documento gerado para fins de preenchimento de Carnê-Leão e declaração de IRPF. Recomenda-se a conferência com um contador especializado em Fintechs conforme a regulação do Banco Central do Brasil.', 0, 'C')

        pdf_output = pdf.output(dest='S')
        return StreamingResponse(
            io.BytesIO(pdf_output),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=relatorio_fiscal_{inicio}.pdf"}
        )

    except Exception as e:
        print(f"Erro Fiscal: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/executar-cobranca")
async def executar_cobranca_automatica(
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Gatilho manual para processar a Cláusula 3.3 (Liquidação via Pool após 5 dias).
    """
    from utils_emprestimo import processar_inadimplencia_coletiva_automatica
    
    try:
        logs = processar_inadimplencia_coletiva_automatica(db)
        db.commit()
        return {
            "status": "sucesso",
            "mensagem": f"Processamento concluído. {len(logs)} ações detectadas.",
            "detalhes": logs
        }
    except Exception as e:
        db.rollback()
        print(f"Erro ao processar cobrança: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno no motor de cobrança: {str(e)}")
