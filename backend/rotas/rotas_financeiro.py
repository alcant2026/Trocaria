from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
from datetime import timezone, timedelta
import pyotp
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from database import get_db
from rotas.rotas_auth import obter_usuario_logado, exigir_admin, verify_password

class NotificacaoDeposito(BaseModel):
    valor: Decimal = Field(gt=0)

class SolicitacaoSaque(BaseModel):
    valor: Decimal = Field(gt=0)
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
    Versão Otimizada (SQL-Aggregated).
    """
    try:
        # 1. Saldo Total Gerenciado (Passivo da plataforma)
        saldo_usuarios = db.query(func.sum(Usuario.saldo)).scalar() or Decimal("0.00")

        # 2. Configurações de tempo
        agora_brasilia = datetime.datetime.now(TZ_BRASILIA)
        mes_atual_str = agora_brasilia.strftime("%Y-%m")

        # 3. Tipos de Receita
        tipos_receita = [
            TipoTransacao.COMPRA_SCORE, 
            TipoTransacao.DESBLOQUEIO_DADOS, 
            TipoTransacao.TAXA_SAQUE,
            TipoTransacao.TAXA_INTERMEDIACAO,
            TipoTransacao.APORTE_CAPITAL
        ]

        # 4. Lucro Total Histórico (Agregado no SQL)
        total_lucro_historico = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        # 5. Saques de lucro do admin
        total_sacado_admin = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == TipoTransacao.SAQUE,
            Transacao.detalhes.like("RESGATE DE LUCRO %"),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        # 6. Detalhes do Mês Atual (Agregado)
        primerio_dia_mes = agora_brasilia.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Filtro de receitas do mês atual
        receitas_mes_query = db.query(Transacao.tipo, func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido",
            Transacao.data_criacao >= primerio_dia_mes
        ).group_by(Transacao.tipo).all()

        detalhamento_mes = {t.name.lower(): Decimal("0.00") for t in tipos_receita}
        for tipo, soma in receitas_mes_query:
            detalhamento_mes[tipo.value] = soma

        total_lucro_mes = sum(detalhamento_mes.values())

        # 7. Histórico Mensal Otimizado
        # Agrupa por mês usando truncamento de data (Postgres/SQLite compatível)
        if "sqlite" in str(engine.url):
            trunc_fn = func.strftime('%Y-%m', Transacao.data_criacao)
        else:
            trunc_fn = func.to_char(Transacao.data_criacao, 'YYYY-MM')

        historico_raw = db.query(
            trunc_fn.label("mes"),
            func.sum(case((Transacao.tipo == TipoTransacao.DEPOSITO, Transacao.valor), else_=0)).label("depositos"),
            func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, ~Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("saques"),
            func.sum(case((Transacao.tipo.in_(tipos_receita), Transacao.valor), else_=0)).label("lucro"),
            func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("lucro_sacado")
        ).filter(Transacao.status == "concluido").group_by("mes").order_by(text("mes DESC")).limit(12).all()

        historico_formatado = []
        for h in historico_raw:
            historico_formatado.append({
                "mes": h.mes,
                "depositos": float(h.depositos or 0),
                "saques": float(h.saques or 0),
                "lucro": float(h.lucro or 0),
                "lucro_sacado": float(h.lucro_sacado or 0)
            })

        return {
            "saldo_usuarios_gerenciado": float(saldo_usuarios),
            "lucro_plataforma_total": float(total_lucro_mes),
            "lucro_plataforma_historico": float(total_lucro_historico),
            "lucro_disponivel": float(total_lucro_historico - total_sacado_admin),
            "detalhamento_lucro": {
                "taxas_postagem": float(detalhamento_mes.get('taxa_intermediacao', 0)), # Referência simplificada
                "desbloqueio_lgpd": float(detalhamento_mes.get('desbloqueio_dados', 0)),
                "kyc_e_score": float(detalhamento_mes.get('compra_score', 0)),
                "taxas_saque_extra": float(detalhamento_mes.get('taxa_saque', 0)),
                "taxas_intermediacao_p2p": float(detalhamento_mes.get('taxa_intermediacao', 0))
            },
            "historico_mensal": historico_formatado
        }
    except Exception as e:
        logger.error(f"Erro no relatório fiscal: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar relatório fiscal.")


class SaqueAdminRequest(BaseModel):
    chave_pix: str
    valor: Decimal = Field(gt=0)
    motivo: str


@router.post("/admin/sacar-lucro")
async def sacar_lucro_plataforma(
    dados: SaqueAdminRequest,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Permite ao admin resgatar parte do lucro acumulado da plataforma.
    O valor é registrado como transação de auditoria e a chave PIX é exibida no painel.
    """

    if dados.valor <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Valor inválido para o saque.")

    # Calcula o lucro total disponível (histórico de taxas)
    todas_receitas = db.query(Transacao).filter(
        Transacao.tipo.in_([TipoTransacao.COMPRA_SCORE, TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_SAQUE, TipoTransacao.TAXA_INTERMEDIACAO, TipoTransacao.APORTE_CAPITAL]),
        Transacao.status == "concluido"
    ).all()
    lucro_disponivel = sum(t.valor for t in todas_receitas)

    # Subtrai saques anteriores do admin
    saques_anteriores = db.query(Transacao).filter(
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.detalhes.like("Saque de lucro da plataforma%"),
        Transacao.status == "concluido"
    ).all()
    total_sacado = sum(t.valor for t in saques_anteriores)

    saldo_lucro_liquido = lucro_disponivel - total_sacado

    if dados.valor > saldo_lucro_liquido:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo de lucro insuficiente. Disponível: R$ {float(saldo_lucro_liquido):.2f}"
        )

    if not dados.motivo or len(dados.motivo.strip()) < 5:
        raise HTTPException(status_code=400, detail="Você deve fornecer uma justificativa clara (mínimo 5 caracteres) para o resgate de lucro.")

    # Registra a transação de auditoria
    transacao = Transacao(
        usuario_id=admin.id,
        valor=dados.valor,
        tipo=TipoTransacao.SAQUE,
        status="concluido",
        detalhes=f"RESGATE DE LUCRO → PIX: {dados.chave_pix} | MOTIVO: {dados.motivo}"
    )
    db.add(transacao)
    db.commit()

    return {
        "message": f"Saque de R$ {float(dados.valor):.2f} registrado! Realize o PIX para a chave: {dados.chave_pix}",
        "lucro_disponivel_restante": float(saldo_lucro_liquido - dados.valor)
    }

@router.post("/admin/aportar-lucro")
async def aportar_lucro_plataforma(
    dados: SaqueAdminRequest, # Reutilizando o schema pois os campos são os mesmos
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Permite ao admin injetar capital/lucro de fontes externas para o balanço da plataforma.
    """
    if dados.valor <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Valor inválido para o aporte.")

    if not dados.motivo or len(dados.motivo.strip()) < 5:
        raise HTTPException(status_code=400, detail="Forneça uma justificativa para o aporte (mínimo 5 caracteres).")

    # Registra a transação de aporte (entrada no fiscal)
    transacao = Transacao(
        usuario_id=admin.id,
        valor=dados.valor,
        tipo=TipoTransacao.APORTE_CAPITAL,
        status="concluido",
        detalhes=f"APORTE EXTERNO → ORIGEM: {dados.chave_pix} | MOTIVO: {dados.motivo}"
    )
    db.add(transacao)
    db.commit()

    return {
        "message": f"Aporte de R$ {float(dados.valor):.2f} registrado com sucesso!",
        "novo_lucro_disponivel": float(db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_([TipoTransacao.COMPRA_SCORE, TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_SAQUE, TipoTransacao.TAXA_INTERMEDIACAO, TipoTransacao.APORTE_CAPITAL]),
            Transacao.status == "concluido"
        ).scalar() or 0)
    }

@router.post("/depositar-manual")
async def registrar_deposito_manual(usuario_id: int, valor: Decimal, db: Session = Depends(get_db)):
    """
    Função administrativa para registrar entrada de dinheiro
    (Processamento via pix manual pelo admin)
    """
    if valor <= 0:
        raise HTTPException(status_code=400, detail="O valor do depósito deve ser maior que zero.")
    
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
