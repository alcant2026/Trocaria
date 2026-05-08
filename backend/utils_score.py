from decimal import Decimal
from sqlalchemy.orm import Session
from modelos.modelos_db import Usuario


def aplicar_bounds_score(usuario: Usuario):
    """Garante que o score fique entre 0 e 1000."""
    if usuario.score is None:
        usuario.score = Decimal("0")
    if usuario.score > Decimal("1000"):
        usuario.score = Decimal("1000")
    if usuario.score < Decimal("0"):
        usuario.score = Decimal("0")
