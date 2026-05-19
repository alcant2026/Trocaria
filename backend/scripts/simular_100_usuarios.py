"""
Simulacao de 100 usuarios na plataforma Trocaria.
Cria usuarios, anuncios, pedidos de apoio, matches, pagamentos e pontos.
Uso: DATABASE_URL="postgresql://..." python scripts/simular_100_usuarios.py
"""

import sys, os, random, string, datetime, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from database import normalizar_database_url
from sqlalchemy import create_engine, text
from rotas.rotas_auth import get_password_hash

URL = os.getenv("DATABASE_URL")
if not URL:
    print("ERRO: Defina DATABASE_URL")
    sys.exit(1)

URL = normalizar_database_url(URL)
engine = create_engine(URL, pool_pre_ping=True)
print(f"Conectando em Neon...")

NOMES = ["Ana","Bruno","Carla","Daniela","Eduardo","Fernanda","Gabriel","Helena","Igor","Julia",
         "Kevin","Larissa","Marcos","Natalia","Otavio","Patricia","Rafael","Sandra","Thiago","Vanessa",
         "Andre","Bianca","Caio","Diana","Enzo","Fabiola","Gustavo","Hilda","Ivan","Joana",
         "Lucas","Manuela","Nathan","Oliver","Paula","Quiteria","Renato","Simone","Tulio","Ursula",
         "Vitor","Wagner","Xavier","Yara","Zeca","Alice","Benjamin","Cecilia","Diego","Elisa",
         "Felipe","Giovana","Heitor","Isabela","Joao","Karen","Leonardo","Marina","Nicolas","Olivia",
         "Pedro","Quezia","Rodrigo","Sabrina","Samuel","Tatiane","Ulysses","Valentina","William","Camila",
         "Arthur","Beatriz","Cesar","Debora","Elias","Flavia","Gilberto","Heloisa","Isaac","Jessica",
         "Luan","Michele","Noah","Priscila","Ruan","Sara","Theo","Tainara","Vinicius","Leticia",
         "Wesley","Aline","Yuri","Bruna","Ziraldo","Cintia","Raimundo","Daniele","Edson","Fatima"]

SOBRENOMES = ["Silva","Santos","Oliveira","Souza","Lima","Costa","Pereira","Almeida","Nascimento","Araujo",
              "Barbosa","Ribeiro","Cardoso","Carvalho","Gomes","Martins","Rodrigues","Ferreira","Alves","Moraes"]

CATEGORIAS = ["Celulares","Informatica","Eletronicos","Veiculos","Imoveis","Servicos","Cursos","Games","Moda","Casa"]

PRODUTOS = [
    ("iPhone 14 128GB", "Celulares", 4299.00),
    ("Samsung Galaxy S24", "Celulares", 3799.00),
    ("Notebook Dell Inspiron", "Informatica", 3299.00),
    ("MacBook Air M3", "Informatica", 8999.00),
    ("Fone Bluetooth JBL", "Eletronicos", 199.90),
    ("Smart TV 50 4K", "Eletronicos", 2399.00),
    ("Honda Civic 2020", "Veiculos", 85000.00),
    ("Toyota Corolla 2019", "Veiculos", 72000.00),
    ("Curso de JavaScript", "Cursos", 97.00),
    ("Curso de Python Completo", "Cursos", 127.00),
    ("PlayStation 5", "Games", 3599.00),
    ("Xbox Series X", "Games", 3299.00),
    ("Tenis Nike Air Max", "Moda", 599.90),
    ("Bolsa Gucci", "Moda", 2499.00),
    ("Batedeira KitchenAid", "Casa", 1899.00),
    ("Sofa 3 lugares", "Casa", 2499.00),
]

def gerar_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))

def gerar_cpf():
    return ''.join([str(random.randint(0,9)) for _ in range(11)])

def gerar_telefone():
    ddd = random.randint(11, 99)
    num = random.randint(10000000, 999999999)
    return f"({ddd}) {str(num)[:5]}-{str(num)[5:]}"

def gerar_email(nome):
    dominios = ["gmail.com","hotmail.com","outlook.com","yahoo.com.br","bol.com.br"]
    return f"{nome.lower().replace(' ','')}{random.randint(1,999)}@{random.choice(dominios)}"

def gerar_chave_pix(nome):
    return gerar_email(nome)

agora = datetime.datetime.now(datetime.timezone.utc)

with engine.connect() as conn:
    # Buscar usuario Josias existente
    josias = conn.execute(text("SELECT id FROM usuarios WHERE id = '383RB'")).fetchone()
    if josias:
        print(f"Josias encontrado: 383RB")
    else:
        print("Josias nao encontrado, pulando referencias")

    usuarios_criados = []
    
    print(f"\nCriando 100 usuarios...")
    for i in range(100):
        uid = gerar_id()
        nome = random.choice(NOMES)
        sobrenome = random.choice(SOBRENOMES)
        nome_completo = f"{nome} {sobrenome}"
        email = gerar_email(nome)
        cpf = gerar_cpf()
        telefone = gerar_telefone()
        cidade = random.choice(["Belem","Ananindeua","Manaus","Sao Paulo","Rio de Janeiro","Brasilia","Salvador","Fortaleza","Recife","Porto Alegre"])
        estado = random.choice(["PA","AM","SP","RJ","DF","BA","CE","PE","RS","MG"])
        
        conn.execute(text("""
            INSERT INTO usuarios (id, nome, email, cpf, senha_hash, chave_pix, telefone, cidade, estado, 
                is_verified, is_active, aceite_termos, score, saldo, credito_virtual,
                pontos_marketplace, pontos_semanais, data_aceite, ultima_atualizacao_score)
            VALUES (:id, :nome, :email, :cpf, :senha, :pix, :tel, :cid, :est,
                :verified, true, true, :score, :saldo, :credito, :pts, :pts_sem, :agora, :agora)
            ON CONFLICT (id) DO NOTHING
        """), {
            "id": uid, "nome": nome_completo, "email": email, "cpf": cpf,
            "senha": get_password_hash("123456"), "pix": email, "tel": telefone,
            "cid": cidade, "est": estado, "verified": random.random() > 0.4,
            "score": random.randint(0, 1000), "saldo": round(random.uniform(0, 500), 2),
            "credito": round(random.uniform(0, 200), 2),
            "pts": random.randint(0, 500), "pts_sem": random.randint(0, 100),
            "agora": agora
        })
        usuarios_criados.append(uid)
    
    print(f"  {len(usuarios_criados)} usuarios criados/atualizados")
    
    # Criar anuncios para ~30 usuarios
    print(f"\nCriando anuncios no marketplace...")
    anuncios_criados = 0
    for uid in random.sample(usuarios_criados, 30):
        prod = random.choice(PRODUTOS)
        views = random.randint(20, 200)
        conn.execute(text("""
            INSERT INTO links_afiliados (nome_produto, descricao, categoria, url_afiliado, url_imagem, valor,
                usuario_id, visualizacoes_restantes, visualizacoes_totais, is_boosted, is_active, nota,
                total_avaliacoes, vendas_texto, data_criacao, data_expiracao)
            VALUES (:nome, :desc, :cat, :url, :img, :valor, :uid, :views, :views_tot, false, true,
                :nota, :avals, :vendas, :agora, :expira)
        """), {
            "nome": prod[0], "desc": f"{prod[0]} em otimo estado, aceito PIX.",
            "cat": prod[1], "url": f"https://wa.me/55{random.randint(11900000000, 11999999999)}?text=Quero%20{prod[0]}",
            "img": f"https://picsum.photos/400/400?random={random.randint(1,9999)}",
            "valor": prod[2], "uid": uid, "views": views, "views_tot": random.randint(views, views+200),
            "nota": round(random.uniform(3.0, 5.0), 1), "avals": random.randint(0, 50),
            "vendas": f"+{random.randint(1,100)} vendidos" if random.random() > 0.5 else "",
            "agora": agora - datetime.timedelta(hours=random.randint(1, 23)),
            "expira": agora + datetime.timedelta(hours=random.randint(1, 24))
        })
        anuncios_criados += 1
    print(f"  {anuncios_criados} anuncios criados")

    # Criar pedidos de apoio (solicitacoes_emprestimo) para ~20 usuarios
    print(f"\nCriando pedidos de apoio...")
    pedidos = 0
    for uid in random.sample(usuarios_criados, 20):
        valor = round(random.uniform(100, 5000), 2)
        parcelas = random.choice([3, 6, 12])
        taxa = round(random.uniform(1.0, 5.0), 2)
        status = random.choice(["pendente", "pendente", "pendente", "aprovado", "concluido"])
        
        conn.execute(text("""
            INSERT INTO solicitacoes_emprestimo (usuario_id, valor, taxa_juros, prazo_meses, status,
                data_criacao, parcelas_pagas, taxas_adicionais, data_aceite, data_quitacao)
            VALUES (:uid, :valor, :taxa, :parcelas, :status, :criacao, :pagas, :taxa_ad, :aceite, :quitacao)
        """), {
            "uid": uid, "valor": valor, "taxa": taxa, "parcelas": parcelas,
            "status": status, "criacao": agora - datetime.timedelta(days=random.randint(1, 60)),
            "pagas": random.randint(0, parcelas) if status in ["aprovado","concluido"] else 0,
            "taxa_ad": round(valor * 0.02, 2),
            "aceite": agora - datetime.timedelta(days=random.randint(1, 30)) if status in ["aprovado","concluido"] else None,
            "quitacao": agora - datetime.timedelta(days=random.randint(1, 5)) if status == "concluido" else None
        })
        pedidos += 1
    print(f"  {pedidos} pedidos criados")

    # Criar historico de cliques para simular pontos
    print(f"\nCriando historico de cliques e pontos...")
    cliques = 0
    for _ in range(200):
        uid = random.choice(usuarios_criados)
        link = conn.execute(text("SELECT id FROM links_afiliados ORDER BY RANDOM() LIMIT 1")).fetchone()
        if link:
            conn.execute(text("""
                INSERT INTO historico_cliques_marketplace (usuario_id, link_id, data_clique)
                VALUES (:uid, :lid, :data)
            """), {"uid": uid, "lid": link[0], "data": agora - datetime.timedelta(hours=random.randint(1, 48))})
            cliques += 1
    print(f"  {cliques} cliques registrados")

    # Criar transacoes de bonus (pontos)
    print(f"\nCriando transacoes de bonus...")
    bonus_count = 0
    for uid in random.sample(usuarios_criados, 50):
        pontos = random.randint(1, 5)
        conn.execute(text("""
            INSERT INTO transacoes (usuario_id, valor, tipo, status, data_criacao, metodo, detalhes)
            VALUES (:uid, :valor, 'bonus', 'concluido', :data, 'sistema', :det)
        """), {"uid": uid, "valor": pontos, "data": agora - datetime.timedelta(hours=random.randint(1, 72)),
              "det": f"{pontos} ponto(s) por clique simulado"})
        bonus_count += 1
    print(f"  {bonus_count} transacoes de bonus criadas")

    # Criar algumas transacoes de taxa
    print(f"\nCriando transacoes de taxa...")
    taxa_count = 0
    for uid in random.sample(usuarios_criados, 30):
        valor_taxa = round(random.uniform(2.00, 20.00), 2)
        conn.execute(text("""
            INSERT INTO transacoes (usuario_id, valor, tipo, status, data_criacao, metodo, detalhes)
            VALUES (:uid, :valor, 'taxa_solicitacao', 'concluido', :data, 'pix', 'Taxa de publicacao simulada')
        """), {"uid": uid, "valor": valor_taxa, "data": agora - datetime.timedelta(days=random.randint(1, 30))})
        taxa_count += 1
    print(f"  {taxa_count} transacoes de taxa criadas")

    # Atualizar pontos_semanais para o ranking
    print(f"\nAtualizando pontos semanais para ranking...")
    conn.execute(text("""
        UPDATE usuarios SET pontos_semanais = FLOOR(RANDOM() * 200 + 1)
        WHERE id != '000PL' AND id != '383RB'
    """))
    
    conn.commit()
    print(f"\n✅ Simulacao concluida!")
    print(f"   - 100 usuarios")
    print(f"   - {anuncios_criados} anuncios")
    print(f"   - {pedidos} pedidos de apoio")
    print(f"   - {cliques} cliques")
    print(f"   - {bonus_count} bonus")
    print(f"   - {taxa_count} taxas")
    print(f"\nLogin dos usuarios: CPF = 11 digitos aleatorios / Senha = 123456")
