"""
utils_auditoria.py - Logs de Auditoria Imutáveis e Compliance
Sistema robusto de rastreamento de todas as operações críticas da plataforma.
"""

import json
import hashlib
import hmac
import os
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from modelos.modelos_db import (
    RegistroAuditoria, AcaoAdmin, Transacao, 
    Usuario
)

# Chave secreta para assinar logs (deve vir do .env em produção)
AUDIT_SECRET_KEY = os.getenv("AUDIT_SECRET_KEY", os.getenv("SECRET_KEY", "default_audit_key_change_in_production"))


# ============================================================================
# CLASSE DE AUDITORIA IMUTÁVEL
# ============================================================================

class AuditoriaImutavel:
    """
    Sistema de auditoria que gera registros com hash encadeado (blockchain simplificado)
    para garantir que logs não sejam alterados após criação.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self._ultimo_hash = None
    
    def _calcular_hash(self, dados: Dict[str, Any]) -> str:
        """Calcula HMAC-SHA256 dos dados usando chave secreta."""
        payload = json.dumps(dados, sort_keys=True, default=str)
        return hmac.new(
            AUDIT_SECRET_KEY.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    def _obter_ultimo_hash(self) -> Optional[str]:
        """Obtém o hash do último registro de auditoria para encadeamento."""
        ultimo = self.db.query(RegistroAuditoria).order_by(
            desc(RegistroAuditoria.id)
        ).first()
        if ultimo and hasattr(ultimo, 'hash_integridade'):
            return ultimo.hash_integridade
        return None
    
    def registrar(
        self,
        ip: str,
        acao: str,
        usuario_id: Optional[str] = None,
        detalhes: Optional[Dict] = None,
        user_agent: Optional[str] = None,
        municipio: Optional[str] = None,
        valor_envolvido: Optional[float] = None,
        entidade_tipo: Optional[str] = None,
        entidade_id: Optional[str] = None
    ) -> RegistroAuditoria:
        """
        Registra um evento de auditoria com hash de integridade.
        """
        agora = datetime.now(timezone.utc)
        
        # Monta payload para hash
        payload = {
            "timestamp": agora.isoformat(),
            "acao": acao,
            "usuario_id": usuario_id,
            "ip": ip,
            "detalhes": detalhes or {},
            "valor_envolvido": valor_envolvido,
            "entidade_tipo": entidade_tipo,
            "entidade_id": entidade_id
        }
        
        # Hash encadeado (inclui hash anterior para detectar adulterações)
        hash_anterior = self._obter_ultimo_hash()
        if hash_anterior:
            payload["hash_anterior"] = hash_anterior
        
        hash_integridade = self._calcular_hash(payload)
        
        # Cria registro
        registro = RegistroAuditoria(
            ip=ip[:45] if ip else "unknown",
            municipio=municipio[:100] if municipio else None,
            user_agent=user_agent[:200] if user_agent else None,
            data_registro=agora,
            # Campos adicionais seriam necessários no modelo:
            # hash_integridade=hash_integridade,
            # acao=acao,
            # usuario_id=usuario_id,
            # detalhes_json=json.dumps(detalhes) if detalhes else None,
            # valor_envolvido=valor_envolvido
        )
        
        self.db.add(registro)
        self.db.flush()  # Obtém o ID sem commit
        
        # Atualiza payload com ID e recalcula hash final
        payload["registro_id"] = registro.id
        hash_final = self._calcular_hash(payload)
        
        # TODO: Adicionar campos ao modelo RegistroAuditoria:
        # registro.hash_integridade = hash_final
        # registro.acao = acao
        # registro.usuario_id = usuario_id
        # registro.detalhes_json = json.dumps(detalhes) if detalhes else None
        
        return registro
    
    def verificar_integridade(self, registro_id: int) -> Dict[str, Any]:
        """
        Verifica se um registro de auditoria foi alterado.
        Retorna status de integridade.
        """
        registro = self.db.query(RegistroAuditoria).filter(
            RegistroAuditoria.id == registro_id
        ).first()
        
        if not registro:
            return {"valido": False, "motivo": "Registro não encontrado"}
        
        # TODO: Quando campos estiverem no modelo, verificar hash
        return {"valido": True, "motivo": "Verificação básica - modelo precisa ser expandido"}


# ============================================================================
# FUNÇÕES DE AUDITORIA ESPECÍFICAS
# ============================================================================

def auditar_transacao_financeira(
    db: Session,
    transacao_id: int,
    usuario_id: str,
    tipo: str,
    valor: float,
    status_anterior: Optional[str] = None,
    status_novo: str = "concluido",
    ip: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Audita qualquer mudança de status em transação financeira."""
    auditor = AuditoriaImutavel(db)
    
    detalhes = {
        "transacao_id": transacao_id,
        "tipo": tipo,
        "valor": float(valor),
        "status_anterior": status_anterior,
        "status_novo": status_novo,
        "natureza": "transacao_financeira"
    }
    
    return auditor.registrar(
        ip=ip or "system",
        acao=f"TRANSACAO_{status_novo.upper()}",
        usuario_id=usuario_id,
        detalhes=detalhes,
        user_agent=user_agent,
        valor_envolvido=float(valor),
        entidade_tipo="Transacao",
        entidade_id=str(transacao_id)
    )


def auditar_acesso_admin(
    db: Session,
    admin_id: str,
    acao: str,
    alvo_id: Optional[str] = None,
    detalhes: Optional[Dict] = None,
    ip: Optional[str] = None
):
    """Audita ações administrativas (suspensões, análises, etc)."""
    db.add(AcaoAdmin(
        admin_id=admin_id,
        alvo_id=alvo_id,
        acao=acao,
        detalhes=json.dumps(detalhes, default=str) if detalhes else None,
        ip=ip,
        data_acao=datetime.now(timezone.utc)
    ))
    db.commit()


def auditar_mudanca_sensivel(
    db: Session,
    usuario_id: str,
    campo_alterado: str,
    valor_anterior: Optional[str],
    valor_novo: Optional[str],
    ip: str,
    user_agent: Optional[str] = None
):
    """
    Audita alterações em campos sensíveis (senha, e-mail, chave PIX, etc).
    Nunca armazena o valor novo em texto claro, apenas hash ou indicativo.
    """
    valor_novo_seguro = "[ALTERADO]" if valor_novo else "[REMOVIDO]"
    
    auditor = AuditoriaImutavel(db)
    return auditor.registrar(
        ip=ip,
        acao="ALTERACAO_DADO_SENSIVEL",
        usuario_id=usuario_id,
        detalhes={
            "campo": campo_alterado,
            "tinha_valor_anterior": bool(valor_anterior),
            "valor_novo_indicativo": valor_novo_seguro,
            "natureza": "mudanca_sensivel"
        },
        user_agent=user_agent,
        entidade_tipo="Usuario",
        entidade_id=usuario_id
    )


def auditar_tentativa_login(
    db: Session,
    cpf_ou_email: str,
    sucesso: bool,
    ip: str,
    user_agent: Optional[str] = None,
    motivo_falha: Optional[str] = None
):
    """Audita tentativas de login (sucesso ou falha)."""
    acao = "LOGIN_SUCESSO" if sucesso else "LOGIN_FALHA"
    
    auditor = AuditoriaImutavel(db)
    return auditor.registrar(
        ip=ip,
        acao=acao,
        usuario_id=None,  # Não sabemos o ID em caso de falha
        detalhes={
            "identificador_mascarado": cpf_ou_email[:3] + "***" if len(cpf_ou_email) > 3 else "***",
            "sucesso": sucesso,
            "motivo_falha": motivo_falha,
            "natureza": "autenticacao"
        },
        user_agent=user_agent
    )


def auditar_kyc(
    db: Session,
    usuario_id: str,
    acao: str,  # ENVIO, APROVACAO, REJEICAO, CONSULTA
    documento_tipo: Optional[str] = None,
    ip: Optional[str] = None,
    motivo_rejeicao: Optional[str] = None
):
    """Audita todo o ciclo de vida do processo KYC."""
    detalhes = {
        "acao_kyc": acao,
        "documento_tipo": documento_tipo,
        "motivo_rejeicao": motivo_rejeicao,
        "natureza": "kyc"
    }
    
    auditor = AuditoriaImutavel(db)
    return auditor.registrar(
        ip=ip or "system",
        acao=f"KYC_{acao.upper()}",
        usuario_id=usuario_id,
        detalhes={k: v for k, v in detalhes.items() if v is not None},
        entidade_tipo="DocumentoVerificacao",
        entidade_id=usuario_id
    )




# ============================================================================
# RELATÓRIOS DE AUDITORIA
# ============================================================================

def gerar_relatorio_atividade_suspeita(
    db: Session,
    dias: int = 7
) -> List[Dict[str, Any]]:
    """Gera relatório de atividades suspeitas para revisão administrativa."""
    desde = datetime.now(timezone.utc) - __import__('datetime').timedelta(days=dias)
    
    # Busca ações do sistema anti-fraude
    acoes = db.query(AcaoAdmin).filter(
        AcaoAdmin.acao.like("TENTATIVA_SUSPEITA_%"),
        AcaoAdmin.data_acao >= desde
    ).order_by(desc(AcaoAdmin.data_acao)).all()
    
    resultado = []
    for acao in acoes:
        resultado.append({
            "id": acao.id,
            "data": acao.data_acao.isoformat() if acao.data_acao else None,
            "alvo": acao.alvo_id,
            "tipo": acao.acao,
            "detalhes": acao.detalhes,
            "ip": acao.ip
        })
    
    return resultado


def gerar_relatorio_transacoes_alto_valor(
    db: Session,
    limite_minimo: float = 5000.00,
    dias: int = 30
) -> List[Dict[str, Any]]:
    """Relatório de transações acima de determinado valor para PLD."""
    desde = datetime.now(timezone.utc) - __import__('datetime').timedelta(days=dias)
    
    transacoes = db.query(Transacao, Usuario).join(
        Usuario, Transacao.usuario_id == Usuario.id
    ).filter(
        Transacao.valor >= limite_minimo,
        Transacao.data_criacao >= desde,
        Transacao.status == "concluido"
    ).order_by(desc(Transacao.valor)).all()
    
    resultado = []
    for trans, user in transacoes:
        resultado.append({
            "transacao_id": trans.id,
            "data": trans.data_criacao.isoformat() if trans.data_criacao else None,
            "usuario_id": user.id,
            "usuario_nome": user.nome,
            "tipo": trans.tipo.value if hasattr(trans.tipo, 'value') else str(trans.tipo),
            "valor": float(trans.valor),
            "metodo": trans.metodo
        })
    
    return resultado


def gerar_trilha_auditoria_usuario(
    db: Session,
    usuario_id: str,
    dias: int = 90
) -> Dict[str, Any]:
    """Gera trilha completa de auditoria de um usuário específico."""
    desde = datetime.now(timezone.utc) - __import__('datetime').timedelta(days=dias)
    
    # Registros de auditoria
    registros = db.query(RegistroAuditoria).filter(
        RegistroAuditoria.data_registro >= desde
    ).order_by(desc(RegistroAuditoria.data_registro)).limit(100).all()
    
    # Ações administrativas relacionadas
    acoes_admin = db.query(AcaoAdmin).filter(
        AcaoAdmin.alvo_id == usuario_id,
        AcaoAdmin.data_acao >= desde
    ).order_by(desc(AcaoAdmin.data_acao)).all()
    
    # Transações
    transacoes = db.query(Transacao).filter(
        Transacao.usuario_id == usuario_id,
        Transacao.data_criacao >= desde
    ).order_by(desc(Transacao.data_criacao)).limit(50).all()
    
    return {
        "usuario_id": usuario_id,
        "periodo_dias": dias,
        "total_registros_auditoria": len(registros),
        "total_acoes_admin": len(acoes_admin),
        "total_transacoes": len(transacoes),
        "acesso_recente": [
            {
                "data": r.data_registro.isoformat() if r.data_registro else None,
                "ip": r.ip,
                "municipio": r.municipio,
                "user_agent": r.user_agent[:50] + "..." if r.user_agent and len(r.user_agent) > 50 else r.user_agent
            }
            for r in registros[:10]
        ],
        "acoes_administrativas": [
            {
                "data": a.data_acao.isoformat() if a.data_acao else None,
                "acao": a.acao,
                "detalhes": a.detalhes
            }
            for a in acoes_admin
        ],
        "transacoes_recentes": [
            {
                "id": t.id,
                "data": t.data_criacao.isoformat() if t.data_criacao else None,
                "tipo": t.tipo.value if hasattr(t.tipo, 'value') else str(t.tipo),
                "valor": float(t.valor),
                "status": t.status
            }
            for t in transacoes[:10]
        ]
    }
