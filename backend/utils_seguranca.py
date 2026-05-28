import re
import hashlib
import ipaddress
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from fastapi import HTTPException, status, Request

from modelos.modelos_db import (
    Usuario, Transacao, TipoTransacao, DenunciaUsuario, RegistroAuditoria
)

LIMITE_MENSAL_TRANSACAO = 50_000.00

IP_BLOCKLIST = set()
SUSPICIOUS_COUNTRIES = {'KP', 'IR', 'SY', 'CU', 'AF'}

PALAVRAS_FAKE = {
    'teste', 'test', 'admin', 'root', 'fake', 'golpe', 'anonymous',
    'hacker', 'banco', 'central', 'receita', 'policia', 'juiz'
}

EMAILS_TEMPORARIOS = {
    'mailinator.com', 'yopmail.com', 'tempmail.com', 'guerrillamail.com',
    '10minutemail.com', 'dropmail.me', 'sharklasers.com', 'getairmail.com',
    'throwawaymail.com', 'temp-mail.org', 'fakeinbox.com', 'mailnesia.com',
    'trashmail.com', 'burnermail.io', 'tempinbox.com'
}


def sanitizar_texto(texto: str, max_length: int = 500) -> str:
    if not texto:
        return ""
    texto = re.sub(r'<[^>]+>', '', texto)
    texto = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', texto)
    texto = ' '.join(texto.split())
    return texto[:max_length]


def validar_ip(ip_str: str) -> bool:
    try:
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return False
        return True
    except ValueError:
        return False


def verificar_ip_suspeito(ip_str: str) -> Dict[str, Any]:
    if not ip_str or ip_str == "unknown":
        return {"bloqueado": True, "motivo": "IP desconhecido"}

    if ip_str in IP_BLOCKLIST:
        return {"bloqueado": True, "motivo": "IP em lista de bloqueio"}

    return {"bloqueado": False, "motivo": None}


def validar_nome_anti_fake(nome: str) -> tuple[bool, Optional[str]]:
    nome_limpo = nome.strip().lower()

    if len(nome_limpo) < 5:
        return False, "Nome muito curto (mínimo 5 caracteres)"

    if len(nome_limpo) > 100:
        return False, "Nome muito longo (máximo 100 caracteres)"

    partes = nome_limpo.split()
    if len(partes) < 2:
        return False, "Informe nome completo (nome e sobrenome)"

    for parte in partes:
        if len(parte) < 2:
            return False, "Cada parte do nome deve ter pelo menos 2 letras"

    for palavra in PALAVRAS_FAKE:
        if palavra in nome_limpo:
            return False, "Nome contém termo não permitido"

    if re.search(r'(.)\1{4,}', nome_limpo):
        return False, "Nome contém repetição suspeita de caracteres"

    if not re.match(r"^[a-zà-öø-ÿ\s]+$", nome_limpo):
        return False, "Nome contém caracteres inválidos"

    return True, None


def verificar_conta_suspeita(db: Session, usuario: Usuario) -> Dict[str, Any]:
    flags = []
    nivel_risco = "baixo"

    dominio = usuario.email.split('@')[-1].lower()
    if dominio in EMAILS_TEMPORARIOS:
        flags.append("email_temporario")
        nivel_risco = "alto"

    if usuario.auditoria and usuario.auditoria.ip:
        ip = usuario.auditoria.ip
        from datetime import datetime, timezone, timedelta
        limite = datetime.now(timezone.utc) - timedelta(hours=24)
        contas_mesmo_ip = db.query(Usuario).join(RegistroAuditoria).filter(
            RegistroAuditoria.ip == ip,
            RegistroAuditoria.data_registro >= limite,
            Usuario.id != usuario.id
        ).count()
        if contas_mesmo_ip >= 3:
            flags.append(f"multiplas_contas_mesmo_ip:{contas_mesmo_ip}")
            nivel_risco = max(nivel_risco, "medio", key=lambda x: ["baixo", "medio", "alto", "critico"].index(x))

    if usuario.data_aceite:
        transacoes_rapidas = db.query(Transacao).filter(
            Transacao.usuario_id == usuario.id,
            Transacao.data_criacao <= usuario.data_aceite + timedelta(minutes=5)
        ).count()
        if transacoes_rapidas > 0:
            flags.append("acoes_rapidas_pos_cadastro")
            nivel_risco = max(nivel_risco, "medio", key=lambda x: ["baixo", "medio", "alto", "critico"].index(x))

    denuncias = db.query(DenunciaUsuario).filter(
        DenunciaUsuario.denunciado_id == usuario.id,
        DenunciaUsuario.status == "pendente"
    ).count()
    if denuncias >= 2:
        flags.append(f"multiplas_denuncias:{denuncias}")
        nivel_risco = "critico"

    return {
        "nivel_risco": nivel_risco,
        "flags": flags,
        "bloquear_operacoes": nivel_risco in ("alto", "critico"),
        "requer_verificacao_adicional": nivel_risco in ("medio", "alto", "critico")
    }


def verificar_dispositivo_unico(db: Session, usuario_id: str, user_agent: str, ip: str) -> bool:
    ultimos_acessos = db.query(RegistroAuditoria).filter(
        RegistroAuditoria.user_agent.isnot(None)
    ).order_by(RegistroAuditoria.data_registro.desc()).limit(5).all()

    if not ultimos_acessos:
        return False

    uas_conhecidos = {a.user_agent for a in ultimos_acessos if a.user_agent}
    ips_conhecidos = {a.ip for a in ultimos_acessos if a.ip}

    if user_agent not in uas_conhecidos and ip not in ips_conhecidos:
        return True

    return False


def exigir_verificacao_kyc(usuario: Usuario):
    if not usuario.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verificação de identidade (KYC) necessária. Envie seus documentos para análise."
        )


def exigir_2fa_se_configurado(usuario: Usuario, codigo_2fa: Optional[str] = None):
    if usuario.two_factor_enabled:
        if not codigo_2fa:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Autenticação de dois fatores (2FA) necessária para esta operação."
            )
        import pyotp
        totp = pyotp.TOTP(usuario.totp_secret)
        if not totp.verify(codigo_2fa):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Código 2FA inválido."
            )


def gerar_hash_auditoria(dados: str) -> str:
    return hashlib.sha256(dados.encode('utf-8')).hexdigest()


def verificar_integridade_hash(dados: str, hash_armazenado: str) -> bool:
    return gerar_hash_auditoria(dados) == hash_armazenado


def registrar_acao_admin(db: Session, admin_id: str, acao: str, alvo_id: Optional[str] = None, detalhes: Optional[str] = None, ip: Optional[str] = None):
    from modelos.modelos_db import AcaoAdmin
    db.add(AcaoAdmin(
        admin_id=admin_id,
        alvo_id=alvo_id,
        acao=acao,
        detalhes=detalhes,
        ip=ip,
        data_acao=datetime.now(timezone.utc)
    ))
    db.commit()


def suspender_usuario_fraude(db: Session, usuario_id: str, motivo: str, admin_id: Optional[str] = None):
    from modelos.modelos_db import AcaoAdmin

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        return False

    usuario.is_active = False
    usuario.motivo_suspensao = motivo
    usuario.data_suspensao = datetime.now(timezone.utc)

    db.add(AcaoAdmin(
        admin_id=admin_id or "SISTEMA",
        alvo_id=usuario_id,
        acao="SUSPENSAO_FRAUDE",
        detalhes=motivo,
        data_acao=datetime.now(timezone.utc)
    ))

    db.commit()
    return True


def registrar_tentativa_suspeita(
    db: Session,
    usuario_id: Optional[str],
    ip: str,
    acao: str,
    detalhes: str,
    nivel_risco: str = "medio"
):
    from modelos.modelos_db import AcaoAdmin

    db.add(AcaoAdmin(
        admin_id="SISTEMA_ANTI_FRAUDE",
        alvo_id=usuario_id or ip,
        acao=f"TENTATIVA_SUSPEITA_{acao}",
        detalhes=f"[{nivel_risco}] {detalhes}",
        ip=ip,
        data_acao=datetime.now(timezone.utc)
    ))
    db.commit()
