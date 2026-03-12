from sqlalchemy.orm import Session
from modelos.modelos_db import AcaoAdmin
import datetime

def registrar_acao_admin(db: Session, admin_id: str, acao: str, alvo_id: str = None, detalhes: str = None, ip: str = None):
    """
    Registra uma ação administrativa na tabela de auditoria.
    """
    nova_acao = AcaoAdmin(
        admin_id=admin_id,
        acao=acao,
        alvo_id=alvo_id,
        detalhes=detalhes,
        ip=ip,
        data_acao=datetime.datetime.utcnow()
    )
    db.add(nova_acao)
    db.commit()
    return nova_acao
