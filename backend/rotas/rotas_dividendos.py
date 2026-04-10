from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from decimal import Decimal
import datetime
from database import get_db
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, RegistroAuditoria
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from pydantic import BaseModel, Field

router = APIRouter(prefix="/dividendos", tags=["Financeiro - Dividendos"])

class ProcessarDividendosRequest(BaseModel):
    custos_administrativos: Decimal = Field(gt=0, description="Soma de Impostos + Infra + Retirada Admin")
    confirmar: bool = False

@router.post("/processar")
async def processar_dividendos_comunitarios(
    dados: ProcessarDividendosRequest, 
    db: Session = Depends(get_db), 
    admin: Usuario = Depends(exigir_admin)
):
    """
    Motor de Distribuição Proporcional (Regra de Negócio Cooperativa).
    Transforma o lucro da plataforma em dividendos para os usuários engajados.
    """
    
    # 1. Identificar o Usuário de Sistema (000PL) onde está o Lucro Bruto
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if not plataforma:
        raise HTTPException(status_code=500, detail="Erro interno: Conta de sistema 000PL não encontrada.")
    
    lucro_bruto = plataforma.saldo
    if lucro_bruto < dados.custos_administrativos:
        raise HTTPException(
            status_code=400, 
            detail=f"Saldo de lucro insuficiente (R$ {lucro_bruto}) para cobrir os custos informados (R$ {dados.custos_administrativos})."
        )
    
    pote_dividendos = lucro_bruto - dados.custos_administrativos
    if pote_dividendos <= 0:
        return {"message": "Sem lucro líquido para distribuição após dedução de custos.", "pote": 0}

    # 2. Buscar usuários elegíveis (ativos e com algum engajamento)
    usuarios = db.query(Usuario).filter(
        Usuario.is_active == True,
        Usuario.id != "000PL" # O sistema não ganha dividendo dele mesmo
    ).all()

    # 3. Calcular Índices de Participação (IP) individuais e totais
    ips = []
    ip_total = Decimal("0.00")

    for u in usuarios:
        saldo_pool = u.saldo_caixa or Decimal("0.00")
        score = u.score or Decimal("0.00")
        gastos = u.gasto_total_taxas or Decimal("0.00")
        
        # Fórmula de Peso: 50% Pool, 30% Score, 20% Gastos
        ip_u = (saldo_pool * Decimal("0.5")) + (score * Decimal("0.3")) + (gastos * Decimal("0.2"))
        
        if ip_u > 0:
            ips.append({"usuario": u, "ip": ip_u})
            ip_total += ip_u

    if ip_total <= 0:
        raise HTTPException(status_code=400, detail="Nenhum usuário elegível encontrado para distribuição.")

    if not dados.confirmar:
        return {
            "simulacao": True,
            "lucro_bruto": float(lucro_bruto),
            "custos": float(dados.custos_administrativos),
            "pote_liquido": float(pote_dividendos),
            "total_participantes": len(ips),
            "ip_global": float(ip_total)
        }

    # 4. Executar Distribuição Real
    distribuido_real = Decimal("0.00")
    for item in ips:
        u = item["usuario"]
        ip_u = item["ip"]
        
        fatia = (ip_u / ip_total) * pote_dividendos
        fatia = fatia.quantize(Decimal("0.01")) 
        
        if fatia > 0:
            u.saldo += fatia
            if u.total_dividendos_ganhos is None: u.total_dividendos_ganhos = Decimal("0.00")
            u.total_dividendos_ganhos += fatia
            
            db.add(Transacao(
                usuario_id=u.id,
                valor=fatia,
                tipo=TipoTransacao.RETORNO_POOL,
                status="concluido",
                detalhes=f"Recebimento de Dividendos Participativos (Ciclo: {datetime.datetime.now().strftime('%m/%Y')})"
            ))
            distribuido_real += fatia

    # 5. Debitar do caixa da plataforma
    plataforma.saldo -= (dados.custos_administrativos + distribuido_real)
    
    db.add(Transacao(
        usuario_id=plataforma.id,
        valor=dados.custos_administrativos,
        tipo=TipoTransacao.SAQUE,
        status="concluido",
        detalhes=f"Dedução de Custos Operacionais (Admin: {admin.id})"
    ))

    db.commit()

    return {
        "status": "sucesso",
        "pote_distribuido": float(distribuido_real),
        "participantes": len(ips),
        "custos_liquidados": float(dados.custos_administrativos)
    }
