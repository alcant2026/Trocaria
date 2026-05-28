import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, engine
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, DocumentoVerificacao
from sqlalchemy import func, case, and_, or_, text
from datetime import timezone, timedelta, datetime
from decimal import Decimal

router = APIRouter(tags=["Snapshot"])

TZ_BRASILIA = timezone(timedelta(hours=-3))

cache_snapshot_data = {}
CACHE_TTL_SEG = 30
CACHE_VERSION = "v6_marketplace"

@router.get("/snapshot")
@router.get("/snapshot/")
async def obter_snapshot_dashboard(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    agora_ts = datetime.now(timezone.utc).timestamp()

    if usuario.id in cache_snapshot_data:
        validade, dados = cache_snapshot_data[usuario.id]
        if agora_ts < validade:
            return dados

    try:
        kyc_pendente = db.query(DocumentoVerificacao).filter(
            DocumentoVerificacao.usuario_id == usuario.id,
            DocumentoVerificacao.status == "pendente"
        ).first()
        kyc_status = "pendente" if kyc_pendente else ("verificado" if usuario.is_verified else "nenhum")

        snapshot = {
            "perfil": {
                "id": usuario.id,
                "nome": usuario.nome,
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
                "is_subscriber": usuario.is_subscriber,
                "assinatura_expira_em": usuario.assinatura_expira_em.isoformat() if usuario.assinatura_expira_em else None,
                "pontos_marketplace": usuario.pontos_marketplace,
            },
            "historico": []
        }

        transacoes = db.query(Transacao).filter(
            Transacao.usuario_id == usuario.id,
            Transacao.tipo != TipoTransacao.DESBLOQUEIO_DADOS
        ).order_by(Transacao.data_criacao.desc()).limit(10).all()
        for t in transacoes:
            data_t = t.data_criacao
            if data_t.tzinfo is None:
                data_t = data_t.replace(tzinfo=timezone.utc)
            try:
                tipo_str = t.tipo.value
            except (LookupError, AttributeError):
                tipo_str = str(t.tipo)
            snapshot["historico"].append({
                "id": t.id,
                "valor": float(t.valor or 0),
                "tipo": tipo_str,
                "status": t.status,
                "metodo": t.metodo,
                "detalhes": t.detalhes,
                "confirmado_cliente": t.confirmado_cliente,
                "data_confirmacao_cliente": t.data_confirmacao_cliente.replace(tzinfo=timezone.utc).isoformat() if t.data_confirmacao_cliente else None,
                "data": data_t.astimezone(TZ_BRASILIA).isoformat()
            })

        from modelos.modelos_db import LinkAfiliado
        agora = datetime.now(timezone.utc).replace(tzinfo=None)

        db.query(LinkAfiliado).filter(
            LinkAfiliado.is_boosted == False,
            or_(
                LinkAfiliado.data_expiracao < agora,
                LinkAfiliado.visualizacoes_restantes <= 0
            )
        ).update({"is_active": False})

        db.query(LinkAfiliado).filter(
            LinkAfiliado.is_boosted == True,
            LinkAfiliado.visualizacoes_restantes <= 0,
            LinkAfiliado.is_active == True
        ).update({"is_active": False})

        db.query(LinkAfiliado).filter(
            LinkAfiliado.is_boosted == True,
            LinkAfiliado.is_active == False,
            LinkAfiliado.data_expiracao < agora
        ).delete()

        db.commit()

        ads_ativos = db.query(LinkAfiliado).filter(
            LinkAfiliado.is_active == True,
            LinkAfiliado.visualizacoes_restantes > 0,
            LinkAfiliado.usuario_id != usuario.id
        ).order_by(LinkAfiliado.is_boosted.desc(), func.random()).limit(6).all()

        snapshot["comunidade_shop"] = []
        for ad in ads_ativos:
            snapshot["comunidade_shop"].append({
                "id": ad.id,
                "nome": ad.nome_produto,
                "url": ad.url_afiliado,
                "img": ad.url_imagem,
                "valor": float(ad.valor or 0) if ad.valor else 0.00,
                "patrocinado": ad.is_boosted,
                "views_restantes": ad.visualizacoes_restantes
            })
        db.commit()

        tipos_receita = [
            TipoTransacao.DESBLOQUEIO_DADOS,
            TipoTransacao.TAXA_POSTAGEM,
            TipoTransacao.ASSINATURA,
        ]

        if usuario.is_admin:
            from datetime import timedelta
            agora_br = datetime.now(TZ_BRASILIA).replace(tzinfo=None)
            data_30_dias_atras = agora_br - timedelta(days=30)

            pendentes_raw = db.query(Transacao).join(Usuario).filter(
                Transacao.status == "pendente",
                Transacao.tipo.in_([TipoTransacao.DESBLOQUEIO_DADOS]),
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
                    "valor": float(p.valor or 0),
                    "tipo": p.tipo.value if hasattr(p.tipo, 'value') else str(p.tipo),
                    "status": p.status,
                    "detalhes": p.detalhes,
                    "data": data_p.astimezone(TZ_BRASILIA).isoformat(),
                }
                if p.tipo == TipoTransacao.DESBLOQUEIO_DADOS:
                    docs = db.query(DocumentoVerificacao).filter(DocumentoVerificacao.usuario_id == p.usuario.id).order_by(DocumentoVerificacao.id.desc()).first()
                    if docs:
                        info_p["tem_rg"] = bool(docs.caminho_rg)
                        info_p["tem_renda"] = bool(docs.caminho_renda)
                        info_p["tem_residencia"] = bool(docs.caminho_residencia)
                        info_p["url_rg"] = f"/api/financeiro/admin/view-doc/{docs.usuario_id}/rg" if docs.caminho_rg else None
                        info_p["url_renda"] = f"/api/financeiro/admin/view-doc/{docs.usuario_id}/renda" if docs.caminho_renda else None
                        info_p["url_residencia"] = f"/api/financeiro/admin/view-doc/{docs.usuario_id}/residencia" if docs.caminho_residencia else None
                pendentes_list.append(info_p)

            total_lucro_historico = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")

            total_pix_recebido = db.query(func.sum(Transacao.valor)).filter(
                Transacao.metodo == "pix",
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")
            total_taxas_mp = total_pix_recebido * Decimal("0.01")

            lucro_mensal_plataforma_bruto = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo.in_(tipos_receita),
                Transacao.status == "concluido",
                Transacao.data_criacao >= data_30_dias_atras
            ).scalar() or Decimal("0.00")

            premios_mensais = Decimal("0.00")
            lucro_mensal_plataforma = max(Decimal("0.00"), lucro_mensal_plataforma_bruto - premios_mensais)

            if "sqlite" in str(engine.url):
                trunc_fn = func.strftime('%Y-%m', Transacao.data_criacao)
            else:
                trunc_fn = func.to_char(Transacao.data_criacao, 'YYYY-MM')

            historico_raw = db.query(
                trunc_fn.label("mes"),
                func.sum(case((Transacao.tipo.in_(tipos_receita), Transacao.valor), else_=0)).label("lucro_bruto"),
            ).filter(Transacao.status == "concluido").group_by(trunc_fn).order_by(text("mes DESC")).limit(12).all()

            historico_mes = []
            for h in historico_raw:
                historico_mes.append({
                    "mes": h.mes,
                    "lucro": float(h.lucro_bruto or 0),
                })

            try:
                import psutil
                is_render = os.getenv("RENDER") == "true"
                cpu_uso = psutil.cpu_percent(interval=0.1)
                cpu_threads_host = psutil.cpu_count(logical=True) or 1
                ram_host = psutil.virtual_memory()
                ram_total_gb_host = round(ram_host.total / (1024**3), 1)
                if is_render:
                    cpu_threads = 1
                    ram_total_gb = 0.5
                    ram_uso = min(100.0, (float(ram_host.used or 0) / (0.5 * 1024**3)) * 100) if ram_host.used else 0.0
                else:
                    cpu_threads = cpu_threads_host
                    ram_total_gb = ram_total_gb_host
                    ram_uso = ram_host.percent
                if ram_total_gb < 0.1: ram_total_gb = 0.5
            except Exception:
                cpu_uso = 0; cpu_threads = 0; ram_uso = 0; ram_total_gb = 0

            from modelos.modelos_db import DenunciaUsuario, ConfirmacaoVenda, LinkAfiliado, ProdutoResgate

            total_denuncias = db.query(DenunciaUsuario).filter(DenunciaUsuario.status == "pendente").count()
            total_comissoes = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo == TipoTransacao.TAXA_SERVICO,
                Transacao.status == "concluido"
            ).scalar() or Decimal("0.00")
            total_comissoes_pendentes = db.query(func.sum(Transacao.valor)).filter(
                Transacao.tipo == TipoTransacao.TAXA_SERVICO,
                Transacao.status == "pendente"
            ).scalar() or Decimal("0.00")
            total_vendas = db.query(ConfirmacaoVenda).filter(
                ConfirmacaoVenda.status == "concluido"
            ).count()
            total_anuncios_ativos = db.query(LinkAfiliado).filter(
                LinkAfiliado.is_active == True
            ).count()
            total_produtos = db.query(ProdutoResgate).count()

            denuncias_raw = db.query(DenunciaUsuario).filter(
                DenunciaUsuario.status == "pendente"
            ).order_by(DenunciaUsuario.data_denuncia.desc()).limit(50).all()
            denuncias_list = []
            for d in denuncias_raw:
                denuncias_list.append({
                    "id": d.id,
                    "denunciante_id": d.denunciante_id,
                    "denunciante_nome": d.denunciante.nome,
                    "denunciado_id": d.denunciado_id,
                    "denunciado_nome": d.denunciado.nome,
                    "denunciado_is_active": d.denunciado.is_active,
                    "motivo": d.motivo,
                    "data": d.data_denuncia.isoformat(),
                })

            snapshot["admin"] = {
                "pendentes": pendentes_list,
                "fiscal": {
                    "lucro_plataforma_total": float(lucro_mensal_plataforma or 0),
                    "lucro_plataforma_historico": float(total_lucro_historico or 0),
                    "total_taxas_mp": float(total_taxas_mp),
                    "total_comissoes": float(total_comissoes),
                    "total_comissoes_pendentes": float(total_comissoes_pendentes),
                    "total_vendas": total_vendas,
                    "total_anuncios_ativos": total_anuncios_ativos,
                    "total_produtos": total_produtos,
                    "denuncias_pendentes": total_denuncias,
                    "cpu_uso": cpu_uso,
                    "cpu_threads": cpu_threads,
                    "ram_uso": ram_uso,
                    "ram_total": ram_total_gb,
                    "historico_mensal": historico_mes
                },
                "gestao_usuarios": [],
                "denuncias": denuncias_list,
            }

            usuarios_query = db.query(Usuario).order_by(Usuario.data_aceite.desc().nullslast()).limit(50).all()
            for u in usuarios_query:
                snapshot["admin"]["gestao_usuarios"].append({
                    "id": u.id,
                    "nome": u.nome,
                    "cpf": u.cpf,
                    "email": u.email,
                    "chave_pix": u.chave_pix,
                    "is_verified": u.is_verified,
                    "is_admin": u.is_admin,
                    "is_active": u.is_active,
                    "is_subscriber": u.is_subscriber,
                    "two_factor_enabled": u.two_factor_enabled,
                    "vendas_completadas": u.vendas_completadas or 0,
                    "comissao_devida": float(u.comissao_devida or 0),
                    "pontos_marketplace": u.pontos_marketplace or 0,
                    "motivo_suspensao": u.motivo_suspensao,
                    "data_suspensao": u.data_suspensao.isoformat() if u.data_suspensao else None,
                    "cidade": u.cidade,
                    "estado": u.estado,
                })

        snapshot["cliente_emprestimos"] = []

        cache_snapshot_data[usuario.id] = (agora_ts + CACHE_TTL_SEG, snapshot)
        return snapshot

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Erro interno ao gerar snapshot.")
