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

                # RECOMPENSAS DE FIDELIDADE (nao e premio de sorteio)
                # Limite por usuario: R$ 50,00 (abaixo do limite de declaracao)
                # Limite total: R$ 1.000,00/sem
                LIMITE_POR_USUARIO = Decimal("50.00")
                LIMITE_TOTAL = Decimal("1000.00")
                total_pago = Decimal("0.00")
                pagos = 0

                for d in dados:
                    premio = Decimal(str(d["premio"]))
                    if premio <= 0:
                        continue
                    
                    # Aplica limite por usuario
                    premio = min(premio, LIMITE_POR_USUARIO)
                    
                    # Verifica limite total
                    if total_pago + premio > LIMITE_TOTAL:
                        premio = LIMITE_TOTAL - total_pago
                        if premio <= 0:
                            break
                    
                    total_pago += premio
                    d["premio"] = float(premio)  # Atualiza no dados

                    usuario = db.query(Usuario).filter(Usuario.id == d["id"]).first()
                    if not usuario:
                        continue

                    # Recompensa de fidelidade - paga via PIX direto (transacao pendente)
                    db.add(Transacao(
                        usuario_id=usuario.id,
                        valor=premio,
                        tipo=TipoTransacao.RESGATE_PONTOS,
                        status="pendente",
                        metodo="ranking",
                        detalhes=f"🎁 Recompensa Fidelidade Semanal — #{d['posicao']} lugar ({d['pontos']} pts) | Programa de engajamento. PIX direto."
                    ))

                    pagos += 1

                # Atualiza historico com valores reais pagos
                historico.total_premio = total_pago
                
                # Resetar pontos de todos os usuários
                db.query(Usuario).update({"pontos_semanais": 0})
                db.commit()

                print(f"✅ Programa Fidelidade resetado! Top {len(dados)} salvo. "
                      f"{total_pontos} pts, R$ {float(total_pago):.2f} em recompensas. "
                      f"{pagos} usuarios recompensados.")
            except Exception as e:
                print(f"⚠️ Erro no reset do ranking: {e}")
                db.rollback()
            finally:
                db.close()

            await asyncio.sleep(61)

        except Exception as e:
            print(f"⚠️ Erro na rotina de reset: {e}")
            await asyncio.sleep(60)
