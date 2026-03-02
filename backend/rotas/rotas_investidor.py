from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal
import datetime
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, AcessoInvestidor, Investimento, Transacao, TipoTransacao, StatusSolicitacao
from database import get_db
from rotas.rotas_auth import obter_usuario_logado

router = APIRouter(prefix="/investidor", tags=["Investidor"])

class InvestimentoRequest(BaseModel):
    valor: Decimal
    aceite_risco: bool # Novo campo obrigatório para blindagem jurídica

@router.post("/desbloquear/{solicitacao_id}")
async def desbloquear_solicitacao(solicitacao_id: int, db: Session = Depends(get_db), investidor: Usuario = Depends(obter_usuario_logado)):
    if not investidor:
        raise HTTPException(status_code=404, detail="Investidor não encontrado")
    
    if not investidor:
        raise HTTPException(status_code=404, detail="Investidor não encontrado")

    custo = Decimal("15.00")
    if investidor.saldo < custo:
        raise HTTPException(status_code=400, detail="Saldo insuficiente. Custo: R$ 15,00")

    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id
    ).first()
    
    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")

    # Verificar se já desbloqueou anteriormente
    acesso_existente = db.query(AcessoInvestidor).filter(
        AcessoInvestidor.investidor_id == investidor.id,
        AcessoInvestidor.solicitacao_id == solicitacao.id
    ).first()

    if acesso_existente:
        tomador = solicitacao.usuario
        return {
            "message": "Informações já foram desbloqueadas para este item.",
            "dados_desbloqueados": {
                "nome": tomador.nome,
                "score": float(tomador.score),
                "taxa": float(solicitacao.taxa_juros),
                "chave_pix": tomador.chave_pix
            },
            "novo_saldo": float(investidor.saldo)
        }

    # Deduzir saldo
    investidor.saldo -= custo
    
    # Registrar transferência para plataforma (no caso, apenas subtrai)
    nova_transacao = Transacao(
        usuario_id=investidor.id,
        valor=custo,
        tipo=TipoTransacao.DESBLOQUEIO_DADOS,
        status="concluido",
        detalhes=f"Desbloqueio de dados para solicitação ID {solicitacao_id}"
    )

    # Conceder acesso
    novo_acesso = AcessoInvestidor(
        investidor_id=investidor.id,
        solicitacao_id=solicitacao.id
    )

    db.add(nova_transacao)
    db.add(novo_acesso)
    db.commit()

    # Retornar dados completos agora que foi pago
    tomador = solicitacao.usuario
    return {
        "message": "Acesso concedido",
        "dados_desbloqueados": {
            "nome": tomador.nome,
            "score": float(tomador.score),
            "taxa": float(solicitacao.taxa_juros),
            "chave_pix": tomador.chave_pix
        },
        "novo_saldo": float(investidor.saldo)
    }

@router.get("/meus-investimentos")
async def listar_investimentos_desbloqueados(db: Session = Depends(get_db), investidor: Usuario = Depends(obter_usuario_logado)):
    acessos = db.query(AcessoInvestidor).filter(
        AcessoInvestidor.investidor_id == investidor.id
    ).all()
    
    resultado = []
    for a in acessos:
        s = a.solicitacao
        u = s.usuario
        resultado.append({
            "solicitacao_id": s.id,
            "valor": float(s.valor),
            "taxa": float(s.taxa_juros),
            "nome": u.nome,
            "score": float(u.score),
            "data_acesso": a.data_acesso
        })
    
    return resultado

@router.get("/carteira")
async def ver_carteira(db: Session = Depends(get_db), investidor: Usuario = Depends(obter_usuario_logado)):
    investimentos = db.query(Investimento).filter(
        Investimento.investidor_id == investidor.id
    ).all()
    
    ipca_mensal = Decimal("0.45") # Benchmark de inflação estimado
    
    resultado = []
    for inv in investimentos:
        s = inv.solicitacao
        
        # Cálculo de retorno total esperado (Juros Simples Mensais)
        taxa_mensal = s.taxa_juros / 100
        valor_bruto_esperado = inv.valor_investido * (1 + (taxa_mensal * s.prazo_meses))
        lucro_esperado = valor_bruto_esperado - inv.valor_investido
        
        resultado.append({
            "id": inv.id,
            "solicitacao_id": s.id,
            "tomador_nome": s.usuario.nome,
            "tomador_score": float(s.usuario.score),
            "tomador_is_verified": s.usuario.is_verified,
            "valor_investido": float(inv.valor_investido),
            "valor_esperado": float(valor_bruto_esperado),
            "lucro_esperado": float(lucro_esperado),
            "valor_recebido": float(inv.pago_para_investidor),
            "taxa_mensal": float(s.taxa_juros),
            "parcelas_pagas": s.parcelas_pagas,
            "total_parcelas": s.prazo_meses,
            "status_emprestimo": s.status.value,
            "ipca_benchmark": float(ipca_mensal),
            "acima_inflacao": s.taxa_juros > ipca_mensal
        })
        
    return resultado

@router.post("/investir/{solicitacao_id}")
async def investir_em_solicitacao(solicitacao_id: int, dados: InvestimentoRequest, db: Session = Depends(get_db), investidor: Usuario = Depends(obter_usuario_logado)):
    valor = dados.valor
    if not dados.aceite_risco:
        raise HTTPException(status_code=400, detail="Você deve aceitar os riscos do investimento para prosseguir.")
        
    if not investidor or investidor.saldo < valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente ou investidor não encontrado.")

    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada ou não está mais pendente.")

    # Validar se o valor investido não ultrapassa a meta
    restante = solicitacao.valor - solicitacao.valor_arrecadado
    if valor > restante:
         raise HTTPException(status_code=400, detail=f"Valor excede o necessário. Faltam apenas R$ {restante}")

    # Processar investimento
    investidor.saldo -= valor
    solicitacao.valor_arrecadado += valor
    
    novo_investimento = Investimento(
        investidor_id=investidor.id,
        solicitacao_id=solicitacao.id,
        valor_investido=valor,
        ciencia_risco=dados.aceite_risco
    )

    # Registrar transação
    transacao = Transacao(
        usuario_id=investidor.id,
        valor=valor,
        tipo=TipoTransacao.INVESTIMENTO,
        status="concluido",
        detalhes=f"Investimento no pedido ID {solicitacao_id}"
    )

    # Se atingiu a meta, muda status (Simplificado: assumimos que o tomador recebe o valor agora ou após aprovação)
    if solicitacao.valor_arrecadado == solicitacao.valor:
        solicitacao.status = StatusSolicitacao.APROVADO
        tomador = solicitacao.usuario
        tomador.saldo += solicitacao.valor # Tomador recebe o valor total

    db.add(novo_investimento)
    db.add(transacao)
    db.commit()

    return {"message": "Investimento realizado com sucesso!", "valor_pago": valor}

@router.post("/processar-expiracoes")
async def processar_expiracoes_job(db: Session = Depends(get_db)):
    agora = datetime.datetime.utcnow()
    
    # 1. Regra das 4h: Ninguém investiu nada
    expirados_4h = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.valor_arrecadado == 0,
        SolicitacaoEmprestimo.data_expiracao_4h <= agora
    ).all()

    for s in expirados_4h:
        s.status = StatusSolicitacao.CANCELADO

    # 2. Regra dos 5d: Tem investimentos mas não atingiu meta
    expirados_5d = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.valor_arrecadado > 0,
        SolicitacaoEmprestimo.data_expiracao_5d <= agora
    ).all()

    for s in expirados_5d:
        # Estornar investidores
        for inv in s.investimentos:
            investidor = inv.investidor
            investidor.saldo += inv.valor_investido
            
            # Registrar estorno
            estorno = Transacao(
                usuario_id=investidor.id,
                valor=inv.valor_investido,
                tipo=TipoTransacao.RECEBIMENTO,
                status="concluido",
                detalhes=f"Estorno por expiração do pedido ID {s.id}"
            )
            db.add(estorno)
        
        # Tomador perde score
        tomador = s.usuario
        tomador.score = max(Decimal("0"), tomador.score - Decimal("10")) # Exemplo de penalidade
        
        s.status = StatusSolicitacao.CANCELADO

    db.commit()
    return {"message": "Expirações processadas.", "cancelados_4h": len(expirados_4h), "estornados_5d": len(expirados_5d)}
