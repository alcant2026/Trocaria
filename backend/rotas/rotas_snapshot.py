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
        print(f"[DEBUG SNAPSHOT] Iniciando perfil para usuario {usuario.id}")
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
                "two_factor_enabled": usuario.two_factor_enabled,
                "saldo_caixa": float(usuario.saldo_caixa or 0)
            },
            "historico": []
        }

        # 2. Histórico (Top 10)
        print(f"[DEBUG SNAPSHOT] Buscando histórico")
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
            print(f"[DEBUG SNAPSHOT] Iniciando bloco ADMIN")
            # Pendências
            pendentes_raw = db.query(Transacao).join(Usuario).filter(
                Transacao.status == "pendente",
                Transacao.tipo.in_([TipoTransacao.DEPOSITO, TipoTransacao.SAQUE, TipoTransacao.DESBLOQUEIO_DADOS])
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
                TipoTransacao.APORTE_CAPITAL,
                TipoTransacao.TAXA_POSTAGEM,
                TipoTransacao.RETORNO_INVESTIMENTO
            ]

            saldo_usuarios = db.query(func.sum(Usuario.saldo)).scalar() or Decimal("0.00")
            total_lucro_historico = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            # Dados da Plataforma (Usuário 000PL)
            plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
            if not plataforma:
                # Fallback se o 000PL ainda não foi criado no banco
                p_saldo = Decimal("0.00")
                p_saldo_caixa = Decimal("0.00")
            else:
                p_saldo = plataforma.saldo
                p_saldo_caixa = plataforma.saldo_caixa

            total_sacado_admin = db.query(func.sum(Transacao.valor)).filter(
                Transacao.usuario_id == "000PL", # Saques agora são no 000PL
                Transacao.tipo == TipoTransacao.SAQUE,
                Transacao.detalhes.like("RESGATE DE LUCRO %"),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            total_investido_institucional = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo == TipoTransacao.INVESTIMENTO,
                Transacao.detalhes.like("%LUCRO%"),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            agora_br = datetime.now(TZ_BRASILIA)
            primeiro_dia_mes = agora_br.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

            receitas_mes_query = db.query(Transacao.tipo, func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido",
                Transacao.data_criacao >= primeiro_dia_mes
            ).group_by(Transacao.tipo).all()

            detalhamento_mes = {t.name.lower(): Decimal("0.00") for t in tipos_receita}
            for tipo, soma in receitas_mes_query:
                detalhamento_mes[tipo.value] = soma

            # Histórico Mensal
            print(f"[DEBUG SNAPSHOT] Buscando histórico mensal (GROUP BY)")
            if "sqlite" in str(engine.url):
                trunc_fn = func.strftime('%Y-%m', Transacao.data_criacao)
            else:
                trunc_fn = func.to_char(Transacao.data_criacao, 'YYYY-MM')

            historico_raw = db.query(
                trunc_fn.label("mes"),
                func.sum(case((Transacao.tipo == TipoTransacao.DEPOSITO, Transacao.valor), else_=0)).label("depositos"),
                func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, ~Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("saques"),
                func.sum(case((Transacao.tipo.in_(tipos_receita), Transacao.valor), else_=0)).label("lucro"),
                func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("lucro_sacado")
            ).filter(Transacao.status == "concluido").group_by(trunc_fn).order_by(text("mes DESC")).limit(12).all()

            historico_mes = []
            for h in historico_raw:
                historico_mes.append({
                    "mes": h.mes,
                    "total_entrada": float(h.depositos or 0),
                    "total_saida": float(h.saques or 0),
                    "receita_plataforma": float(h.lucro or 0),
                    "total_sacado": float(h.lucro_sacado or 0)
                })

            # Calcular Juros Acumulados no Pool para o Admin (Lógica Híbrida)
            # 1. Total Aportado pelo Admin ao Pool (Reinvestimentos)
            total_aportado_pool = db.query(func.sum(Transacao.valor)).filter(
                Transacao.usuario_id == usuario.id,
                Transacao.tipo == TipoTransacao.APORTE_CAIXA,
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            # 2. Total Resgatado pelo Admin do Pool
            total_resgatado_pool = db.query(func.sum(Transacao.valor)).filter(
                Transacao.usuario_id == usuario.id,
                Transacao.tipo == TipoTransacao.RESGATE_CAIXA,
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            # 3. Juros Calculados via Logs (Novas Transações)
            transacoes_pool_logs = db.query(Transacao.detalhes).filter(
                Transacao.usuario_id == usuario.id,
                Transacao.tipo == TipoTransacao.RETORNO_POOL,
                Transacao.status == "concluido"
            ).all()
            
            juros_via_logs = Decimal("0.00")
            import re
            for t in transacoes_pool_logs:
                if t.detalhes:
                    match = re.search(r"Juros(?: Est\. Admin)?: ([\d\.]+)", t.detalhes)
                    if match:
                        juros_via_logs += Decimal(match.group(1))

            # 4. Reconciliação Híbrida:
            # Se o saldo atual é maior que (Aportes - Resgates), a diferença é lucro histórico (antes dos logs detalhados)
            capital_liquido_investido = total_aportado_pool - total_resgatado_pool
            lucro_reconciliado = max(Decimal("0.00"), usuario.saldo_caixa - capital_liquido_investido)
            
            # Usamos o maior entre a reconciliação e a soma dos logs (para evitar duplicidade ou perdas)
            juros_acumulados_pool = max(lucro_reconciliado, juros_via_logs)

            snapshot["admin"] = {
                "pendentes": pendentes_list,
                "fiscal": {
                    "saldo_usuarios_gerenciado": float(saldo_usuarios),
                    "lucro_plataforma_total": float(sum(detalhamento_mes.values())),
                    "lucro_plataforma_historico": float(total_lucro_historico),
                    "lucro_disponivel": float(p_saldo), # Lucro disponível é o saldo do 000PL
                    "saldo_pool_caixa": float(saldo_pool_caixa),
                    "meu_saldo_pool": float(p_saldo_caixa), # Capital da empresa no Pool
                    "lucro_acumulado_pool": float(juros_acumulados_pool),
                    "detalhamento_lucro": {
                        "taxas_postagem": float(detalhamento_mes.get('taxa_postagem', 0)),
                        "desbloqueio_dados": float(detalhamento_mes.get('desbloqueio_dados', 0)),
                        "kyc_score": float(detalhamento_mes.get('compra_score', 0)),
                        "taxas_saque": float(detalhamento_mes.get('taxa_saque', 0)),
                        "taxa_intermediacao": float(detalhamento_mes.get('taxa_intermediacao', 0)),
                        "aportes_externos": float(detalhamento_mes.get('aporte_capital', 0)),
                        "retorno_investimento": float(detalhamento_mes.get('retorno_investimento', 0))
                    },
                    "historico_mensal": historico_mes
                },
                "emprestimos_para_liberar": [],
                "solicitacoes_ativas": []
            }

            # 6. Todas as Solicitações Ativas (Para investimento institucional)
            solicitacoes_ativas = db.query(SolicitacaoEmprestimo).filter(
                SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE
            ).all()

            for sa in solicitacoes_ativas:
                snapshot["admin"]["solicitacoes_ativas"].append({
                    "id": sa.id,
                    "tomador": sa.usuario.nome,
                    "valor": float(sa.valor),
                    "valor_arrecadado": float(sa.valor_arrecadado),
                    "score": float(sa.usuario.score),
                    "taxa": float(sa.taxa_juros),
                    "parcelas": sa.prazo_meses,
                    "sugestao_pool": float(sa.sugestao_pool or 0)
                })

            # 6. Empréstimos que bateram a meta mas não liberaram (Falta garantidor)
            stuck_loans = db.query(SolicitacaoEmprestimo).filter(
                SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
                SolicitacaoEmprestimo.valor_arrecadado >= SolicitacaoEmprestimo.valor
            ).all()

            for sl in stuck_loans:
                snapshot["admin"]["emprestimos_para_liberar"].append({
                    "id": sl.id,
                    "tomador": sl.usuario.nome,
                    "valor": float(sl.valor),
                    "arrecadado": float(sl.valor_arrecadado),
                    "garantidores_atuais": len(sl.garantias_sociais)
                })

        # --- TOMADOR DATA ---
        print(f"[DEBUG SNAPSHOT] Iniciando bloco TOMADOR")
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
                "data_expiracao_4h": s.data_expiracao_4h.isoformat() if s.data_expiracao_4h else None,
                "data_expiracao_5d": s.data_expiracao_5d.isoformat() if s.data_expiracao_5d else None,
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
        print(f"[DEBUG SNAPSHOT] Iniciando bloco INVESTIDOR")
        solicitacoes_raw = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE).all()
        
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
            
        print(f"[DEBUG SNAPSHOT] Buscando carteira do investidor")
        carteira_raw = db.query(Investimento).filter(Investimento.investidor_id == usuario.id).all()
        carteira_list = []
        for i in carteira_raw:
            s = i.solicitacao
            taxa_mensal = s.taxa_juros / 100
            valor_total_ativo = i.valor_investido * (Decimal("1") + (taxa_mensal * s.prazo_meses))
            valor_mensal = valor_total_ativo / s.prazo_meses
            
            valor_recebido = i.pago_para_investidor
            valor_restante = max(0, float(valor_total_ativo - valor_recebido))
            if s.status == StatusSolicitacao.CONCLUIDO:
                valor_restante = 0.0

            carteira_list.append({
                "id": i.id,
                "solicitacao_id": s.id,
                "valor_investido": float(i.valor_investido),
                "valor_mensal": round(float(valor_mensal), 2),
                "valor_recebido": float(valor_recebido),
                "valor_restante": round(valor_restante, 2),
                "status_emprestimo": s.status.value,
                "tomador_nome": s.usuario.nome.split()[0],
                "tomador_is_verified": s.usuario.is_verified,
                "taxa": float(s.taxa_juros),
                "parcelas_pagas": s.parcelas_pagas,
                "total_parcelas": s.prazo_meses
            })

        snapshot["investidor"] = {
            "solicitacoes_disponiveis": solic_list,
            "carteira": carteira_list
        }

        # Salvar no Cache antes de retornar
        print(f"[DEBUG SNAPSHOT] Finalizado com sucesso para {usuario.id}")
        cache_snapshot_data[usuario.id] = (agora_ts + CACHE_TTL_SEG, snapshot)
        
        return snapshot

    except Exception as e:
        print(f"Erro no Snapshot: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar snapshot.")
