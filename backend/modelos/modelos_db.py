from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, Boolean, Text, Index
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
    # === TIPOS DEPRECADOS (remover em migracao futura) ===
    # DEPOSITO e SAQUE removidos pois a Trocaria nao e instituicao financeira
    # e nao pode segurar dinheiro de usuarios (Lei 12.865/2013, Lei 4.595/1964)
    DEPOSITO = "deposito"  # DEPRECATED: nao usar
    SAQUE = "saque"  # DEPRECATED: nao usar
    
    # === TIPOS VALIDOS (taxas de servico e registros P2P) ===
    INVESTIMENTO = "investimento"  # Registro de intencao de investimento (nao movimenta dinheiro)
    RECEBIMENTO = "recebimento"  # Confirmacao de recebimento P2P
    COMPRA_SCORE = "compra_score"  # Taxa de servico
    DESBLOQUEIO_DADOS = "desbloqueio_dados"  # Taxa de servico (KYC)
    TAXA_SAQUE = "taxa_saque"  # DEPRECATED: renomear para taxa_cobranca
    TAXA_SERVICO = "taxa_servico"  # Taxa generica de servico (substitui intermediacao)
    TAXA_MATCH = "taxa_match"  # Taxa de publicacao/match
    TAXA_ESPECIE = "taxa_especie"  # DEPRECATED
    PAGAMENTO_PARCELA = "pagamento_parcela"  # Registro de confirmacao P2P
    TAXA_POSTAGEM = "taxa_postagem"  # Taxa de destaque no marketplace
    TAXA_ADM_EMPRESTIMO = "taxa_adm_emprestimo"  # Taxa de uso de ferramenta de cobranca
    TAXA_SOLICITACAO = "taxa_solicitacao"  # Taxa de publicacao de pedido
    TAXA_ORIGEM = "taxa_origem"  # Taxa de servico
    CONFIRMACAO_PAGAMENTO = "confirmacao_pagamento"  # Registro P2P (investidor confirma pagamento)
    CONFIRMACAO_RECEBIMENTO = "confirmacao_recebimento"  # Registro P2P (tomador confirma recebimento)
    ASSINATURA = "assinatura"  # Assinatura Premium (taxa de servico)
    RESGATE_PONTOS = "resgate_pontos"  # Premiacao do ranking (pago via PIX direto)
    BONUS = "bonus"  # Pontos de indicacao (sem valor monetario direto)
    
    # === TIPOS DEPRECADOS DE POOL/CAPITAL (remover em migracao) ===
    APORTE_CAPITAL = "aporte_capital"  # DEPRECATED: nao usar
    APORTE_CAIXA = "aporte_caixa"  # DEPRECATED: nao usar
    RESGATE_CAIXA = "resgate_caixa"  # DEPRECATED: nao usar
    APORTE_POOL = "aporte_pool"  # DEPRECATED: nao usar
    RESGATE_POOL = "resgate_pool"  # DEPRECATED: nao usar
    RETORNO_INVESTIMENTO = "retorno_investimento"  # DEPRECATED: nao usar
    RETORNO_POOL = "retorno_pool"  # DEPRECATED: nao usar
    ABERTURA_GAVETA = "abertura_gaveta"  # DEPRECATED: nao usar
    FECHAMENTO_GAVETA = "fechamento_gaveta"  # DEPRECATED: nao usar
    BONUS_PAGADOR_CAIXA = "bonus_pagador_caixa"  # DEPRECATED: nao usar
    COMISSAO_PARCEIRO = "comissao_parceiro"  # DEPRECATED: nao usar
    TAXA_DEPOSITO_VIRTUAL = "taxa_deposito_virtual"  # DEPRECATED: nao usar
    TAXA_INTERMEDIACAO = "taxa_intermediacao"  # DEPRECATED: renomeado para taxa_servico

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
    # DEPRECATED: saldo e saldo_caixa serao removidos na proxima migracao.
    # A Trocaria nao segura dinheiro de usuarios (Lei 12.865/2013, art. 8o).
    saldo = Column(Numeric(precision=20, scale=2), default=0)
    saldo_caixa = Column(Numeric(precision=20, scale=2), default=0)
    valor_emprestado = Column(Numeric(precision=20, scale=2), default=0)
    inadimplente = Column(Boolean, default=False)
    emprestimos_ativos = Column(Integer, default=0)
    emprestimos_concluidos = Column(Integer, default=0)
    score = Column(Numeric(precision=6, scale=1), default=0)
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

    # Verificação de Email (Firebase)
    email_verificado = Column(Boolean, default=False)
    telefone_verificado = Column(Boolean, default=False)

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

    # Mercado Pago Marketplace (OAuth)
    mp_access_token = Column(String(255), nullable=True)
    mp_refresh_token = Column(String(255), nullable=True)
    mp_user_id = Column(String(100), nullable=True)
    mp_token_expires_at = Column(DateTime, nullable=True)

    vendas_completadas = Column(Integer, default=0)

    # Foto de Perfil
    foto_perfil = Column(String(500), nullable=True)

    # Indicacao (Referral)
    codigo_indicacao = Column(String(10), unique=True, index=True, nullable=True)
    indicado_por = Column(String(5), ForeignKey("usuarios.id"), nullable=True)

    # Admin: suspensão de usuário
    motivo_suspensao = Column(String(200), nullable=True)
    data_suspensao = Column(DateTime, nullable=True)
    
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
    nome_produto = Column(String(90), nullable=False)  # OLX: max 90 chars
    descricao = Column(Text, nullable=True)  # OLX: max 6000 chars
    categoria = Column(String(50), default="Geral", index=True)
    url_afiliado = Column(String(500), nullable=False)
    valor = Column(Numeric(10, 2), nullable=False)  # Preco obrigatorio
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

    from sqlalchemy import Index
    __table_args__ = (
        Index('idx_link_is_active', 'is_active'),
        Index('idx_link_nome', 'nome_produto'),
    )


class ImagemAnuncio(Base):
    """Imagens de anuncios (max 6 por anuncio, comprimidas para 500KB)."""
    __tablename__ = "imagens_anuncios"
    
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    caminho_arquivo = Column(String(500), nullable=False)
    ordem = Column(Integer, default=0)  # Ordem de exibicao
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    anuncio = relationship("LinkAfiliado", back_populates="imagens")


class OfertaAnuncio(Base):
    """Sistema de ofertas estilo OLX: comprador propoe preco, vendedor aceita/recusa em 48h."""
    __tablename__ = "ofertas_anuncios"
    
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    ofertante_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    valor_oferta = Column(Numeric(10, 2), nullable=False)
    status = Column(String(20), default="pendente")  # pendente, aceita, recusada, expirada
    
    data_oferta = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_expiracao = Column(DateTime, nullable=False)  # 48h apos a oferta
    data_resposta = Column(DateTime, nullable=True)
    
    anuncio = relationship("LinkAfiliado", back_populates="ofertas")
    ofertante = relationship("Usuario", foreign_keys=[ofertante_id])


class BloqueioUsuario(Base):
    """Bloqueio user-to-user: usuario bloqueia outro para nao ver seus anuncios."""
    __tablename__ = "bloqueios_usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    bloqueador_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    bloqueado_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    data_bloqueio = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    bloqueador = relationship("Usuario", foreign_keys=[bloqueador_id])
    bloqueado = relationship("Usuario", foreign_keys=[bloqueado_id])
    
    __table_args__ = (
        # Evita bloqueio duplicado
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

class DenunciaUsuario(Base):
    """Denúncias de usuários por mau comportamento (calote, golpe, etc)."""
    __tablename__ = "denuncias_usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    denunciante_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    denunciado_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    motivo = Column(String(200), nullable=True)
    status = Column(String(20), default="pendente")  # pendente, revisado, suspenso
    data_denuncia = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    denunciante = relationship("Usuario", foreign_keys=[denunciante_id])
    denunciado = relationship("Usuario", foreign_keys=[denunciado_id])


class Disputa(Base):
    """Sistema de disputas e mediação entre usuários (Tomador x Investidor)."""
    __tablename__ = "disputas"
    
    id = Column(Integer, primary_key=True, index=True)
    solicitacao_emprestimo_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id"), nullable=False, index=True)
    
    # Partes envolvidas
    requerente_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    requerido_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    # Tipo e descrição
    tipo = Column(String(50), nullable=False)  # nao_recebimento, valor_incorreto, calote, fraude, outro
    descricao = Column(Text, nullable=False)
    evidencias = Column(Text, nullable=True)  # JSON com URLs ou descrições de evidências
    
    # Status do processo de mediação
    status = Column(String(30), default="aberta")  # aberta, em_analise, mediando, resolvida, encaminhada_judicial, cancelada
    
    # Resolução
    decisao = Column(Text, nullable=True)  # Descrição da decisão da mediação
    decisao_favoravel_a = Column(String(5), ForeignKey("usuarios.id"), nullable=True)  # Quem ganhou a disputa
    valor_ressarcimento = Column(Numeric(precision=20, scale=2), nullable=True)
    
    # Prazos
    data_abertura = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_analise = Column(DateTime, nullable=True)  # Quando um analista pegou o caso
    data_resolucao = Column(DateTime, nullable=True)
    data_limite_resposta = Column(DateTime, nullable=True)  # Prazo para o requerido responder
    
    # Analista responsável (admin)
    analista_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True)
    
    # Comunicações
    resposta_requerido = Column(Text, nullable=True)
    data_resposta_requerido = Column(DateTime, nullable=True)
    
    # Auditoria
    ip_abertura = Column(String(45), nullable=True)
    user_agent_abertura = Column(String(200), nullable=True)
    
    requerente = relationship("Usuario", foreign_keys=[requerente_id])
    requerido = relationship("Usuario", foreign_keys=[requerido_id])
    analista = relationship("Usuario", foreign_keys=[analista_id])
    decisao_favoravel = relationship("Usuario", foreign_keys=[decisao_favoravel_a])
    solicitacao = relationship("SolicitacaoEmprestimo")


class ContratoMutuo(Base):
    """Contratos digitais de mútuo entre particulares (prova de nao-intermediacao)."""
    __tablename__ = "contratos_mutuo"
    
    id = Column(Integer, primary_key=True, index=True)
    numero_contrato = Column(String(50), unique=True, nullable=False, index=True)
    
    # Partes
    tomador_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    investidor_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    # Operação vinculada
    solicitacao_emprestimo_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id"), nullable=False)
    
    # Valores
    valor_principal = Column(Numeric(precision=20, scale=2), nullable=False)
    taxa_juros_mensal = Column(Numeric(precision=5, scale=2), nullable=False)
    prazo_meses = Column(Integer, nullable=False)
    
    # Status do contrato
    status = Column(String(30), default="pendente")  # pendente, ativo, quitado, inadimplente, cancelado
    
    # Assinaturas digitais
    tomador_aceite = Column(Boolean, default=False)
    tomador_data_aceite = Column(DateTime, nullable=True)
    tomador_ip = Column(String(45), nullable=True)
    tomador_hash = Column(String(200), nullable=True)
    
    investidor_aceite = Column(Boolean, default=False)
    investidor_data_aceite = Column(DateTime, nullable=True)
    investidor_ip = Column(String(45), nullable=True)
    investidor_hash = Column(String(200), nullable=True)
    
    # Termo de ciência de risco
    termo_risco_aceite = Column(Boolean, default=False)
    termo_risco_hash = Column(String(200), nullable=True)
    
    # Hash de integridade do contrato completo
    hash_integridade = Column(String(200), nullable=False)
    
    # JSON do contrato completo
    contrato_json = Column(Text, nullable=False)
    
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_atualizacao = Column(DateTime, nullable=True)
    
    tomador = relationship("Usuario", foreign_keys=[tomador_id])
    investidor = relationship("Usuario", foreign_keys=[investidor_id])
    solicitacao = relationship("SolicitacaoEmprestimo")


class ExtratoPontos(Base):
    """Extrato permanente de pontos do usuario (nunca reseta). Cada entrada e credito ou debito."""
    __tablename__ = "extrato_pontos"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    # Tipo de acao que gerou os pontos
    tipo = Column(String(50), nullable=False)  # view_anuncio, conversa, indicacao, postagem, kyc, taxa_publicacao, taxa_match, taxa_destaque, taxa_boost, assinatura, cashback, resgate
    
    # Quantidade de pontos (positivo = ganhou, negativo = resgatou)
    pontos = Column(Integer, nullable=False)
    
    # Valor monetario referencia (para cashback proporcional)
    valor_referencia = Column(Numeric(precision=10, scale=2), nullable=True)
    
    # Detalhes
    detalhes = Column(String(255), nullable=True)
    
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    
    usuario = relationship("Usuario")
    
    __table_args__ = (
        Index('idx_extrato_user_data', 'usuario_id', 'data_criacao'),
        Index('idx_extrato_tipo', 'tipo'),
    )


class ResgatePontos(Base):
    """Solicitacoes de resgate de pontos em dinheiro via PIX (da conta da empresa CNPJ)."""
    __tablename__ = "resgates_pontos"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    # Pontos resgatados (negativo no extrato)
    pontos = Column(Integer, nullable=False)
    
    # Valor em reais
    valor = Column(Numeric(precision=10, scale=2), nullable=False)
    
    # Chave PIX para recebimento
    chave_pix = Column(String(255), nullable=False)
    
    # Status
    status = Column(String(20), default="pendente")  # pendente, processando, pago, falhou
    
    # Dados do PIX gerado (para confirmacao)
    payment_id = Column(String(100), nullable=True)
    
    # Detalhes
    detalhes = Column(String(255), nullable=True)
    
    data_solicitacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_pagamento = Column(DateTime, nullable=True)
    
    usuario = relationship("Usuario")
    
    __table_args__ = (
        Index('idx_resgate_user_status', 'usuario_id', 'status'),
    )


class ConfirmacaoVenda(Base):
    """Confirmacao bilateral de venda P2P. Ambos devem confirmar para gerar score."""
    __tablename__ = "confirmacoes_venda"
    
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False, index=True)
    vendedor_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    comprador_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    # Confirmacao do vendedor
    vendedor_confirmou = Column(Boolean, default=False)
    data_confirmacao_vendedor = Column(DateTime, nullable=True)
    
    # Confirmacao do comprador
    comprador_confirmou = Column(Boolean, default=False)
    data_confirmacao_comprador = Column(DateTime, nullable=True)
    
    # Avaliacao do comprador sobre o vendedor (1-5)
    avaliacao_comprador = Column(Integer, nullable=True)
    # Avaliacao do vendedor sobre o comprador (1-5)
    avaliacao_vendedor = Column(Integer, nullable=True)
    
    status = Column(String(20), default="pendente")  # pendente, confirmada, expirada, disputada
    
    data_criacao = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    data_expiracao = Column(DateTime, nullable=False)
    
    link = relationship("LinkAfiliado")
    vendedor = relationship("Usuario", foreign_keys=[vendedor_id])
    comprador = relationship("Usuario", foreign_keys=[comprador_id])
    
    __table_args__ = (
        Index('idx_confirmacao_link', 'link_id'),
        Index('idx_confirmacao_status', 'status'),
    )


class ConsentimentoLGPD(Base):
    """Registro de consentimentos LGPD dos usuarios para rastreabilidade legal."""
    __tablename__ = "consentimentos_lgpd"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False, index=True)
    
    tipo_consentimento = Column(String(100), nullable=False)  # termos_uso, privacidade, marketing, cookies, kyc
    versao_documento = Column(String(20), nullable=False)  # Ex: "2.0"
    
    aceite = Column(Boolean, default=False)
    data_aceite = Column(DateTime, nullable=True)
    data_revogacao = Column(DateTime, nullable=True)
    
    ip_aceite = Column(String(45), nullable=True)
    user_agent_aceite = Column(String(200), nullable=True)
    
    usuario = relationship("Usuario")
