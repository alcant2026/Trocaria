import asyncio
import json
import datetime
from datetime import timezone
from decimal import Decimal
from database import SessionLocal
from modelos.modelos_db import Usuario, Transacao, TipoTransacao, RankingHistorico


def _proximo_sabado_21utc():
    """Retorna o próximo sábado 18:00 BRT (21:00 UTC) como datetime UTC."""
    agora = datetime.datetime.now(timezone.utc)
    dias_ate_sabado = (5 - agora.weekday()) % 7
    if dias_ate_sabado == 0 and agora.hour >= 21:
        dias_ate_sabado = 7
    proximo = agora + datetime.timedelta(days=dias_ate_sabado)
    return proximo.replace(hour=21, minute=0, second=0, microsecond=0)


async def rotina_reset_ranking():
    """Background task: reseta pontos_semanais e paga top 20 todo sábado 18:00 BRT."""
    print("🏆 Rotina de reset do ranking semanal iniciada (com pagamento automático).")

    while True:
        try:
            proximo = _proximo_sabado_21utc()
            agora = datetime.datetime.now(timezone.utc)
            segundos = (proximo - agora).total_seconds()

            if segundos > 0:
                if segundos > 3600:
                    print(f"⏰ Próximo reset do ranking: {proximo.strftime('%d/%m %H:%M')} UTC ({segundos/3600:.1f}h)")
                await asyncio.sleep(min(segundos, 3600))
                continue

            print("🏆 EXECUTANDO RESET DO RANKING SEMANAL!")
            db = SessionLocal()
            try:
                top20 = db.query(Usuario).filter(
                    Usuario.pontos_semanais > 0
                ).order_by(Usuario.pontos_semanais.desc()).limit(20).all()

                dados = []
                total_pontos = 0
                total_premio = Decimal("0.00")

                for i, u in enumerate(top20, 1):
                    premio = Decimal(str(round((u.pontos_semanais or 0) / 1000, 2)))
                    dados.append({
                        "posicao": i,
                        "id": u.id,
                        "nome": u.nome,
                        "pontos": u.pontos_semanais or 0,
                        "premio": float(premio)
                    })
                    total_pontos += u.pontos_semanais or 0
                    total_premio += premio

                # Salvar histórico do ranking antes de resetar
                historico = RankingHistorico(
                    data_reset=datetime.datetime.now(timezone.utc),
                    dados_json=json.dumps(dados, ensure_ascii=False),
                    total_pontos=total_pontos,
                    total_premio=total_premio
                )
                db.add(historico)

                # PAGAR os vencedores com saldo da plataforma
                plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
                pagos = 0

                for d in dados:
                    premio = Decimal(str(d["premio"]))
                    if premio <= 0:
                        continue

                    usuario = db.query(Usuario).filter(Usuario.id == d["id"]).first()
                    if not usuario:
                        continue

                    # Creditar saldo do vencedor
                    usuario.saldo = (usuario.saldo or Decimal("0")) + premio

                    # Criar transação de premiação
                    db.add(Transacao(
                        usuario_id=usuario.id,
                        valor=premio,
                        tipo=TipoTransacao.BONUS,
                        status="concluido",
                        metodo="ranking",
                        detalhes=f"🏆 Prêmio Ranking Semanal — #{d['posicao']} lugar ({d['pontos']} pts)"
                    ))

                    # Debitar da plataforma
                    if plataforma:
                        plataforma.saldo = (plataforma.saldo or Decimal("0")) - premio

                    pagos += 1

                # Resetar pontos de todos os usuários
                db.query(Usuario).update({"pontos_semanais": 0})
                db.commit()

                print(f"✅ Ranking resetado! Top {len(dados)} salvo. "
                      f"{total_pontos} pts, R$ {float(total_premio):.2f} em prêmios. "
                      f"{pagos} vencedores pagos.")
            except Exception as e:
                print(f"⚠️ Erro no reset do ranking: {e}")
                db.rollback()
            finally:
                db.close()

            await asyncio.sleep(61)

        except Exception as e:
            print(f"⚠️ Erro na rotina de reset: {e}")
            await asyncio.sleep(60)
