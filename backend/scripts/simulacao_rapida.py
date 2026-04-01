import decimal
from decimal import Decimal
from datetime import datetime
from database import SessionLocal, engine, Base
from modelos.modelos_db import Usuario, SolicitacaoEmprestimo, StatusSolicitacao, Transacao, TipoTransacao, GarantiaSocial, Investimento
from rotas.rotas_auth import get_password_hash
from utils_db import sincronizar_esquema

def simular():
    print("🚀 [SIMULAÇÃO] PEER APP - CICLO DE 5 PESSOAS")
    print("-" * 50)
    
    # Sincronizar esquema local antes de tudo
    print("⚙️ Sincronizando esquema do banco local...")
    sincronizar_esquema(Base, engine)
    
    db = SessionLocal()
    
    try:
        # 1. CRIAR USUÁRIOS
        print("1. Criando João (Tomador), Maria/José (Garantidores) e Ana/Pedro (Investidores)...")
        users = {}
        tokens = [
            ("JOAO", "11111111111"), ("MARIA", "22222222222"), 
            ("JOSE", "33333333333"), ("ANA", "44444444444"), ("PEDRO", "55555555555")
        ]
        
        for nome, cpf in tokens:
            u = db.query(Usuario).filter(Usuario.cpf == cpf).first()
            if not u:
                u = Usuario(
                    id=nome[:3] + "99", nome=f"{nome.title()} Simula", email=f"{nome.lower()}@simula.com",
                    cpf=cpf, senha_hash=get_password_hash("123456"), chave_pix=nome.lower(),
                    is_active=True, saldo=Decimal("0.00")
                )
                db.add(u)
            users[nome] = u
        
        # 2. ABASTECER SALDOS
        print("2. Abastecendo Maria/José (Garantia) e Ana/Pedro (Investimento) com R$ 500 cada...")
        for n in ["MARIA", "JOSE", "ANA", "PEDRO"]:
            users[n].saldo = Decimal("500.00")
        
        db.commit()

        # 3. SOLICITAÇÃO
        print("3. João solicita R$ 1.000,00...")
        sol = SolicitacaoEmprestimo(
            usuario_id=users["JOAO"].id, valor=Decimal("1000.00"),
            taxa_juros=Decimal("10.0"), prazo_meses=2, status=StatusSolicitacao.AGUARDANDO_GARANTIDORES,
            valor_arrecadado=Decimal("0.00")
        )
        db.add(sol)
        db.commit()

        # 4. GARANTIDORES
        print("4. Maria e José aceitam garantir 50% cada (Saldo Bloqueado)...")
        for g_n in ["MARIA", "JOSE"]:
            gar = GarantiaSocial(solicitacao_id=sol.id, garante_id=users[g_n].id, aceito=True)
            db.add(gar)
            users[g_n].saldo -= Decimal("500.00")
            users[g_n].saldo_bloqueado += Decimal("500.00")
        
        sol.status = StatusSolicitacao.PENDENTE
        db.commit()

        # 5. INVESTIDORES
        print("5. Ana e Pedro investem R$ 500 cada...")
        for i_n in ["ANA", "PEDRO"]:
            inv = Investimento(investidor_id=users[i_n].id, solicitacao_id=sol.id, valor_investido=Decimal("500.00"), ciencia_risco=True)
            db.add(inv)
            t = Transacao(usuario_id=users[i_n].id, valor=Decimal("500.00"), tipo=TipoTransacao.INVESTIMENTO, status="concluido")
            db.add(t)
            users[i_n].saldo -= Decimal("500.00")
            sol.valor_arrecadado += Decimal("500.00")
        
        db.commit()

        # 6. LIBERAÇÃO
        print("6. Empréstimo APROVADO! João recebe os R$ 1.000,00.")
        sol.status = StatusSolicitacao.APROVADO
        users["JOAO"].saldo += Decimal("1000.00")
        db.commit()

        # 7. PAGAMENTO (Simulado)
        print("7. João AMORTIZOU R$ 550,00 da dívida.")
        users["JOAO"].saldo -= Decimal("550.00")
        sol.valor_amortizado += Decimal("550.00")
        sol.parcelas_pagas += 1
        
        # Retorno investidores: 550 / 2 = 275 cada (Simples)
        print("8. Distribuindo R$ 275,00 de retorno para Ana e Pedro...")
        users["ANA"].saldo += Decimal("275.00")
        users["PEDRO"].saldo += Decimal("275.00")
        
        db.commit()

        print("-" * 50)
        print("✅ RESULTADO FINAL DA SIMULAÇÃO:")
        print(f"💰 JOÃO (Tomador): R$ {users['JOAO'].saldo}")
        print(f"🛡️  MARIA (Garantidor): R$ {users['MARIA'].saldo} (+ R$ {users['MARIA'].saldo_bloqueado} bloqueado)")
        print(f"🏦 ANA (Investidor): R$ {users['ANA'].saldo} (Recuperou R$ 275)")
        print("-" * 50)

    except Exception as e:
        db.rollback()
        print(f"❌ ERRO NA SIMULAÇÃO: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    simular()
