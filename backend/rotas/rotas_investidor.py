from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, AcessoInvestidor, Investimento, Transacao, TipoTransacao, StatusSolicitacao, RegistroAuditoria
from database import get_db
from rotas.rotas_auth import obter_usuario_logado, exigir_admin
from utils_data import adicionar_mes
from utils_emprestimo import tentar_liberar_emprestimo, estornar_e_limpar_solicitacao
from utils_seguranca import registrar_acao_admin

router = APIRouter(prefix="/investidor", tags=["Investidor"])

class InvestimentoRequest(BaseModel):
    valor: Decimal = Field(gt=0)
    aceite_risco: bool # Novo campo obrigatório para blindagem jurídica

@router.post("/desbloquear/{solicitacao_id}")
async def desbloquear_solicitacao(solicitacao_id: int, db: Session = Depends(get_db), investidor: Usuario = Depends(obter_usuario_logado)):
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
        
        # Cálculo de retorno total esperado (Líquido: Juros Brutos - 10% Performance + Principal)
        taxa_mensal = s.taxa_juros / 100
        lucro_bruto_total = inv.valor_investido * (taxa_mensal * s.prazo_meses)
        lucro_liquido_total = lucro_bruto_total * Decimal("0.90")
        valor_liquido_total_esperado = inv.valor_investido + lucro_liquido_total
        
        valor_mensal_liquido = valor_liquido_total_esperado / s.prazo_meses
        valor_restante_liquido = max(0, valor_liquido_total_esperado - inv.pago_para_investidor)
        
        resultado.append({
            "id": inv.id,
            "solicitacao_id": s.id,
            "tomador_nome": s.usuario.nome,
            "tomador_score": float(s.usuario.score),
            "tomador_is_verified": s.usuario.is_verified,
            "valor_investido": float(inv.valor_investido),
            "valor_esperado": float(valor_liquido_total_esperado),
            "valor_mensal": round(float(valor_mensal_liquido), 2),
            "valor_restante": round(float(valor_restante_liquido), 2),
            "lucro_esperado": float(lucro_liquido_total),
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
async def investir_em_solicitacao(solicitacao_id: int, dados: InvestimentoRequest, request: Request, db: Session = Depends(get_db), investidor: Usuario = Depends(obter_usuario_logado)):
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
    
    # Criar registro de auditoria
    agora_reg = datetime.datetime.utcnow()
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        municipio=f"{investidor.cidade}/{investidor.estado}" if investidor.cidade else "Localização não informada",
        user_agent=request.headers.get("user-agent"),
        data_registro=agora_reg
    )
    db.add(auditoria)
    db.flush()

    novo_investimento = Investimento(
        investidor_id=investidor.id,
        solicitacao_id=solicitacao.id,
        valor_investido=valor,
        pago_para_investidor=Decimal("0.00"),
        data_investimento=agora_reg,
        ciencia_risco=dados.aceite_risco,
        # Blindagem Jurídica
        auditoria_id=auditoria.id,
        cpf_aceite=investidor.cpf
    )

    # Registrar transação
    transacao = Transacao(
        usuario_id=investidor.id,
        valor=valor,
        tipo=TipoTransacao.INVESTIMENTO,
        status="concluido",
        detalhes=f"Investimento no pedido ID {solicitacao_id}"
    )

    # Se atingiu a meta, tenta liberar (verifica garantias também)
    print(f"DEBUG: Solicitacao {solicitacao.id} - Arrecadado: {solicitacao.valor_arrecadado} / Meta: {solicitacao.valor}")
    if solicitacao.valor_arrecadado == solicitacao.valor:
        print(f"DEBUG: Meta atingida! Chamando tentar_liberar_emprestimo...")
        liberou = tentar_liberar_emprestimo(solicitacao.id, db)
        print(f"DEBUG: Resultado da tentativa de liberação: {liberou}")

    db.add(novo_investimento)
    db.add(transacao)
    db.commit()

    return {"message": "Investimento realizado com sucesso!", "valor_pago": valor}

@router.post("/processar-expiracoes")
async def processar_expiracoes_job(db: Session = Depends(get_db), _: Usuario = Depends(exigir_admin)):
    """Rota administrativa para processar expirações de 4h e 5d."""
    agora = datetime.datetime.utcnow()
    
    # 1. Regra das 4h: Ninguém investiu nada -> APAGAR
    expirados_4h = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.valor_arrecadado == 0,
        SolicitacaoEmprestimo.data_expiracao_4h <= agora
    ).all()

    count_4h = len(expirados_4h)
    for s in expirados_4h:
        estornar_e_limpar_solicitacao(s.id, db)

    # 2. Regra dos 5d: Tem investimentos mas não atingiu meta OU atingiu e não assinou
    expirados_5d = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
        SolicitacaoEmprestimo.data_expiracao_5d <= agora
    ).all()

    count_5d = len(expirados_5d)
    for s in expirados_5d:
        estornar_e_limpar_solicitacao(s.id, db)

    db.commit()
    registrar_acao_admin(db, admin.id, "PROCESSAR_EXPIRACOES", alvo_id="SISTEMA", detalhes=f"Removidos 4h: {count_4h}, Estornados 5d: {count_5d}", ip=None)
    return {"message": "Expirações processadas e limpeza realizada.", "removidos_4h": count_4h, "estornados_limpos_5d": count_5d}
