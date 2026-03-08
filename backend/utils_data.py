import datetime
import calendar
import random
import string

def adicionar_mes(data_inicial: datetime.datetime) -> datetime.datetime:
    """
    Calcula a mesma data no mês seguinte.
    Se o dia não existir no mês seguinte (ex: 31 de Janeiro -> Fevereiro),
    retorna o último dia do mês seguinte.
    """
    ano = data_inicial.year + (data_inicial.month // 12)
    mes = (data_inicial.month % 12) + 1
    dia = data_inicial.day

    # Pegar o último dia possível do mês/ano alvo
    ultimo_dia = calendar.monthrange(ano, mes)[1]
    dia_final = min(dia, ultimo_dia)

    return data_inicial.replace(year=ano, month=mes, day=dia_final)

def gerar_id_customizado() -> str:
    """Gera um ID no formato 3 números + 2 letras (ex: 742KJ)"""
    numeros = "".join(random.choices(string.digits, k=3))
    letras = "".join(random.choices(string.ascii_uppercase, k=2))
    return f"{numeros}{letras}"
