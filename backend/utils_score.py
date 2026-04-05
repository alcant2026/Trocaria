from decimal import Decimal
from sqlalchemy.orm import Session
from modelos.modelos_db import Usuario, TipoTransacao, Transacao

def atualizar_score(db: Session, usuario_id: str, valor: Decimal, tipo_acao: str, detalhes: str = ""):
    """
    Centraliza a lógica de atualização de Score baseada em comportamento financeiro.
    """
    # LOCK no usuário para garantir atomicidade
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).with_for_update().first()
    if not usuario:
        return None

    score_atual = usuario.score
    ganho_ou_perda = Decimal("0.0")

    # NOVAS REGRAS DE SCORE (Reformuladas)
    if tipo_acao == "DEPOSITO":
        # +1.0 a cada R$ 100,00 depositados
        ganho_ou_perda = valor / Decimal("100.0") * Decimal("1.0")
    
    elif tipo_acao == "APORTE_POOL":
        # +2.0 a cada R$ 100,00 aportados no Pool
        ganho_ou_perda = valor / Decimal("100.0") * Decimal("2.0")
        
    elif tipo_acao == "PAGAMENTO_PARCELA":
        # Mantém regra fixa: +2.0 se em dia, +0.5 se atrasado (valor representa o ganho direto)
        ganho_ou_perda = valor
        
    elif tipo_acao == "QUITACAO_TOTAL":
        # Bônus por quitação antecipada (valor representa o bônus fixo)
        ganho_ou_perda = valor

    elif tipo_acao == "SAQUE":
        # -2.0 a cada R$ 100,00 sacados (Penalidade 2x vs Depósito)
        ganho_ou_perda = -(valor / Decimal("100.0") * Decimal("2.0"))
        
    elif tipo_acao == "RESGATE_POOL":
        # -4.0 a cada R$ 100,00 resgatados do Pool (Penalidade 2x vs Aporte)
        ganho_ou_perda = -(valor / Decimal("100.0") * Decimal("4.0"))

    # Aplicar mudança e respeitar limites (0 - 1000)
    novo_score = score_atual + ganho_ou_perda
    if novo_score > Decimal("1000"):
        novo_score = Decimal("1000")
    if novo_score < Decimal("0"):
        novo_score = Decimal("0")

    usuario.score = novo_score
    
    # Opcional: Registrar log em Transacao se for relevante (Atualmente score não gera transação própria, só detalhes)
    return float(novo_score)
