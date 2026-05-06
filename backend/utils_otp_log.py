"""
Utilitário de auditoria para códigos OTP enviados.
Permite rastrear todos os códigos enviados para email e telefone.
"""
import hashlib
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from modelos.modelos_db import CodigoOTPLog

def registrar_codigo_otp(
    db: Session,
    usuario_id: str,
    tipo: str,  # 'email' ou 'telefone'
    codigo: str,
    destino: str,
    enviado_com_sucesso: bool,
    metodo: str,  # 'resend', 'callmebot', 'console'
    ip_origem: str = None,
    user_agent: str = None,
    expiracao_minutos: int = 15
):
    """
    Registra um código OTP enviado no log de auditoria.
    Guarda o HASH do código (nunca o código em texto puro).
    """
    codigo_hash = hashlib.sha256(codigo.encode()).hexdigest()
    
    log = CodigoOTPLog(
        usuario_id=usuario_id,
        tipo=tipo,
        codigo_hash=codigo_hash,
        destino=destino,
        enviado_com_sucesso=enviado_com_sucesso,
        metodo=metodo,
        ip_origem=ip_origem,
        user_agent=user_agent,
        data_expiracao=datetime.now(timezone.utc) + __import__('datetime').timedelta(minutes=expiracao_minutos)
    )
    
    db.add(log)
    db.commit()
    
    return log

def buscar_logs_otp(db: Session, usuario_id: str = None, tipo: str = None, limite: int = 100):
    """Busca logs de códigos OTP enviados."""
    query = db.query(CodigoOTPLog).order_by(CodigoOTPLog.data_envio.desc())
    
    if usuario_id:
        query = query.filter(CodigoOTPLog.usuario_id == usuario_id)
    if tipo:
        query = query.filter(CodigoOTPLog.tipo == tipo)
    
    return query.limit(limite).all()

def buscar_ultimo_codigo_otp(db: Session, usuario_id: str, tipo: str):
    """Busca o último código OTP enviado para um usuário."""
    return db.query(CodigoOTPLog).filter(
        CodigoOTPLog.usuario_id == usuario_id,
        CodigoOTPLog.tipo == tipo
    ).order_by(CodigoOTPLog.data_envio.desc()).first()

def limpar_logs_otp_antigos(db: Session, dias: int = 30):
    """Remove logs de OTP antigos para economizar espaço."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=dias)
    
    deletados = db.query(CodigoOTPLog).filter(
        CodigoOTPLog.data_envio < cutoff
    ).delete(synchronize_session=False)
    
    db.commit()
    return deletados