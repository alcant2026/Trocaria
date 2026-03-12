from sqlalchemy import inspect, text, Enum as SAEnum
import logging
import enum

# Configurar logs para acompanhar as migrações no terminal
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DB_SYNC")

def sincronizar_esquema(Base, engine):
    """
    Compara os modelos (Base.metadata) com o banco de dados real e 
    adiciona automaticamente colunas, valores de enum e índices faltantes.
    """
    inspector = inspect(engine)
    is_postgres = "postgresql" in str(engine.url)
    
    with engine.connect() as conn:
        logger.debug("Verificando consistência de colunas com os modelos...")
        
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
                            val = column.default.arg
                            if isinstance(val, str):
                                default_sql = f" DEFAULT '{val}'"
                            else:
                                default_sql = f" DEFAULT {val}"
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

        # --- Sincronização de Enums (PostgreSQL/Neon) ---
        if is_postgres:
            logger.debug("Verificando consistência de tipos ENUM no PostgreSQL...")
            
            # Coletar todos os tipos Enum usados nos modelos
            enums_modelo = {}
            for table_name, table in Base.metadata.tables.items():
                for column in table.columns:
                    if isinstance(column.type, SAEnum) and column.type.enum_class:
                        enum_class = column.type.enum_class
                        # Nome do tipo no PostgreSQL (ex: statussolicitacao, tipotransacao)
                        pg_type_name = column.type.name or enum_class.__name__.lower()
                        if pg_type_name not in enums_modelo:
                            enums_modelo[pg_type_name] = enum_class
            
            for pg_type_name, enum_class in enums_modelo.items():
                try:
                    # Buscar valores existentes no PostgreSQL
                    result = conn.execute(text(
                        "SELECT unnest(enum_range(NULL::\"" + pg_type_name + "\"))::text"
                    ))
                    valores_existentes = {row[0] for row in result}
                    
                    # Valores definidos no modelo Python
                    valores_modelo = {e.value for e in enum_class}
                    
                    # Detectar valores novos
                    novos = valores_modelo - valores_existentes
                    if novos:
                        for valor in sorted(novos):
                            try:
                                conn.execute(text(
                                    f"ALTER TYPE \"{pg_type_name}\" ADD VALUE IF NOT EXISTS '{valor}'"
                                ))
                                conn.commit()
                                logger.info(f"✅ Enum '{pg_type_name}': novo valor '{valor}' adicionado.")
                            except Exception as e:
                                logger.error(f"❌ Erro ao adicionar valor '{valor}' ao enum '{pg_type_name}': {e}")
                    
                except Exception as e:
                    # Tipo enum pode não existir ainda (tabela nova) — será criado pelo create_all
                    logger.warning(f"⚠️ Enum '{pg_type_name}' não encontrado no banco (será criado automaticamente): {e}")
        
        logger.debug("Verificando consistência de índices...")
        for table_name, table in Base.metadata.tables.items():
            indices_existentes = [idx["name"] for idx in inspector.get_indexes(table_name)]
            
            for index in table.indexes:
                if index.name not in indices_existentes:
                    logger.info(f"Detectado novo índice: {table_name}.{index.name}")
                    
                    # Gerar SQL de criação de índice
                    colunas_str = ", ".join([c.name for c in index.columns])
                    sql_index = f"CREATE INDEX {index.name} ON {table_name} ({colunas_str})"
                    
                    # Postgres suporta IF NOT EXISTS
                    if is_postgres:
                        sql_index = f"CREATE INDEX IF NOT EXISTS {index.name} ON {table_name} ({colunas_str})"
                    
                    try:
                        conn.execute(text(sql_index))
                        conn.commit()
                        logger.info(f"✅ Índice '{index.name}' criado com sucesso.")
                    except Exception as e:
                        # Ignorar erros se o índice já existir (comum em race conditions de boot no Render)
                        if "already exists" in str(e).lower() or "duplicada" in str(e).lower():
                            logger.info(f"ℹ️ Índice '{index.name}' já existe ou está sendo criado. Pulando...")
                            conn.rollback()
                        else:
                            logger.error(f"❌ Erro ao criar índice '{index.name}': {e}")
                            conn.rollback()

        logger.debug("Sincronização concluída.")

