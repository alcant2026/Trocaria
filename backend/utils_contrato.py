"""
utils_contrato.py - Gerador de Contratos de Mútuo P2P Digital
Contrato juridicamente robusto para operacoes entre particulares.
"""

import hashlib
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any


def gerar_contrato_mutuo(
    pedido_id: int,
    tomador_nome: str,
    tomador_cpf: str,
    tomador_email: str,
    investidor_nome: str,
    investidor_cpf: str,
    investidor_email: str,
    valor_principal: Decimal,
    taxa_juros_mensal: Decimal,
    prazo_meses: int,
    data_emissao: datetime = None
) -> Dict[str, Any]:
    """
    Gera um contrato de mútuo (emprestimo entre particulares) com hash de integridade.
    Este contrato demonstra que a Psy Pay NAO e parte na relacao juridica.
    """
    if data_emissao is None:
        data_emissao = datetime.now(timezone.utc)
    
    # Calcula valores
    juros_total = valor_principal * (taxa_juros_mensal / 100) * prazo_meses
    valor_total = valor_principal + juros_total
    valor_parcela = valor_total / prazo_meses if prazo_meses > 0 else valor_total
    
    # Monta o contrato
    contrato = {
        "versao": "1.0",
        "tipo": "MUTUO_ENTRE_PARTICULARES",
        "numero_contrato": f"PSY-MUTUO-{pedido_id:08d}",
        "data_emissao": data_emissao.isoformat(),
        "data_vencimento_primeira_parcela": None,  # Preencher apos aceite
        
        "partes": {
            "tomador": {
                "nome": tomador_nome,
                "cpf": f"***.{tomador_cpf[-4:]}" if len(tomador_cpf) >= 4 else "***",
                "email": tomador_email,
                "qualificacao": "Pessoa Fisica, maior de idade"
            },
            "investidor": {
                "nome": investidor_nome,
                "cpf": f"***.{investidor_cpf[-4:]}" if len(investidor_cpf) >= 4 else "***",
                "email": investidor_email,
                "qualificacao": "Pessoa Fisica, maior de idade"
            }
        },
        
        "objeto": {
            "tipo": "Mutuo simples (art. 586, Código Civil)",
            "valor_principal": float(valor_principal),
            "taxa_juros_mensal_percentual": float(taxa_juros_mensal),
            "prazo_meses": prazo_meses,
            "juros_total": float(juros_total),
            "valor_total_devido": float(valor_total),
            "valor_parcela": float(valor_parcela)
        },
        
        "condicoes": {
            "forma_pagamento": "Transferencia via PIX diretamente entre as partes",
            "vencimento_parcelas": "Mensal, na mesma data de emissao do contrato",
            "multa_atraso": "2% sobre a parcela em atraso",
            "juros_mora": "0,1% ao dia, limitado a 20% do valor da parcela",
            "antecipacao": "Permitida sem penalidade",
            "quitacao": "Ocorre com o pagamento da ultima parcela + eventuais encargos"
        },
        
        "disposicoes_gerais": {
            "foro": "Foro da comarca do domicilio do Tomador",
            "lei_aplicavel": "Leis da Republica Federativa do Brasil",
            "renegociacao": "Podera ser feita diretamente entre as partes, sem intermediacao",
            "cessao": "Nao permitida sem consentimento expresso da outra parte"
        },
        
        "psypay_declaracao": {
            "natureza_juridica": "Plataforma de correspondencia de interesses (NAO e instituição financeira)",
            "nao_e": [
                "Banco ou instituicao financeira",
                "Sociedade de Credito Direto (SCD)",
                "Sociedade de Emprestimo entre Pessoas (SEP)",
                "Instituicao de Pagamento",
                "Administradora de Consorcio",
                "Intermediaria financeira"
            ],
            "servicos_prestados": [
                "Correspondencia de interesses entre tomadores e investidores",
                "Geracao e armazenamento deste contrato digital",
                "Verificacao de identidade (KYC)",
                "Atribuicao de score de reputacao",
                "Ferramentas de cobranca (mediante taxa de servico)"
            ],
            "responsabilidade": "A Psy Pay NAO se responsabiliza pelo cumprimento das obrigacoes aqui assumidas. O risco do credito e exclusivo do Investidor."
        },
        
        "assinaturas": {
            "tomador": {
                "aceite_eletronico": False,
                "data_aceite": None,
                "ip_aceite": None,
                "hash_aceite": None
            },
            "investidor": {
                "aceite_eletronico": False,
                "data_aceite": None,
                "ip_aceite": None,
                "hash_aceite": None
            }
        }
    }
    
    # Gera hash do contrato (para garantir integridade)
    contrato_json = json.dumps(contrato, sort_keys=True, default=str)
    contrato["hash_integridade"] = hashlib.sha256(contrato_json.encode()).hexdigest()
    
    return contrato


def registrar_aceite_tomador(
    contrato: Dict[str, Any],
    ip: str,
    user_agent: str
) -> Dict[str, Any]:
    """Registra o aceite do tomador no contrato."""
    agora = datetime.now(timezone.utc).isoformat()
    
    aceite_data = f"ACEITE_TOMADOR:{agora}:{ip}:{user_agent}"
    hash_aceite = hashlib.sha256(aceite_data.encode()).hexdigest()
    
    contrato["assinaturas"]["tomador"]["aceite_eletronico"] = True
    contrato["assinaturas"]["tomador"]["data_aceite"] = agora
    contrato["assinaturas"]["tomador"]["ip_aceite"] = ip
    contrato["assinaturas"]["tomador"]["hash_aceite"] = hash_aceite
    
    # Recalcula hash geral
    contrato_copia = {k: v for k, v in contrato.items() if k != "hash_integridade"}
    contrato["hash_integridade"] = hashlib.sha256(
        json.dumps(contrato_copia, sort_keys=True, default=str).encode()
    ).hexdigest()
    
    return contrato


def registrar_aceite_investidor(
    contrato: Dict[str, Any],
    ip: str,
    user_agent: str
) -> Dict[str, Any]:
    """Registra o aceite do investidor no contrato."""
    agora = datetime.now(timezone.utc).isoformat()
    
    aceite_data = f"ACEITE_INVESTIDOR:{agora}:{ip}:{user_agent}"
    hash_aceite = hashlib.sha256(aceite_data.encode()).hexdigest()
    
    contrato["assinaturas"]["investidor"]["aceite_eletronico"] = True
    contrato["assinaturas"]["investidor"]["data_aceite"] = agora
    contrato["assinaturas"]["investidor"]["ip_aceite"] = ip
    contrato["assinaturas"]["investidor"]["hash_aceite"] = hash_aceite
    
    # Recalcula hash geral
    contrato_copia = {k: v for k, v in contrato.items() if k != "hash_integridade"}
    contrato["hash_integridade"] = hashlib.sha256(
        json.dumps(contrato_copia, sort_keys=True, default=str).encode()
    ).hexdigest()
    
    return contrato


def verificar_integridade_contrato(contrato: Dict[str, Any]) -> bool:
    """Verifica se o contrato foi alterado apos a geracao."""
    hash_armazenado = contrato.get("hash_integridade")
    if not hash_armazenado:
        return False
    
    contrato_copia = {k: v for k, v in contrato.items() if k != "hash_integridade"}
    hash_calculado = hashlib.sha256(
        json.dumps(contrato_copia, sort_keys=True, default=str).encode()
    ).hexdigest()
    
    return hash_armazenado == hash_calculado


def gerar_texto_contrato(contrato: Dict[str, Any]) -> str:
    """Gera o texto plano do contrato para leitura humana ou PDF."""
    t = contrato["partes"]["tomador"]
    i = contrato["partes"]["investidor"]
    o = contrato["objeto"]
    
    texto = f"""
CONTRATO DE MÚTUO ENTRE PARTICULARES

Nº {contrato['numero_contrato']}
Data de Emissão: {contrato['data_emissao']}

1. QUALIFICAÇÃO DAS PARTES

1.1. TOMADOR (Mutuário):
Nome: {t['nome']}
CPF: {t['cpf']}
E-mail: {t['email']}

1.2. INVESTIDOR (Mutuante):
Nome: {i['nome']}
CPF: {i['cpf']}
E-mail: {i['email']}

2. OBJETO DO CONTRATO

2.1. O presente contrato tem por objeto o mútuo simples entre pessoas físicas, 
nos termos do art. 586 e seguintes do Código Civil Brasileiro.

2.2. Valor principal: R$ {o['valor_principal']:.2f}
2.3. Taxa de juros: {o['taxa_juros_mensal_percentual']:.2f}% ao mês
2.4. Prazo: {o['prazo_meses']} meses
2.5. Valor total devido: R$ {o['valor_total_devido']:.2f}
2.6. Valor da parcela: R$ {o['valor_parcela']:.2f}

3. FORMA DE PAGAMENTO

3.1. O pagamento será feito DIRETAMENTE entre as partes via PIX, transferência 
bancária ou outra forma acordada entre elas.

3.2. A PSY PAY NÃO INTERMEDIA, NÃO SEGURA E NÃO TRANSFERE o dinheiro do empréstimo.
A Psy Pay é apenas uma plataforma de correspondência de interesses.

4. DISPOSIÇÕES GERAIS

4.1. A Psy Pay NÃO é parte neste contrato e NÃO se responsabiliza pelo cumprimento 
das obrigações aqui assumidas.

4.2. O risco do crédito é EXCLUSIVO do Investidor.

4.3. O Tomador reconhece que obteve o empréstimo de uma pessoa física, não de 
instituição financeira.

5. ASSINATURAS ELETRÔNICAS

Tomador: {"Aceito eletronicamente em " + t_a['data_aceite'] if (t_a := contrato['assinaturas']['tomador'])['aceite_eletronico'] else "Pendente"}
Investidor: {"Aceito eletronicamente em " + i_a['data_aceite'] if (i_a := contrato['assinaturas']['investidor'])['aceite_eletronico'] else "Pendente"}

Hash de Integridade: {contrato['hash_integridade']}

DECLARAÇÃO PSY PAY:
A Psy Pay é uma plataforma de correspondência de interesses entre particulares 
interessados em operações de mútuo. NÃO somos banco, financeira, SCD, SEP ou 
instituição de pagamento. NÃO seguramos dinheiro de usuários. Cobramos apenas 
taxas de serviço pelo uso da plataforma.
"""
    return texto
