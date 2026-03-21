import os
import sys
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

# Adiciona o diretório backend ao path para permitir imports de database e modelos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SQLALCHEMY_DATABASE_URL
from modelos.modelos_db import Base

def auditar_esquema():
    print(f"🚀 Iniciando Auditoria no Banco: {SQLALCHEMY_DATABASE_URL.split('@')[-1] if '@' in SQLALCHEMY_DATABASE_URL else SQLALCHEMY_DATABASE_URL}")
    
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        inspector = inspect(engine)
        
        # 1. Tabelas no Banco Real
        tabelas_db = set(inspector.get_table_names())
        
        # 2. Tabelas nos Modelos
        tabelas_modelos = set(Base.metadata.tables.keys())
        
        print("\n--- COMPARATIVO DE TABELAS ---")
        print(f"Total no Banco: {len(tabelas_db)}")
        print(f"Total nos Modelos: {len(tabelas_modelos)}")
        
        faltando_no_db = tabelas_modelos - tabelas_db
        extra_no_db = tabelas_db - tabelas_modelos
        
        if faltando_no_db:
            print(f"🚨 FALTANDO NO BANCO: {faltando_no_db}")
        else:
            print("✅ Todas as tabelas dos modelos existem no banco.")
            
        if extra_no_db:
            print(f"ℹ️  TABELAS EXTRAS NO BANCO (não mapeadas): {extra_no_db}")

        print("\n--- DETALHAMENTO DE COLUNAS (Comparação Profunda) ---")
        for tabela in sorted(tabelas_modelos):
            if tabela not in tabelas_db:
                print(f"\n❌ Tabela {tabela} FALTANDO no banco.")
                continue
                
            print(f"\n[Tabela: {tabela}]")
            # Obter colunas do DB real
            cols_db = {col['name']: col for col in inspector.get_columns(tabela)}
            # Obter colunas do Modelo
            cols_modelo = {col.name: col for col in Base.metadata.tables[tabela].columns}
            
            nomes_db = set(cols_db.keys())
            nomes_modelo = set(cols_modelo.keys())
            
            # 1. Colunas Faltando no DB
            faltando_db = nomes_modelo - nomes_db
            if faltando_db:
                print(f"  🚨 FALTANDO NO BANCO: {faltando_db}")
            
            # 2. Colunas Extras no DB
            extras_db = nomes_db - nomes_modelo
            if extras_db:
                # Mostrar tipo das colunas extras
                detalhe_extras = [f"{n} ({cols_db[n]['type']})" for n in extras_db]
                print(f"  ℹ️  EXTRAS NO BANCO (não mapeadas): {detalhe_extras}")
            
            # 3. Comparar tipos das colunas comuns
            comuns = nomes_db & nomes_modelo
            diferencas_tipo = []
            for col in comuns:
                tipo_db = str(cols_db[col]['type']).upper()
                tipo_modelo = str(cols_modelo[col].type).upper()
                
                # Normalização simples de tipos para comparação
                if "VARCHAR" in tipo_db and "STRING" in tipo_modelo:
                     continue # Compatível
                if "NUMERIC" in tipo_db and "NUMERIC" in tipo_modelo:
                     continue
                if "TIMESTAMP" in tipo_db and "DATETIME" in tipo_modelo:
                     continue
                if "ENUM" in tipo_db or "ENUM" in tipo_modelo:
                     continue # Enums são complexos de comparar via str
                
                if tipo_db != tipo_modelo and tipo_db not in tipo_modelo:
                    diferencas_tipo.append(f"{col}: DB={tipo_db} vs Modelo={tipo_modelo}")
            
            if diferencas_tipo:
                print(f"  ⚠️  DIFERENÇAS DE TIPO: {diferencas_tipo}")
            
            if not faltando_db and not extras_db and not diferencas_tipo:
                print("  ✅ 100% em sincronia.")
                
    except Exception as e:
        print(f"❌ ERRO DURANTE AUDITORIA: {e}")

if __name__ == "__main__":
    auditar_esquema()
