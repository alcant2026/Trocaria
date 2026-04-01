import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("❌ Erro: DATABASE_URL não encontrada no .env")
    exit(1)

# Ajuste de protocolo para SQLAlchemy 2.0+
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def executar_migracao():
    sql_commands = [
        # 1. Remover Constraints de Chave Estrangeira (nomes padrão do SQLAlchemy/Postgres)
        "ALTER TABLE solicitacoes_emprestimo DROP CONSTRAINT IF EXISTS solicitacoes_emprestimo_usuario_id_fkey",
        "ALTER TABLE investimentos DROP CONSTRAINT IF EXISTS investimentos_investidor_id_fkey",
        "ALTER TABLE acessos_investidores DROP CONSTRAINT IF EXISTS acessos_investidores_investidor_id_fkey",
        "ALTER TABLE transacoes DROP CONSTRAINT IF EXISTS transacoes_usuario_id_fkey",
        "ALTER TABLE garantias_sociais DROP CONSTRAINT IF EXISTS garantias_sociais_garante_id_fkey",
        
        # 2. Alterar o tipo da coluna ID na tabela principal (Usuarios)
        "ALTER TABLE usuarios ALTER COLUMN id TYPE VARCHAR(5) USING id::text",
        
        # 3. Alterar o tipo das colunas que referenciam o usuário
        "ALTER TABLE solicitacoes_emprestimo ALTER COLUMN usuario_id TYPE VARCHAR(5) USING usuario_id::text",
        "ALTER TABLE investimentos ALTER COLUMN investidor_id TYPE VARCHAR(5) USING investidor_id::text",
        "ALTER TABLE acessos_investidores ALTER COLUMN investidor_id TYPE VARCHAR(5) USING investidor_id::text",
        "ALTER TABLE transacoes ALTER COLUMN usuario_id TYPE VARCHAR(5) USING usuario_id::text",
        "ALTER TABLE garantias_sociais ALTER COLUMN garante_id TYPE VARCHAR(5) USING garante_id::text",
        
        # 4. Recriar as Constraints de Chave Estrangeira
        "ALTER TABLE solicitacoes_emprestimo ADD CONSTRAINT solicitacoes_emprestimo_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
        "ALTER TABLE investimentos ADD CONSTRAINT investimentos_investidor_id_fkey FOREIGN KEY (investidor_id) REFERENCES usuarios(id)",
        "ALTER TABLE acessos_investidores ADD CONSTRAINT acessos_investidores_investidor_id_fkey FOREIGN KEY (investidor_id) REFERENCES usuarios(id)",
        "ALTER TABLE transacoes ADD CONSTRAINT transacoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id)",
        "ALTER TABLE garantias_sociais ADD CONSTRAINT garantias_sociais_garante_id_fkey FOREIGN KEY (garante_id) REFERENCES usuarios(id) ON DELETE CASCADE"
    ]

    with engine.connect() as conn:
        print("🚀 Iniciando migração de tipos de ID...")
        transaction = conn.begin()
        try:
            for command in sql_commands:
                print(f"Executing: {command[:50]}...")
                conn.execute(text(command))
            transaction.commit()
            print("✅ Migração concluída com sucesso!")
        except Exception as e:
            transaction.rollback()
            print(f"❌ Erro durante a migração: {e}")

if __name__ == "__main__":
    executar_migracao()
