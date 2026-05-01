from decimal import Decimal
import datetime
from datetime import timezone
from unittest.mock import Mock


def _make_solicitacao(valor=1000, taxa_juros=5, prazo_meses=6, parcelas_pagas=0,
                     taxas_adicionais=None, proximo_vencimento=None,
                     status="APROVADO", valor_amortizado=0):
    s = Mock()
    s.valor = Decimal(str(valor))
    s.taxa_juros = Decimal(str(taxa_juros))
    s.prazo_meses = prazo_meses
    s.parcelas_pagas = parcelas_pagas
    s.taxas_adicionais = Decimal(str(taxas_adicionais)) if taxas_adicionais else Decimal("0.00")
    s.proximo_vencimento = proximo_vencimento
    s.status = status
    s.valor_amortizado = Decimal(str(valor_amortizado))
    return s


class TestCalcularDividaTotal:
    def test_sem_juros_sem_mora(self):
        from utils_emprestimo import calcular_divida_total
        s = _make_solicitacao(valor=1000, taxa_juros=5, prazo_meses=6,
                              proximo_vencimento=datetime.datetime.now(timezone.utc) + datetime.timedelta(days=10))
        total = calcular_divida_total(s)
        esperado = Decimal("1000") * (1 + Decimal("0.05") * 6) / 6 * 6
        assert total == esperado, f"{total} != {esperado}"

    def test_com_taxas_adicionais(self):
        from utils_emprestimo import calcular_divida_total
        s = _make_solicitacao(valor=500, taxa_juros=10, prazo_meses=3,
                              taxas_adicionais=15,
                              proximo_vencimento=datetime.datetime.now(timezone.utc) + datetime.timedelta(days=5))
        total = calcular_divida_total(s)
        base = Decimal("500") * (1 + Decimal("0.10") * 3)
        esperado = (base + Decimal("15")).quantize(Decimal("0.01"))
        assert total.quantize(Decimal("0.01")) == esperado, f"{total} != {esperado}"

    def test_com_mora(self):
        from utils_emprestimo import calcular_divida_total
        atrasado = datetime.datetime.now(timezone.utc) - datetime.timedelta(days=10)
        s = _make_solicitacao(valor=200, taxa_juros=5, prazo_meses=2,
                              proximo_vencimento=atrasado)
        total = calcular_divida_total(s)
        valor_parcela = Decimal("200") * (1 + Decimal("0.05") * 2) / 2
        mora = valor_parcela * Decimal("0.02") + valor_parcela * Decimal("0.001") * 10
        esperado = valor_parcela * 2 + mora
        assert total == esperado, f"{total} != {esperado}"

    def test_parcialmente_pago(self):
        from utils_emprestimo import calcular_divida_total
        s = _make_solicitacao(valor=1000, taxa_juros=5, prazo_meses=4,
                              parcelas_pagas=2,
                              proximo_vencimento=datetime.datetime.now(timezone.utc) + datetime.timedelta(days=5))
        total = calcular_divida_total(s)
        valor_parcela = Decimal("1000") * (1 + Decimal("0.05") * 4) / 4
        esperado = valor_parcela * 2
        assert total == esperado, f"{total} != {esperado}"

    def test_sem_vencimento_sem_mora(self):
        from utils_emprestimo import calcular_divida_total
        s = _make_solicitacao(valor=300, taxa_juros=3, prazo_meses=1,
                              proximo_vencimento=None)
        total = calcular_divida_total(s)
        esperado = Decimal("300") * (1 + Decimal("0.03") * 1)
        assert total == esperado, f"{total} != {esperado}"


class TestCalcularMora:
    def test_sem_atraso(self):
        from utils_emprestimo import calcular_mora
        s = _make_solicitacao(proximo_vencimento=datetime.datetime.now(timezone.utc) + datetime.timedelta(days=1))
        mora = calcular_mora(s, Decimal("100"))
        assert mora == Decimal("0.00")

    def test_com_atraso_5_dias(self):
        from utils_emprestimo import calcular_mora
        atrasado = datetime.datetime.now(timezone.utc) - datetime.timedelta(days=5)
        s = _make_solicitacao(proximo_vencimento=atrasado)
        mora = calcular_mora(s, Decimal("200"))
        esperado = Decimal("200") * Decimal("0.02") + Decimal("200") * Decimal("0.001") * 5
        assert mora == esperado, f"{mora} != {esperado}"

    def test_sem_proximo_vencimento(self):
        from utils_emprestimo import calcular_mora
        s = _make_solicitacao(proximo_vencimento=None)
        mora = calcular_mora(s, Decimal("100"))
        assert mora == Decimal("0.00")


class TestCalcularLimiteCredito:
    def test_limite_personalizado(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = Decimal("500")
        usuario.saldo_caixa = Decimal("0")
        usuario.score = Decimal("0")
        usuario.is_verified = False
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("500")

    def test_score_alto_sem_pool(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("0")
        usuario.score = Decimal("850")
        usuario.is_verified = True
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("200")

    def test_score_muito_alto(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("0")
        usuario.score = Decimal("950")
        usuario.is_verified = True
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("500")

    def test_nao_verificado_limite_zero(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("0")
        usuario.score = Decimal("300")
        usuario.is_verified = False
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("0")

    def test_nao_verificado_com_pool(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("150")
        usuario.score = Decimal("300")
        usuario.is_verified = False
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("150")

    def test_verificado_sem_pool_score_baixo(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("0")
        usuario.score = Decimal("100")
        usuario.is_verified = True
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("0")

    def test_bonus_score_progressivo(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("50")
        usuario.score = Decimal("600")
        usuario.is_verified = True
        limite = calcular_limite_credito(usuario, None)
        bonus = (Decimal("600") - Decimal("500")) / Decimal("100") * Decimal("10")
        esperado = Decimal("20") + bonus
        assert limite == esperado, f"{limite} != {esperado}"

    def test_score_excelente_multiplicador_com_pool(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("100")
        usuario.score = Decimal("850")
        usuario.is_verified = False
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("100")

    def test_verified_sem_pool_score_alto_retorna_fixo(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("0")
        usuario.score = Decimal("850")
        usuario.is_verified = True
        limite = calcular_limite_credito(usuario, None)
        assert limite == Decimal("200")

    def test_verified_com_pool_score_600_bonus_progressivo(self):
        from utils_fintech import calcular_limite_credito
        usuario = Mock()
        usuario.limite_credito_personalizado = None
        usuario.saldo_caixa = Decimal("100")
        usuario.score = Decimal("600")
        usuario.is_verified = True
        limite = calcular_limite_credito(usuario, None)
        bonus = (Decimal("600") - Decimal("500")) / Decimal("100") * Decimal("10")
        esperado = Decimal("20") + bonus
        assert limite == esperado, f"{limite} != {esperado}"
