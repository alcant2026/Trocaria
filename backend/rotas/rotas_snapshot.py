from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, SolicitacaoEmprestimo, Investimento, GarantiaSocial, AcessoInvestidor, StatusSolicitacao
from sqlalchemy import func
from datetime import timezone, timedelta

router = APIRouter(prefix="/snapshot", tags=["Snapshot"])

TZ_BRASILIA = timezone(timedelta(hours=-3))

@router.get("")
async def obter_snapshot_dashboard(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Endpoint consolidado único para evitar circularidades e reduzir carga.
    """
    # 1. Perfil
    data = {
        "perfil": {
            "id": usuario.id,
            "nome": usuario.nome,
            "saldo": float(usuario.saldo),
            "score": float(usuario.score),
            "is_admin": usuario.is_admin,
            "is_verified": usuario.is_verified,
            "cpf": usuario.cpf,
            "chave_pix": usuario.chave_pix,
            "cidade": usuario.cidade,
            "estado": usuario.estado
        },
        "historico": []
    }

    # 2. Histórico
    transacoes = db.query(Transacao).filter(Transacao.usuario_id == usuario.id).order_by(Transacao.data_criacao.desc()).limit(10).all()
    for t in transacoes:
        data_t = t.data_criacao
        if data_t.tzinfo is None:
            data_t = data_t.replace(tzinfo=timezone.utc)
        data["historico"].append({
            "id": t.id,
            "valor": float(t.valor),
            "tipo": t.tipo.value,
            "status": t.status,
            "detalhes": t.detalhes,
            "data": data_t.astimezone(TZ_BRASILIA).isoformat()
        })

    # 3. Dados por Perfil
    if usuario.is_admin:
        # Importações locais seguras
        from rotas.rotas_financeiro import obter_resumo_fiscal, listar_pendentes
        try:
            data["admin"] = {
                "pendentes": await listar_pendentes(db, usuario),
                "fiscal": await obter_resumo_fiscal(db, usuario)
            }
        except Exception:
            data["admin"] = {"pendentes": [], "fiscal": None}

    # Tomador
    from rotas.rotas_emprestimo import listar_meus_emprestimos, listar_garantias_pendentes
    try:
        data["tomador"] = {
            "meus_emprestimos": await listar_meus_emprestimos(db, usuario),
            "garantias_pendentes": await listar_garantias_pendentes(db, usuario)
        }
    except Exception:
        data["tomador"] = {"meus_emprestimos": [], "garantias_pendentes": []}

    # Investidor
    from rotas.rotas_investidor import ver_carteira
    from rotas.rotas_emprestimo import listar_solicitacoes
    try:
        data["investidor"] = {
            "solicitacoes_disponiveis": await listar_solicitacoes(db, usuario),
            "carteira": await ver_carteira(db, usuario)
        }
    except Exception:
        data["investidor"] = {"solicitacoes_disponiveis": [], "carteira": []}

    return data
