import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from database import SessionLocal
from modelos.modelos_db import LinkAfiliado, Usuario
import datetime

db = SessionLocal()

# 1. Encontrar o usuário 000PL para ser o "dono" do anúncio
usuario_pl = db.query(Usuario).filter(Usuario.id == "000PL").first()
if not usuario_pl:
    print("Usuário 000PL não encontrado. Cadastrando no primeiro usuário da base...")
    usuario_pl = db.query(Usuario).first()

if not usuario_pl:
    print("Nenhum usuário no banco. Crie uma conta primeiro.")
    sys.exit()

# 2. Criar o anúncio
novo_anuncio = LinkAfiliado(
    usuario_id=usuario_pl.id,
    url_afiliado="https://amzn.to/exemplo-iphone15",
    nome_produto="Apple iPhone 15 Pro (256 GB) - Titânio Natural",
    valor=7299.00,
    is_boosted=True,
    visualizacoes_totais=342,
    visualizacoes_restantes=5000,
    nota=4.9,
    total_avaliacoes=128,
    url_imagem="https://m.media-amazon.com/images/I/81+GIkwqLIL._AC_SX679_.jpg",
    ponto_max=1,
    descricao="Smartphone premium com carcaça em titânio aeroespacial. Novo chip A17 Pro para games pesados. Câmera de 48MP com zoom ótico 3x.\n\nAparelho lacrado com nota fiscal e garantia de 1 ano da Apple.\n\nAceito propostas apenas se o valor for via PIX à vista. Não aceito trocas.",
    categoria="Celulares e Telefonia",
    vendas_texto="500+ vendidos",
    data_expiracao=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
)

db.add(novo_anuncio)
db.commit()
print("✅ Anúncio Premium do iPhone 15 Pro criado com sucesso!")

db.close()
