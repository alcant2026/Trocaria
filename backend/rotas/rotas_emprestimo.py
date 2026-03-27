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
            taxa_adesao=taxa_solicitacao # A taxa agora é financiada
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    db.commit()
    cache_snapshot_data.clear()

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
    valor: Decimal = Field(gt=0)

@router.post("/pagar/{id}")
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
    
    # 2. Distribuir Lucro para o Pool (Cooperativa)
    # Regra: 100% do juro vai para o Pool. A plataforma fica com a Taxa de Operação.
    juro_da_parcela = (solicitacao.valor * taxa_mensal)
    lucro_pool = juro_da_parcela
    
    # A plataforma fica com a parte da Taxa Financiada e a Mora
    taxa_diluida = (solicitacao.taxas_adicionais or Decimal("0.00")) / solicitacao.prazo_meses
    taxa_plataforma = taxa_diluida + mora

    # Rateio para todos no Pool
    total_pool_global = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("1.00")
    # Apenas quem tem dinheiro no pool recebe
    participantes = db.query(Usuario).filter(Usuario.saldo_caixa > 0).all()
    for p in participantes:
        fatia = (p.saldo_caixa / total_pool_global) * lucro_pool
        p.saldo_caixa += fatia

    # Receita da plataforma
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    if plataforma:
        plataforma.saldo += taxa_plataforma

    # 3. Atualizar Empréstimo
    solicitacao.parcelas_pagas += 1
    if solicitacao.parcelas_pagas >= solicitacao.prazo_meses:
        solicitacao.status = StatusSolicitacao.CONCLUIDO
    else:
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
    cache_snapshot_data.clear()
    
    return {"message": "Pagamento realizado com sucesso!", "novo_saldo": float(usuario.saldo)}
