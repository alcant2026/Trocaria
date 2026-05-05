from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
import bcrypt
import pyotp
from modelos.modelos_db import Usuario, RegistroAuditoria
from database import get_db
import qrcode
import io
import base64
import random
import string
import hashlib
import os
from utils_email import enviar_email_recuperacao, mascarar_email, mascarar_cpf

router = APIRouter(prefix="/auth", tags=["Autenticação"])

class RegistroUsuario(BaseModel):
    nome: str
    email: EmailStr
    cpf: str
    senha: str 
    chave_pix: str
    telefone: str | None = None
    cidade: str | None = None
    estado: str | None = None
    aceite_termos: bool = False

def get_password_hash(password):
    # Bcrypt tem um limite de 72 bytes.
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")

from limitador import limiter
import re

def validar_cpf(cpf: str) -> bool:
    cpf = re.sub(r'[^0-9]', '', cpf)
    if len(cpf) != 11 or len(set(cpf)) == 1:
        return False
    # Cálculo do primeiro dígito verificador
    soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
    digito1 = (soma * 10 % 11) % 10
    # Cálculo do segundo dígito verificador
    soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
    digito2 = (soma * 10 % 11) % 10
    return int(cpf[9]) == digito1 and int(cpf[10]) == digito2

EMAILS_TEMPORARIOS = {'mailinator.com', 'yopmail.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'dropmail.me'}

@router.post("/registrar")
@limiter.limit("3/minute")
async def registrar_usuario(request: Request, dados: RegistroUsuario, db: Session = Depends(get_db)):
    
    # >>> TRAVA BETA: Limite de 100 usuários (remova este bloco para escalar) <<<
    LIMITE_BETA = 100
    total_usuarios = db.query(Usuario).count()
    if total_usuarios >= LIMITE_BETA:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Plataforma em fase beta. Limite de {LIMITE_BETA} usuários atingido. Em breve abriremos mais vagas!"
        )
    # >>> FIM TRAVA BETA <<<

    # Validação 1: Nome Completo (rigorosa — sem empresa por trás, precisamos confiar no nome)
    nome_limpo = " ".join(dados.nome.strip().split())  # Remove espaços duplos
    partes_nome = nome_limpo.split()

    # 1a. Mínimo 2 palavras
    if len(partes_nome) < 2:
        print(f"DEBUG REGISTRO: Nome inválido (partes < 2): {dados.nome}")
        raise HTTPException(status_code=400, detail="Informe nome e sobrenome completos.")

    # 1b. Cada parte deve ter pelo menos 2 letras (bloqueia "A Silva", "J Santos")
    for parte in partes_nome:
        if len(parte) < 2:
            print(f"DEBUG REGISTRO: Parte do nome muito curta: {parte}")
            raise HTTPException(status_code=400, detail="Cada parte do nome deve ter pelo menos 2 letras.")

    # 1c. Só letras e acentos (sem números, @, #, etc.)
    if not re.match(r"^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$", nome_limpo):
        print(f"DEBUG REGISTRO: Nome com caracteres inválidos: {dados.nome}")
        raise HTTPException(status_code=400, detail="Nome não pode conter números ou caracteres especiais.")

    # 1d. Nome total mínimo 5 caracteres
    if len(nome_limpo) < 5:
        print(f"DEBUG REGISTRO: Nome total muito curto (<5): {dados.nome}")
        raise HTTPException(status_code=400, detail="Nome muito curto. Informe seu nome completo.")

    # 1e. Sem repetição suspeita (ex: "aaa aaa", "teste teste")
    if len(set(p.lower() for p in partes_nome)) == 1:
        print(f"DEBUG REGISTRO: Nome com partes repetidas: {dados.nome}")
        raise HTTPException(status_code=400, detail="Nome inválido. Informe seu nome real.")

    # 1f. Normalizar capitalização (Ex: "ROMARIO DANTAS" -> "Romario Dantas")
    nome_limpo = nome_limpo.title()
    dados.nome = nome_limpo

    # Validação 2: Email Temporário Descartável
    dominio_email = dados.email.split('@')[-1].lower()
    if dominio_email in EMAILS_TEMPORARIOS:
        print(f"DEBUG REGISTRO: Email temporário detectado: {dados.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domínios de e-mail temporário não são permitidos por motivos de segurança."
        )

    # Validação 3: Cálculo Estrutural do CPF (Dígito Verificador)
    if not validar_cpf(dados.cpf):
        print(f"DEBUG REGISTRO: CPF inválido: {dados.cpf}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CPF inválido. Verifique o número digitado."
        )

    # NOVO: Normalizar CPF (remover pontos e traços) ANTES de salvar no Banco
    dados.cpf = re.sub(r'[^0-9]', '', dados.cpf)

    # Validação 4: Verificar se email ou CPF já existem no Banco
    usuario_existente = db.query(Usuario).filter(
        (Usuario.email == dados.email) | (Usuario.cpf == dados.cpf)
    ).first()
    
    if usuario_existente:
        print(f"DEBUG REGISTRO: Email ou CPF já cadastrados: {dados.email} / {dados.cpf}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou CPF já cadastrados."
        )

    if not dados.aceite_termos:
        print(f"DEBUG REGISTRO: Falta aceite de termos.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você precisa aceitar os Termos de Uso e Política de Privacidade para se cadastrar."
        )

    # Criar registro de auditoria para o aceite de termos
    agora = datetime.now(timezone.utc)
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        municipio=f"{dados.cidade}/{dados.estado}" if dados.cidade else "Localização não informada",
        user_agent=request.headers.get("user-agent"),
        data_registro=agora
    )
    db.add(auditoria)
    db.flush()

    # Criar novo usuário com senha hashed
    from utils_data import gerar_id_customizado
    
    novo_id = gerar_id_customizado()
    # Garantir unicidade do ID (simples check)
    while db.query(Usuario).filter(Usuario.id == novo_id).first():
        novo_id = gerar_id_customizado()

    novo_usuario = Usuario(
        id=novo_id,
        nome=dados.nome,
        email=dados.email,
        cpf=dados.cpf,
        senha_hash=get_password_hash(dados.senha),
        chave_pix=dados.chave_pix,
        telefone=dados.telefone,
        cidade=dados.cidade,
        estado=dados.estado,
        aceite_termos=dados.aceite_termos,
        auditoria_id=auditoria.id,
        saldo=0,
        score=0
    )

    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    return {"message": "Usuário registrado com sucesso!", "usuario_id": novo_usuario.id}

import os
from dotenv import load_dotenv

load_dotenv()

# Configurações JWT
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    import secrets
    SECRET_KEY = secrets.token_hex(32)
    print("⚠️ SECRET_KEY nao configurada. Usando chave aleatoria temporaria. Sessoes serao invalidadas ao reiniciar.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440)) # 24 horas default

from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

async def obter_usuario_logado(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de acesso ausente.")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido.")
        
        usuario = db.query(Usuario).filter(Usuario.id == user_id).first()
        if not usuario:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
        return usuario
    except Exception as e:
        # Silenciar erros de boot repetitivos em logs de produção
        pass
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Erro ao validar credenciais. Por favor, faça login novamente."
        )
def verificar_token_manual(token: str) -> str | None:
    """Decodifica um token e retorna o sub (id do usuário) se válido."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        return None

async def exigir_admin(usuario: Usuario = Depends(obter_usuario_logado)):
    if not usuario.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Esta operação exige privilégios de administrador."
        )
    return usuario

class LoginUsuario(BaseModel):
    cpf: str
    senha: str

def verify_password(plain_password, hashed_password):
    try:
        password_bytes = plain_password.encode("utf-8")[:72]
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, dados: LoginUsuario, db: Session = Depends(get_db)):
    # Normalizar CPF (remover pontos e traços)
    cpf_limpo = re.sub(r'[^0-9]', '', dados.cpf)
    
    usuario = db.query(Usuario).filter(
        Usuario.cpf == cpf_limpo,
        Usuario.is_active == True
    ).first()
    
    if not usuario:
        print(f"DEBUG LOGIN: Usuário NÃO encontrado para CPF {cpf_limpo}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="CPF ou senha incorretos."
        )

    # SEGURANÇA: Bloquear login do ID de sistema
    if usuario.id == "000PL":
        print(f"ALERTA SEGURANÇA: Tentativa de login negada para ID de sistema 000PL.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="CPF ou senha incorretos."
        )

    senha_valida = verify_password(dados.senha, usuario.senha_hash)

    if not senha_valida:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="CPF ou senha incorretos."
        )

    access_token = create_access_token(data={"sub": str(usuario.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "usuario": {
            "id": usuario.id,
            "nome": usuario.nome,
            "saldo": float(usuario.saldo),
            "score": float(usuario.score),
            "is_admin": usuario.is_admin,
            "is_verified": usuario.is_verified,
            "two_factor_enabled": usuario.two_factor_enabled,
            "is_subscriber": usuario.is_subscriber,
            "assinatura_expira_em": usuario.assinatura_expira_em.isoformat() if usuario.assinatura_expira_em else None,
            "pontos_marketplace": usuario.pontos_marketplace,
            "mp_access_token": bool(usuario.mp_access_token)
        }
    }

@router.get("/perfil")
async def obter_perfil(usuario: Usuario = Depends(obter_usuario_logado)):
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "saldo": float(usuario.saldo),
        "credito_virtual": float(usuario.credito_virtual or 0),
        "score": float(usuario.score),
        "is_admin": usuario.is_admin,
        "is_verified": usuario.is_verified,
        "cpf": usuario.cpf,
        "email": usuario.email,
        "chave_pix": usuario.chave_pix,
        "telefone": usuario.telefone,
        "cidade": usuario.cidade,
        "estado": usuario.estado,
        "two_factor_enabled": usuario.two_factor_enabled,
        "aceite_cookies": usuario.aceite_cookies,
        "is_subscriber": usuario.is_subscriber,
        "assinatura_expira_em": usuario.assinatura_expira_em.isoformat() if usuario.assinatura_expira_em else None,
        "pontos_marketplace": usuario.pontos_marketplace,
        "mp_access_token": bool(usuario.mp_access_token),
        "foto_url": f"/auth/view-foto/{usuario.id}" if usuario.foto_perfil else None
    }

class AtualizarPerfil(BaseModel):
    email: str | None = None
    telefone: str | None = None
    chave_pix: str | None = None

@router.put("/perfil")
async def atualizar_perfil(dados: AtualizarPerfil, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    u = db.query(Usuario).filter(Usuario.id == usuario.id).first()
    alterado = []
    if dados.email is not None:
        import re as _re
        if not _re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', dados.email):
            raise HTTPException(status_code=400, detail="Email invalido.")
        if db.query(Usuario).filter(Usuario.email == dados.email, Usuario.id != u.id).first():
            raise HTTPException(status_code=400, detail="Email ja em uso.")
        u.email = dados.email
        alterado.append("email")
    if dados.telefone is not None:
        apenas_digitos = re.sub(r'\D', '', dados.telefone)
        if len(apenas_digitos) not in (10, 11):
            raise HTTPException(status_code=400, detail="Telefone invalido. Use DDD + numero (10 ou 11 digitos).")
        u.telefone = dados.telefone
        alterado.append("telefone")
    if dados.chave_pix is not None:
        if not dados.chave_pix.strip():
            raise HTTPException(status_code=400, detail="Chave PIX nao pode estar vazia.")
        u.chave_pix = dados.chave_pix.strip()
        alterado.append("chave_pix")
    if not alterado:
        raise HTTPException(status_code=400, detail="Nenhum campo enviado.")
    db.commit()
    return {"message": f"Campos atualizados: {', '.join(alterado)}.", "chave_pix": u.chave_pix, "telefone": u.telefone, "email": u.email}

import secrets as _secrets

ALLOWED_FOTO_TYPES = {"image/png", "image/jpeg", "image/jpg"}
FOTO_MAGIC = {b'\x89PNG\r\n\x1a\n': 'image/png', b'\xff\xd8\xff': 'image/jpeg'}
MAX_FOTO_SIZE = 2 * 1024 * 1024

@router.post("/upload-foto")
async def upload_foto_perfil(foto: UploadFile = File(...), db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if foto.content_type not in ALLOWED_FOTO_TYPES:
        raise HTTPException(status_code=400, detail="Formato nao permitido. Use PNG ou JPG.")
    conteudo = await foto.read()
    if len(conteudo) > MAX_FOTO_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Maximo 2MB.")
    valido = any(conteudo.startswith(m) for m in FOTO_MAGIC)
    if not valido:
        raise HTTPException(status_code=400, detail="Arquivo invalido ou corrompido.")
    ext = "png" if conteudo.startswith(b'\x89PNG') else "jpg"
    nome = f"foto_{usuario.id}_{_secrets.token_hex(8)}.{ext}"
    caminho = os.path.join("uploads", nome)
    with open(caminho, "wb") as f:
        f.write(conteudo)
    if usuario.foto_perfil:
        try:
            if os.path.exists(usuario.foto_perfil):
                os.remove(usuario.foto_perfil)
        except: pass
    usuario.foto_perfil = caminho
    db.commit()
    return {"message": "Foto atualizada!", "url": f"/auth/view-foto/{usuario.id}"}

@router.get("/view-foto/{usuario_id}")
async def view_foto_perfil(usuario_id: str, db: Session = Depends(get_db)):
    u = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not u or not u.foto_perfil or not os.path.exists(u.foto_perfil):
        raise HTTPException(status_code=404, detail="Foto nao encontrada.")
    return FileResponse(u.foto_perfil)

@router.post("/aceitar-cookies")
async def aceitar_cookies(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    """Registra o consentimento de cookies para o usuário logado."""
    usuario.aceite_cookies = True
    usuario.data_aceite_cookies = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Preferências de cookies salvas."}

@router.post("/2fa/gerar")
async def gerar_2fa(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    """Gera um novo segredo TOTP e retorna a URI para o QR Code."""
    if usuario.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA já está ativado.")
    
    if not usuario.totp_secret:
        usuario.totp_secret = pyotp.random_base32()
        db.commit()
    
    totp = pyotp.TOTP(usuario.totp_secret)
    provisioning_uri = totp.provisioning_uri(name=usuario.email, issuer_name="PSY PAY App")
    
    try:
        # Gerar imagem do QR Code
        img = qrcode.make(provisioning_uri)
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode()
        
        return {
            "secret": usuario.totp_secret, 
            "uri": provisioning_uri, 
            "qr_code": f"data:image/png;base64,{qr_base64}"
        }
    except Exception as e:
        print(f"Erro ao gerar QR Code: {e}")
        # Se falhar a imagem, ainda retornamos o segredo para pareamento manual
        return {
            "secret": usuario.totp_secret, 
            "uri": provisioning_uri, 
            "qr_code": None,
            "error": "Não foi possível gerar a imagem do QR Code no servidor."
        }

@router.post("/2fa/ativar")
@limiter.limit("5/minute")
async def ativar_2fa(request: Request, codigo: str, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    """Valida o código e ativa definitivamente o 2FA para o usuário."""
    if not usuario.totp_secret:
        raise HTTPException(status_code=400, detail="Segredo 2FA não gerado.")
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if totp.verify(codigo):
        usuario.two_factor_enabled = True
        # Só marca a alteração se for RE-ativação (campo já existia = o usuário desativou antes)
        # No primeiro cadastro do 2FA, ultima_alteracao_2fa fica NULL → sem trava de 48h
        if usuario.ultima_alteracao_2fa is not None:
            usuario.ultima_alteracao_2fa = datetime.now(timezone.utc)
        db.commit()
        return {"message": "2FA ativado com sucesso!"}
    else:
        raise HTTPException(status_code=400, detail="Código 2FA inválido.")

@router.post("/2fa/desativar")
@limiter.limit("3/minute")
async def desativar_2fa(request: Request, senha: str, codigo: str, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    """Desativa o 2FA mediante validação de senha e código atual."""
    if not verify_password(senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Senha incorreta.")
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if not totp.verify(codigo):
        raise HTTPException(status_code=400, detail="Código 2FA inválido.")
    
    usuario.two_factor_enabled = False
    usuario.totp_secret = None
    usuario.ultima_alteracao_2fa = datetime.now(timezone.utc)
    db.commit()
    return {"message": "2FA desativado."}

class SolicitacaoExclusao(BaseModel):
    senha: str

@router.delete("/excluir-conta")
async def excluir_conta(dados: SolicitacaoExclusao, request: Request, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    # 0. Segurança: Validar Senha ANTES de qualquer processamento
    if not verify_password(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha incorreta. A exclusão da conta exige confirmação de segurança."
        )

    # 1. Validar se tem empréstimos ativos (PENDENTE ou APROVADO)
    from modelos.modelos_db import SolicitacaoEmprestimo, StatusSolicitacao
    
    tem_pendencias = db.query(SolicitacaoEmprestimo).filter(
        SolicitacaoEmprestimo.usuario_id == usuario.id,
        SolicitacaoEmprestimo.status.in_([StatusSolicitacao.PENDENTE, StatusSolicitacao.APROVADO])
    ).first()
    
    if tem_pendencias:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível excluir a conta com empréstimos ativos ou pendentes. Quite suas dívidas primeiro."
        )
    
    # 2. Anonimizar dados sensíveis (LGPD)
    usuario.nome = "Usuário Excluído"
    usuario.email = f"excluido_{usuario.id}@psypay.com.br"
    usuario.cpf = f"000.000.000-{usuario.id}"
    usuario.chave_pix = "removida"
    usuario.senha_hash = "DELETADO"
    usuario.is_active = False
    
    # Registrar auditoria da exclusão
    from modelos.modelos_db import AcaoAdmin
    db.add(RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=datetime.now(timezone.utc),
        municipio="Exclusão de Conta (Self-Service)"
    ))

    db.commit()
    return {"message": "Conta excluída com sucesso. Seus dados foram anonimizados conforme a LGPD."}

# --- ROTAS DE RECUPERAÇÃO DE SENHA (SEGURANÇA BANCÁRIA) ---

class SolicitarRecuperacao(BaseModel):
    cpf: str

class RedefinirSenha(BaseModel):
    cpf: str
    codigo: str
    nova_senha: str

from fastapi import BackgroundTasks

@router.post("/recuperar-senha/solicitar")
@limiter.limit("3/minute")
async def solicitar_recuperacao(request: Request, dados: SolicitarRecuperacao, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Inicia o fluxo de recuperação validando o CPF e enviando o código."""
    cpf_limpo = re.sub(r'[^0-9]', '', dados.cpf)
    
    usuario = db.query(Usuario).filter(Usuario.cpf == cpf_limpo, Usuario.is_active == True).first()
    
    # Por segurança (prevenção de enumeração), se o usuário não existir, não damos erro explícito
    if not usuario:
        # Mas demoramos um pouco para evitar timing attacks
        import time
        time.sleep(0.5)
        return {"message": "Se o CPF estiver cadastrado, um código foi enviado.", "email_mascarado": "da***@em***.com"}

    # Gerar código de 6 dígitos
    codigo = "".join(random.choices(string.digits, k=6))
    
    # Salvar Hash do código (Segurança Bancária: nunca salvar limpo)
    usuario.codigo_recuperacao_hash = hashlib.sha256(codigo.encode()).hexdigest()
    usuario.expiracao_recuperacao = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    db.commit()

    # Enviar e-mail em SEGUNDO PLANO (Não bloqueia o worker do Render)
    background_tasks.add_task(enviar_email_recuperacao, usuario.email, usuario.nome, codigo)
    
    return {
        "message": "Código enviado com sucesso.",
        "email_mascarado": mascarar_email(usuario.email)
    }

@router.post("/recuperar-senha/redefinir")
@limiter.limit("5/minute")
async def redefinir_senha(request: Request, dados: RedefinirSenha, db: Session = Depends(get_db)):
    """Valida o código e redefine a senha do usuário."""
    cpf_limpo = re.sub(r'[^0-9]', '', dados.cpf)
    
    usuario = db.query(Usuario).filter(Usuario.cpf == cpf_limpo, Usuario.is_active == True).first()
    
    if not usuario or not usuario.codigo_recuperacao_hash:
        raise HTTPException(status_code=400, detail="Solicitação de recuperação não encontrada ou expirada.")

    # Verificar expiração
    if datetime.now(timezone.utc) > usuario.expiracao_recuperacao:
        usuario.codigo_recuperacao_hash = None # Limpa por segurança
        db.commit()
        raise HTTPException(status_code=400, detail="O código de recuperação expirou (limite de 15 min).")

    # Validar código
    hash_enviado = hashlib.sha256(dados.codigo.encode()).hexdigest()
    if hash_enviado != usuario.codigo_recuperacao_hash:
        raise HTTPException(status_code=400, detail="Código de recuperação inválido.")

    # Validar nova senha (mínimo 6 caracteres sugerido)
    if len(dados.nova_senha) < 6:
        raise HTTPException(status_code=400, detail="A nova senha deve ter pelo menos 6 caracteres.")

    # Sucesso: Atualizar senha e limpar campos de recuperação
    usuario.senha_hash = get_password_hash(dados.nova_senha)
    usuario.codigo_recuperacao_hash = None
    usuario.expiracao_recuperacao = None
    
    # Registrar auditoria
    agora = datetime.now(timezone.utc)
    auditoria = RegistroAuditoria(
        ip=request.client.host,
        user_agent=request.headers.get("user-agent"),
        data_registro=agora,
        municipio="Redefinição de Senha"
    )
    db.add(auditoria)
    
    db.commit()
    
    return {"message": "Sua senha foi redefinida com sucesso! Você já pode fazer login."}

