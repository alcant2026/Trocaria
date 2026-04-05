from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import datetime
import io
from fpdf import FPDF
from database import get_db
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from rotas.rotas_auth import obter_usuario_logado
from decimal import Decimal

router = APIRouter(prefix="/financeiro/relatorio", tags=["Relatórios"])

class InformePDF(FPDF):
    def header(self):
        # Logo Oficial
        try:
            logo_path = "/home/josias/Área de trabalho/projetos/psy pay/frontend/public/logo.png"
            self.image(logo_path, x=85, y=10, w=40)
            self.ln(35) # Aumentado para não sobrepor o título
        except:
            # Fallback se a imagem falhar
            self.set_font('Arial', 'B', 22)
            self.set_text_color(41, 121, 255)
            self.cell(0, 15, 'PSY PAY', 0, 1, 'C')
            self.ln(5)
        
        self.set_font('Arial', 'B', 14)
        self.set_text_color(80, 80, 80)
        self.cell(0, 10, 'INFORME DE RENDIMENTOS FINANCEIROS', 0, 1, 'C')
        self.ln(10)

    def footer(self):
        self.set_y(-25)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, 'Este documento é um extrato auxiliar para auxílio na declaração do IRPF.', 0, 1, 'C')
        self.cell(0, 10, f'Página {self.page_no()}', 0, 0, 'C')

@router.get("/pdf")
async def gerar_relatorio_pdf(
    ano: int = Query(2026, ge=2022),
    db: Session = Depends(get_db),
    user: Usuario = Depends(obter_usuario_logado)
):
    try:
        # 1. Definir Período
        data_ini = datetime.datetime(ano, 1, 1, 0, 0, 0)
        data_fim = datetime.datetime(ano, 12, 31, 23, 59, 59)
        
        # 2. Buscar Dados do Usuário
        res_saldo_ini = db.query(func.sum(Transacao.valor)).filter(
            Transacao.usuario_id == user.id,
            Transacao.status == "concluido",
            Transacao.data_criacao < data_ini
        ).scalar() or 0
        
        # 3. Rendimentos do Pool (Lógica de Ciclo Atual para consistência)
        transacoes_pool = db.query(Transacao).filter(
            Transacao.usuario_id == user.id,
            Transacao.tipo.in_([TipoTransacao.APORTE_CAIXA, TipoTransacao.RESGATE_CAIXA]),
            Transacao.status == "concluido",
            Transacao.data_criacao <= data_fim
        ).order_by(Transacao.data_criacao.asc()).all()
        
        capital_no_ciclo = Decimal("0.00")
        for t in transacoes_pool:
            if t.tipo == TipoTransacao.APORTE_CAIXA:
                capital_no_ciclo += t.valor
            else:
                capital_no_ciclo = max(Decimal("0.00"), capital_no_ciclo - t.valor)

        # O lucro real acumulado no ciclo atual
        rendimento_pool = max(Decimal("0.00"), user.saldo_caixa - capital_no_ciclo)
        
        # 4. Transações Relevantes (Depósitos e Saques)
        transacoes = db.query(Transacao).filter(
            Transacao.usuario_id == user.id,
            Transacao.status == "concluido",
            Transacao.data_criacao >= data_ini,
            Transacao.data_criacao <= data_fim
        ).order_by(Transacao.data_criacao.asc()).all()
        
        # 5. Calcular Saldo Final do Ano
        movimentacao_ano = sum([t.valor if t.tipo in [TipoTransacao.DEPOSITO, TipoTransacao.RETORNO_POOL, TipoTransacao.RECEBIMENTO] else -t.valor for t in transacoes])
        saldo_fim = Decimal(str(res_saldo_ini)) + Decimal(str(movimentacao_ano))
        # 4. Construção do PDF (Simplificado: Foco em Saldo e Lucro)
        pdf = InformePDF()
        pdf.add_page()
        
        # Identificação
        pdf.set_font('Arial', 'B', 12)
        pdf.cell(0, 10, f'Contribuinte: {user.nome.upper()}', 0, 1)
        pdf.set_font('Arial', '', 10)
        pdf.cell(0, 8, f'CPF: {user.cpf}', 0, 1)
        pdf.cell(0, 8, f'Ano-Calendário de Referência: {ano}', 0, 1)
        pdf.ln(10)
        
        # Seção 1: Saldo em CC (Conta Digital)
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(0, 10, ' 1. SALDO EM CONTA DIGITAL (CONTA CORRENTE)', 0, 1, 'L', True)
        pdf.ln(2)
        pdf.set_font('Arial', '', 10)
        pdf.cell(100, 8, f'Saldo em 31/12/{ano}:', 0, 0)
        pdf.set_font('Arial', 'B', 10)
        pdf.cell(0, 8, f'R$ {user.saldo:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), 0, 1, 'R')
        pdf.ln(10)

        # Seção 2: Saldo e Rendimentos do Pool (LIQUIDEZ)
        pdf.set_fill_color(240, 240, 240)
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(0, 10, ' 2. INVESTIMENTOS EM POOL DE LIQUIDEZ (POUPANÇA/POOL)', 0, 1, 'L', True)
        pdf.ln(4)
        
        # O que tem no Pool
        pdf.set_font('Arial', '', 10)
        pdf.cell(100, 10, f'Valor Total em Custódia no Pool (31/12/{ano}):', 0, 0)
        pdf.set_font('Arial', 'B', 12)
        pdf.set_text_color(41, 121, 255) # Azul destaque
        pdf.cell(0, 10, f'R$ {user.saldo_caixa:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), 0, 1, 'R')
        
        # Quanto Ganhou (Lucro Real)
        pdf.set_text_color(0, 0, 0) # Volta ao preto
        pdf.set_font('Arial', '', 10)
        pdf.cell(100, 10, f'Rendimento Líquido Acumulado no Ano ({ano}):', 0, 0)
        pdf.set_font('Arial', 'B', 12)
        pdf.set_text_color(0, 150, 0) # Verde lucro
        pdf.cell(0, 10, f'R$ {rendimento_pool:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.'), 0, 1, 'R')
        
        pdf.set_text_color(0, 0, 0)
        pdf.ln(20)
        
        # Mensagem Final
        pdf.set_font('Arial', 'I', 9)
        pdf.multi_cell(0, 5, 'Nota: Os valores acima refletem a posição consolidada do investidor na plataforma PSY PAY para fins de ajuste anual perante a Receita Federal ou controle financeiro pessoal.', 0, 'C')

        # Stream the PDF response
        pdf_output = pdf.output(dest='S')
        return StreamingResponse(
            io.BytesIO(pdf_output),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=INFORME_PSY_PAY_{user.nome.replace(' ', '_')}_{ano}.pdf"
            }
        )
    except Exception as e:
        print(f"Erro ao gerar PDF: {e}")
        raise HTTPException(status_code=500, detail=str(e))
