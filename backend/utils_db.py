from sqlalchemy import inspect, text
import logging

# Configurar logs para acompanhar as migrações no terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DB_SYNC")

def sincronizar_esquema(Base, engine):
    """
    Compara os modelos (Base.metadata) com o banco de dados real e 
    adiciona automaticamente colunas que estiverem faltando.
    """
    inspector = inspect(engine)
    
    with engine.connect() as conn:
        logger.info("Verificando consistência de colunas com os modelos...")
        
        # Iterar sobre todas as tabelas definidas nos nossos modelos
        for table_name, table in Base.metadata.tables.items():
            # Pegar colunas existentes no banco físico para esta tabela
            colunas_existentes = [col["name"] for col in inspector.get_columns(table_name)]
            
            # Comparar com o que está definido no modelo Python
            for column in table.columns:
                if column.name not in colunas_existentes:
                    logger.info(f"Detectada nova coluna: {table_name}.{column.name}")
                    
                    # Gerar o comando ALTER TABLE
                    # Pegamos o tipo da coluna e formatamos para SQL
                    tipo_sql = str(column.type.compile(engine.dialect))
                    
                    # Definir valor padrão (se houver no modelo ou baseado no tipo)
                    default_sql = ""
                    if column.default is not None and hasattr(column.default, 'arg'):
                         # Valor literal simples
                         if not callable(column.default.arg):
                            default_sql = f" DEFAULT {column.default.arg}"
                    elif str(column.type).lower() == "boolean":
                        default_sql = " DEFAULT FALSE"
                    
                    # Tratamento específico para SQLite vs Postgres
                    if "sqlite" in str(engine.url):
                        # SQLite tem limitações para ALTER TABLE mas suporta ADD COLUMN básico
                        sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {tipo_sql}{default_sql}"
                    else:
                        # Postgres/Neon
                        sql = f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {column.name} {tipo_sql}{default_sql}"
                    
                    try:
                        conn.execute(text(sql))
                        conn.commit()
                        logger.info(f"✅ Coluna '{column.name}' criada com sucesso na tabela '{table_name}'.")
                    except Exception as e:
                        logger.error(f"❌ Erro ao criar coluna '{column.name}': {e}")
        
        logger.info("Sincronização concluída.")
