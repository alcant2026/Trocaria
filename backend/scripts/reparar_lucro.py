# =============================================================================
# DEPRECATED
# =============================================================================
# Este script esta DEPRECATED porque a Psy Pay nao e instituicao financeira
# e nao segura mais dinheiro de usuarios (Lei 12.865/2013, art. 8o).
# Campos saldo/saldo_caixa nao devem mais ser manipulados.
# =============================================================================

import os
import sys
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

# Adicionar o diretório pai ao path para importar os módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modelos.modelos_db import Usuario, Transacao, TipoTransacao, Parceiro, engine

def reparar_saldo_plataforma():
    print("[DEPRECATED] Este script foi descontinuado.")
    print("A Psy Pay nao segura dinheiro de usuarios. Nenhum saldo foi alterado.")
    return

    # CODIGO LEGADO COMENTADO — manipulava saldo da plataforma 000PL
    # with Session(engine) as db:
    #     print("Iniciando reparo de saldo da plataforma (000PL)...")
    #     
    #     plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
    #     if not plataforma:
    #         print("Erro: Usuário 000PL não encontrado.")
    #         return
    #
    #     tipos_receita = [
    #         TipoTransacao.COMPRA_SCORE, 
    #         TipoTransacao.DESBLOQUEIO_DADOS, 
    #         TipoTransacao.TAXA_INTERMEDIACAO,
    #         TipoTransacao.APORTE_CAPITAL,
    #         TipoTransacao.TAXA_POSTAGEM,
    #         TipoTransacao.RETORNO_INVESTIMENTO
    #     ]
    #
    #     total_receita = db.query(func.sum(Transacao.valor)).filter(
    #         Transacao.tipo.in_(tipos_receita),
    #         Transacao.status == "concluido"
    #     ).scalar() or Decimal("0.00")
    #
    #     total_sacado = db.query(func.sum(Transacao.valor)).filter(
    #         Transacao.tipo == TipoTransacao.SAQUE,
    #         Transacao.detalhes.like("RESGATE DE LUCRO %"),
    #         Transacao.status == "concluido"
    #     ).scalar() or Decimal("0.00")
    #     
    #     total_investido = db.query(func.sum(Transacao.valor)).filter(
    #         Transacao.tipo == TipoTransacao.INVESTIMENTO,
    #         Transacao.detalhes.like("%LUCRO%"),
    #         Transacao.status == "concluido"
    #     ).scalar() or Decimal("0.00")
    #
    #     saldo_calculado = total_receita - total_sacado - total_investido
    #     
    #     print(f"Total Receitas: R$ {total_receita}")
    #     print(f"Total Sacado: R$ {total_sacado}")
    #     print(f"Total Investido: R$ {total_investido}")
    #     print(f"Saldo Calculado: R$ {saldo_calculado}")
    #     print(f"Saldo Atual: R$ {plataforma.saldo}")
    #
    #     # REMOVIDO: atualizacao de saldo descontinuada
    #     # if plataforma.saldo != saldo_calculado:
    #     #     print(f"Atualizando saldo do 000PL para R$ {saldo_calculado}...")
    #     #     plataforma.saldo = saldo_calculado
    #     #     db.commit()
    #     #     print("Saldo atualizado com sucesso!")
    #     # else:
    #     #     print("Saldo já está correto.")

if __name__ == "__main__":
    reparar_saldo_plataforma()
