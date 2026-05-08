from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, Boolean, Text
from sqlalchemy.orm import relationship
import datetime
import enum
from database import Base

class StatusSolicitacao(enum.Enum):
    PENDENTE = "pendente"
    APROVADO = "aprovado"
    REJEITADO = "rejeitado"
    CANCELADO = "cancelado"
    CONCLUIDO = "concluido"

class TipoTransacao(enum.Enum):
    DEPOSITO = "deposito"
    SAQUE = "saque"
    INVESTIMENTO = "investimento"
    RECEBIMENTO = "recebimento"
    COMPRA_SCORE = "compra_score"
    DESBLOQUEIO_DADOS = "desbloqueio_dados"
    TAXA_SAQUE = "taxa_saque"
    TAXA_INTERMEDIACAO = "taxa_intermediacao"
    TAXA_ESPECIE = "taxa_especie"  # deprecated - mantido para compatibilidade
    APORTE_CAPITAL = "aporte_capital"
    PAGAMENTO_PARCELA = "pagamento_parcela"
    TAXA_POSTAGEM = "taxa_postagem"
    RETORNO_INVESTIMENTO = "retorno_investimento"
    APORTE_CAIXA = "aporte_caixa"
    RESGATE_CAIXA = "resgate_caixa"
    APORTE_POOL = "aporte_pool"
    RESGATE_POOL = "resgate_pool"
    ABERTURA_GAVETA = "abertura_gaveta"
    FECHAMENTO_GAVETA = "fechamento_gaveta"
    BONUS_PAGADOR_CAIXA = "bonus_pagador_caixa"
    RETORNO_POOL = "retorno_pool"
    COMISSAO_PARCEIRO = "comissao_parceiro"  # deprecated - mantido para compatibilidade
    TAXA_ADM_EMPRESTIMO = "taxa_adm_emprestimo"
    TAXA_DEPOSITO_VIRTUAL = "taxa_deposito_virtual"
    TAXA_SOLICITACAO = "taxa_solicitacao"
    TAXA_ORIGEM = "taxa_origem"
    CONFIRMACAO_PAGAMENTO = "confirmacao_pagamento"
    CONFIRMACAO_RECEBIMENTO = "confirmacao_recebimento"
    ASSINATURA = "assinatura"
    RESGATE_PONTOS = "resgate_pontos"
    BONUS = "bonus"

class RegistroAuditoria(Base):
    __tablename__ = "registros_auditoria"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String(45), nullable=False)
    municipio = Column(String(100), nullable=True)
    user_agent = Column(String(200), nullable=True)  # truncado para economizar
    data_registro = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(5), primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    cpf = Column(String(14), unique=True, index=True, nullable=False)
    senha_hash = Column(Text, nullable=False)
    chave_pix = Column(String(255), nullable=False)
    saldo = Column(Numeric(precision=20, scale=2), default=0)
    saldo_caixa = Column(Numeric(precision=20, scale=2), default=0)
    valor_emprestado = Column(Numeric(precision=20, scale=2), default=0)
    inadimplente = Column(Boolean, default=False)
    qtd_calotes = Column(Integer, default=0)
    emprestimos_ativos = Column(Integer, default=0)
    emprestimos_concluidos = Column(Integer, default=0)
    score = Column(Numeric(precision=6, scale=1), default=0)
    score_anterior = Column(Numeric(precision=6, scale=1), default=0)
    ultima_solicitacao = Column(DateTime, nullable=True)
    solicitacoes_hoje = Column(Integer, default=0)
    ultima_atualizacao_score = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    limite_credito_personalizado = Column(Numeric(precision=20, scale=2), nullable=True)
    
    telefone = Column(String(20), nullable=True)
    cidade = Column(String(100), nullable=True)
    estado = Column(String(50), nullable=True)
    aceite_termos = Column(Boolean, default=False)
    aceite_cookies = Column(Boolean, default=False)
    data_aceite_cookies = Column(DateTime, nullable=True)
    data_aceite = Column(DateTime, nullable=True)
    
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)
    auditoria = relationship("RegistroAuditoria")

    totp_secret = Column(String(32), nullable=True)
    two_factor_enabled = Column(Boolean, default=False)
    ultima_alteracao_2fa = Column(DateTime, nullable=True)

    codigo_recuperacao_hash = Column(String(200), nullable=True)
    expiracao_recuperacao = Column(DateTime, nullable=True)

    # Verificação de Email e Telefone (Firebase Email + Código Tela)
    email_verificado = Column(Boolean, default=False)
    telefone_verificado = Column(Boolean, default=False)
    codigo_verificacao_telefone = Column(String(200), nullable=True)
    expiracao_codigo_telefone = Column(DateTime, nullable=True)

    # FREE TIER STORAGE CONTROL
    storage_tier = Column(String(20), default="free")  # free, premium
    is_premium = Column(Boolean, default=False)
    premium_expira_em = Column(DateTime, nullable=True)
    storage_used_mb = Column(Numeric(10, 2), default=0)
    storage_limit_mb = Column(Integer, default=10)  # free = 10MB, premium = ilimitado

    # NOVO: Assinatura Premium Marketplace
    is_subscriber = Column(Boolean, default=False)
    assinatura_expira_em = Column(DateTime, nullable=True)
    pontos_marketplace = Column(Integer, default=0)
    pontos_semanais = Column(Integer, default=0)

    # NOVO: Regra de Dividendos Participativos
    vendas_completadas = Column(Integer, default=0)

    # Mercado Pago Marketplace (OAuth)
    mp_access_token = Column(String(255), nullable=True)
    mp_refresh_token = Column(String(255), nullable=True)
    mp_user_id = Column(String(100), nullable=True)
    mp_token_expires_at = Column(DateTime, nullable=True)

    # Foto de Perfil
    foto_perfil = Column(String(500), nullable=True)

    # Indicacao (Referral)
    codigo_indicacao = Column(String(10), unique=True, index=True, nullable=True)
    indicado_por = Column(String(5), ForeignKey("usuarios.id"), nullable=True)

    solicitacoes = relationship("SolicitacaoEmprestimo", back_populates="usuario", foreign_keys="SolicitacaoEmprestimo.usuario_id")
    transacoes = relationship("Transacao", back_populates="usuario")

class SolicitacaoEmprestimo(Base):
    __tablename__ = "solicitacoes_emprestimo"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), index=True)
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    taxa_juros = Column(Numeric(precision=5, scale=2), nullable=False)
    prazo_meses = Column(Integer, nullable=False)
    status = Column(Enum(StatusSolicitacao, name="status_solicitacao", values_callable=lambda x: [e.value for e in x]), default=StatusSolicitacao.PENDENTE, index=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    proximo_vencimento = Column(DateTime, nullable=True)
    parcelas_pagas = Column(Integer, default=0)
    taxas_adicionais = Column(Numeric(precision=20, scale=2), default=0)
    valor_amortizado = Column(Numeric(precision=20, scale=2), default=0)
    valor_arrecadado = Column(Numeric(precision=20, scale=2), default=0)
    credor_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True, index=True)
    chave_pix_credor = Column(String(255), nullable=True)
    confirmacao_pagamento_data = Column(DateTime, nullable=True)
    confirmacao_recebimento_data = Column(DateTime, nullable=True)
    data_quitacao = Column(DateTime, nullable=True)
    tipo_garantia = Column(String(50), default="p2p")
    garantia_descricao = Column(String(500), nullable=True)  # limitado para free tier
    
    data_expiracao_4h = Column(DateTime, nullable=True) # Janela para entrega física
    data_expiracao_5d = Column(DateTime, nullable=True) # Prazo total para captação (se houver)

    parceiro_id = Column(Integer, ForeignKey("parceiros.id"), nullable=True, index=True)
    parceiro = relationship("Parceiro")

    aceite_termos = Column(Boolean, default=False)
    aceite_termos_plataforma = Column(Boolean, default=False)
    ip_aceite_plataforma = Column(String(45), nullable=True)
    data_aceite_plataforma = Column(DateTime, nullable=True)
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)
    cpf_aceite = Column(String(14), nullable=True)
    data_aceite = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    ip_aceite = Column(String(45), nullable=True)
    municipio_aceite = Column(String(255), nullable=True)

    auditoria = relationship("RegistroAuditoria")
    usuario = relationship("Usuario", back_populates="solicitacoes", foreign_keys=[usuario_id])
    credor = relationship("Usuario", foreign_keys=[credor_id], primaryjoin="SolicitacaoEmprestimo.credor_id == Usuario.id")

    from sqlalchemy import Index
    __table_args__ = (
        Index('idx_solicitacao_status_user', 'usuario_id', 'status'),
    )

class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), index=True)
    payment_id = Column(String(100), index=True, nullable=True) # ID externo (Mercado Pago, etc)
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    tipo = Column(Enum(TipoTransacao, name="tipo_transacao", values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    status = Column(String(50), default="pendente", index=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    detalhes = Column(String(500), nullable=True)  # limitado para economizar storage
    metodo = Column(String, default="pix", index=True)
    parceiro_id = Column(Integer, ForeignKey("parceiros.id"), nullable=True, index=True)
    
    # NOVOS: Protocolo de Recebimento do Cliente (Feedback)
    confirmado_cliente = Column(Boolean, default=False)
    data_confirmacao_cliente = Column(DateTime, nullable=True)
    
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)

    auditoria = relationship("RegistroAuditoria")
    usuario = relationship("Usuario", back_populates="transacoes")

    from sqlalchemy import Index
    __table_args__ = (
        Index('idx_transacao_user_status', 'usuario_id', 'status'),
        Index('idx_transacao_parceiro_status', 'parceiro_id', 'status'),
        Index('idx_transacao_tipo_status', 'tipo', 'status'),
        Index('idx_transacao_data', 'data_criacao'),
    )


class Parceiro(Base):
    __tablename__ = "parceiros"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    razao_social = Column(String(255), nullable=True)
    cnpj = Column(String(18), unique=True, index=True, nullable=True)
    cnpj_status = Column(String(30), default="pendente", index=True)
    cnpj_validado_em = Column(DateTime, nullable=True)
    endereco = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True, index=True)

    # Mercado Pago Marketplace (Custódia Descentralizada)
    mp_access_token = Column(String(255), nullable=True)
    mp_refresh_token = Column(String(255), nullable=True)
    mp_user_id = Column(String(100), nullable=True)
    mp_token_expires_at = Column(DateTime, nullable=True)

    usuario = relationship("Usuario")

class LinkAfiliado(Base):
    __tablename__ = "links_afiliados"

    id = Column(Integer, primary_key=True, index=True)
    nome_produto = Column(String(150), nullable=False)
    descricao = Column(Text, nullable=True)
    categoria = Column(String(50), default="Geral", index=True)
    url_afiliado = Column(String(500), nullable=False)
    url_imagem = Column(String(500), nullable=True)
    valor = Column(Numeric(10, 2), default=0.00)
    is_active = Column(Boolean, default=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    # Novos campos para Marketplace
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True, index=True)
    is_boosted = Column(Boolean, default=False)
    visualizacoes_restantes = Column(Integer, default=50) # Bônus inicial de 50 views
    visualizacoes_totais = Column(Integer, default=0)
    data_expiracao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24))
    nota = Column(Numeric(2, 1), default=0.0)  # Rating 0.0 a 5.0 (média)
    total_avaliacoes = Column(Integer, default=0)
    vendas_texto = Column(String(50), nullable=True)  # Ex: "8mil+ vendas"
    denuncias_count = Column(Integer, default=0)
    
    # Controle de pontos (Gamificação)
    ponto_min = Column(Integer, default=1)
    ponto_max = Column(Integer, default=1)

    usuario = relationship("Usuario")

    from sqlalchemy import Index
    __table_args__ = (
        Index('idx_link_is_active', 'is_active'),
    )

class AcaoAdmin(Base):
    __tablename__ = "acoes_admin"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(String(5), ForeignKey("usuarios.id"))
    alvo_id = Column(String(100), nullable=True)
    acao = Column(String(100), nullable=False)
    detalhes = Column(Text, nullable=True)
    ip = Column(String(45), nullable=True)
    data_acao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    admin = relationship("Usuario")

class DenunciaLink(Base):
    __tablename__ = "denuncias_links"
    
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False)
    motivo = Column(String(200), nullable=True)
    data_denuncia = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    link = relationship("LinkAfiliado")
    usuario = relationship("Usuario")

class AvaliacaoLink(Base):
    __tablename__ = "avaliacoes_links"
    
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False)
    nota = Column(Integer, nullable=False) # 1 a 5
    data_avaliacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    link = relationship("LinkAfiliado")
    usuario = relationship("Usuario")

class DocumentoVerificacao(Base):
    __tablename__ = "documentos_verificacao"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, unique=True)
    caminho_rg = Column(String(500), nullable=True)
    caminho_renda = Column(String(500), nullable=True)
    caminho_residencia = Column(String(500), nullable=True)
    status = Column(String(50), default="pendente") # pendente, aprovado, rejeitado
    motivo_rejeicao = Column(String(200), nullable=True)
    data_envio = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_analise = Column(DateTime, nullable=True)
    
    usuario = relationship("Usuario")

class HistoricoClique(Base):
    """Tabela para garantir que cliques sejam únicos para ganho de pontos (máx 1 per Link per User per 24h)."""
    __tablename__ = "historico_cliques_marketplace"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    data_clique = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    usuario = relationship("Usuario")
    link = relationship("LinkAfiliado")

class Indicacao(Base):
    """Tabela de rede de indicacoes. Um usuario pode ser indicado por varias pessoas diferentes."""
    __tablename__ = "indicacoes"
    
    id = Column(Integer, primary_key=True, index=True)
    indicador_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    indicado_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    indicador = relationship("Usuario", foreign_keys=[indicador_id])
    indicado = relationship("Usuario", foreign_keys=[indicado_id])
    
    __table_args__ = (
        # Garante que a mesma pessoa nao pode indicar o mesmo usuario 2x
        {'sqlite_autoincrement': True},
    )

class CodigoOTPLog(Base):
    """Tabela de auditoria para rastrear todos os códigos OTP enviados."""
    __tablename__ = "codigos_otp_log"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)  # 'email' ou 'telefone'
    codigo_hash = Column(String(200), nullable=False)  # Hash SHA256 do código (nunca o código limpo)
    destino = Column(String(255), nullable=False)  # Email ou telefone mascarado
    enviado_com_sucesso = Column(Boolean, default=False)
    metodo = Column(String(50), nullable=False)  # 'resend', 'callmebot', 'console'
    ip_origem = Column(String(45), nullable=True)
    user_agent = Column(String(200), nullable=True)
    data_envio = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_expiracao = Column(DateTime, nullable=False)
    
    usuario = relationship("Usuario")

class RankingHistorico(Base):
    """Armazena snapshots dos rankings semanais antes do reset sabado 18h."""
    __tablename__ = "ranking_historico"
    
    id = Column(Integer, primary_key=True, index=True)
    data_reset = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    dados_json = Column(Text, nullable=False)
    total_pontos = Column(Integer, default=0)
    total_premio = Column(Numeric(10, 2), default=0)
    status = Column(String(20), default="pago")  # pago, conferido
    conferido_por = Column(String(5), ForeignKey("usuarios.id"), nullable=True)
    data_conferido = Column(DateTime, nullable=True)
