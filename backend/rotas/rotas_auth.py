from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta
import bcrypt
import pyotp
from modelos.modelos_db import Usuario
from database import get_db
import qrcode
import io
import base64

router = APIRouter(prefix="/auth", tags=["Autenticação"])

class RegistroUsuario(BaseModel):
    nome: str
    email: EmailStr
    cpf: str
    senha: str 
    chave_pix: str
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
    
    # Validação 1: Nome Completo (Mínimo 2 palavras e sem caracteres especiais)
    nome_limpo = dados.nome.strip()
    if not re.match(r"^[A-Za-zÀ-ÖØ-öø-ÿ]+\s+[A-Za-zÀ-ÖØ-öø-ÿ]+", nome_limpo):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe seu nome completo (Nome e Sobrenome) sem números ou caracteres especiais."
        )

    # Validação 2: Email Temporário Descartável
    dominio_email = dados.email.split('@')[-1].lower()
    if dominio_email in EMAILS_TEMPORARIOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domínios de e-mail temporário não são permitidos por motivos de segurança."
        )

    # Validação 3: Cálculo Estrutural do CPF (Dígito Verificador)
    if not validar_cpf(dados.cpf):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CPF inválido. Verifique o número digitado."
        )

    # Validação 4: Verificar se email ou CPF já existem no Banco
    usuario_existente = db.query(Usuario).filter(
        (Usuario.email == dados.email) | (Usuario.cpf == dados.cpf)
    ).first()
    
    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ou CPF já cadastrados."
        )

    if not dados.aceite_termos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você precisa aceitar os Termos de Uso e Política de Privacidade para se cadastrar."
        )

    # Criar novo usuário com senha hashed
    novo_usuario = Usuario(
        nome=dados.nome,
        email=dados.email,
        cpf=dados.cpf,
        senha_hash=get_password_hash(dados.senha),
        chave_pix=dados.chave_pix,
        cidade=dados.cidade,
        estado=dados.estado,
        aceite_termos=dados.aceite_termos,
        data_aceite=datetime.utcnow(),
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
SECRET_KEY = os.getenv("SECRET_KEY", "mudar_em_producao_123456")
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
        
        usuario = db.query(Usuario).filter(Usuario.id == int(user_id)).first()
        if not usuario:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
        return usuario
    except Exception as e:
        print(f"Erro JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Erro ao validar credenciais. Por favor, faça login novamente."
        )

async def exigir_admin(usuario: Usuario = Depends(obter_usuario_logado)):
    if not usuario.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Esta operação exige privilégios de administrador."
        )
    return usuario

class LoginUsuario(BaseModel):
    email: EmailStr
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
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, dados: LoginUsuario, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(
        Usuario.email == dados.email,
        Usuario.is_active == True
    ).first()
    
    if not usuario or not verify_password(dados.senha, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos."
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
            "two_factor_enabled": usuario.two_factor_enabled
        }
    }

@router.get("/perfil")
async def obter_perfil(usuario: Usuario = Depends(obter_usuario_logado)):
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "saldo": float(usuario.saldo),
        "score": float(usuario.score),
        "is_admin": usuario.is_admin,
        "is_verified": usuario.is_verified,
        "cpf": usuario.cpf,
        "chave_pix": usuario.chave_pix,
        "cidade": usuario.cidade,
        "estado": usuario.estado,
        "two_factor_enabled": usuario.two_factor_enabled
    }

@router.post("/2fa/gerar")
async def gerar_2fa(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    """Gera um novo segredo TOTP e retorna a URI para o QR Code."""
    if usuario.two_factor_enabled:
        raise HTTPException(status_code=400, detail="2FA já está ativado.")
    
    if not usuario.totp_secret:
        usuario.totp_secret = pyotp.random_base32()
        db.commit()
    
    totp = pyotp.TOTP(usuario.totp_secret)
    provisioning_uri = totp.provisioning_uri(name=usuario.email, issuer_name="Peer App")
    
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
async def ativar_2fa(codigo: str, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    """Valida o código e ativa definitivamente o 2FA para o usuário."""
    if not usuario.totp_secret:
        raise HTTPException(status_code=400, detail="Segredo 2FA não gerado.")
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if totp.verify(codigo):
        usuario.two_factor_enabled = True
        db.commit()
        return {"message": "2FA ativado com sucesso!"}
    else:
        raise HTTPException(status_code=400, detail="Código 2FA inválido.")

@router.post("/2fa/desativar")
async def desativar_2fa(senha: str, codigo: str, usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    """Desativa o 2FA mediante validação de senha e código atual."""
    if not verify_password(senha, usuario.senha_hash):
        raise HTTPException(status_code=401, detail="Senha incorreta.")
    
    totp = pyotp.TOTP(usuario.totp_secret)
    if not totp.verify(codigo):
        raise HTTPException(status_code=400, detail="Código 2FA inválido.")
    
    usuario.two_factor_enabled = False
    usuario.totp_secret = None
    db.commit()
    return {"message": "2FA desativado."}

@router.delete("/excluir-conta")
async def excluir_conta(usuario: Usuario = Depends(obter_usuario_logado), db: Session = Depends(get_db)):
    # 1. Validar se tem empréstimos ativos (PENDENTE ou APROVADO)
    # Importação local para evitar circular dependency se necessário, mas está no mesmo repositório
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
    usuario.email = f"excluido_{usuario.id}@peer.com.br"
    usuario.cpf = f"000.000.000-{usuario.id}"
    usuario.chave_pix = "removida"
    usuario.senha_hash = "DELETADO"
    usuario.is_active = False
    
    db.commit()
    return {"message": "Conta excluída com sucesso. Seus dados foram anonimizados conforme a LGPD."}
