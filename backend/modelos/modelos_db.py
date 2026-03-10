from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Enum, Boolean
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
    APORTE_CAPITAL = "aporte_capital"
    PAGAMENTO_PARCELA = "pagamento_parcela"
    TAXA_POSTAGEM = "taxa_postagem"
    RETORNO_INVESTIMENTO = "retorno_investimento"
    APORTE_CAIXA = "aporte_caixa"
    RESGATE_CAIXA = "resgate_caixa"
    BONUS_PAGADOR_CAIXA = "bonus_pagador_caixa"
    RETORNO_POOL = "retorno_pool"

class RegistroAuditoria(Base):
    __tablename__ = "registros_auditoria"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, nullable=False)
    municipio = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    data_registro = Column(DateTime, default=datetime.datetime.utcnow)

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String(5), primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    cpf = Column(String(14), unique=True, index=True, nullable=False)
    senha_hash = Column(String(200), nullable=False)
    chave_pix = Column(String(100), nullable=False)
    saldo = Column(Numeric(precision=20, scale=2), default=0)
    saldo_bloqueado = Column(Numeric(precision=20, scale=2), default=0) # NOVO: Para garantidores
    saldo_caixa = Column(Numeric(precision=20, scale=2), default=0) # Saldo no Pool de Investimentos
    score = Column(Numeric(precision=6, scale=1), default=0)
    score_anterior = Column(Numeric(precision=6, scale=1), default=0) # Memória para restaurar após calote
    ultima_solicitacao = Column(DateTime, nullable=True)
    solicitacoes_hoje = Column(Integer, default=0)
    ultima_atualizacao_score = Column(DateTime, default=datetime.datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True) # Para LGPD / Deleção lógica
    
    # Localização do Usuário
    cidade = Column(String, nullable=True)
    estado = Column(String, nullable=True)
    
    # Proteção Jurídica: Aceite de Termos de Uso (Intermediação SaaS)
    aceite_termos = Column(Boolean, default=False)
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)
    
    auditoria = relationship("RegistroAuditoria")

    # Autenticação de Dois Fatores (2FA)
    totp_secret = Column(String, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)
    ultima_alteracao_2fa = Column(DateTime, nullable=True) # Trava de 48h para saques

    solicitacoes = relationship("SolicitacaoEmprestimo", back_populates="usuario")
    transacoes = relationship("Transacao", back_populates="usuario")
    garantias_prestadas = relationship("GarantiaSocial", back_populates="garante")

class SolicitacaoEmprestimo(Base):
    __tablename__ = "solicitacoes_emprestimo"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"))
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    valor_arrecadado = Column(Numeric(precision=20, scale=2), default=0)
    taxa_juros = Column(Numeric(precision=5, scale=2), nullable=False)
    prazo_meses = Column(Integer, nullable=False)
    status = Column(Enum(StatusSolicitacao, name="status_solicitacao", values_callable=lambda x: [e.value for e in x]), default=StatusSolicitacao.PENDENTE, index=True)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    data_expiracao_4h = Column(DateTime)
    data_expiracao_5d = Column(DateTime)
    proximo_vencimento = Column(DateTime, nullable=True) # Data para cobrança de juros de mora
    parcelas_pagas = Column(Integer, default=0)
    valor_amortizado = Column(Numeric(precision=20, scale=2), default=0) # Pagamentos de valor livre
    taxas_adicionais = Column(Numeric(precision=20, scale=2), default=0) # Taxas de R$ 1,50 acumuladas
    sugestao_pool = Column(Numeric(precision=20, scale=2), default=0) # Valor sugerido pelo sistema para o Pool investir
    
    # Blindagem Jurídica: Rastreabilidade de Aceite
    aceite_termos = Column(Boolean, default=False)
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)
    cpf_aceite = Column(String, nullable=True)
    data_aceite = Column(DateTime, default=datetime.datetime.utcnow)

    auditoria = relationship("RegistroAuditoria")

    usuario = relationship("Usuario", back_populates="solicitacoes")
    acessos_investidores = relationship("AcessoInvestidor", back_populates="solicitacao")
    investimentos = relationship("Investimento", back_populates="solicitacao")
    garantias_sociais = relationship("GarantiaSocial", back_populates="solicitacao", cascade="all, delete-orphan")

class Investimento(Base):
    __tablename__ = "investimentos"

    id = Column(Integer, primary_key=True, index=True)
    investidor_id = Column(String(5), ForeignKey("usuarios.id"))
    solicitacao_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id"))
    valor_investido = Column(Numeric(precision=20, scale=2), nullable=False)
    pago_para_investidor = Column(Numeric(precision=20, scale=2), default=0) # Total recebido de volta
    data_investimento = Column(DateTime, default=datetime.datetime.utcnow)
    ciencia_risco = Column(Boolean, default=False) # Blindagem jurídica: investidor deu aceite no risco
    
    # Blindagem Jurídica: Rastreabilidade
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)
    cpf_aceite = Column(String, nullable=True)
    is_institutional = Column(Boolean, default=False)
    is_pool = Column(Boolean, default=False) # Se o dinheiro veio do Pool (Caixa)

    auditoria = relationship("RegistroAuditoria")
    solicitacao = relationship("SolicitacaoEmprestimo", back_populates="investimentos")
    investidor = relationship("Usuario")

class AcessoInvestidor(Base):
    __tablename__ = "acessos_investidores"

    id = Column(Integer, primary_key=True, index=True)
    investidor_id = Column(String(5), ForeignKey("usuarios.id"))
    solicitacao_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id"))
    data_acesso = Column(DateTime, default=datetime.datetime.utcnow)

    solicitacao = relationship("SolicitacaoEmprestimo", back_populates="acessos_investidores")

class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(String(5), ForeignKey("usuarios.id"))
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    tipo = Column(Enum(TipoTransacao, name="tipo_transacao", values_callable=lambda x: [e.value for e in x]), nullable=False, index=True)
    status = Column(String, default="pendente", index=True) # pendente, concluido, falhou
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Para saques/depósitos, armazenar a chave pix ou ID do parceiro
    detalhes = Column(String, nullable=True) 
    metodo = Column(String, default="pix") # pix, especie
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

class GarantiaSocial(Base):
    __tablename__ = "garantias_sociais"

    id = Column(Integer, primary_key=True, index=True)
    solicitacao_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id", ondelete="CASCADE"))
    garante_id = Column(String(5), ForeignKey("usuarios.id", ondelete="CASCADE"))
    aceito = Column(Boolean, default=False)
    data_aceite = Column(DateTime, nullable=True)
    auditoria_id = Column(Integer, ForeignKey("registros_auditoria.id"), nullable=True)

    auditoria = relationship("RegistroAuditoria")
    solicitacao = relationship("SolicitacaoEmprestimo", back_populates="garantias_sociais")
    garante = relationship("Usuario", back_populates="garantias_prestadas")
