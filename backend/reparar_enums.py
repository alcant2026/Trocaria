import sys
import os
from sqlalchemy import text
# Abrir o caminho do projeto para importar database
sys.path.append(os.path.join(os.path.dirname(__file__), "."))
from database import engine

def reparar():
    if "sqlite" in str(engine.url):
        print("Ambiente SQLite detectado. Nada para reparar em Enums nativos.")
        return

    print("Conectando ao banco de dados Postgres para reparar Enums...")
    
    # 1. Definir os valores desejados para cada Enum (usando os valores do modelos_db.py)
    # Importante: O erro sugere que 'deposito' (minúsculo) é inválido, 
    # mas antes 'TAXA_SAQUE' (maiúsculo) também foi.
    # Vamos adicionar ambos para garantir compatibilidade total se necessário,
    # ou apenas garantir que os valores minúsculos (definidos no Python) existam.
    
    enums_para_reparar = {
        "tipotransacao": [
            "deposito", "saque", "investimento", "recebimento", 
            "compra_score", "desbloqueio_dados", "taxa_saque", 
            "taxa_intermediacao", "aporte_capital", "pagamento_parcela",
            "taxa_postagem", "retorno_investimento", "aporte_caixa",
            "resgate_caixa", "bonus_pagador_caixa", "retorno_pool"
        ],
        "tipo_transacao": [
            "deposito", "saque", "investimento", "recebimento", 
            "compra_score", "desbloqueio_dados", "taxa_saque", 
            "taxa_intermediacao", "aporte_capital", "pagamento_parcela",
            "taxa_postagem", "retorno_investimento", "aporte_caixa",
            "resgate_caixa", "bonus_pagador_caixa", "retorno_pool"
        ],
        "statussolicitacao": [
            "pendente", "aprovado", "rejeitado", "cancelado", "concluido"
        ],
        "status_solicitacao": [
            "pendente", "aprovado", "rejeitado", "cancelado", "concluido"
        ]
    }

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for tipo_nome, valores in enums_para_reparar.items():
            print(f"\nReparando tipo Enum: {tipo_nome}")
            
            # Tentar adicionar cada valor
            for valor in valores:
                try:
                    sql = f"ALTER TYPE {tipo_nome} ADD VALUE IF NOT EXISTS '{valor}'"
                    conn.execute(text(sql))
                    print(f"  [OK] Valor '{valor}' verificado/adicionado.")
                except Exception as e:
                    if "already exists" in str(e).lower():
                        print(f"  [SKIP] Valor '{valor}' já existe.")
                    else:
                        print(f"  [ERRO] Falha ao adicionar '{valor}': {e}")
            
            # Adicionar também as versões em MAIÚSCULO para segurança
            for valor in valores:
                valor_up = valor.upper()
                if valor_up == valor: continue
                try:
                    sql = f"ALTER TYPE {tipo_nome} ADD VALUE IF NOT EXISTS '{valor_up}'"
                    conn.execute(text(sql))
                    print(f"  [OK] Valor '{valor_up}' (UPPER) verificado/adicionado.")
                except:
                    pass

    print("\n✅ Reparo de Enums concluído.")

if __name__ == "__main__":
    reparar()
