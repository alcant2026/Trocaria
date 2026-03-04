from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, engine
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, SolicitacaoEmprestimo, Investimento, GarantiaSocial, AcessoInvestidor, StatusSolicitacao
from sqlalchemy import func, case, and_, text
from datetime import timezone, timedelta, datetime
from decimal import Decimal

router = APIRouter(tags=["Snapshot"])

TZ_BRASILIA = timezone(timedelta(hours=-3))

# Cache Level 1 (Em Memória) para reduzir carga no DB Neon
# Estrutura: {usuario_id: (timestamp_validade, dados_json)}
cache_snapshot_data = {}
CACHE_TTL_SEG = 15 # 15 segundos de "paz" para o banco de dados

@router.get("/snapshot")
@router.get("/snapshot/")
async def obter_snapshot_dashboard(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Endpoint de Snapshot Autocontido com Cache de 15s.
    """
    agora_ts = datetime.utcnow().timestamp()
    
    # Verificar Cache
    if usuario.id in cache_snapshot_data:
        validade, dados = cache_snapshot_data[usuario.id]
        if agora_ts < validade:
            return dados

    try:
        # 1. Perfil Básico (Sempre retorna)
        snapshot = {
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
                "estado": usuario.estado,
                "two_factor_enabled": usuario.two_factor_enabled
            },
            "historico": []
        }

        # 2. Histórico (Top 10)
        transacoes = db.query(Transacao).filter(Transacao.usuario_id == usuario.id).order_by(Transacao.data_criacao.desc()).limit(10).all()
        for t in transacoes:
            data_t = t.data_criacao
            if data_t.tzinfo is None:
                data_t = data_t.replace(tzinfo=timezone.utc)
            snapshot["historico"].append({
                "id": t.id,
                "valor": float(t.valor),
                "tipo": t.tipo.value,
                "status": t.status,
                "detalhes": t.detalhes,
                "data": data_t.astimezone(TZ_BRASILIA).isoformat()
            })

        # 3. Dados por Perfil (Lógica duplicada aqui para evitar circularidade)
        
        # --- ADMIN DATA ---
        if usuario.is_admin:
            # Pendências
            pendentes_raw = db.query(Transacao).join(Usuario).filter(
                Transacao.status == "pendente",
                Transacao.tipo.in_([TipoTransacao.DEPOSITO.value, TipoTransacao.SAQUE.value, TipoTransacao.DESBLOQUEIO_DADOS.value])
            ).all()
            
            pendentes_list = []
            for p in pendentes_raw:
                data_p = p.data_criacao
                if data_p.tzinfo is None: data_p = data_p.replace(tzinfo=timezone.utc)
                pendentes_list.append({
                    "transacao_id": p.id,
                    "usuario_nome": p.usuario.nome,
                    "valor": float(p.valor),
                    "tipo": p.tipo.value,
                    "detalhes": p.detalhes,
                    "data": data_p.astimezone(TZ_BRASILIA).isoformat()
                })

            # Fiscal Resumo Otimizado (Lógica replicada de rotas_financeiro para evitar circularidade)
            tipos_receita = [
                TipoTransacao.COMPRA_SCORE, 
                TipoTransacao.DESBLOQUEIO_DADOS, 
                TipoTransacao.TAXA_SAQUE, 
                TipoTransacao.TAXA_INTERMEDIACAO,
                TipoTransacao.APORTE_CAPITAL
            ]

            saldo_usuarios = db.query(func.sum(Usuario.saldo)).scalar() or Decimal("0.00")
            total_lucro_historico = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_([t.value for t in tipos_receita]),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            total_sacado_admin = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo == TipoTransacao.SAQUE.value,
                Transacao.detalhes.like("RESGATE DE LUCRO %"),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            agora_br = datetime.now(TZ_BRASILIA)
            primeiro_dia_mes = agora_br.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

            receitas_mes_query = db.query(Transacao.tipo, func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_([t.value for t in tipos_receita]),
                Transacao.status == "concluido",
                Transacao.data_criacao >= primeiro_dia_mes
            ).group_by(Transacao.tipo).all()

            detalhamento_mes = {t.name.lower(): Decimal("0.00") for t in tipos_receita}
            for tipo, soma in receitas_mes_query:
                detalhamento_mes[tipo.value] = soma

            # Histórico Mensal
            if "sqlite" in str(engine.url):
                trunc_fn = func.strftime('%Y-%m', Transacao.data_criacao)
            else:
                trunc_fn = func.to_char(Transacao.data_criacao, 'YYYY-MM')

            historico_raw = db.query(
                trunc_fn.label("mes"),
                func.sum(case((Transacao.tipo == TipoTransacao.DEPOSITO.value, Transacao.valor), else_=0)).label("depositos"),
                func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE.value, ~Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("saques"),
                func.sum(case((Transacao.tipo.in_([t.value for t in tipos_receita]), Transacao.valor), else_=0)).label("lucro"),
                func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE.value, Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("lucro_sacado")
            ).filter(Transacao.status == "concluido").group_by("mes").order_by(text("mes DESC")).limit(12).all()

            historico_mes = []
            for h in historico_raw:
                historico_mes.append({
                    "mes": h.mes,
                    "depositos": float(h.depositos or 0),
                    "saques": float(h.saques or 0),
                    "lucro": float(h.lucro or 0),
                    "lucro_sacado": float(h.lucro_sacado or 0)
                })

            snapshot["admin"] = {
                "pendentes": pendentes_list,
                "fiscal": {
                    "saldo_usuarios_gerenciado": float(saldo_usuarios),
                    "lucro_plataforma_total": float(sum(detalhamento_mes.values())),
                    "lucro_plataforma_historico": float(total_lucro_historico),
                    "lucro_disponivel": float(total_lucro_historico - total_sacado_admin),
                    "detalhamento_lucro": {
                        "taxas_postagem": float(detalhamento_mes.get('taxa_intermediacao', 0)),
                        "desbloqueio_lgpd": float(detalhamento_mes.get('desbloqueio_dados', 0)),
                        "kyc_e_score": float(detalhamento_mes.get('compra_score', 0)),
                        "taxas_saque_extra": float(detalhamento_mes.get('taxa_saque', 0)),
                        "taxas_intermediacao_p2p": float(detalhamento_mes.get('taxa_intermediacao', 0))
                    },
                    "historico_mensal": historico_mes
                }
            }

        # --- TOMADOR DATA ---
        solicitacoes_tomador = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.usuario_id == usuario.id).all()
        meus_emp_list = []
        for s in solicitacoes_tomador:
            # Replicando lógica de juros e parcelas de rotas_emprestimo
            taxa_mensal = s.taxa_juros / 100
            total_com_juros = s.valor * (Decimal("1") + (taxa_mensal * s.prazo_meses))
            valor_parcela = total_com_juros / s.prazo_meses
            
            total_pago_real = (valor_parcela * s.parcelas_pagas) + s.valor_amortizado
            if s.status == StatusSolicitacao.CONCLUIDO:
                valor_total_restante = 0.00
            else:
                valor_total_restante = max(0, float((total_com_juros + s.taxas_adicionais) - total_pago_real))

            meus_emp_list.append({
                "id": s.id,
                "valor": float(s.valor),
                "valor_arrecadado": float(s.valor_arrecadado),
                "taxa_juros": float(s.taxa_juros),
                "parcelas": s.prazo_meses,
                "parcelas_pagas": s.parcelas_pagas,
                "valor_parcela": round(float(valor_parcela), 2),
                "valor_total_restante": round(valor_total_restante, 2),
                "status": s.status.value,
                "proximo_vencimento": s.proximo_vencimento.isoformat() if s.proximo_vencimento else None,
                "garantidores": [
                    {
                        "nome": g.garante.nome.split()[0],
                        "aceito": g.aceito
                    } for g in s.garantias_sociais
                ]
            })

        garantias_raw = db.query(GarantiaSocial).filter(GarantiaSocial.garante_id == usuario.id, GarantiaSocial.aceito == False).all()
        garantias_list = []
        for g in garantias_raw:
            garantias_list.append({
                "id": g.id, # Importante incluir o ID da garantia para aceitar/rejeitar
                "solicitacao_id": g.solicitacao_id,
                "valor": float(g.solicitacao.valor),
                "tomador": g.solicitacao.usuario.nome.split()[0]
            })
            
        snapshot["tomador"] = {
            "meus_emprestimos": meus_emp_list,
            "garantias_pendentes": garantias_list
        }

        # --- INVESTIDOR DATA ---
        solicitacoes_raw = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE.value).all()
        
        # Obter IDs de solicitações já desbloqueadas por este investidor
        desbloqueadas_ids = {a.solicitacao_id for a in db.query(AcessoInvestidor.solicitacao_id).filter(AcessoInvestidor.investidor_id == usuario.id).all()}
        
        solic_list = []
        for s in solicitacoes_raw:
            is_unlocked = s.id in desbloqueadas_ids
            solic_list.append({
                "id": s.id,
                "valor": float(s.valor),
                "valor_arrecadado": float(s.valor_arrecadado),
                "taxa": float(s.taxa_juros) if is_unlocked else 0, # Oculto se bloqueado
                "parcelas": s.prazo_meses if is_unlocked else 0,
                "nome": s.usuario.nome if is_unlocked else None,
                "score": float(s.usuario.score) if is_unlocked else float(s.usuario.score), # O score costuma ser visível para atrair investidor
                "verified": s.usuario.is_verified,
                "unlocked": is_unlocked,
                "expira_4h": s.data_expiracao_4h.isoformat() if s.data_expiracao_4h else None,
                "expira_5d": s.data_expiracao_5d.isoformat() if s.data_expiracao_5d else None
            })
            
        carteira_raw = db.query(Investimento).filter(Investimento.investidor_id == usuario.id).all()
        carteira_list = []
        for i in carteira_raw:
            carteira_list.append({
                "id": i.id,
                "valor_investido": float(i.valor_investido),
                "status_emprestimo": i.solicitacao.status.value,
                "tomador_nome": i.solicitacao.usuario.nome.split()[0],
                "taxa": float(i.solicitacao.taxa_juros),
                "pago_para_investidor": float(i.pago_para_investidor)
            })

        snapshot["investidor"] = {
            "solicitacoes_disponiveis": solic_list,
            "carteira": carteira_list
        }

        # Salvar no Cache antes de retornar
        cache_snapshot_data[usuario.id] = (agora_ts + CACHE_TTL_SEG, snapshot)
        
        return snapshot

    except Exception as e:
        print(f"Erro no Snapshot: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar snapshot.")
