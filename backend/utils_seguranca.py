"""
utils_seguranca.py - Módulo de Segurança e Anti-Fraude Trocaria
Proteções para produção: detecção de contas fake, validações KYC, limites de risco.
"""

import re
import hashlib
import ipaddress
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from fastapi import HTTPException, status, Request

from modelos.modelos_db import (
    Usuario, SolicitacaoEmprestimo, StatusSolicitacao, 
    Transacao, TipoTransacao, DenunciaUsuario, RegistroAuditoria
)

# ============================================================================
# CONSTANTES DE SEGURANÇA
# ============================================================================

# Limites financeiros para prevenção à lavagem de dinheiro (PLD/FT)
LIMITE_DIARIO_DEPOSITO = 10_000.00  # R$ 10.000,00
LIMITE_DIARIO_SAQUE = 10_000.00
LIMITE_MENSAL_TRANSACAO = 50_000.00
LIMITE_MAXIMO_EMPRESTIMO_P2P = 50_000.00
LIMITE_MINIMO_EMPRESTIMO_P2P = 50.00

# Juros máximos permitidos (% ao mês)
JUROS_MAXIMO_MENSAL = 20.0  # 20% a.m. - acima disso é considerado abusivo
JUROS_ALERTA_MENSAL = 15.0  # 15% a.m. - gera alerta de auditoria

# Score mínimo para operações
SCORE_MINIMO_TOMADOR = 300
SCORE_MINIMO_INVESTIDOR = 0

# Bloqueio de IPs suspeitos
IP_BLOCKLIST = set()
SUSPICIOUS_COUNTRIES = {'KP', 'IR', 'SY', 'CU', 'AF'}  # Sanções OFAC/ONU

# Palavras proibidas em nomes (contas fake)
PALAVRAS_FAKE = {
    'teste', 'test', 'admin', 'root', 'fake', 'golpe', 'anonymous', 
    'hacker', 'banco', 'central', 'receita', 'policia', 'juiz'
}

# Emails temporários/bloqueados (expandido)
EMAILS_TEMPORARIOS = {
    'mailinator.com', 'yopmail.com', 'tempmail.com', 'guerrillamail.com',
    '10minutemail.com', 'dropmail.me', 'sharklasers.com', 'getairmail.com',
    'throwawaymail.com', 'temp-mail.org', 'fakeinbox.com', 'mailnesia.com',
    'trashmail.com', 'burnermail.io', 'tempinbox.com'
}


# ============================================================================
# VALIDAÇÕES DE ENTRADA (Anti-Injection e sanitização)
# ============================================================================

def sanitizar_texto(texto: str, max_length: int = 500) -> str:
    """Remove caracteres perigosos e limita tamanho."""
    if not texto:
        return ""
    # Remove tags HTML
    texto = re.sub(r'<[^>]+>', '', texto)
    # Remove caracteres de controle perigosos
    texto = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', texto)
    # Remove múltiplos espaços
    texto = ' '.join(texto.split())
    return texto[:max_length]


def validar_ip(ip_str: str) -> bool:
    """Valida se é um IP válido e não é privado/reservado (em produção)."""
    try:
        ip = ipaddress.ip_address(ip_str)
        # Em produção, bloquear IPs privados tentando burlar proxies
        if ip.is_private or ip.is_loopback or ip.is_reserved:
            return False
        return True
    except ValueError:
        return False


def verificar_ip_suspeito(ip_str: str) -> Dict[str, Any]:
    """Verifica se o IP está em blocklist ou é de país sancionado."""
    if not ip_str or ip_str == "unknown":
        return {"bloqueado": True, "motivo": "IP desconhecido"}
    
    if ip_str in IP_BLOCKLIST:
        return {"bloqueado": True, "motivo": "IP em lista de bloqueio"}
    
    # TODO: Integrar com GeoIP2 para verificar país do IP
    # Por enquanto, retorna liberado para IPs válidos
    return {"bloqueado": False, "motivo": None}


# ============================================================================
# ANTI-FRAUDE: DETECÇÃO DE CONTAS FAKE
# ============================================================================

def validar_nome_anti_fake(nome: str) -> tuple[bool, Optional[str]]:
    """
    Valida se o nome parece ser de uma conta fake.
    Retorna (valido, motivo_rejeicao)
    """
    nome_limpo = nome.strip().lower()
    
    # Mínimo de caracteres
    if len(nome_limpo) < 5:
        return False, "Nome muito curto (mínimo 5 caracteres)"
    
    # Máximo de caracteres
    if len(nome_limpo) > 100:
        return False, "Nome muito longo (máximo 100 caracteres)"
    
    # Deve ter pelo menos nome e sobrenome
    partes = nome_limpo.split()
    if len(partes) < 2:
        return False, "Informe nome completo (nome e sobrenome)"
    
    # Cada parte deve ter pelo menos 2 caracteres
    for parte in partes:
        if len(parte) < 2:
            return False, "Cada parte do nome deve ter pelo menos 2 letras"
    
    # Verifica palavras proibidas
    for palavra in PALAVRAS_FAKE:
        if palavra in nome_limpo:
            return False, f"Nome contém termo não permitido"
    
    # Verifica repetição excessiva de caracteres (ex: "aaaaaa", "João João João")
    if re.search(r'(.)\1{4,}', nome_limpo):  # 5 caracteres iguais seguidos
        return False, "Nome contém repetição suspeita de caracteres"
    
    # Verifica se é apenas letras e espaços (e acentos)
    if not re.match(r"^[a-zà-öø-ÿ\s]+$", nome_limpo):
        return False, "Nome contém caracteres inválidos"
    
    return True, None


def verificar_conta_suspeita(db: Session, usuario: Usuario) -> Dict[str, Any]:
    """
    Analisa padrões suspeitos na conta do usuário.
    Retorna dict com nível de risco e flags.
    """
    flags = []
    nivel_risco = "baixo"  # baixo, medio, alto, critico
    
    # 1. Verifica se o email é temporário
    dominio = usuario.email.split('@')[-1].lower()
    if dominio in EMAILS_TEMPORARIOS:
        flags.append("email_temporario")
        nivel_risco = "alto"
    
    # 2. Verifica múltiplas contas no mesmo IP (últimas 24h)
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
    
    # 3. Verifica velocidade de criação + ações (possível bot)
    if usuario.data_aceite:
        # Se tem transações em menos de 5 minutos do cadastro
        transacoes_rapidas = db.query(Transacao).filter(
            Transacao.usuario_id == usuario.id,
            Transacao.data_criacao <= usuario.data_aceite + timedelta(minutes=5)
        ).count()
        if transacoes_rapidas > 0:
            flags.append("acoes_rapidas_pos_cadastro")
            nivel_risco = max(nivel_risco, "medio", key=lambda x: ["baixo", "medio", "alto", "critico"].index(x))
    
    # 4. Verifica se já foi denunciado
    denuncias = db.query(DenunciaUsuario).filter(
        DenunciaUsuario.denunciado_id == usuario.id,
        DenunciaUsuario.status == "pendente"
    ).count()
    if denuncias >= 2:
        flags.append(f"multiplas_denuncias:{denuncias}")
        nivel_risco = "critico"
    
    # 5. Verifica tentativas de empréstimo múltiplas em curto prazo
    ultima_hora = datetime.now(timezone.utc) - timedelta(hours=1)
    emprestimos_rapidos = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.data_criacao >= ultima_hora
    ).count()
    if emprestimos_rapidos >= 3:
        flags.append(f"multiplos_emprestimos_rapidos:{emprestimos_rapidos}")
        nivel_risco = max(nivel_risco, "alto", key=lambda x: ["baixo", "medio", "alto", "critico"].index(x))
    
    return {
        "nivel_risco": nivel_risco,
        "flags": flags,
        "bloquear_operacoes": nivel_risco in ("alto", "critico"),
        "requer_verificacao_adicional": nivel_risco in ("medio", "alto", "critico")
    }


def verificar_dispositivo_unico(db: Session, usuario_id: str, user_agent: str, ip: str) -> bool:
    """
    Verifica se o acesso está vindo de um dispositivo/IP diferente do habitual.
    Retorna True se for acesso suspeito (novo dispositivo).
    """
    # Busca últimos registros de auditoria do usuário
    ultimos_acessos = db.query(RegistroAuditoria).filter(
        RegistroAuditoria.user_agent.isnot(None)
    ).order_by(RegistroAuditoria.data_registro.desc()).limit(5).all()
    
    if not ultimos_acessos:
        return False  # Primeiro acesso
    
    # Verifica se o user_agent ou IP são completamente diferentes
    uas_conhecidos = {a.user_agent for a in ultimos_acessos if a.user_agent}
    ips_conhecidos = {a.ip for a in ultimos_acessos if a.ip}
    
    if user_agent not in uas_conhecidos and ip not in ips_conhecidos:
        return True
    
    return False


# ============================================================================
# PREVENÇÃO À LAVAGEM DE DINHEIRO (PLD/FT)
# ============================================================================

def calcular_volume_transacoes(db: Session, usuario_id: str, dias: int = 30) -> Dict[str, float]:
    """Calcula o volume total de transações do usuário no período."""
    desde = datetime.now(timezone.utc) - timedelta(days=dias)
    
    depositos = db.query(func.sum(Transacao.valor)).filter(
        Transacao.usuario_id == usuario_id,
        Transacao.tipo == TipoTransacao.DEPOSITO,
        Transacao.status == "concluido",
        Transacao.data_criacao >= desde
    ).scalar() or 0
    
    saques = db.query(func.sum(Transacao.valor)).filter(
        Transacao.usuario_id == usuario_id,
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.status == "concluido",
        Transacao.data_criacao >= desde
    ).scalar() or 0
    
    emprestimos = db.query(func.sum(SolicitacaoEmprestimo.valor)).filter(
        SolicitacaoEmprestimo.usuario_id == usuario_id,
        SolicitacaoEmprestimo.data_criacao >= desde
    ).scalar() or 0
    
    return {
        "total_depositos": float(depositos),
        "total_saques": float(saques),
        "total_emprestimos_solicitados": float(emprestimos),
        "volume_total": float(depositos + saques + emprestimos)
    }


def verificar_limites_pld(db: Session, usuario_id: str, valor_proposto: float, tipo: str) -> Dict[str, Any]:
    """
    Verifica se uma transação proposta está dentro dos limites PLD.
    tipo: 'deposito', 'saque', 'emprestimo'
    """
    volumes = calcular_volume_transacoes(db, usuario_id, dias=1)
    volumes_mensais = calcular_volume_transacoes(db, usuario_id, dias=30)
    
    alertas = []
    bloquear = False
    
    # Verifica limite diário
    if tipo == "deposito":
        if volumes["total_depositos"] + valor_proposto > LIMITE_DIARIO_DEPOSITO:
            alertas.append(f"Limite diário de depósito excedido (R$ {LIMITE_DIARIO_DEPOSITO:,.2f})")
            bloquear = True
    elif tipo == "saque":
        if volumes["total_saques"] + valor_proposto > LIMITE_DIARIO_SAQUE:
            alertas.append(f"Limite diário de saque excedido (R$ {LIMITE_DIARIO_SAQUE:,.2f})")
            bloquear = True
    
    # Verifica limite mensal total
    if volumes_mensais["volume_total"] + valor_proposto > LIMITE_MENSAL_TRANSACAO:
        alertas.append(f"Limite mensal de transações excedido (R$ {LIMITE_MENSAL_TRANSACAO:,.2f})")
        bloquear = True
    
    # Verifica limite de empréstimo
    if tipo == "emprestimo":
        if valor_proposto > LIMITE_MAXIMO_EMPRESTIMO_P2P:
            alertas.append(f"Valor máximo de empréstimo excedido (R$ {LIMITE_MAXIMO_EMPRESTIMO_P2P:,.2f})")
            bloquear = True
        if valor_proposto < LIMITE_MINIMO_EMPRESTIMO_P2P:
            alertas.append(f"Valor mínimo de empréstimo não atingido (R$ {LIMITE_MINIMO_EMPRESTIMO_P2P:,.2f})")
            bloquear = True
    
    # Alerta de volume alto (não bloqueia, mas gera alerta para análise)
    if volumes_mensais["volume_total"] + valor_proposto > LIMITE_MENSAL_TRANSACAO * 0.8:
        alertas.append("Atenção: Volume mensal atingindo 80% do limite PLD")
    
    return {
        "bloquear": bloquear,
        "alertas": alertas,
        "volumes_atuais": volumes,
        "requer_analise_manual": volumes_mensais["volume_total"] > LIMITE_MENSAL_TRANSACAO * 0.5
    }


# ============================================================================
# VALIDAÇÃO DE JUROS (Compliance com Lei de Usura)
# ============================================================================

def validar_taxa_juros(taxa_mensal: float) -> Dict[str, Any]:
    """
    Valida se a taxa de juros está dentro dos limites legais.
    Retorna dict com status e alertas.
    """
    if taxa_mensal <= 0:
        return {"valido": False, "bloquear": True, "motivo": "Taxa de juros deve ser positiva"}
    
    if taxa_mensal > JUROS_MAXIMO_MENSAL:
        return {
            "valido": False, 
            "bloquear": True, 
            "motivo": f"Taxa de juros excede o limite máximo permitido de {JUROS_MAXIMO_MENSAL}% ao mês",
            "alerta_compliance": True
        }
    
    if taxa_mensal > JUROS_ALERTA_MENSAL:
        return {
            "valido": True,
            "bloquear": False,
            "motivo": None,
            "alerta_compliance": True,
            "mensagem": f"Taxa de juros alta ({taxa_mensal}% a.m.) - será registrada para auditoria"
        }
    
    return {"valido": True, "bloquear": False, "motivo": None, "alerta_compliance": False}


def calcular_cet(valor: float, taxa_juros_mensal: float, prazo_meses: int, taxas_adicionais: float = 0) -> Dict[str, Any]:
    """
    Calcula o Custo Efetivo Total (CET) de uma operação de empréstimo.
    """
    # Cálculo simplificado de CET (juros compostos + taxas)
    montante = valor * ((1 + taxa_juros_mensal / 100) ** prazo_meses)
    juros_totais = montante - valor
    cet_valor = juros_totais + taxas_adicionais
    cet_percentual = (cet_valor / valor) * 100 if valor > 0 else 0
    
    # CET mensal equivalente
    cet_mensal = (((valor + cet_valor) / valor) ** (1 / prazo_meses) - 1) * 100 if valor > 0 and prazo_meses > 0 else 0
    
    return {
        "valor_solicitado": valor,
        "montante_total": round(montante + taxas_adicionais, 2),
        "juros_totais": round(juros_totais, 2),
        "taxas_adicionais": round(taxas_adicionais, 2),
        "cet_total_valor": round(cet_valor, 2),
        "cet_total_percentual": round(cet_percentual, 2),
        "cet_mensal_percentual": round(cet_mensal, 2),
        "parcela_media": round((montante + taxas_adicionais) / prazo_meses, 2) if prazo_meses > 0 else 0
    }


# ============================================================================
# PROTEÇÃO DE ROTAS E MIDDLEWARES
# ============================================================================

def exigir_score_minimo(usuario: Usuario, minimo: int = SCORE_MINIMO_TOMADOR):
    """Levanta exceção se o usuário não tiver score mínimo."""
    if (usuario.score or 0) < minimo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Score mínimo de {minimo} pontos necessário. Seu score: {int(usuario.score or 0)}. "
                   f"Complete seu perfil e verifique sua identidade para aumentar seu score."
        )


def exigir_verificacao_kyc(usuario: Usuario):
    """Levanta exceção se o usuário não tiver KYC aprovado."""
    if not usuario.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Verificação de identidade (KYC) necessária. Envie seus documentos para análise."
        )


def exigir_2fa_se_configurado(usuario: Usuario, codigo_2fa: Optional[str] = None):
    """
    Se o usuário tem 2FA ativado, exige o código para operações sensíveis.
    """
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


# ============================================================================
# HASH E CRIPTOGRAFIA DE AUDITORIA
# ============================================================================

def gerar_hash_auditoria(dados: str) -> str:
    """Gera hash SHA-256 para garantir integridade de registros de auditoria."""
    return hashlib.sha256(dados.encode('utf-8')).hexdigest()


def verificar_integridade_hash(dados: str, hash_armazenado: str) -> bool:
    """Verifica se os dados correspondem ao hash armazenado."""
    return gerar_hash_auditoria(dados) == hash_armazenado


# ============================================================================
# SANÇÕES E BLOQUEIOS
# ============================================================================

def registrar_acao_admin(db: Session, admin_id: str, acao: str, alvo_id: Optional[str] = None, detalhes: Optional[str] = None, ip: Optional[str] = None):
    """Registra uma acao administrativa no log de auditoria."""
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
    """Suspende um usuário por suspeita de fraude e registra auditoria."""
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
    """Registra uma tentativa de ação suspeita para análise posterior."""
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
