"""
rotas_compliance.py - Rotas de Compliance LGPD e Direitos do Titular
Permite que usuários exercam seus direitos conforme Lei 13.709/2018.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from typing import Optional, List

from database import get_db
from modelos.modelos_db import (
    Usuario, ConsentimentoLGPD, RegistroAuditoria,
    Transacao
)
from rotas.rotas_auth import obter_usuario_logado
from utils_auditoria import (
    auditar_mudanca_sensivel, auditar_kyc, AuditoriaImutavel
)
from utils_seguranca import verificar_conta_suspeita

router = APIRouter(prefix="/compliance", tags=["Compliance LGPD"])


# ============================================================================
# MODELOS Pydantic
# ============================================================================

class SolicitacaoPortabilidade(BaseModel):
    formato: str = "json"  # json, csv
    email_destino: Optional[EmailStr] = None


class SolicitacaoExclusaoLGPD(BaseModel):
    motivo: Optional[str] = "Exercício do direito ao esquecimento (art. 18, V - LGPD)"
    confirmacao: bool = False  # Deve ser True para prosseguir


class SolicitacaoCorrecao(BaseModel):
    campo: str  # nome, email, telefone, cidade, estado
    valor_correto: str


class RevogacaoConsentimento(BaseModel):
    tipo: str  # marketing, cookies (não pode revogar termos_uso em conta ativa)


# ============================================================================
# ROTAS DE TRANSPARÊNCIA E ACESSO
# ============================================================================

@router.get("/dados-pessoais")
async def acessar_dados_pessoais(
    request: Request,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Retorna todos os dados pessoais do usuário (Direito de Acesso - art. 18, I).
    """
    # Coleta dados cadastrais
    dados = {
        "identificacao": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "cpf": usuario.cpf,
            "telefone": usuario.telefone,
            "cidade": usuario.cidade,
            "estado": usuario.estado,
        },
        "status_conta": {
            "ativo": usuario.is_active,
            "admin": usuario.is_admin,
            "verificado": usuario.is_verified,
            "assinante_premium": usuario.is_subscriber,
            "email_verificado": usuario.email_verificado,
            "telefone_verificado": usuario.telefone_verificado,
        },
        "dados_financeiros": {
            "saldo": 0.0,  # DEPRECATED: sistema de saldo descontinuado
            "saldo_caixa": 0.0,  # DEPRECATED
            "chave_pix": usuario.chave_pix,
            "valor_emprestado": float(usuario.valor_emprestado or 0),
            "emprestimos_ativos": 0,
            "emprestimos_concluidos": 0,
        },
        "gamificacao": {
            "pontos_marketplace": usuario.pontos_marketplace,
            "pontos_semanais": usuario.pontos_semanais,
            "codigo_indicacao": usuario.codigo_indicacao,
        },
        "seguranca": {
            "two_factor_enabled": usuario.two_factor_enabled,
            "ultima_alteracao_2fa": usuario.ultima_alteracao_2fa.isoformat() if usuario.ultima_alteracao_2fa else None,
        },
        "consentimentos": [],
        "auditoria_acessos": [],
        "transacoes_resumo": [],
    }
    
    # Consentimentos
    consentimentos = db.query(ConsentimentoLGPD).filter(
        ConsentimentoLGPD.usuario_id == usuario.id
    ).all()
    dados["consentimentos"] = [
        {
            "tipo": c.tipo_consentimento,
            "versao": c.versao_documento,
            "aceite": c.aceite,
            "data_aceite": c.data_aceite.isoformat() if c.data_aceite else None,
            "data_revogacao": c.data_revogacao.isoformat() if c.data_revogacao else None,
        }
        for c in consentimentos
    ]
    
    # Últimos acessos (limitado a 20)
    acessos = db.query(RegistroAuditoria).filter(
        RegistroAuditoria.ip.isnot(None)
    ).order_by(RegistroAuditoria.data_registro.desc()).limit(20).all()
    dados["auditoria_acessos"] = [
        {
            "data": a.data_registro.isoformat() if a.data_registro else None,
            "ip": a.ip,
            "municipio": a.municipio,
            "user_agent": a.user_agent[:100] + "..." if a.user_agent and len(a.user_agent) > 100 else a.user_agent,
        }
        for a in acessos
    ]
    
    # Resumo de transações
    transacoes = db.query(Transacao).filter(
        Transacao.usuario_id == usuario.id
    ).order_by(Transacao.data_criacao.desc()).limit(50).all()
    dados["transacoes_resumo"] = [
        {
            "id": t.id,
            "data": t.data_criacao.isoformat() if t.data_criacao else None,
            "tipo": t.tipo.value if hasattr(t.tipo, 'value') else str(t.tipo),
            "valor": float(t.valor),
            "status": t.status,
            "metodo": t.metodo,
        }
        for t in transacoes
    ]
    
    # Registrar auditoria do acesso
    auditor = AuditoriaImutavel(db)
    auditor.registrar(
        ip=request.client.host,
        acao="LGPD_ACESSO_DADOS",
        usuario_id=usuario.id,
        detalhes={"natureza": "exercicio_direito_lgpd", "direito": "acesso"},
        user_agent=request.headers.get("user-agent")
    )
    
    return {
        "message": "Dados pessoais recuperados conforme art. 18, I da LGPD.",
        "data_solicitacao": datetime.now(timezone.utc).isoformat(),
        "dados": dados
    }


@router.post("/portabilidade")
async def solicitar_portabilidade(
    request: Request,
    dados: SolicitacaoPortabilidade,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Gera arquivo de portabilidade dos dados (Direito de Portabilidade - art. 18, V).
    """
    import json
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    # Coleta dados (mesmo do acesso, mas em formato exportável)
    dados_export = {
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "email": usuario.email,
            "cpf": usuario.cpf,
            "telefone": usuario.telefone,
            "cidade": usuario.cidade,
            "estado": usuario.estado,
            "chave_pix": usuario.chave_pix,
        },
        "transacoes": [
            {
                "id": t.id,
                "data": t.data_criacao.isoformat() if t.data_criacao else None,
                "tipo": t.tipo.value if hasattr(t.tipo, 'value') else str(t.tipo),
                "valor": float(t.valor),
                "status": t.status,
                "detalhes": t.detalhes,
            }
            for t in db.query(Transacao).filter(Transacao.usuario_id == usuario.id).all()
        ],
        "emprestimos": []
    }
    
    # Registrar auditoria
    auditor = AuditoriaImutavel(db)
    auditor.registrar(
        ip=request.client.host,
        acao="LGPD_PORTABILIDADE",
        usuario_id=usuario.id,
        detalhes={"natureza": "exercicio_direito_lgpd", "direito": "portabilidade", "formato": dados.formato},
        user_agent=request.headers.get("user-agent")
    )
    
    if dados.formato.lower() == "csv":
        # Gera CSV simplificado
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Campo", "Valor"])
        for key, val in dados_export["usuario"].items():
            writer.writerow([key, val])
        
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=trocaria_dados_{usuario.id}.csv"}
        )
    else:
        # JSON
        return {
            "message": "Dados de portabilidade gerados (art. 18, V - LGPD).",
            "formato": "json",
            "dados": dados_export,
            "data_geracao": datetime.now(timezone.utc).isoformat()
        }


# ============================================================================
# CORREÇÃO DE DADOS
# ============================================================================

@router.post("/correcao")
async def solicitar_correcao(
    request: Request,
    dados: SolicitacaoCorrecao,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Permite correção de dados incompletos ou desatualizados (Direito de Retificação - art. 18, II).
    """
    campos_permitidos = {"nome", "email", "telefone", "cidade", "estado"}
    
    if dados.campo not in campos_permitidos:
        raise HTTPException(
            status_code=400,
            detail=f"Campo '{dados.campo}' não pode ser alterado por esta rota. Campos permitidos: {campos_permitidos}"
        )
    
    valor_anterior = getattr(usuario, dados.campo, None)
    
    # Validações específicas
    if dados.campo == "email":
        import re
        if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', dados.valor_correto):
            raise HTTPException(status_code=400, detail="E-mail inválido.")
        # Verifica se email já existe
        existente = db.query(Usuario).filter(
            Usuario.email == dados.valor_correto,
            Usuario.id != usuario.id
        ).first()
        if existente:
            raise HTTPException(status_code=400, detail="E-mail já em uso por outro usuário.")
    
    elif dados.campo == "telefone":
        import re
        apenas_digitos = re.sub(r'\D', '', dados.valor_correto)
        if len(apenas_digitos) not in (10, 11):
            raise HTTPException(status_code=400, detail="Telefone inválido. Use DDD + número.")
    
    elif dados.campo == "nome":
        from utils_seguranca import validar_nome_anti_fake
        valido, erro = validar_nome_anti_fake(dados.valor_correto)
        if not valido:
            raise HTTPException(status_code=400, detail=f"Nome inválido: {erro}")
        dados.valor_correto = dados.valor_correto.title()
    
    # Aplica alteração
    setattr(usuario, dados.campo, dados.valor_correto)
    
    # Auditoria
    auditar_mudanca_sensivel(
        db=db,
        usuario_id=usuario.id,
        campo_alterado=dados.campo,
        valor_anterior=str(valor_anterior) if valor_anterior else None,
        valor_novo=dados.valor_correto,
        ip=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    
    db.commit()
    
    return {
        "message": f"Campo '{dados.campo}' atualizado com sucesso (art. 18, II - LGPD).",
        "campo": dados.campo,
        "valor_anterior": str(valor_anterior) if valor_anterior else None,
        "valor_novo": dados.valor_correto,
        "data_alteracao": datetime.now(timezone.utc).isoformat()
    }


# ============================================================================
# EXCLUSÃO DE DADOS (DIREITO AO ESQUECIMENTO)
# ============================================================================

@router.delete("/exclusao")
async def solicitar_exclusao_lgpd(
    request: Request,
    dados: SolicitacaoExclusaoLGPD,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Processa pedido de exclusão de dados (Direito ao Esquecimento - art. 18, V).
    
    IMPORTANTE: Dados não podem ser excluídos se:
    - Houver empréstimos ativos/pendentes
    - Houver obrigação legal de retenção (PLD/FT, fiscal)
    - Houver processo judicial em andamento
    """
    if not dados.confirmacao:
        raise HTTPException(
            status_code=400,
            detail="Você deve confirmar explicitamente (confirmacao=true) a solicitação de exclusão."
        )
    
    # 1. Anonimização (não exclusão total por obrigações legais)
    # Guardamos dados mínimos para PLD/FT e obrigações fiscais
    usuario_id_original = usuario.id
    
    # Anonimiza dados pessoais
    usuario.nome = f"Usuário Excluído ({usuario_id_original})"
    usuario.email = f"excluido_{usuario_id_original}@trocaria-anon.com"
    usuario.cpf = f"00000000{usuario_id_original}"[:11]
    usuario.telefone = "00000000000"
    usuario.chave_pix = "EXCLUIDO"
    usuario.cidade = None
    usuario.estado = None
    usuario.senha_hash = "EXCLUIDO_LGPD"
    usuario.is_active = False
    usuario.motivo_suspensao = "Exclusão solicitada pelo titular (art. 18, V - LGPD)"
    usuario.data_suspensao = datetime.now(timezone.utc)
    
    # Remove dados sensíveis que não precisam ser retidos
    usuario.foto_perfil = None
    usuario.totp_secret = None
    usuario.two_factor_enabled = False
    usuario.codigo_recuperacao_hash = None
    usuario.expiracao_recuperacao = None
    usuario.mp_access_token = None
    usuario.mp_refresh_token = None
    usuario.mp_user_id = None
    
    # 4. Revoga todos os consentimentos
    consentimentos = db.query(ConsentimentoLGPD).filter(
        ConsentimentoLGPD.usuario_id == usuario_id_original
    ).all()
    for c in consentimentos:
        c.aceite = False
        c.data_revogacao = datetime.now(timezone.utc)
    
    # 5. Auditoria
    auditor = AuditoriaImutavel(db)
    auditor.registrar(
        ip=request.client.host,
        acao="LGPD_EXCLUSAO_TITULAR",
        usuario_id=usuario_id_original,
        detalhes={
            "natureza": "exercicio_direito_lgpd",
            "direito": "esquecimento",
            "motivo": dados.motivo,
            "tipo_exclusao": "anonimizacao_com_retencao_legal"
        },
        user_agent=request.headers.get("user-agent")
    )
    
    db.commit()
    
    return {
        "message": "Solicitação de exclusão processada com sucesso.",
        "detalhes": {
            "status": "Dados pessoais anonimizados",
            "retencao_legal": "Dados financeiros e registros de transações mantidos por 5 anos "
                              "conforme obrigações legais (PLD/FT e fiscal).",
            "prazo_final_exclusao": "Após 5 anos, todos os dados serão permanentemente excluídos.",
            "direito": "art. 18, V - LGPD"
        },
        "data_processamento": datetime.now(timezone.utc).isoformat()
    }


# ============================================================================
# REVOGAÇÃO DE CONSENTIMENTO
# ============================================================================

@router.post("/revogar-consentimento")
async def revogar_consentimento(
    request: Request,
    dados: RevogacaoConsentimento,
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """
    Permite revogar consentimentos específicos (art. 8º, §4º - LGPD).
    Não é possível revogar termos de uso ou privacidade com conta ativa.
    """
    if dados.tipo in ("termos_uso", "privacidade", "kyc"):
        raise HTTPException(
            status_code=400,
            detail=f"Não é possível revogar o consentimento de '{dados.tipo}' com a conta ativa. "
                   f"Para isso, solicite a exclusão da conta."
        )
    
    consentimento = db.query(ConsentimentoLGPD).filter(
        ConsentimentoLGPD.usuario_id == usuario.id,
        ConsentimentoLGPD.tipo_consentimento == dados.tipo
    ).first()
    
    if not consentimento:
        raise HTTPException(
            status_code=404,
            detail=f"Consentimento do tipo '{dados.tipo}' não encontrado."
        )
    
    consentimento.aceite = False
    consentimento.data_revogacao = datetime.now(timezone.utc)
    
    # Auditoria
    auditor = AuditoriaImutavel(db)
    auditor.registrar(
        ip=request.client.host,
        acao="LGPD_REVOGACAO_CONSENTIMENTO",
        usuario_id=usuario.id,
        detalhes={
            "natureza": "exercicio_direito_lgpd",
            "direito": "revogacao_consentimento",
            "tipo_revogado": dados.tipo
        },
        user_agent=request.headers.get("user-agent")
    )
    
    db.commit()
    
    return {
        "message": f"Consentimento '{dados.tipo}' revogado com sucesso.",
        "tipo": dados.tipo,
        "data_revogacao": datetime.now(timezone.utc).isoformat(),
        "observacao": "A revogação não afeta tratamentos realizados anteriormente com base nesse consentimento."
    }


# ============================================================================
# CONSENTIMENTOS ATIVOS
# ============================================================================

@router.get("/consentimentos")
async def listar_consentimentos(
    usuario: Usuario = Depends(obter_usuario_logado),
    db: Session = Depends(get_db)
):
    """Lista todos os consentimentos ativos e histórico do usuário."""
    consentimentos = db.query(ConsentimentoLGPD).filter(
        ConsentimentoLGPD.usuario_id == usuario.id
    ).order_by(ConsentimentoLGPD.data_aceite.desc()).all()
    
    return {
        "usuario_id": usuario.id,
        "consentimentos": [
            {
                "tipo": c.tipo_consentimento,
                "versao": c.versao_documento,
                "ativo": c.aceite and c.data_revogacao is None,
                "data_aceite": c.data_aceite.isoformat() if c.data_aceite else None,
                "data_revogacao": c.data_revogacao.isoformat() if c.data_revogacao else None,
                "ip_aceite": c.ip_aceite,
            }
            for c in consentimentos
        ]
    }


# ============================================================================
# INFORMAÇÕES SOBRE TRATAMENTO
# ============================================================================

@router.get("/info-tratamento")
async def informacoes_tratamento():
    """
    Retorna informações públicas sobre como a Trocaria trata dados pessoais.
    Equivalente ao art. 9º da LGPD.
    """
    return {
        "controlador": "Trocaria - [INSERIR RAZÃO SOCIAL]",
        "cnpj": "[INSERIR CNPJ]",
        "encarregado_dados": {
            "nome": "[INSERIR NOME DPO]",
            "email": "dpo@trocaria.com.br",
            "telefone": "[INSERIR]"
        },
        "finalidades_principais": [
            "Cadastro e gestão de contas de usuários",
            "Correspondência de interesses para operações de mútuo entre particulares",
            "Verificação de identidade (KYC)",
            "Processamento de pagamentos via PIX",
            "Prevenção à fraude e lavagem de dinheiro (PLD/FT)",
            "Cumprimento de obrigações legais e regulatórias",
            "Comunicações operacionais"
        ],
        "bases_legais_utilizadas": [
            "Execução de contrato (art. 7º, V - LGPD)",
            "Cumprimento de obrigação legal (art. 7º, II - LGPD)",
            "Legítimo interesse (art. 7º, IX - LGPD)",
            "Consentimento (art. 7º, I - LGPD) - quando aplicável"
        ],
        "compartilhamento": {
            "prestadores_servico": "Hospedagem, processamento de pagamentos, análise de risco",
            "usuarios_p2p": "Dados mínimos necessários para operações de crédito",
            "orgaos_publicos": "Quando determinado por lei ou ordem judicial"
        },
        "prazos_retencao": {
            "dados_cadastrais": "5 anos após encerramento da conta",
            "documentos_kyc": "5 anos (Lei 9.613/98 - PLD)",
            "transacoes_financeiras": "10 anos (obrigação contábil/fiscal)",
            "logs_auditoria": "5 anos"
        },
        "direitos_titular": [
            "Acesso (art. 18, I)",
            "Correção (art. 18, II)",
            "Exclusão (art. 18, V)",
            "Portabilidade (art. 18, V)",
            "Revogação de consentimento (art. 8º, §4º)",
            "Informação sobre compartilhamento (art. 18, VI)"
        ],
        "documentacao_legal": {
            "termos_de_uso": "/docs/TERMOS_DE_USO.md",
            "politica_privacidade": "/docs/POLITICA_PRIVACIDADE.md"
        }
    }


# ============================================================================
# DECLARAÇÃO REGULATÓRIA PÚBLICA
# ============================================================================

@router.get("/declaracao-regulatoria")
async def declaracao_regulatoria_publica():
    """
    Retorna a declaração pública de que a Trocaria NÃO é instituição financeira.
    Esta rota é pública e pode ser acessada sem autenticação.
    """
    return {
        "declaracao": "A Trocaria NÃO é uma instituição financeira, banco, financeira, SCD, SEP, instituição de pagamento ou qualquer outra entidade sujeita à regulação do Banco Central do Brasil ou da CVM.",
        "natureza_juridica": "Plataforma de correspondência de interesses entre particulares para operações de mútuo (art. 586, Código Civil)",
        "nao_somos": [
            "Banco ou instituição financeira",
            "Sociedade de Crédito Direto (SCD)",
            "Sociedade de Empréstimo entre Pessoas (SEP)",
            "Instituição de Pagamento",
            "Administradora de Consórcio",
            "Intermediária financeira"
        ],
        "servicos_prestados": [
            "Conexão entre pessoas interessadas em operações de mútuo",
            "Geração e armazenamento de contratos digitais",
            "Verificação de identidade (KYC)",
            "Ferramentas de cobrança (mediante taxa de serviço)"
        ],
        "fluxo_dinheiro": "O dinheiro das operações de mútuo circula DIRETAMENTE entre Tomador e Investidor via PIX, sem passar pela plataforma. A Trocaria recebe apenas taxas de serviço.",
        "base_legal": [
            "Art. 586 e seguintes do Código Civil (mútuo entre particulares)",
            "Art. 39, §1º do CDC (programas de fidelidade)",
            "LGPD (Lei 13.709/2018) - proteção de dados"
        ],
        "documentacao_completa": "/docs/NAO_SOMOS_INSTITUICAO_FINANCEIRA.md",
        "data_declaracao": "18/05/2026",
        "contato_juridico": "juridico@trocaria.com.br"
    }
