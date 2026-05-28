from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
from database import get_db
from modelos.modelos_db import Usuario, ProdutoResgate
from rotas.rotas_auth import exigir_admin
from utils_ranking import calcular_pontos_minimos

router = APIRouter(prefix="/admin/produtos", tags=["Admin - Produtos Resgate"])


@router.post("")
async def criar_produto(
    dados: dict,
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    nome = dados.get("nome")
    valor_reais = Decimal(str(dados.get("valor_reais", 0)))
    foto_url = dados.get("foto_url")
    descricao = dados.get("descricao", "")
    quantidade = int(dados.get("quantidade_disponivel", 1))

    if not nome or valor_reais <= 0:
        raise HTTPException(status_code=400, detail="Nome e valor_reais sao obrigatorios")

    pontos = calcular_pontos_minimos(valor_reais)

    produto = ProdutoResgate(
        nome=nome,
        descricao=descricao,
        foto_url=foto_url,
        valor_reais=valor_reais,
        pontos_minimos=pontos,
        quantidade_disponivel=quantidade,
        status="ativo",
    )
    db.add(produto)
    db.commit()
    db.refresh(produto)

    return {
        "message": "Produto criado",
        "produto": {
            "id": produto.id,
            "nome": produto.nome,
            "valor_reais": float(produto.valor_reais),
            "pontos_minimos": produto.pontos_minimos,
            "quantidade_disponivel": produto.quantidade_disponivel,
            "foto_url": produto.foto_url,
        }
    }


@router.get("")
async def listar_produtos_admin(
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    produtos = db.query(ProdutoResgate).order_by(ProdutoResgate.data_criacao.desc()).all()
    return [
        {
            "id": p.id,
            "nome": p.nome,
            "descricao": p.descricao,
            "foto_url": p.foto_url,
            "valor_reais": float(p.valor_reais),
            "pontos_minimos": p.pontos_minimos,
            "quantidade_disponivel": p.quantidade_disponivel,
            "status": p.status,
            "data_criacao": p.data_criacao.isoformat(),
        }
        for p in produtos
    ]


@router.put("/{produto_id}")
async def atualizar_produto(
    produto_id: int,
    dados: dict,
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    produto = db.query(ProdutoResgate).filter(ProdutoResgate.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")

    if "nome" in dados:
        produto.nome = dados["nome"]
    if "descricao" in dados:
        produto.descricao = dados["descricao"]
    if "foto_url" in dados:
        produto.foto_url = dados["foto_url"]
    if "valor_reais" in dados:
        valor = Decimal(str(dados["valor_reais"]))
        produto.valor_reais = valor
        produto.pontos_minimos = calcular_pontos_minimos(valor)
    if "quantidade_disponivel" in dados:
        produto.quantidade_disponivel = int(dados["quantidade_disponivel"])
    if "status" in dados:
        produto.status = dados["status"]

    db.commit()
    db.refresh(produto)

    return {
        "message": "Produto atualizado",
        "produto": {
            "id": produto.id,
            "nome": produto.nome,
            "valor_reais": float(produto.valor_reais),
            "pontos_minimos": produto.pontos_minimos,
            "quantidade_disponivel": produto.quantidade_disponivel,
            "status": produto.status,
        }
    }


@router.delete("/{produto_id}")
async def deletar_produto(
    produto_id: int,
    admin: Usuario = Depends(exigir_admin),
    db: Session = Depends(get_db)
):
    produto = db.query(ProdutoResgate).filter(ProdutoResgate.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")

    db.delete(produto)
    db.commit()
    return {"message": "Produto removido"}
