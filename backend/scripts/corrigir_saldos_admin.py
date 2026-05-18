# =============================================================================
# DEPRECATED
# =============================================================================
# Este script esta DEPRECATED porque a Psy Pay nao e instituicao financeira
# e nao segura mais dinheiro de usuarios (Lei 12.865/2013, art. 8o).
# Campos saldo/saldo_caixa nao devem mais ser manipulados.
# A conta 000PL tambem nao e mais criada automaticamente.
# =============================================================================

from database import SessionLocal
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from decimal import Decimal

def migrar_saldos_teste():
    print("[DEPRECATED] Este script foi descontinuado.")
    print("A Psy Pay nao segura dinheiro de usuarios. Nenhum saldo foi alterado.")
    return

    # CODIGO LEGADO COMENTADO — manipulava saldo/saldo_caixa e criava 000PL
    # db = SessionLocal()
    # try:
    #     admin_id = "367MD"
    #     plataforma_id = "000PL"
    #     
    #     admin = db.query(Usuario).filter(Usuario.id == admin_id).first()
    #     plataforma = db.query(Usuario).filter(Usuario.id == plataforma_id).first()
    #     
    #     if not admin:
    #         print(f"[ERRO] Admin {admin_id} não encontrado.")
    #         return
    #
    #     if not plataforma:
    #         plataforma = Usuario(
    #             id=plataforma_id,
    #             nome="PSY PAY Plataforma (Sistema)",
    #             email="sistema@psy pay.com.br",
    #             cpf="000.000.000-00",
    #             senha_hash="SISTEMA_VIRTUAL",
    #             chave_pix="sistema",
    #             is_admin=True,
    #             is_active=True,
    #             saldo=0,
    #             saldo_caixa=0
    #         )
    #         db.add(plataforma)
    #         db.flush()
    #         print("[OK] Conta de sistema 000PL criada.")
    #
    #     VALOR_MIGRAR = Decimal("20.00")
    #     
    #     # REMOVIDO: manipulacao de saldo descontinuada
    #     # if admin.saldo_caixa >= VALOR_MIGRAR:
    #     #     admin.saldo_caixa -= VALOR_MIGRAR
    #     #     plataforma.saldo_caixa += VALOR_MIGRAR
    #     #     print(f"[OK] Transferidos R$ {VALOR_MIGRAR} do saldo_caixa do Admin para Plataforma.")
    #     # else:
    #     #     print(f"[AVISO] Admin não possui R$ {VALOR_MIGRAR} no saldo_caixa. Saldo atual: {admin.saldo_caixa}")
    #
    #     transacoes_admin = db.query(Transacao).filter(
    #         Transacao.usuario_id == admin_id,
    #         Transacao.detalhes.like("%LUCRO%")
    #     ).all()
    #     
    #     for t in transacoes_admin:
    #         t.usuario_id = plataforma_id
    #         print(f"[OK] Transação {t.id} migrada para a Plataforma.")
    #
    #     db.commit()
    #     print("[SUCESSO] Sincronização retroativa concluída.")
    #     
    # except Exception as e:
    #     db.rollback()
    #     print(f"[ERRO] Falha na migração: {e}")
    # finally:
    #     db.close()

if __name__ == "__main__":
    migrar_saldos_teste()
