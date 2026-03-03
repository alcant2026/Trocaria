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

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    cpf = Column(String, unique=True, index=True, nullable=False)
    senha_hash = Column(String, nullable=False)
    chave_pix = Column(String, nullable=False)
    saldo = Column(Numeric(precision=20, scale=2), default=0)
    score = Column(Numeric(precision=6, scale=1), default=0)
    ultima_solicitacao = Column(DateTime, nullable=True)
    solicitacoes_hoje = Column(Integer, default=0)
    ultima_atualizacao_score = Column(DateTime, default=datetime.datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True) # Para LGPD / Deleção lógica
    
    # Proteção Jurídica: Aceite de Termos de Uso (Intermediação SaaS)
    aceite_termos = Column(Boolean, default=False)
    data_aceite = Column(DateTime, default=datetime.datetime.utcnow)

    # Autenticação de Dois Fatores (2FA)
    totp_secret = Column(String, nullable=True)
    two_factor_enabled = Column(Boolean, default=False)

    solicitacoes = relationship("SolicitacaoEmprestimo", back_populates="usuario")
    transacoes = relationship("Transacao", back_populates="usuario")

class SolicitacaoEmprestimo(Base):
    __tablename__ = "solicitacoes_emprestimo"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    valor_arrecadado = Column(Numeric(precision=20, scale=2), default=0)
    taxa_juros = Column(Numeric(precision=5, scale=2), nullable=False)
    prazo_meses = Column(Integer, nullable=False)
    status = Column(Enum(StatusSolicitacao), default=StatusSolicitacao.PENDENTE)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    data_expiracao_4h = Column(DateTime)
    data_expiracao_5d = Column(DateTime)
    parcelas_pagas = Column(Integer, default=0)

    usuario = relationship("Usuario", back_populates="solicitacoes")
    acessos_investidores = relationship("AcessoInvestidor", back_populates="solicitacao")
    investimentos = relationship("Investimento", back_populates="solicitacao")

class Investimento(Base):
    __tablename__ = "investimentos"

    id = Column(Integer, primary_key=True, index=True)
    investidor_id = Column(Integer, ForeignKey("usuarios.id"))
    solicitacao_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id"))
    valor_investido = Column(Numeric(precision=20, scale=2), nullable=False)
    pago_para_investidor = Column(Numeric(precision=20, scale=2), default=0) # Total recebido de volta
    data_investimento = Column(DateTime, default=datetime.datetime.utcnow)
    ciencia_risco = Column(Boolean, default=False) # Blindagem jurídica: investidor deu aceite no risco

    solicitacao = relationship("SolicitacaoEmprestimo", back_populates="investimentos")
    investidor = relationship("Usuario")

class AcessoInvestidor(Base):
    __tablename__ = "acessos_investidores"

    id = Column(Integer, primary_key=True, index=True)
    investidor_id = Column(Integer, ForeignKey("usuarios.id"))
    solicitacao_id = Column(Integer, ForeignKey("solicitacoes_emprestimo.id"))
    data_acesso = Column(DateTime, default=datetime.datetime.utcnow)

    solicitacao = relationship("SolicitacaoEmprestimo", back_populates="acessos_investidores")

class Transacao(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    valor = Column(Numeric(precision=20, scale=2), nullable=False)
    tipo = Column(Enum(TipoTransacao), nullable=False)
    status = Column(String, default="pendente") # pendente, concluido, falhou
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Para saques, armazenar a chave pix usada no momento
    detalhes = Column(String, nullable=True) 

    usuario = relationship("Usuario", back_populates="transacoes")
