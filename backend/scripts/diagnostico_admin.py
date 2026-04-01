from database import SessionLocal
from modelos.modelos_db import Usuario, Transacao, TipoTransacao
from sqlalchemy import or_

def teste_diagnostico():
    db = SessionLocal()
    try:
        # 1. Verificar se existe algum admin
        admin = db.query(Usuario).filter(Usuario.is_admin == True).first()
        print(f"Admin encontrado: {admin.email if admin else 'NENHUM'}")

        # 2. Verificar transações pendentes brutas
        transacoes = db.query(Transacao).filter(Transacao.status == 'pendente').all()
        print(f"Total transações pendentes no banco: {len(transacoes)}")
        for t in transacoes:
            print(f"ID: {t.id}, Tipo: {t.tipo}, Status: {t.status}, Usuario_ID: {t.usuario_id}")

        # 3. Testar o filtro exato usado no snapshot
        tipos_esperados = [TipoTransacao.DEPOSITO.value, TipoTransacao.SAQUE.value, TipoTransacao.DESBLOQUEIO_DADOS.value]
        print(f"Testando filtro com valores strings: {tipos_esperados}")
        
        pendentes_str = db.query(Transacao).filter(
            Transacao.status == "pendente",
            Transacao.tipo.in_(tipos_esperados)
        ).all()
        print(f"Pendentes encontrados com filtro string: {len(pendentes_str)}")

        # 4. Testar o filtro com objetos Enum
        tipos_enum = [TipoTransacao.DEPOSITO, TipoTransacao.SAQUE, TipoTransacao.DESBLOQUEIO_DADOS]
        print(f"Testando filtro com objetos Enum: {tipos_enum}")
        
        pendentes_enum = db.query(Transacao).filter(
            Transacao.status == "pendente",
            Transacao.tipo.in_(tipos_enum)
        ).all()
        print(f"Pendentes encontrados com filtro Enum: {len(pendentes_enum)}")

    finally:
        db.close()

if __name__ == "__main__":
    teste_diagnostico()
