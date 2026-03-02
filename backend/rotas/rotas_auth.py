from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt
from datetime import datetime, timedelta
import bcrypt
from modelos.modelos_db import Usuario
from database import get_db

router = APIRouter(prefix="/auth", tags=["Autenticação"])

class RegistroUsuario(BaseModel):
    nome: str
    email: EmailStr
    cpf: str
    senha: str 
    chave_pix: str
    aceite_termos: bool = False

def get_password_hash(password):
    # Bcrypt tem um limite de 72 bytes.
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")

@router.post("/registrar")
async def registrar_usuario(dados: RegistroUsuario, db: Session = Depends(get_db)):
    # Verificar se email ou CPF já existem
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
async def login(dados: LoginUsuario, db: Session = Depends(get_db)):
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
            "is_verified": usuario.is_verified
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
        "chave_pix": usuario.chave_pix
    }

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
