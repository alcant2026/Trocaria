import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, engine
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, SolicitacaoEmprestimo, StatusSolicitacao, DocumentoVerificacao
from sqlalchemy import func, case, and_, or_, text
from datetime import timezone, timedelta, datetime
from decimal import Decimal
from utils_emprestimo import calcular_divida_total
import psutil

router = APIRouter(tags=["Snapshot"])

TZ_BRASILIA = timezone(timedelta(hours=-3))

# Cache Level 1 (Em Memória) para reduzir carga no DB Neon
# Estrutura: {usuario_id: (timestamp_validade, dados_json)}
cache_snapshot_data = {}
CACHE_TTL_SEG = 30 # 30 segundos de cache para reduzir carga no banco

# Versão do cache — incrementar aqui força invalidação de todos os snapshots cacheados
# quando o servidor reinicia com novos campos no perfil
CACHE_VERSION = "v5_render_free_tier"

@router.get("/snapshot")
@router.get("/snapshot/")
async def obter_snapshot_dashboard(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """
    Endpoint de Snapshot Autocontido com Cache de 15s.
    """
    agora_ts = datetime.now(timezone.utc).timestamp()
    agora_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    
    # Lazy-Cleaning: Expurgar solicitações expiradas (4h/5d) antes de ler o BD
    try:
        from utils_emprestimo import processar_expiracoes_interna
    except ImportError:
        processar_expiracoes_interna = None
    if processar_expiracoes_interna:
        try:
            usuarios_afetados = processar_expiracoes_interna(db)
            if usuarios_afetados:
                for uid in usuarios_afetados:
                    cache_snapshot_data.pop(uid, None)
                cache_snapshot_data.pop("000PL", None)
        except Exception as e:
            pass
    if usuario.id in cache_snapshot_data:
        validade, dados = cache_snapshot_data[usuario.id]
        if agora_ts < validade:
            return dados

    try:
        from modelos.modelos_db import Parceiro
        parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
        is_parceiro = parceiro is not None

        # Verificar Status KYC (Documentos Pendentes)
        kyc_pendente = db.query(DocumentoVerificacao).filter(
            DocumentoVerificacao.usuario_id == usuario.id,
            DocumentoVerificacao.status == "pendente"
        ).first()
        kyc_status = "pendente" if kyc_pendente else ("verificado" if usuario.is_verified else "nenhum")
        
        # 0. Calcular Dívida Total Pendente (Skin in the game guarantee)
        divida_total_pendente = Decimal("0.00")
        emprestimos_ativos = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.usuario_id == usuario.id,
            SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
        ).all()
        for emp in emprestimos_ativos:
            divida_total_pendente += calcular_divida_total(emp)
        
        saldo_caixa_total = usuario.saldo_caixa or Decimal("0.00")
        saldo_caixa_disponivel = max(Decimal("0.00"), saldo_caixa_total - divida_total_pendente)

        # 0.1 Calcular Métricas Financeiras (Otimizado)
        capital_aportado = Decimal("0.00")
        capital_resgatado = Decimal("0.00")
        if usuario.saldo_caixa and usuario.saldo_caixa > 0:
            capital_aportado = db.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
                Transacao.usuario_id == usuario.id,
                Transacao.tipo.in_([TipoTransacao.APORTE_CAIXA, TipoTransacao.APORTE_POOL]),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")
            capital_resgatado = db.query(func.coalesce(func.sum(Transacao.valor), 0)).filter(
                Transacao.usuario_id == usuario.id,
                Transacao.tipo.in_([TipoTransacao.RESGATE_CAIXA, TipoTransacao.RESGATE_POOL]),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

        capital_liquido = max(Decimal("0.00"), capital_aportado - capital_resgatado)
        rendimento_abs = max(Decimal("0.00"), (usuario.saldo_caixa or 0) - capital_liquido)
        rendimento_pct = (float(rendimento_abs) / float(capital_liquido)) * 100 if capital_liquido > 0 else 0.0

        snapshot = {
            "perfil": {
                "id": usuario.id,
                "nome": usuario.nome,
                "saldo": float(usuario.saldo),
                "credito_virtual": float(usuario.credito_virtual or 0),
                "score": float(usuario.score),
                "is_admin": usuario.is_admin,
                "is_verified": usuario.is_verified,
                "kyc_status": kyc_status,
                "email": usuario.email,
                "telefone": usuario.telefone,
                "foto_url": f"/auth/view-foto/{usuario.id}" if usuario.foto_perfil else None,
                "codigo_indicacao": usuario.codigo_indicacao,
                "cpf": usuario.cpf,
                "chave_pix": usuario.chave_pix,
                "cidade": usuario.cidade,
                "estado": usuario.estado,
                "two_factor_enabled": usuario.two_factor_enabled,
                "saldo_caixa": float(saldo_caixa_total),
                "saldo_pool": float(saldo_caixa_total), # Alias para o frontend
                "saldo_caixa_disponivel": float(saldo_caixa_disponivel),
                "rendimento_pool_abs": float(rendimento_abs),
                "rendimento_pool_pct": float(rendimento_pct),
                "divida_total_pool": float(divida_total_pendente),
                "is_parceiro": is_parceiro,
                "parceiro_id": parceiro.id if parceiro else None,
                "parceiro_cnpj": parceiro.cnpj if parceiro else None,
                "parceiro_razao_social": parceiro.razao_social if parceiro else None,
                "parceiro_cnpj_status": parceiro.cnpj_status if parceiro else None,
                "caixa_aberto": parceiro.caixa_aberto if parceiro else False,
                "prazo": parceiro.prazo_liquidacao if parceiro else 0,
                "taxa_loja": float(parceiro.taxa_comissao or 0) if parceiro else 0.0,
                "comissoes_acumuladas": float(parceiro.comissoes_acumuladas or 0) if parceiro else 0.0,
                "comissoes_pendentes": float(parceiro.comissoes_pendentes or 0) if parceiro else 0.0,
                "saldo_caixa_inicial": float(parceiro.saldo_caixa_inicial or 0) if parceiro else 0.0,
                "saldo_caixa_atual": float(parceiro.saldo_caixa_atual or 0) if parceiro else 0.0,
                "is_subscriber": usuario.is_subscriber,
                "assinatura_expira_em": usuario.assinatura_expira_em.isoformat() if usuario.assinatura_expira_em else None,
                "pontos_marketplace": usuario.pontos_marketplace,
                # Dividendos
                "gasto_total_taxas": float(usuario.gasto_total_taxas or 0),
                "total_dividendos_ganhos": float(usuario.total_dividendos_ganhos or 0),
            },
            "historico": []
        }

        # 2. Histórico (Top 10) - Filtrando taxas administrativas que o usuário não quer ver (KYC/Score)
        transacoes = db.query(Transacao).filter(
            Transacao.usuario_id == usuario.id,
            Transacao.tipo != TipoTransacao.DESBLOQUEIO_DADOS,
            Transacao.tipo != TipoTransacao.COMPRA_SCORE
        ).order_by(Transacao.data_criacao.desc()).limit(10).all()
        for t in transacoes:
            data_t = t.data_criacao
            if data_t.tzinfo is None:
                data_t = data_t.replace(tzinfo=timezone.utc)
            snapshot["historico"].append({
                "id": t.id,
                "valor": float(t.valor),
                "tipo": t.tipo.value,
                "status": t.status,
                "metodo": t.metodo,
                "detalhes": t.detalhes,
                "confirmado_cliente": t.confirmado_cliente,
                "data_confirmacao_cliente": t.data_confirmacao_cliente.replace(tzinfo=timezone.utc).isoformat() if t.data_confirmacao_cliente else None,
                "data": data_t.astimezone(TZ_BRASILIA).isoformat()
            })

        # --- NOVO: MARKETPLACE DA COMUNIDADE (CPM ADS) ---
        from modelos.modelos_db import LinkAfiliado
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        
        # 1. LIMPEZA INTELIGENTE DO MARKETPLACE
        # GRÁTIS: expirou (24h) OU views acabaram → DELETA do BD (libera espaço)
        db.query(LinkAfiliado).filter(
            LinkAfiliado.is_boosted == False,
            or_(
                LinkAfiliado.data_expiracao < agora,
                LinkAfiliado.visualizacoes_restantes <= 0
            )
        ).delete()
        
        # PAGO: views acabaram → apenas desativa (pode recomprar)
        db.query(LinkAfiliado).filter(
            LinkAfiliado.is_boosted == True,
            LinkAfiliado.visualizacoes_restantes <= 0,
            LinkAfiliado.is_active == True
        ).update({"is_active": False})
        
        # PAGO: 30 dias sem atividade (expirado) → DELETA do BD
        db.query(LinkAfiliado).filter(
            LinkAfiliado.is_boosted == True,
            LinkAfiliado.is_active == False,
            LinkAfiliado.data_expiracao < agora
        ).delete()
        
        db.commit()

        # 2. Buscar 6 anúncios ativos (Premium primeiro, excluindo o próprio usuário)
        ads_ativos = db.query(LinkAfiliado).filter(
            LinkAfiliado.is_active == True,
            LinkAfiliado.visualizacoes_restantes > 0,
            LinkAfiliado.usuario_id != usuario.id
        ).order_by(LinkAfiliado.is_boosted.desc(), func.random()).limit(6).all()

        snapshot["comunidade_shop"] = []
        for ad in ads_ativos:
            # Views NÃO são consumidas aqui (apenas na listagem).
            # O consumo real acontece via POST /comunidade/registrar-view quando o usuário clica.
            snapshot["comunidade_shop"].append({
                "id": ad.id,
                "nome": ad.nome_produto,
                "url": ad.url_afiliado,
                "img": ad.url_imagem,
                "valor": float(ad.valor) if ad.valor else 0.00,
                "patrocinado": ad.is_boosted,
                "views_restantes": ad.visualizacoes_restantes
            })
        db.commit()

        # 3. Dados por Perfil (Lógica duplicada aqui para evitar circularidade)
        tipos_receita = [
            TipoTransacao.COMPRA_SCORE, 
            TipoTransacao.DESBLOQUEIO_DADOS, 
            TipoTransacao.TAXA_SAQUE, 
            TipoTransacao.TAXA_INTERMEDIACAO,
            TipoTransacao.TAXA_ESPECIE,
            TipoTransacao.TAXA_POSTAGEM,
            TipoTransacao.RETORNO_INVESTIMENTO,
            TipoTransacao.TAXA_ADM_EMPRESTIMO,
            TipoTransacao.ASSINATURA,
            TipoTransacao.APORTE_CAPITAL
        ]

        # --- ADMIN DATA ---
        if usuario.is_admin:
            # Configurações de tempo para a visão fiscal de 30 dias
            from datetime import timedelta
            agora_br = datetime.now(TZ_BRASILIA).replace(tzinfo=None)
            data_30_dias_atras = agora_br - timedelta(days=30)
            # Pendências
            pendentes_raw = db.query(Transacao).join(Usuario).filter(
                Transacao.status == "pendente",
                Transacao.tipo.in_([TipoTransacao.DEPOSITO, TipoTransacao.SAQUE, TipoTransacao.DESBLOQUEIO_DADOS]),
                Transacao.parceiro_id == None
            ).all()
            
            pendentes_list = []
            for p in pendentes_raw:
                data_p = p.data_criacao
                if data_p.tzinfo is None: data_p = data_p.replace(tzinfo=timezone.utc)
                
                info_p = {
                    "transacao_id": p.id,
                    "usuario_id": p.usuario.id,
                    "usuario_nome": p.usuario.nome,
                    "usuario_cpf": p.usuario.cpf,
                    "usuario_verificado": p.usuario.is_verified,
                    "usuario_chave_pix": p.usuario.chave_pix,
                    "valor": float(p.valor),
                    "tipo": p.tipo.value,
                    "status": p.status,
                    "detalhes": p.detalhes,
                    "confirmado_cliente": p.confirmado_cliente,
                    "data_confirmacao_cliente": p.data_confirmacao_cliente.isoformat() if p.data_confirmacao_cliente else None,
                    "data": data_p.astimezone(TZ_BRASILIA).isoformat(),
                    "tem_rg": False,
                    "tem_renda": False,
                    "tem_residencia": False,
                    "url_rg": None,
                    "url_renda": None,
                    "url_residencia": None
                }

                # Se for KYC, buscar se tem arquivos vinculados (pegando sempre o envio mais recente)
                if p.tipo == TipoTransacao.DESBLOQUEIO_DADOS:
                    docs = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == p.usuario.id).order_by(DocumentoVerificacao.id.desc()).first()
                    if docs:
                        def parse_url(path, tipo):
                            if not path: return None
                            return f"/api/financeiro/admin/view-doc/{docs.usuario_id}/{tipo}"

                        info_p["tem_rg"] = bool(docs.caminho_rg)
                        info_p["tem_renda"] = bool(docs.caminho_renda)
                        info_p["tem_residencia"] = bool(docs.caminho_residencia)
                        info_p["url_rg"] = parse_url(docs.caminho_rg, "rg")
                        info_p["url_renda"] = parse_url(docs.caminho_renda, "renda")
                        info_p["url_residencia"] = parse_url(docs.caminho_residencia, "residencia")

                pendentes_list.append(info_p)

            # Fiscal Resumo Otimizado (Lógica replicada de rotas_financeiro para evitar circularidade)

            # Soma de saldos de usuários REAIS (Exclui conta de sistema 000PL)
            saldo_usuarios = db.query(func.sum(Usuario.saldo)).filter(Usuario.id != "000PL").scalar() or Decimal("0.00")
            total_lucro_historico = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            # 1. Saldo Total no Pool (Soma de todos os usuários)
            saldo_pool_caixa = db.query(func.sum(Usuario.saldo_caixa)).scalar() or Decimal("0.00")

            # 2. Dados da Plataforma (Usuário 000PL) para Isolação
            plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
            if not plataforma:
                p_saldo = Decimal("0.00")
                p_saldo_caixa = Decimal("0.00")
            else:
                p_saldo = plataforma.saldo or Decimal("0.00")
                p_saldo_caixa = plataforma.saldo_caixa or Decimal("0.00")

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

            # 3. Comissões pendentes (Passivo com parceiros)
            total_comissoes_pendentes = db.query(func.sum(Parceiro.comissoes_acumuladas)).filter(
                Parceiro.is_active == True
            ).scalar() or Decimal("0.00")

            # 4. Lucro Disponível (Cálculo Virtual para consistência com rotas_financeiro)
            lucro_disponivel_virtual = max(Decimal("0.00"), total_lucro_historico - total_sacado_admin - total_investido_institucional - total_comissoes_pendentes)

            # 4.1 Cálculo de Taxas Operacionais (1% de cada PIX no Checkout Pro)
            total_pix_recebido = db.query(func.sum(Transacao.valor)).filter(
                Transacao.metodo == "pix",
                Transacao.tipo.in_([TipoTransacao.DEPOSITO, TipoTransacao.APORTE_CAPITAL]),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")
            
            # Taxa Padrão: 1% (R$ 0.01 por cada R$ 1.00)
            total_taxas_mp = (total_pix_recebido * Decimal("0.01"))
            
            # 4.2 Custos Fixos de Infraestrutura (Mensais/Deduções)
            # Render: R$ 0.00 (Por enquanto no Free Tier conforme solicitado)
            custo_render = Decimal("0.00")
            custo_neon = Decimal("0.00")
            total_infra = custo_render + custo_neon
            
            # 4.2.1 Custos com Prêmios e Cashback (Marketplace Points)
            # Esses valores são deduzidos do lucro da plataforma (000PL)
            total_premios_marketplace = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo == TipoTransacao.RETORNO_POOL,
                Transacao.detalhes.like("%Pontos Marketplace%"),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            # 4.3 Lucro Real Líquido (Abatendo taxas, infra e prêmios)
            lucro_real_liquido = max(Decimal("0.00"), lucro_disponivel_virtual - total_taxas_mp - total_infra - total_premios_marketplace)

            # 4.4 Custódia Total Estimada (Líquido esperado sem considerar dívida externa)
            custodia_total_estimada = (saldo_pool_caixa + p_saldo_caixa)

            # 5. Detalhamento de Receitas (HISTÓRICO ACUMULADO por padrão)
            # Nota: Trocamos o detalhamento de 'mes' para 'historia' para não aparecer zerado no dia 1º.
            receitas_totais_query = db.query(Transacao.tipo, func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido"
            ).group_by(Transacao.tipo).all()

            detalhamento_total = {t.name.lower(): Decimal("0.00") for t in tipos_receita}
            for tipo, soma in receitas_totais_query:
                detalhamento_total[tipo.value] = soma

            # 5.2 Receita Bruta (Últimos 30 dias - Rolling Window)
            lucro_mensal_plataforma_bruto = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido",
                Transacao.data_criacao >= data_30_dias_atras
            ).scalar() or Decimal("0.00")

            # Prêmios do mês
            premios_mensais = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo == TipoTransacao.RETORNO_POOL,
                Transacao.detalhes.like("%Pontos Marketplace%"),
                Transacao.status == "concluido",
                Transacao.data_criacao >= data_30_dias_atras
            ).scalar() or Decimal("0.00")

            # Receita Bruta Real (Dedução imediata de bônus)
            lucro_mensal_plataforma = max(Decimal("0.00"), lucro_mensal_plataforma_bruto - premios_mensais)

            # Histórico Mensal")
            if "sqlite" in str(engine.url):
                trunc_fn = func.strftime('%Y-%m', Transacao.data_criacao)
            else:
                trunc_fn = func.to_char(Transacao.data_criacao, 'YYYY-MM')

            historico_raw = db.query(
                trunc_fn.label("mes"),
                func.sum(case((Transacao.tipo == TipoTransacao.DEPOSITO, Transacao.valor), else_=0)).label("depositos"),
                func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, ~Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("saques"),
                func.sum(case((Transacao.tipo.in_(tipos_receita), Transacao.valor), else_=0)).label("lucro_bruto"),
                func.sum(case((and_(Transacao.tipo == TipoTransacao.RETORNO_POOL, Transacao.detalhes.like("%Pontos Marketplace%")), Transacao.valor), else_=0)).label("premios"),
                func.sum(case((and_(Transacao.tipo == TipoTransacao.SAQUE, Transacao.detalhes.like("RESGATE DE LUCRO %")), Transacao.valor), else_=0)).label("lucro_sacado")
            ).filter(Transacao.status == "concluido").group_by(trunc_fn).order_by(text("mes DESC")).limit(12).all()

            historico_mes = []
            for h in historico_raw:
                lucro_liquido_mensal = max(Decimal("0.00"), (h.lucro_bruto or 0) - (h.premios or 0))
                historico_mes.append({
                    "mes": h.mes,
                    "total_entrada": float(h.depositos or 0),
                    "total_saida": float(h.saques or 0),
                    "lucro": float(lucro_liquido_mensal),
                    "lucro_sacado": float(h.lucro_sacado or 0)
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

            # 4. Cálculo de Crédito Ativo (Empréstimos na rua)
            total_credito_ativo = db.query(func.sum(SolicitacaoEmprestimo.valor)).filter(
                SolicitacaoEmprestimo.status == StatusSolicitacao.APROVADO
            ).scalar() or Decimal("0.00")

            # 5. Reconciliação Híbrida:
            # Se o saldo atual é maior que (Aportes - Resgates), a diferença é lucro histórico (antes dos logs detalhados)
            capital_liquido_investido = total_aportado_pool - total_resgatado_pool
            lucro_reconciliado = max(Decimal("0.00"), usuario.saldo_caixa - capital_liquido_investido)
            
            # Usamos o maior entre a reconciliação e a soma dos logs (para evitar duplicidade ou perdas)
            juros_acumulados_pool = max(lucro_reconciliado, juros_via_logs)
            
            # Aportes Institucionais (Últimos 30 dias)
            aportes_mes = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo == TipoTransacao.APORTE_CAPITAL,
                Transacao.status == "concluido",
                Transacao.data_criacao >= data_30_dias_atras
            ).scalar() or Decimal("0.00")
            # --- MÉTRICAS DE HARDWARE (REAL-TIME) ---
            try:
                # Detecção de Limites de Plano (Render Free Tier)
                is_render = os.getenv("RENDER") == "true"
                
                cpu_uso = psutil.cpu_percent(interval=0.1)
                cpu_threads_host = psutil.cpu_count(logical=True) or 1
                ram_host = psutil.virtual_memory()
                ram_total_gb_host = round(ram_host.total / (1024**3), 1)

                if is_render:
                    # Limites do Plano Render Free: 512MB RAM e ~1 CPU compartilhado
                    cpu_threads = 1
                    ram_total_gb = 0.5
                    # Ajustamos o uso proporcionalmente ao limite do plano se psutil reportar o host
                    ram_uso = min(100.0, (float(ram_host.used) / (0.5 * 1024**3)) * 100) if ram_host.used else 0.0
                else:
                    cpu_threads = cpu_threads_host
                    ram_total_gb = ram_total_gb_host
                    ram_uso = ram_host.percent

                if ram_total_gb < 0.1: ram_total_gb = 0.5 # Fallback de emergência
                
                print(f"📊 HARDWARE ({'RENDER' if is_render else 'LOCAL'}): CPU {cpu_uso}% ({cpu_threads} threads) | RAM {ram_uso}% ({ram_total_gb}GB)")
            except Exception as e:
                print(f"Erro ao coletar métricas de hardware: {e}")
                cpu_uso = 0
                cpu_threads = 0
                ram_uso = 0
                ram_total_gb = 0

            # 8. Saques Concluídos Recentemente (Para Auditoria de Recebimento)
            concluidos_raw = db.query(Transacao).join(Usuario).filter(
                Transacao.status == "concluido",
                Transacao.tipo == TipoTransacao.SAQUE
            ).order_by(Transacao.data_criacao.desc()).limit(20).all()

            concluidos_list = []
            for c in concluidos_raw:
                data_c = c.data_criacao
                if data_c.tzinfo is None: data_c = data_c.replace(tzinfo=timezone.utc)
                concluidos_list.append({
                    "transacao_id": c.id,
                    "usuario_nome": c.usuario.nome,
                    "valor": float(c.valor),
                    "data": data_c.astimezone(TZ_BRASILIA).isoformat(),
                    "confirmado_cliente": c.confirmado_cliente,
                    "data_confirmacao_cliente": c.data_confirmacao_cliente.replace(tzinfo=timezone.utc).isoformat() if c.data_confirmacao_cliente else None,
                    "detalhes": c.detalhes
                })

            snapshot["admin"] = {
                "pendentes": pendentes_list,
                "concluidos_recentes": concluidos_list,
                "fiscal": {
                        "custodia_total": float(custodia_total_estimada),
                        "saldo_usuarios_gerenciado": float(saldo_usuarios),
                        "lucro_plataforma_total": float(lucro_mensal_plataforma),
                        "lucro_plataforma_historico": float(total_lucro_historico),
                        "lucro_disponivel": float(lucro_disponivel_virtual),
                        "lucro_real_liquido": float(lucro_real_liquido),
                        "total_taxas_mp": float(total_taxas_mp),
                        "custos_infra_estimados": float(total_infra),
                        "saldo_pool_caixa": float(saldo_pool_caixa),
                        "saldo_plataforma": float(p_saldo),
                        "meu_saldo_pool": float(p_saldo_caixa), # Capital da empresa no Pool
                        "lucro_acumulado_pool": float(juros_acumulados_pool),
                        "total_credito_ativo": float(total_credito_ativo),
                        "cpu_uso": cpu_uso,
                        "cpu_threads": cpu_threads,
                        "ram_uso": ram_uso,
                        "ram_total": ram_total_gb,
                    "detalhamento_lucro": {
                        "taxa_postagem": float(detalhamento_total.get('taxa_postagem', 0)),
                        "desbloqueio_dados": float(detalhamento_total.get('desbloqueio_dados', 0)),
                        "kyc_score": float(detalhamento_total.get('compra_score', 0)),
                        "taxas_saque": float(detalhamento_total.get('taxa_saque', 0)),
                        "taxa_intermediacao": float(detalhamento_total.get('taxa_intermediacao', 0)),
                        "taxa_especie": float(detalhamento_total.get('taxa_especie', 0)),
                        "taxa_adm_emprestimo": float(detalhamento_total.get('taxa_adm_emprestimo', 0)),
                        "aportes_externos": float(detalhamento_total.get('aporte_capital', 0)),
                        "retorno_investimento": float(detalhamento_total.get('retorno_investimento', 0)),
                        "assinaturas": float(detalhamento_total.get('assinatura', 0)),
                        "premios_marketplace": float(total_premios_marketplace)
                    },
                    "historico_mensal": historico_mes
                },
                "emprestimos_para_liberar": [],
                "solicitacoes_ativas": [],
                "gestao_usuarios": [],
                "gestao_parceiros": []
            }
            
            # 5. Adicionar lista resumida de usuários para gestão rápida no novo painel
            # OTIMIZAÇÃO: Busca em lote para evitar N+1 no loop
            usuarios_query = db.query(Usuario).filter(Usuario.id != "000PL").limit(50).all()
            user_ids = [u.id for u in usuarios_query]
            
            # Pré-busca de empréstimos para cálculo de fidelidade em lote
            all_loans = db.query(SolicitacaoEmprestimo).filter(
                SolicitacaoEmprestimo.usuario_id.in_(user_ids),
                SolicitacaoEmprestimo.status.in_([StatusSolicitacao.APROVADO, StatusSolicitacao.CONCLUIDO])
            ).limit(200).all()

            # Mapeamento de fidelidade por usuário
            agora_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            fidelidade_map = {uid: False for uid in user_ids}
            
            for uid in user_ids:
                u_loans = [l for l in all_loans if l.usuario_id == uid]
                if not u_loans: continue
                
                tem_pagamento = any(l.parcelas_pagas > 0 or l.status == StatusSolicitacao.CONCLUIDO for l in u_loans)
                tem_atraso = any(l.status == StatusSolicitacao.APROVADO and l.proximo_vencimento < agora_utc for l in u_loans)
                if tem_pagamento and not tem_atraso:
                    fidelidade_map[uid] = True

            for u in usuarios_query:
                snapshot["admin"]["gestao_usuarios"].append({
                    "id": u.id,
                    "nome": u.nome,
                    "cpf": u.cpf,
                    "saldo": float(u.saldo or 0),
                    "saldo_caixa": float(u.saldo_caixa or 0),
                    "score": float(u.score or 0),
                    "is_verified": u.is_verified,
                    "is_good_payer": fidelidade_map.get(u.id, False)
                })
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
                    "taxa": float(sa.taxa_juros)
                })

            # 7. Gestão de Parceiros (Apenas ativos para o HUB)
            from modelos.modelos_db import Parceiro
            parceiros_query = db.query(Parceiro).filter(Parceiro.is_active == True).limit(50).all()
            for p in parceiros_query:
                snapshot["admin"]["gestao_parceiros"].append({
                    "id": p.id,
                    "nome": p.nome,
                    "endereco": p.endereco,
                    "usuario_id": p.usuario_id,
                    "prazo_liquidacao": p.prazo_liquidacao,
                    "taxa_comissao": float(p.taxa_comissao),
                    "is_active": p.is_active,
                    "caixa_aberto": p.caixa_aberto,
                    "saldo_atual": float(p.saldo_caixa_atual),
                    "comissao": float(p.comissoes_acumuladas),
                    "mp_conectado": bool(p.mp_access_token)
                })

            # 8. Empréstimos que bateram a meta mas não liberaram (Falta garantidor)
            stuck_loans = db.query(SolicitacaoEmprestimo).filter(
                SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE,
                SolicitacaoEmprestimo.valor_arrecadado >= SolicitacaoEmprestimo.valor
            ).all()

            for sl in stuck_loans:
                snapshot["admin"]["emprestimos_para_liberar"].append({
                    "id": sl.id,
                    "tomador": sl.usuario.nome,
                    "valor": float(sl.valor),
                    "arrecadado": float(sl.valor_arrecadado)
                })

        # --- MEUS CONTRATOS ---
        solicitacoes_tomador = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.usuario_id == usuario.id
        ).all()
        solicitacoes_credor = db.query(SolicitacaoEmprestimo).filter(
            SolicitacaoEmprestimo.credor_id == usuario.id,
            SolicitacaoEmprestimo.usuario_id != usuario.id  # Evita duplicata quando é o mesmo usuário
        ).all()
        todas_solicitacoes = list(solicitacoes_tomador) + list(solicitacoes_credor)
        meus_emp_list = []
        for s in todas_solicitacoes:
            # Replicando lógica de juros e parcelas de rotas_emprestimo (Incluindo taxas financiadas)
            taxa_mensal = s.taxa_juros / 100
            total_com_juros = s.valor * (Decimal("1") + (taxa_mensal * s.prazo_meses))
            taxas_adicionais = s.taxas_adicionais or Decimal("0.00")
            
            valor_parcela = (total_com_juros + taxas_adicionais) / s.prazo_meses
            
            # Tratamento de nulos para campos novos ou legados
            taxas_adicionais = s.taxas_adicionais or Decimal("0.00")
            valor_amortizado = s.valor_amortizado or Decimal("0.00")
            
            total_pago_real = (valor_parcela * s.parcelas_pagas) + valor_amortizado
            if s.status == StatusSolicitacao.CONCLUIDO:
                valor_total_restante = 0.00
            else:
                valor_total_restante = max(0, float((total_com_juros + taxas_adicionais) - total_pago_real))

            meus_emp_list.append({
                "id": s.id,
                "tipo": "tomador" if s.usuario_id == usuario.id else "credor",
                "contraparte_nome": s.credor.nome if s.credor and s.usuario_id == usuario.id else (s.usuario.nome if s.usuario else "—"),
                "chave_pix_pagamento": s.chave_pix_credor if s.usuario_id == usuario.id else (s.usuario.chave_pix_publica or s.usuario.chave_pix),
                "valor": float(s.valor),
                "valor_arrecadado": float(s.valor_arrecadado),
                "taxa_juros": float(s.taxa_juros),
                "parcelas": s.prazo_meses,
                "parcelas_pagas": s.parcelas_pagas,
                "valor_parcela": round(float(valor_parcela), 2),
                "valor_total_restante": round(valor_total_restante, 2),
                "status": s.status.value,
                "pagamento_pendente": s.status == StatusSolicitacao.APROVADO and s.confirmacao_pagamento_data is not None and s.confirmacao_recebimento_data is None,
                "confirmacao_pagamento_data": s.confirmacao_pagamento_data.isoformat() if s.confirmacao_pagamento_data else None,
                "tipo_garantia": s.tipo_garantia,
                "garantia_descricao": s.garantia_descricao,
                "parceiro_nome": s.parceiro.nome if s.parceiro else None,
                "parceiro_endereco": s.parceiro.endereco if s.parceiro else None,
                "proximo_vencimento": s.proximo_vencimento.isoformat() if s.proximo_vencimento else None,
                "data_expiracao_4h": s.data_expiracao_4h.isoformat() if s.data_expiracao_4h else None,
                "data_expiracao_5d": s.data_expiracao_5d.isoformat() if s.data_expiracao_5d else None
            })

        snapshot["cliente_emprestimos"] = meus_emp_list # Unificado

        # --- INVESTIDOR DATA ---
        solicitacoes_raw = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.status == StatusSolicitacao.PENDENTE).limit(50).all()
        
        solic_list = []
        for s in solicitacoes_raw:
            solic_list.append({
                "id": s.id,
                "valor": float(s.valor),
                "valor_arrecadado": float(s.valor_arrecadado),
                "taxa": float(s.taxa_juros),
                "parcelas": s.prazo_meses,
                "nome": s.usuario.nome,
                "score": float(s.usuario.score),
                "verified": s.usuario.is_verified,
                "unlocked": True, # Acesso agora é livre
                "tipo_garantia": s.tipo_garantia,
                "garantia_descricao": s.garantia_descricao,
                "parceiro_nome": s.parceiro.nome if s.parceiro else None,
                "parceiro_endereco": s.parceiro.endereco if s.parceiro else None,
                "expira_4h": s.data_expiracao_4h.isoformat() if s.data_expiracao_4h else None,
                "expira_5d": s.data_expiracao_5d.isoformat() if s.data_expiracao_5d else None
            })

        snapshot["investidor"] = {"solicitacoes_disponiveis": solic_list, "carteira": []}

        # Salvar no Cache antes de retornar
        cache_snapshot_data[usuario.id] = (agora_ts + CACHE_TTL_SEG, snapshot)
        
        return snapshot

    except Exception as e:
        import traceback
        print(f"Erro no Snapshot: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao gerar snapshot.")
