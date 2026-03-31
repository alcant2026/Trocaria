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
    TAXA_ESPECIE = "taxa_especie"
    APORTE_CAPITAL = "aporte_capital"
    PAGAMENTO_PARCELA = "pagamento_parcela"
    TAXA_POSTAGEM = "taxa_postagem"
    RETORNO_INVESTIMENTO = "retorno_investimento"
    APORTE_CAIXA = "aporte_caixa"
    RESGATE_CAIXA = "resgate_caixa"
    BONUS_PAGADOR_CAIXA = "bonus_pagador_caixa"
    RETORNO_POOL = "retorno_pool"
    COMISSAO_PARCEIRO = "comissao_parceiro"
    TAXA_ADM_EMPRESTIMO = "taxa_adm_emprestimo"
    ASSINATURA = "assinatura"

class RegistroAuditoria(Base):
    __tablename__ = "registros_auditoria"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String(45), nullable=False)
    municipio = Column(String(255), nullable=True)
    user_agent = Column(Text, nullable=True)
    data_registro = Column(DateTime, default=datetime.datetime.utcnow)

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(5), primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    cpf = Column(String(14), unique=True, index=True, nullable=False)
    senha_hash = Column(Text, nullable=False)
    chave_pix = Column(String(255), nullable=False)
    saldo = Column(Numeric(precision=20, scale=2), default=0)
    saldo_caixa = Column(Numeric(precision=20, scale=2), default=0) # Saldo no Pool de Investimentos
    score = Column(Numeric(precision=6, scale=1), default=0)
    score_anterior = Column(Numeric(precision=6, scale=1), default=0)
    ultima_solicitacao = Column(DateTime, nullable=True)
    solicitacoes_hoje = Column(Integer, default=0)
    ultima_atualizacao_score = Column(DateTime, default=datetime.datetime.utcnow)
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

    # NOVO: Assinatura Premium Marketplace
    is_subscriber = Column(Boolean, default=False)
    assinatura_expira_em = Column(DateTime, nullable=True)
    pontos_marketplace = Column(Integer, default=0)

    solicitacoes = relationship("SolicitacaoEmprestimo", back_populates="usuario")
    transacoes = relationship("Transacao", back_populates="usuario")

class SolicitacaoEmprestimo(Base):
    __tablename__ = "solicitacoes_emprestimo"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"))
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    taxa_juros = Column(Numeric(precision=5, scale=2), nullable=False)
    prazo_meses = Column(Integer, nullable=False)
    status = Column(Enum(StatusSolicitacao, name="status_solicitacao", values_callable=lambda x: [e.value for e in x]), default=StatusSolicitacao.PENDENTE, index=True)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    proximo_vencimento = Column(DateTime, nullable=True)
    parcelas_pagas = Column(Integer, default=0)
    taxas_adicionais = Column(Numeric(precision=20, scale=2), default=0)
    valor_amortizado = Column(Numeric(precision=20, scale=2), default=0)
    valor_arrecadado = Column(Numeric(precision=20, scale=2), default=0)
    tipo_garantia = Column(String(50), default="pool") # pool, avalista, objeto
    garantia_descricao = Column(Text, nullable=True)
    sugestao_pool = Column(Numeric(precision=20, scale=2), default=0)
    
    data_expiracao_4h = Column(DateTime, nullable=True) # Janela para entrega física
    data_expiracao_5d = Column(DateTime, nullable=True) # Prazo total para captação (se houver)

    parceiro_id = Column(Integer, ForeignKey("parceiros.id"), nullable=True)
    parceiro = relationship("Parceiro")

    aceite_termos = Column(Boolean, default=False)
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)
    cpf_aceite = Column(String(14), nullable=True)
    data_aceite = Column(DateTime, default=datetime.datetime.utcnow)
    ip_aceite = Column(String(45), nullable=True)
    municipio_aceite = Column(String(255), nullable=True)

    auditoria = relationship("RegistroAuditoria")
    usuario = relationship("Usuario", back_populates="solicitacoes")
    investimentos = relationship("Investimento", back_populates="solicitacao")

class Investimento(Base):
    __tablename__ = "investimentos"

    id = Column(Integer, primary_key=True, index=True)
    investidor_id = Column(String(5), ForeignKey("usuarios.id"))
    solicitacao_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id"))
    valor_investido = Column(Numeric(precision=20, scale=2), nullable=False)
    pago_para_investidor = Column(Numeric(precision=20, scale=2), default=0)
    data_investimento = Column(DateTime, default=datetime.datetime.utcnow)
    is_pool = Column(Boolean, default=True)

    solicitacao = relationship("SolicitacaoEmprestimo", back_populates="investimentos")
    investidor = relationship("Usuario")

class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"))
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    tipo = Column(Enum(TipoTransacao, name="tipo_transacao", values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    status = Column(String(50), default="pendente", index=True)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    
    detalhes = Column(Text, nullable=True)
    metodo = Column(String, default="pix")
    parceiro_id = Column(Integer, ForeignKey("parceiros.id"), nullable=True)
    
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)

    auditoria = relationship("RegistroAuditoria")
    usuario = relationship("Usuario", back_populates="transacoes")
    parceiro = relationship("Parceiro")

class Parceiro(Base):
    __tablename__ = "parceiros"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    endereco = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True)
    caixa_aberto = Column(Boolean, default=False)
    saldo_caixa_inicial = Column(Numeric(precision=20, scale=2), default=0)
    saldo_caixa_atual = Column(Numeric(precision=20, scale=2), default=0)
    comissoes_acumuladas = Column(Numeric(precision=20, scale=2), default=0)
    
    usuario = relationship("Usuario")

class LinkAfiliado(Base):
    __tablename__ = "links_afiliados"

    id = Column(Integer, primary_key=True, index=True)
    nome_produto = Column(String(150), nullable=False)
    url_afiliado = Column(String(500), nullable=False)
    url_imagem = Column(String(500), nullable=True)
    valor = Column(Numeric(10, 2), default=0.00)
    is_active = Column(Boolean, default=True)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Novos campos para Marketplace
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=True)
    is_boosted = Column(Boolean, default=False)
    visualizacoes_restantes = Column(Integer, default=50) # Bônus inicial de 50 views
    visualizacoes_totais = Column(Integer, default=0)
    data_expiracao = Column(DateTime, default=lambda: datetime.datetime.utcnow() + datetime.timedelta(hours=24))
    nota = Column(Numeric(2, 1), default=0.0)  # Rating 0.0 a 5.0 (média)
    total_avaliacoes = Column(Integer, default=0)
    vendas_texto = Column(String(50), nullable=True)  # Ex: "8mil+ vendas"
    denuncias_count = Column(Integer, default=0)
    
    # Controle de pontos (Gamificação)
    ponto_min = Column(Integer, default=1)
    ponto_max = Column(Integer, default=1)

    usuario = relationship("Usuario")

class AcaoAdmin(Base):
    __tablename__ = "acoes_admin"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(String(5), ForeignKey("usuarios.id"))
    alvo_id = Column(String(100), nullable=True)
    acao = Column(String(100), nullable=False)
    detalhes = Column(Text, nullable=True)
    ip = Column(String(45), nullable=True)
    data_acao = Column(DateTime, default=datetime.datetime.utcnow)

    admin = relationship("Usuario")

class DenunciaLink(Base):
    __tablename__ = "denuncias_links"
    
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False)
    motivo = Column(String(200), nullable=True)
    data_denuncia = Column(DateTime, default=datetime.datetime.utcnow)
    
    link = relationship("LinkAfiliado")
    usuario = relationship("Usuario")

class AvaliacaoLink(Base):
    __tablename__ = "avaliacoes_links"
    
    id = Column(Integer, primary_key=True, index=True)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False)
    nota = Column(Integer, nullable=False) # 1 a 5
    data_avaliacao = Column(DateTime, default=datetime.datetime.utcnow)
    
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
    data_envio = Column(DateTime, default=datetime.datetime.utcnow)
    data_analise = Column(DateTime, nullable=True)
    
    usuario = relationship("Usuario")

class HistoricoClique(Base):
    """Tabela para garantir que cliques sejam únicos para ganho de pontos (máx 1 per Link per User per 24h)."""
    __tablename__ = "historico_cliques_marketplace"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"), nullable=False)
    link_id = Column(Integer, ForeignKey("links_afiliados.id"), nullable=False)
    data_clique = Column(DateTime, default=datetime.datetime.utcnow)
    
    usuario = relationship("Usuario")
    link = relationship("LinkAfiliado")
