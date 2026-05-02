import re


def normalizar_cnpj(cnpj: str) -> str:
    return re.sub(r"[^0-9]", "", cnpj or "")


def validar_cnpj(cnpj: str) -> bool:
    cnpj = normalizar_cnpj(cnpj)
    if len(cnpj) != 14 or len(set(cnpj)) == 1:
        return False

    pesos_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    soma_1 = sum(int(cnpj[i]) * pesos_1[i] for i in range(12))
    resto_1 = soma_1 % 11
    digito_1 = 0 if resto_1 < 2 else 11 - resto_1

    pesos_2 = [6] + pesos_1
    soma_2 = sum(int(cnpj[i]) * pesos_2[i] for i in range(13))
    resto_2 = soma_2 % 11
    digito_2 = 0 if resto_2 < 2 else 11 - resto_2

    return cnpj[-2:] == f"{digito_1}{digito_2}"


def normalizar_status_cadastral(status: str) -> str:
    return (status or "").strip().lower()


def parceiro_esta_apto(parceiro) -> bool:
    if not parceiro or not parceiro.is_active:
        return False

    if not validar_cnpj(parceiro.cnpj):
        return False

    return normalizar_status_cadastral(parceiro.cnpj_status) == "ativa"
