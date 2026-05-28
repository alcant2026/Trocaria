from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, Boolean, Text, Index
from sqlalchemy.orm import relationship
import datetime
import enum
from database import Base

class TipoTransacao(enum.Enum):
    DESBLOQUEIO_DADOS = "desbloqueio_dados"
    TAXA_SERVICO = "taxa_servico"
    TAXA_POSTAGEM = "taxa_postagem"
    ASSINATURA = "assinatura"
    BONUS = "bonus"

class RegistroAuditoria(Base):
    __tablename__ = "registros_auditoria"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String(45), nullable=False)
    municipio = Column(String(100), nullable=True)
    user_agent = Column(String(200), nullable=True)
    data_registro = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(5), primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    cpf = Column(String(14), unique=True, index=True, nullable=False)
    senha_hash = Column(Text, nullable=False)
    chave_pix = Column(String(255), nullable=False)

    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    selfie_url = Column(String(500), nullable=True)
    selfie_verificada = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

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

    email_verificado = Column(Boolean, default=False)
    telefone_verificado = Column(Boolean, default=False)

    storage_tier = Column(String(20), default="free")
    is_premium = Column(Boolean, default=False)
    premium_expira_em = Column(DateTime, nullable=True)
    storage_used_mb = Column(Numeric(10, 2), default=0)
    storage_limit_mb = Column(Integer, default=10)

    is_subscriber = Column(Boolean, default=False)
    assinatura_expira_em = Column(DateTime, nullable=True)
    pontos_marketplace = Column(Integer, default=0)
    pontos_semanais = Column(Integer, default=0)

    mp_access_token = Column(String(255), nullable=True)
    mp_refresh_token = Column(String(255), nullable=True)
    mp_user_id = Column(String(100), nullable=True)
    mp_token_expires_at = Column(DateTime, nullable=True)

    vendas_completadas = Column(Integer, default=0)
    foto_perfil = Column(String(500), nullable=True)
    comissao_devida = Column(Numeric(10, 2), default=0)
    comissao_paga_em = Column(DateTime, nullable=True)

    codigo_indicacao = Column(String(10), unique=True, index=True, nullable=True)
    indicado_por = Column(String(5), ForeignKey("usuarios.id"), nullable=True)

    motivo_suspensao = Column(String(200), nullable=True)
    data_suspensao = Column(DateTime, nullable=True)

    transacoes = relationship("Transacao", back_populates="usuario")

class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), index=True)
    payment_id = Column(String(100), index=True, nullable=True)
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    tipo = Column(Enum(TipoTransacao, name="tipo_transacao", values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    status = Column(String(50), default="pendente", index=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    detalhes = Column(String(500), nullable=True)
    metodo = Column(String, default="pix", index=True)

    confirmado_cliente = Column(Boolean, default=False)
    data_confirmacao_cliente = Column(DateTime, nullable=True)

    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)

    auditoria = relationship("RegistroAuditoria")
    usuario = relationship("Usuario", back_populates="transacoes")

    __table_args__ = (
        Index('idx_transacao_user_status', 'usuario_id', 'status'),
        Index('idx_transacao_tipo_status', 'tipo', 'status'),
        Index('idx_transacao_data', 'data_criacao'),
    )

class LinkAfiliado(Base):
    __tablename__ = "links_afiliados"

    id = Column(Integer, primary_key=True, index=True)
    nome_produto = Column(String(90), nullable=False)
    descricao = Column(Text, nullable=True)
    categoria = Column(String(50), default="Geral", index=True)
    url_afiliado = Column(String(500), nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True, index=True)
    is_boosted = Column(Boolean, default=False)
    visualizacoes_restantes = Column(Integer, default=50)
    visualizacoes_totais = Column(Integer, default=0)
    data_expiracao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24))
    nota = Column(Numeric(2, 1), default=0.0)
    total_avaliacoes = Column(Integer, default=0)
    vendas_texto = Column(String(50), nullable=True)
    denuncias_count = Column(Integer, default=0)

    cidade = Column(String(100), nullable=True)
    estado = Column(String(50), nullable=True)

    ponto_min = Column(Integer, default=1)
    ponto_max = Column(Integer, default=1)

    usuario = relationship("Usuario")
    imagens = relationship("ImagemAnuncio", back_populates="anuncio", cascade="all, delete-orphan")
    ofertas = relationship("OfertaAnuncio", back_populates="anuncio", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_link_is_active', 'is_active'),
        Index('idx_link_nome', 'nome_produto'),
    )

class ImagemAnuncio(Base):
    __tablename__ = "imagens_anuncios"

    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    caminho_arquivo = Column(String(500), nullable=False)
    ordem = Column(Integer, default=0)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    anuncio = relationship("LinkAfiliado", back_populates="imagens")

class OfertaAnuncio(Base):
    __tablename__ = "ofertas_anuncios"

    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    ofertante_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)

    valor_oferta = Column(Numeric(10, 2), nullable=False)
    pontos_usar = Column(Integer, default=0)
    valor_pix = Column(Numeric(10, 2), nullable=True)
    status = Column(String(20), default="pendente")

    data_oferta = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_expiracao = Column(DateTime, nullable=False)
    data_resposta = Column(DateTime, nullable=True)

    anuncio = relationship("LinkAfiliado", back_populates="ofertas")
    ofertante = relationship("Usuario", foreign_keys=[ofertante_id])

class BloqueioUsuario(Base):
    __tablename__ = "bloqueios_usuarios"

    id = Column(Integer, primary_key=True, index=True)
    bloqueador_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    bloqueado_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    data_bloqueio = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    bloqueador = relationship("Usuario", foreign_keys=[bloqueador_id])
    bloqueado = relationship("Usuario", foreign_keys=[bloqueado_id])

    __table_args__ = (
        Index('idx_bloqueio_unico', 'bloqueador_id', 'bloqueado_id', unique=True),
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
    nota = Column(Integer, nullable=False)
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
    status = Column(String(50), default="pendente")
    motivo_rejeicao = Column(String(200), nullable=True)
    data_envio = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_analise = Column(DateTime, nullable=True)

    usuario = relationship("Usuario")

class HistoricoClique(Base):
    __tablename__ = "historico_cliques_marketplace"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    data_clique = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    usuario = relationship("Usuario")
    link = relationship("LinkAfiliado")

class Indicacao(Base):
    __tablename__ = "indicacoes"

    id = Column(Integer, primary_key=True, index=True)
    indicador_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    indicado_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    indicador = relationship("Usuario", foreign_keys=[indicador_id])
    indicado = relationship("Usuario", foreign_keys=[indicado_id])

class CodigoOTPLog(Base):
    __tablename__ = "codigos_otp_log"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    codigo_hash = Column(String(200), nullable=False)
    destino = Column(String(255), nullable=False)
    enviado_com_sucesso = Column(Boolean, default=False)
    metodo = Column(String(50), nullable=False)
    ip_origem = Column(String(45), nullable=True)
    user_agent = Column(String(200), nullable=True)
    data_envio = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_expiracao = Column(DateTime, nullable=False)

    usuario = relationship("Usuario")

class RankingHistorico(Base):
    __tablename__ = "ranking_historico"

    id = Column(Integer, primary_key=True, index=True)
    data_reset = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), index=True)
    dados_json = Column(Text, nullable=False)
    total_pontos = Column(Integer, default=0)
    total_premio = Column(Numeric(10, 2), default=0)
    status = Column(String(20), default="pago")
    conferido_por = Column(String(5), ForeignKey("usuarios.id"), nullable=True)
    data_conferido = Column(DateTime, nullable=True)

class DenunciaUsuario(Base):
    __tablename__ = "denuncias_usuarios"

    id = Column(Integer, primary_key=True, index=True)
    denunciante_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    denunciado_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    motivo = Column(String(200), nullable=True)
    status = Column(String(20), default="pendente")
    data_denuncia = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    denunciante = relationship("Usuario", foreign_keys=[denunciante_id])
    denunciado = relationship("Usuario", foreign_keys=[denunciado_id])

class ExtratoPontos(Base):
    __tablename__ = "extrato_pontos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)

    tipo = Column(String(50), nullable=False)
    pontos = Column(Integer, nullable=False)
    valor_referencia = Column(Numeric(precision=10, scale=2), nullable=True)
    detalhes = Column(String(255), nullable=True)

    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    usuario = relationship("Usuario")

    __table_args__ = (
        Index('idx_extrato_user_data', 'usuario_id', 'data_criacao'),
        Index('idx_extrato_tipo', 'tipo'),
    )

class ResgatePontos(Base):
    __tablename__ = "resgates_pontos"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)

    pontos = Column(Integer, nullable=False)
    tipo_beneficio = Column(String(50), nullable=False)
    alvo_id = Column(Integer, nullable=True)
    status = Column(String(20), default="pendente")
    detalhes = Column(String(255), nullable=True)

    data_solicitacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_processamento = Column(DateTime, nullable=True)

    usuario = relationship("Usuario")

    __table_args__ = (
        Index('idx_resgate_user_status', 'usuario_id', 'status'),
    )

class ConfirmacaoVenda(Base):
    __tablename__ = "confirmacoes_venda"

    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    vendedor_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    comprador_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)

    vendedor_confirmou = Column(Boolean, default=False)
    data_confirmacao_vendedor = Column(DateTime, nullable=True)

    comprador_confirmou = Column(Boolean, default=False)
    data_confirmacao_comprador = Column(DateTime, nullable=True)

    avaliacao_comprador = Column(Integer, nullable=True)
    avaliacao_vendedor = Column(Integer, nullable=True)

    pontos_usados = Column(Integer, default=0)
    pontos_bonus_vendedor = Column(Integer, default=0)
    pontos_queimados = Column(Boolean, default=False)

    status = Column(String(20), default="pendente")

    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_expiracao = Column(DateTime, nullable=False)

    link = relationship("LinkAfiliado")
    vendedor = relationship("Usuario", foreign_keys=[vendedor_id])
    comprador = relationship("Usuario", foreign_keys=[comprador_id])

    __table_args__ = (
        Index('idx_confirmacao_link', 'link_id'),
        Index('idx_confirmacao_status', 'status'),
    )

class AcordoTroca(Base):
    __tablename__ = "acordos_troca"

    id = Column(Integer, primary_key=True, index=True)

    anuncio_a_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    anuncio_b_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)

    usuario_a_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    usuario_b_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)

    etapa_a_entregou = Column(Boolean, default=False)
    etapa_b_recebeu_entregou = Column(Boolean, default=False)
    etapa_a_recebeu = Column(Boolean, default=False)

    status = Column(String(20), default="pendente")

    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_expiracao = Column(DateTime, nullable=False)

    anuncio_a = relationship("LinkAfiliado", foreign_keys=[anuncio_a_id])
    anuncio_b = relationship("LinkAfiliado", foreign_keys=[anuncio_b_id])
    usuario_a = relationship("Usuario", foreign_keys=[usuario_a_id])
    usuario_b = relationship("Usuario", foreign_keys=[usuario_b_id])

    __table_args__ = (
        Index('idx_troca_status', 'status'),
        Index('idx_troca_usuario_a', 'usuario_a_id'),
        Index('idx_troca_usuario_b', 'usuario_b_id'),
    )

class ProdutoResgate(Base):
    __tablename__ = "produtos_resgate"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    foto_url = Column(String(500), nullable=True)
    valor_reais = Column(Numeric(10, 2), nullable=False)
    pontos_minimos = Column(Integer, nullable=False)
    quantidade_disponivel = Column(Integer, default=1)
    status = Column(String(20), default="ativo")
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_atualizacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc), onupdate=lambda: datetime.datetime.now(datetime.timezone.utc))


class SolicitacaoResgateProduto(Base):
    __tablename__ = "solicitacoes_resgate_produto"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, ForeignKey("produtos_resgate.id"), nullable=False)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False)
    pontos_gastos = Column(Integer, nullable=False)
    status = Column(String(20), default="pendente")
    data_solicitacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    produto = relationship("ProdutoResgate")
    usuario = relationship("Usuario")


class Disputa(Base):
    __tablename__ = "disputas"

    id = Column(Integer, primary_key=True, index=True)
    confirmacao_venda_id = Column(Integer, ForeignKey("confirmacoes_venda.id"), nullable=False, index=True)
    abridor_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    motivo = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    status = Column(String(20), default="aberta")
    decisao = Column(String(100), nullable=True)
    admin_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True)
    notapublica = Column(Text, nullable=True)
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_resolucao = Column(DateTime, nullable=True)

    confirmacao = relationship("ConfirmacaoVenda")
    abridor = relationship("Usuario", foreign_keys=[abridor_id])
    admin = relationship("Usuario", foreign_keys=[admin_id])

    __table_args__ = (
        Index('idx_disputa_status', 'status'),
        Index('idx_disputa_abridor', 'abridor_id'),
    )


class ConsentimentoLGPD(Base):
    __tablename__ = "consentimentos_lgpd"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)

    tipo_consentimento = Column(String(100), nullable=False)
    versao_documento = Column(String(20), nullable=False)

    aceite = Column(Boolean, default=False)
    data_aceite = Column(DateTime, nullable=True)
    data_revogacao = Column(DateTime, nullable=True)

    ip_aceite = Column(String(45), nullable=True)
    user_agent_aceite = Column(String(200), nullable=True)

    usuario = relationship("Usuario")
