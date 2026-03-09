from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
import logging

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
from decimal import Decimal
import datetime
from datetime import timezone, timedelta
import pyotp
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from database import get_db, engine
from rotas.rotas_auth import obter_usuario_logado, exigir_admin, verify_password
from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao, Investimento, RegistroAuditoria

class NotificacaoDeposito(BaseModel):
    valor: Decimal = Field(gt=0)

class SolicitacaoSaque(BaseModel):
    valor: Decimal = Field(gt=0)
    chave_pix: str
    senha: str
    codigo_2fa: str

class AporteCaixaRequest(BaseModel):
    valor: Decimal = Field(gt=0)
    senha: str
    codigo_2fa: str = ""
    aceite_termos: bool = False

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

    # TRAVA DE SEGURANÇA: 48 HORAS APÓS MUDANÇA DE 2FA
    if usuario.ultima_alteracao_2fa:
        # Garantir que estamos comparando offset-naive UTC times
        agora_utc = datetime.datetime.utcnow()
        tempo_decorrido = agora_utc - usuario.ultima_alteracao_2fa
        
        if tempo_decorrido < timedelta(hours=48):
            horas_restantes = 48 - (tempo_decorrido.total_seconds() / 3600)
            raise HTTPException(
                status_code=403, 
                detail=f"Saque Bloqueado: Por medida de segurança, após alterar o 2FA, os saques ficam suspensos por 48 horas. Tente novamente em aproximadamente {int(horas_restantes)} horas."
            )

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

@router.post("/caixa/aporte")
async def aporte_caixa(dados: AporteCaixaRequest, request: Request, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Move saldo da conta principal para o Caixa com blindagem jurídica."""
    if not verify_password(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Senha de segurança incorreta.")
    
    if not dados.aceite_termos:
        raise HTTPException(status_code=400, detail="Você deve aceitar os termos de ciência de risco e regras do Pool.")

    if usuario.saldo < dados.valor:
        raise HTTPException(status_code=400, detail="Saldo insuficiente para aporte no Caixa.")
    
    # Registro de Auditoria (IP/Device)
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.datetime.utcnow()
    )
    db.add(auditoria)
    db.flush()

    usuario.saldo -= dados.valor
    usuario.saldo_caixa += dados.valor
    
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor,
        tipo=TipoTransacao.APORTE_CAIXA,
        status="concluido",
        detalhes="Aporte no Pool (Aceite de Termos e Risco Confirmado)",
        auditoria_id=auditoria.id
    )
    db.add(transacao)
    db.commit()
    return {"message": f"Aporte de R$ {dados.valor:.2f} realizado com sucesso!", "novo_saldo_caixa": float(usuario.saldo_caixa)}

@router.post("/caixa/resgate")
async def resgate_caixa(dados: AporteCaixaRequest, request: Request, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Resgata saldo do Caixa com blindagem e auditoria."""
    if not verify_password(dados.senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Senha de segurança incorreta.")

    agora = datetime.datetime.now(TZ_BRASILIA)
    # REGRA: Apenas entre 19 e 21 de dezembro
    if not (agora.month == 12 and 19 <= agora.day <= 21):
         raise HTTPException(
            status_code=403, 
            detail="Resgate bloqueado: O saldo do Caixa só pode ser resgatado entre 19 e 21 de Dezembro."
        )

    # NOVO: Chave Anticalote - Bloqueia resgate se houver empréstimo ativo
    emprestimo_ativo = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).first()
    
    if emprestimo_ativo:
        raise HTTPException(
            status_code=403,
            detail="Saque Negado: Você possui um empréstimo ativo. O resgate do Caixa está bloqueado até a quitação total da dívida."
        )

    if usuario.saldo_caixa < dados.valor:
        raise HTTPException(status_code=400, detail="Saldo no Caixa insuficiente para resgate.")
    
    # Registro de Auditoria
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.datetime.utcnow()
    )
    db.add(auditoria)
    db.flush()

    usuario.saldo_caixa -= dados.valor
    usuario.saldo += dados.valor
    
    transacao = Transacao(
        usuario_id=usuario.id,
        valor=dados.valor,
        tipo=TipoTransacao.RESGATE_CAIXA,
        status="concluido",
        detalhes="Resgate do Pool (Autenticado via Senha/IP)",
        auditoria_id=auditoria.id
    )
    db.add(transacao)
    db.commit()
    return {"message": f"Resgate de R$ {dados.valor:.2f} realizado!", "novo_saldo": float(usuario.saldo)}

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
            TipoTransacao.APORTE_CAPITAL,
            TipoTransacao.TAXA_POSTAGEM,
            TipoTransacao.RETORNO_INVESTIMENTO
        ]

        # 4. Lucro Total Histórico (Agregado no SQL)
        total_lucro_historico = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        # 5. Saques de lucro do admin + investimentos institucionais
        total_sacado_admin = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == TipoTransacao.SAQUE,
            Transacao.detalhes.like("RESGATE DE LUCRO %"),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        total_investido_institucional = db.query(func.sum(Transacao.valor)).filter(
            Transacao.tipo == TipoTransacao.INVESTIMENTO,
            Transacao.detalhes.like("%INSTITUCIONAL%LUCRO%"),
            Transacao.status == "concluido"
        ).scalar() or Decimal("0.00")

        lucro_disponivel = total_lucro_historico - total_sacado_admin - total_investido_institucional

        # 6. Detalhamento Histórico (sem filtro de mês — bate com o Bruto)
        receitas_historico_query = db.query(Transacao.tipo, func.sum(Transacao.valor)).filter(
            Transacao.tipo.in_(tipos_receita),
            Transacao.status == "concluido"
        ).group_by(Transacao.tipo).all()

        detalhamento_historico = {t.name.lower(): Decimal("0.00") for t in tipos_receita}
        for tipo, soma in receitas_historico_query:
            detalhamento_historico[tipo.value] = soma

        # 6b. Detalhes do Mês Atual (para o histórico mensal)
        primerio_dia_mes = agora_brasilia.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
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
            "lucro_disponivel": float(lucro_disponivel),
            "detalhamento_lucro": {
                "taxas_postagem": float(detalhamento_historico.get('taxa_postagem', 0)),
                "desbloqueio_lgpd": float(detalhamento_historico.get('desbloqueio_dados', 0)),
                "kyc_e_score": float(detalhamento_historico.get('compra_score', 0)),
                "taxas_saque_extra": float(detalhamento_historico.get('taxa_saque', 0)),
                "taxas_intermediacao_p2p": float(detalhamento_historico.get('taxa_intermediacao', 0)),
                "aportes_externos": float(detalhamento_historico.get('aporte_capital', 0)),
                "retorno_investimento": float(detalhamento_historico.get('retorno_investimento', 0))
            },
            "saldo_pool_caixa": float(db.query(func.sum(Usuario.saldo_caixa)).scalar() or 0),
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
        Transacao.tipo.in_([TipoTransacao.COMPRA_SCORE, TipoTransacao.DESBLOQUEIO_DADOS, TipoTransacao.TAXA_SAQUE, TipoTransacao.TAXA_INTERMEDIACAO, TipoTransacao.APORTE_CAPITAL, TipoTransacao.TAXA_POSTAGEM, TipoTransacao.RETORNO_INVESTIMENTO]),
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

    # DEDUZIR DO SALDO REAL DO ADMIN
    admin.saldo -= dados.valor

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
    admin.saldo += dados.valor
    transacao = Transacao(
        usuario_id=admin.id,
        valor=dados.valor,
        tipo=TipoTransacao.APORTE_CAPITAL,
        status="concluido",
        detalhes=f"APORTE EXTERNO → ORIGEM: {dados.chave_pix} | MOTIVO: {dados.motivo}"
    )
    db.add(transacao)
    db.commit()

@router.post("/admin/reinvestir-lucro-pool")
async def reinvestir_lucro_pool(
    dados: Decimal = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Move valor do Lucro Disponível diretamente para o Pool (Caixa).
    """
    if dados <= Decimal("0"):
        raise HTTPException(status_code=400, detail="Valor inválido.")

    # 1. Calcular Lucro Disponível (Histórico - Sacado)
    # Nota: Usamos a mesma lógica do snapshot para consistência
    tipos_receita = [
        TipoTransacao.COMPRA_SCORE, 
        TipoTransacao.DESBLOQUEIO_DADOS, 
        TipoTransacao.TAXA_SAQUE, 
        TipoTransacao.TAXA_INTERMEDIACAO,
        TipoTransacao.APORTE_CAPITAL,
        TipoTransacao.TAXA_POSTAGEM,
        TipoTransacao.RETORNO_INVESTIMENTO
    ]
    
    total_receita = db.query(func.sum(Transacao.valor)).filter(
        Transacao.tipo.in_(tipos_receita),
        Transacao.status == "concluido"
    ).scalar() or Decimal("0.00")

    total_sacado = db.query(func.sum(Transacao.valor)).filter(
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.detalhes.like("RESGATE DE LUCRO %"),
        Transacao.status == "concluido"
    ).scalar() or Decimal("0.00")

    lucro_disponivel = total_receita - total_sacado

    if dados > lucro_disponivel:
        raise HTTPException(status_code=400, detail="Lucro insuficiente.")

    # 2. Executar Movimentação
    admin.saldo_caixa += dados
    
    # Registro de Saída do Lucro
    db.add(Transacao(
        usuario_id=admin.id,
        valor=dados,
        tipo=TipoTransacao.SAQUE,
        status="concluido",
        detalhes=f"RESGATE DE LUCRO PARA REINVESTIMENTO NO POOL (ID ADMIN: {admin.id})"
    ))

    # Registro de Entrada no Pool
    db.add(Transacao(
        usuario_id=admin.id,
        valor=dados,
        tipo=TipoTransacao.APORTE_CAIXA,
        status="concluido",
        detalhes=f"REINVESTIMENTO INSTITUCIONAL NO POOL (ORIGEM: LUCRO PLATAFORMA)"
    ))

    db.commit()
    return {"message": "Sucesso! Lucro reinvestido no Pool.", "novo_saldo_pool": float(admin.saldo_caixa)}

@router.post("/admin/resgatar-pool-para-lucro")
async def resgatar_pool_para_lucro(
    dados: Decimal = Body(..., embed=True),
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Retira valor do Pool (Capital + Juros) e devolve para o Lucro da plataforma.
    """
    if dados <= Decimal("0") or dados > admin.saldo_caixa:
        raise HTTPException(status_code=400, detail="Saldo no Pool insuficiente ou valor inválido.")

    # 1. Executar Movimentação
    admin.saldo_caixa -= dados

    # Registro de Saída do Pool
    db.add(Transacao(
        usuario_id=admin.id,
        valor=dados,
        tipo=TipoTransacao.RESGATE_CAIXA,
        status="concluido",
        detalhes=f"RESGATE DO POOL PARA RETORNO AO LUCRO (CAPITAL + JUROS)"
    ))

    # Registro de Entrada no Balanço de Lucro (Aporte de Capital)
    db.add(Transacao(
        usuario_id=admin.id,
        valor=dados,
        tipo=TipoTransacao.APORTE_CAPITAL,
        status="concluido",
        detalhes=f"RETORNO DE REINVESTIMENTO DO POOL (ID ADMIN: {admin.id})"
    ))

    db.commit()
    return {"message": "Sucesso! Capital e juros retornaram ao Lucro.", "novo_saldo_pool": float(admin.saldo_caixa)}

class InvestimentoAdminRequest(BaseModel):
    solicitacao_id: int
    valor: Decimal = Field(gt=0)
    motivo: str

@router.post("/admin/investir-lucro")
async def investir_lucro_plataforma(
    dados: InvestimentoAdminRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: Usuario = Depends(exigir_admin)
):
    """
    Permite ao admin investir o lucro acumulado em solicitações de empréstimo.
    """
    valor = dados.valor
    solicitacao = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.id == dados.solicitacao_id,
        SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
    ).first()

    if not solicitacao:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada ou não está mais pendente.")

    # Calcula o saldo total disponível no Pool (Soma do saldo_caixa de todos os usuários)
    saldo_pool_global = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")

    if valor > saldo_pool_global:
        raise HTTPException(
            status_code=400, 
            detail=f"Saldo do Pool insuficiente para este investimento. Disponível: R$ {float(saldo_pool_global):.2f}"
        )

    # Validar meta
    restante = solicitacao.valor - solicitacao.valor_arrecadado
    if valor > restante:
         raise HTTPException(status_code=400, detail=f"Valor excede o necessário. Faltam apenas R$ {restante}")

    # Processar investimento (Não tira do saldo pessoal do admin, é institucional)
    solicitacao.valor_arrecadado += valor

    # Criar registro de auditoria
    agora = datetime.datetime.utcnow()
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        municipio=f"{admin.cidade}/{admin.estado}" if admin.cidade else "Localização Admin",
        user_agent=request.headers.get("user-agent"),
        data_registro=agora
    )
    db.add(auditoria)
    db.flush()

    novo_investimento = Investimento(
        investidor_id=admin.id,
        solicitacao_id=solicitacao.id,
        valor_investido=valor,
        pago_para_investidor=Decimal("0.00"),
        data_investimento=agora,
        ciencia_risco=True,
        auditoria_id=auditoria.id,
        cpf_aceite=admin.cpf,
        is_institutional=True,
        is_pool=True
    )

    # Registrar transação
    transacao = Transacao(
        usuario_id=admin.id,
        valor=valor,
        tipo=TipoTransacao.INVESTIMENTO,
        status="concluido",
        detalhes=f"INVESTIMENTO INSTITUCIONAL (POOL) -> Pedido #{solicitacao.id} | MOTIVO: {dados.motivo}"
    )

    # Se atingiu a meta, tenta liberar
    from utils_emprestimo import tentar_liberar_emprestimo
    if solicitacao.valor_arrecadado == solicitacao.valor:
        tentar_liberar_emprestimo(solicitacao.id, db)

    # Deduzir do Pool de forma pro-rata entre todos os participantes
    total_pool = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("1.00")
    participantes_caixa = db.query(Usuario).filter(Usuario.saldo_caixa > 0).all()
    
    for p_caixa in participantes_caixa:
        fatia_debito = (p_caixa.saldo_caixa / total_pool) * valor
        p_caixa.saldo_caixa -= fatia_debito

    db.add(novo_investimento)
    db.add(transacao)
    db.commit()

    return {"message": "Investimento realizado com sucesso usando o saldo do Pool (Caixa)!", "valor": float(valor)}

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
@router.post("/admin/liquidar-caixa")
async def liquidar_caixa_devedores(db: Session = Depends(get_db), admin: Usuario = Depends(exigir_admin)):
    """
    Chave de Liquidação: Em dezembro, o sistema identifica investidores que possuem saldo no Caixa 
    mas estão inadimplentes ou com empréstimos ativos. 
    O saldo deles é confiscado e rateado entre os investidores adimplentes.
    """
    agora = datetime.datetime.now(TZ_BRASILIA)
    if agora.month != 12:
        raise HTTPException(status_code=400, detail="A Liquidação Compulsória só pode ser executada em Dezembro.")

    # 1. Identificar Devedores que possuem saldo no Caixa
    devedores = db.query(Usuario).join(SolicitacaoEmprestimo).filter(
        Usuario.saldo_caixa > 0,
        SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
    ).all()

    total_confiscado = Decimal("0.00")
    for dev in devedores:
        valor_confisco = dev.saldo_caixa
        total_confiscado += valor_confisco
        dev.saldo_caixa = Decimal("0.00")
        
        db.add(Transacao(
            usuario_id=dev.id,
            valor=valor_confisco,
            tipo=TipoTransacao.RESGATE_CAIXA, # Usando tipo existente para fluxo
            status="falhou",
            detalhes=f"LIQUIDAÇÃO COMPULSÓRIA: Saldo confiscado por dívida ativa em {agora.year}."
        ))

    # 2. Ratear entre Investidores Adimplentes (quem tem saldo_caixa > 0 e NÃO é devedor)
    if total_confiscado > 0:
        # Subquery para excluir devedores do rateio
        ids_devedores = [d.id for d in devedores]
        investidores_bons = db.query(Usuario).filter(
            Usuario.saldo_caixa > 0,
            ~Usuario.id.in_(ids_devedores)
        ).all()

        total_caixa_bom = sum(u.saldo_caixa for u in investidores_bons) or Decimal("1.00")
        
        for inv in investidores_bons:
            fatia = (inv.saldo_caixa / total_caixa_bom) * total_confiscado
            inv.saldo_caixa += fatia
            
            db.add(Transacao(
                usuario_id=inv.id,
                valor=fatia,
                tipo=TipoTransacao.RETORNO_POOL,
                status="concluido",
                detalhes=f"BÔNUS DE LIQUIDAÇÃO: Rateio de devedores em {agora.year}."
            ))

    db.commit()
    return {
        "message": "Liquidação concluída com sucesso.",
        "devedores_afetados": len(devedores),
        "total_confiscado_e_rateado": float(total_confiscado)
    }
