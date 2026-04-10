from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from decimal import Decimal
from pydantic import BaseModel, Field
import datetime
from rotas.rotas_snapshot import cache_snapshot_data

router = APIRouter(prefix="/dividendos", tags=["Dividendos & Cooperativa"])

class ProcessarDividendosRequest(BaseModel):
    valor_distribuir: Decimal = Field(gt=0, description="Valor líquido a ser rateado entre os cooperados")
    descricao: str = Field(default="Distribuição de Lucros Periódica", description="Motivo da distribuição")

@router.get("/status")
async def obter_status_dividendos(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """Retorna o saldo acumulado na plataforma disponível para distribuição."""
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    
    # Busca total de taxas/juros acumulados (Saldo do 000PL)
    saldo_bruto = plataforma.saldo if plataforma else Decimal("0.00")
    
    # Estatísticas do Pool
    total_participantes = db.query(Usuario).filter(Usuario.saldo_caixa > 0).count()
    total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")
    
    return {
        "saldo_bruto_plataforma": float(saldo_bruto),
        "total_participantes_pool": total_participantes,
        "capital_total_pool": float(total_pool),
        "mensagem": "Este saldo reflete juros e taxas acumulados que ainda não foram distribuídos."
    }

@router.post("/processar")
async def processar_dividendos(
    dados: ProcessarDividendosRequest, 
    db: Session = Depends(get_db), 
    admin: Usuario = Depends(exigir_admin)
):
    """
    Algoritmo Cooperativo 2.0: Distribui lucro excedente baseado em Saldo + Score + Engajamento.
    """
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    
    if plataforma.saldo < dados.valor_distribuir:
        raise HTTPException(
            status_code=400, 
            detail=f"Saldo insuficiente na plataforma. Disponível: R$ {plataforma.saldo}"
        )

    # 1. Identificar Participantes do Pool
    participantes = db.query(Usuario).filter(Usuario.saldo_caixa > 0, Usuario.id != "000PL").all()
    if not participantes:
        raise HTTPException(status_code=400, detail="Não há participantes no Pool para receber dividendos.")

    # 2. Calcular Pesos Ponderados
    # Pesos Sugeridos: 60% Saldo Pool | 30% Psy Score | 10% Gasto em Taxas (Engajamento)
    dados_rateio = []
    soma_pesos_total = Decimal("0.00")

    from sqlalchemy import func
    
    for p in participantes:
        # Calcular quanto esse usuário já pagou em taxas (Engajamento)
        total_taxas_pagas = db.query(func.sum(Transacao.valor)).filter(
            Transacao.usuario_id == p.id,
            Transacao.tipo.in_([TipoTransacao.TAXA_ADM_EMPRESTIMO, TipoTransacao.TAXA_ESPECIE]),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        # Fórmulas de Peso
        peso_saldo = p.saldo_caixa * Decimal("0.60")
        peso_score = (p.score * Decimal("10")) * Decimal("0.30") # Multiplica score por 10 para escala 1000
        peso_taxas = total_taxas_pagas * Decimal("0.10")
        
        peso_final = peso_saldo + peso_score + peso_taxas
        soma_pesos_total += peso_final
        dados_rateio.append({
            "usuario": p,
            "peso": peso_final
        })

    if soma_pesos_total <= 0:
         raise HTTPException(status_code=400, detail="Peso total calculado é zero. Verifique os saldos do Pool.")

    # 3. Executar o Rateio
    for item in dados_rateio:
        user = item["usuario"]
        fatia = (item["peso"] / soma_pesos_total) * dados.valor_distribuir
        
        # Credita no saldo do Pool (Reinvestimento automático ou saldo disponível?)
        # A regra cooperativa do Psy Pay reinveste no saldo_caixa para aumentar o limite.
        user.saldo_caixa += fatia
        user.total_dividendos_ganhos = (user.total_dividendos_ganhos or Decimal("0.00")) + fatia
        
        # Registrar Transação para o Usuário
        db.add(Transacao(
            usuario_id=user.id,
            valor=fatia,
            tipo=TipoTransacao.DIVIDENDOS,
            status="concluido",
            detalhes=f"Recebimento de Dividendos Coletivos - {dados.descricao}"
        ))
        
        # Invalida cache do snapshot do usuário
        cache_snapshot_data.pop(user.id, None)

    # 4. Debitar da Plataforma
    plataforma.saldo -= dados.valor_distribuir
    
    # Registrar Saída da Plataforma
    db.add(Transacao(
        usuario_id="000PL",
        valor=dados.valor_distribuir,
        tipo=TipoTransacao.RESGATE_POOL,
        status="concluido",
        detalhes=f"Distribuição de Dividendos: {dados.descricao} (Total: R$ {dados.valor_distribuir})"
    ) )

    db.commit()
    cache_snapshot_data.pop("000PL", None)

    return {
        "status": "success",
        "mensagem": f"R$ {dados.valor_distribuir} distribuídos com sucesso entre {len(participantes)} sócios.",
        "media_por_socio": float(dados.valor_distribuir / len(participantes))
    }

from sqlalchemy import func
