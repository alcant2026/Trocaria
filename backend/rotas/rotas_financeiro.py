from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from decimal import Decimal
import datetime
from datetime import timezone, timedelta
import pyotp
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from database import get_db
from rotas.rotas_auth import obter_usuario_logado, exigir_admin, verify_password

class NotificacaoDeposito(BaseModel):
    valor: Decimal

class SolicitacaoSaque(BaseModel):
    valor: Decimal
    chave_pix: str
    senha: str
    codigo_2fa: str

router = APIRouter(prefix="/financeiro", tags=["Financeiro"])
TZ_BRASILIA = timezone(timedelta(hours=-3))

@router.post("/solicitar-saque")
async def solicitar_saque(dados: SolicitacaoSaque, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    valor = dados.valor
    chave_pix = dados.chave_pix
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if valor <= 0:
        raise HTTPException(status_code=400, detail="Valor de saque inválido.")

    if usuario.saldo < valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para este saque.")

    # SEGURANÇA: Validação de PIX (Zero Trust Policy)
    # A regra do usuário é que o saque tem que ser na mesma chave PIX do nome
    # Em um cenário real, consultaríamos uma API do Bacen/PSP para validar a titularidade.
    # Como o processo é manual inicial, registraremos a intenção e alertaremos o admin.
    
    # Simulação de validação de titularidade (nome no cadastro vs nome da chave pix)
    # Aqui, como o usuário cadastrou sua chave_pix no perfil, comparamos com a solicitada no saque
    if chave_pix != usuario.chave_pix:
        raise HTTPException(
            status_code=401, 
            detail="Saque negado: A chave PIX deve pertencer obrigatoriamente à mesma titularidade da conta (conforme LGPD e regras Bacen)."
        )

    # NOVO: Validação OBRIGATÓRIA de Senha e 2FA
    if not verify_password(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Senha de segurança incorreta.")
    
    if not usuario.two_factor_enabled:
        raise HTTPException(
            status_code=403, 
            detail="2FA Obrigatório: Você precisa ativar a Autenticação de Dois Fatores (Google Authenticator) antes de realizar um saque."
        )
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if not totp.verify(dados.codigo_2fa):
        raise HTTPException(status_code=401, detail="Código 2FA (Authenticator) inválido ou expirado.")

    # Regra: 1º saque do dia grátis, demais R$ 5,00
    hoje = datetime.datetime.now(TZ_BRASILIA).date()
    inicio_dia = datetime.datetime.combine(hoje, datetime.time.min).replace(tzinfo=TZ_BRASILIA)
    
    saques_hoje = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id,
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.data_criacao >= inicio_dia
    ).count()

    taxa = Decimal("0.00")
    if saques_hoje >= 1:
        taxa = Decimal("5.00")
        if usuario.saldo < (valor + taxa):
            raise HTTPException(status_code=400, detail=f"Saldo insuficiente para saque + taxa de R$ {taxa} (você já realizou {saques_hoje} saque(s) hoje).")

    # Deduzir valor e taxa imediatamente
    usuario.saldo -= (valor + taxa)
    
    # Criar transação de saque pendente
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor,
        tipo=TipoTransacao.SAQUE,
        status="pendente",
        detalhes=f"Solicitação de saque para chave PIX: {chave_pix}"
    )
    db.add(nova_transacao)

    # Se houver taxa, registrar como lucro da plataforma
    if taxa > 0:
        transacao_taxa = Transacao(
            usuario_id=usuario.id,
            valor=taxa,
            tipo=TipoTransacao.TAXA_SAQUE,
            status="concluido",
            detalhes=f"Taxa de saque extra ({saques_hoje + 1}º saque no dia)"
        )
        db.add(transacao_taxa)

    db.commit()
    
    msg = "Solicitação de saque registrada." 
    if taxa > 0:
        msg += f" Taxa de R$ {taxa} aplicada por ser o seu {saques_hoje + 1}º saque hoje."
    
    return {"message": msg + " Aguardando processamento manual."}

@router.post("/notificar-deposito")
async def notificar_deposito(dados: NotificacaoDeposito, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    valor = dados.valor
    
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor,
        tipo=TipoTransacao.DEPOSITO,
        status="pendente",
        detalhes="Notificação de depósito manual via PIX"
    )
    db.add(nova_transacao)
    db.commit()
    return {"message": "Notificação enviada. O saldo será creditado assim que o admin confirmar o Pix."}

@router.get("/admin/pendentes")
async def listar_pendentes(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    pendentes = db.query(Transacao).join(Usuario).filter(
        Transacao.status == "pendente",
        Transacao.tipo.in_([TipoTransacao.DEPOSITO, TipoTransacao.SAQUE, TipoTransacao.DESBLOQUEIO_DADOS])
    ).all()
    
    resultado = []
    for t in pendentes:
        data = t.data_criacao
        if data.tzinfo is None:
            data = data.replace(tzinfo=timezone.utc)
        data_brasilia = data.astimezone(TZ_BRASILIA)

        resultado.append({
            "transacao_id": t.id,
            "usuario_nome": t.usuario.nome,
            "usuario_cpf": t.usuario.cpf,
            "usuario_verificado": t.usuario.is_verified,
            "valor": float(t.valor),
            "tipo": t.tipo.value,
            "detalhes": t.detalhes,
            "data": data_brasilia.isoformat()
        })

    return resultado

@router.post("/admin/confirmar/{transacao_id}")
async def confirmar_transacao(transacao_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao or transacao.status != "pendente":
        raise HTTPException(status_code=404, detail="Transação pendente não encontrada.")

    usuario = transacao.usuario
    
    if transacao.tipo == TipoTransacao.DEPOSITO:
        usuario.saldo += transacao.valor
        msg = f"Saldo de R$ {transacao.valor} creditado para {usuario.nome}!"
    elif transacao.tipo == TipoTransacao.SAQUE:
        # No saque, o saldo já foi deduzido (bloqueado) na solicitação.
        # Aqui o admin apenas confirma que enviou o Pix.
        msg = f"Saque de R$ {transacao.valor} para {usuario.nome} marcado como enviado!"
    else:
        msg = f"Transação de {usuario.nome} confirmada!"
    
    transacao.status = "concluido"
    db.commit()
    return {"message": msg}

@router.post("/admin/confirmar-verificacao/{transacao_id}")
async def confirmar_verificacao(transacao_id: int, db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao or transacao.status != "pendente":
        raise HTTPException(status_code=404, detail="Solicitação de verificação não encontrada.")

    usuario = transacao.usuario
    usuario.is_verified = True
    transacao.status = "concluido"
    
    db.commit()
    return {"message": f"Identidade de {usuario.nome} verificada com sucesso!"}

@router.post("/admin/rejeitar/{transacao_id}")
async def rejeitar_transacao(transacao_id: int, motivo: str = "Dados inválidos ou documento ilegível", db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    transacao = db.query(Transacao).filter(Transacao.id == transacao_id).first()
    if not transacao or transacao.status != "pendente":
        raise HTTPException(status_code=404, detail="Transação pendente não encontrada.")

    usuario = transacao.usuario
    
    # Só não estorna em DEPÓSITO (dinheiro ainda não entrou) e RECEBIMENTO (dinheiro vindo de fora)
    if transacao.tipo.value not in ["deposito", "recebimento"]:
        usuario.saldo += transacao.valor
    
    transacao.status = "falhou"
    transacao.detalhes = f"REJEITADO: {motivo}"
    
    db.commit()
    return {"message": f"Transação de {usuario.nome} rejeitada. Motivo: {motivo}"}

@router.get("/admin/fiscal")
async def obter_resumo_fiscal(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Retorna o resumo fiscal da plataforma para declaração: 
    Total sob custódia (saldo dos usuários) e Lucro da Plataforma (Taxas).
    """
    from sqlalchemy import func

    # 1. Saldo Total Gerenciado (Passivo da plataforma = dinheiro dos usuários)
    # Soma o saldo de TODOS os usuários cadastrados (inclusive o próprio admin durante os testes)
    saldo_usuarios = db.query(func.sum(Usuario.saldo)).scalar() or Decimal("0.00")

    # 2. Receitas da Plataforma (Lucro do Mês Atual)
    total_lucro_mes = Decimal("0.00")
    agora_brasilia = datetime.datetime.utcnow() - timedelta(hours=3)
    mes_atual = agora_brasilia.strftime("%Y-%m")

    # 2. Receitas da Plataforma (Lucro do Mês Atual)
    todas_receitas = db.query(Transacao).filter(
        Transacao.tipo.in_([TipoTransacao.COMPRA_SCORE, TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_SAQUE]),
        Transacao.status == "concluido"
    ).all()

    # Filtrar apenas o que pertence ao mês atual para os cards de destaque
    receitas_mes = [
        t for t in todas_receitas 
        if (t.data_criacao - timedelta(hours=3)).strftime("%Y-%m") == mes_atual
    ]

    total_lucro_mes = sum(t.valor for t in receitas_mes)
    
    # Detalhamento do lucro NO MÊS ATUAL
    lucro_postagem = sum(t.valor for t in receitas_mes if t.valor == Decimal("4.00"))
    lucro_lgpd = sum(t.valor for t in receitas_mes if t.valor == Decimal("15.00"))
    lucro_kyc_score = sum(t.valor for t in receitas_mes if t.valor == Decimal("35.00"))

    # Lucro Total Acumulado (histórico)
    total_lucro_historico = sum(t.valor for t in todas_receitas)

    historico_mensal = {}
    
    todas_transacoes = db.query(Transacao).filter(Transacao.status == "concluido").all()
    
    for t in todas_transacoes:
        # Ajuste para Horário de Brasília (UTC-3)
        data_brasilia = t.data_criacao - timedelta(hours=3)
        mes_ano = data_brasilia.strftime("%Y-%m")
        
        if mes_ano not in historico_mensal:
            historico_mensal[mes_ano] = {"depositos": Decimal("0.00"), "saques": Decimal("0.00"), "lucro": Decimal("0.00")}
            
        if t.tipo == TipoTransacao.DEPOSITO:
            historico_mensal[mes_ano]["depositos"] += t.valor
        elif t.tipo == TipoTransacao.SAQUE:
            historico_mensal[mes_ano]["saques"] += t.valor
        elif t.tipo in [TipoTransacao.COMPRA_SCORE, TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_SAQUE]:
            historico_mensal[mes_ano]["lucro"] += t.valor

    # Formatar resposta do histórico
    historico_formatado = []
    for mes, dados in sorted(historico_mensal.items(), reverse=True):
        historico_formatado.append({
            "mes": mes,
            "depositos": float(dados["depositos"]),
            "saques": float(dados["saques"]),
            "lucro": float(dados["lucro"])
        })

    return {
        "saldo_usuarios_gerenciado": float(saldo_usuarios),
        "lucro_plataforma_total": float(total_lucro_mes),
        "lucro_plataforma_historico": float(total_lucro_historico),
        "detalhamento_lucro": {
            "taxas_postagem": float(lucro_postagem),
            "desbloqueio_lgpd": float(lucro_lgpd),
            "kyc_e_score": float(lucro_kyc_score),
            "taxas_saque_extra": float(sum(t.valor for t in receitas_mes if t.tipo == TipoTransacao.TAXA_SAQUE))
        },
        "fluxo_caixa_total": {
            "depositos_confirmados": sum(h["depositos"] for h in historico_formatado),
            "saques_confirmados": sum(h["saques"] for h in historico_formatado)
        },
        "historico_mensal": historico_formatado
    }

@router.post("/depositar-manual")
async def registrar_deposito_manual(usuario_id: int, valor: Decimal, db: Session = Depends(get_db)):
    """
    Função administrativa para registrar entrada de dinheiro
    (Processamento via pix manual pelo admin)
    """
    admin_id = 0 # Dummy admin logic
    
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Alvo do depósito não encontrado.")

    usuario.saldo += valor
    
    nova_transacao = Transacao(
        usuario_id=usuario.id,
        valor=valor,
        tipo=TipoTransacao.DEPOSITO,
        status="concluido",
        detalhes="Depósito manual via transferência Pix (Aprovado pelo Admin)"
    )

    db.add(nova_transacao)
    db.commit()
    
    return {"message": "Depósito creditado com sucesso.", "novo_saldo": usuario.saldo}

@router.get("/meu-historico")
async def meu_historico(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Retorna as últimas transações do usuário (Depósitos, Saques, etc)
    """
    transacoes = db.query(Transacao).filter(Transacao.usuario_id == usuario.id).order_by(Transacao.data_criacao.desc()).limit(10).all()
    
    resultado = []
    for t in transacoes:
        data = t.data_criacao
        if data.tzinfo is None:
            data = data.replace(tzinfo=timezone.utc)
        data_brasilia = data.astimezone(TZ_BRASILIA)

        resultado.append({
            "id": t.id,
            "valor": float(t.valor),
            "tipo": t.tipo.value,
            "status": t.status,
            "detalhes": t.detalhes,
            "data": data_brasilia.isoformat()
        })
    
    return resultado
