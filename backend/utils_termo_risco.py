"""
Termo de Ciencia de Risco para Investidores
Documento obrigatorio antes de aceitar qualquer operacao P2P.
"""

TERMO_DE_CIENCIA_DE_RISCO = """
TERMO DE CIÊNCIA E ASSUNÇÃO DE RISCO - INVESTIDOR P2P

IMPORTANTE: LEIA ATENTAMENTE ANTES DE ACEITAR

Declaro que sou maior de 18 anos, plenamente capaz, e que ao clicar em "Aceitar", 
estou ciente e de acordo com os seguintes termos:

1. NATUREZA DA OPERAÇÃO

1.1. Estou realizando uma operação de MÚTUO (empréstimo) diretamente com outra 
pessoa física (Tomador), sem intervenção de instituição financeira.

1.2. A Psy Pay é APENAS uma plataforma de correspondência de interesses. Ela NÃO é:
- Banco ou instituição financeira
- Correspondente bancário
- Intermediária financeira
- Avalista ou garantidora da operação

2. RISCOS ASSUMIDOS

2.1. RISCO DE CALOTE: O Tomador pode não pagar o empréstimo. Em caso de 
inadimplência, posso ter prejuízo financeiro.

2.2. RISCO DE ATRASO: O Tomador pode atrasar parcelas, gerando incerteza de 
recebimento.

2.3. RISCO DE FRAUDE: O Tomador pode ter fornecido informações falsas, mesmo 
após verificação KYC.

2.4. RISCO DE INSOLVÊNCIA: O Tomador pode perder a capacidade de pagamento 
decorrente de desemprego, doença, ou outros fatores.

2.5. RISCO DE LIQUIDEZ: O dinheiro emprestado ficará indisponível até o recebimento 
das parcelas ou quitacao.

3. AUSÊNCIA DE GARANTIAS

3.1. A Psy Pay NÃO garante o pagamento deste empréstimo.
3.2. A Psy Pay NÃO avalisa, endossa ou garante a solvência do Tomador.
3.3. A Psy Pay NÃO cobre prejuízos em caso de inadimplência.
3.4. O score de reputação é apenas uma referência baseada em histórico, não é 
garantia de pagamento.

4. LIMITES E RESPONSABILIDADE

4.1. O valor máximo que posso perder é o valor total deste empréstimo.
4.2. Recomenda-se não investir mais do que posso perder sem comprometer minha 
estabilidade financeira.
4.3. Recomenda-se diversificar entre vários Tomadores para reduzir o risco 
de concentração.

5. COBRANÇA E RECUPERAÇÃO

5.1. Em caso de inadimplência, posso:
- Cobrar judicialmente o Tomador (por minha conta e risco)
- Usar ferramentas de cobrança da plataforma (mediante taxa de serviço)
- Negativar o Tomador em cadastros de proteção ao crédito

5.2. A Psy Pay pode fornecer os dados do contrato e do Tomador para auxiliar 
em ação judicial, mas não assume custos processuais.

6. TRIBUTAÇÃO

6.1. Os rendimentos obtidos com juros podem estar sujeitos a tributação (IR, CSLL).
6.2. Sou responsável por declarar meus rendimentos à Receita Federal.

7. ACEITE

Ao clicar em "Li e aceito os riscos", declaro que:
- Li e compreendi todos os riscos acima
- Estou investindo por minha própria conta e risco
- Entendo que a Psy Pay não garante o retorno do investimento
- Tenho capacidade financeira para assumir o prejuízo em caso de calote
- Não me enquadro como investidor inexperiente ou vulnerável

Data: {data_aceite}
IP: {ip}
Hash: {hash_aceite}
"""


def gerar_termo_ciencia_risco(
    investidor_nome: str,
    investidor_cpf: str,
    pedido_id: int,
    valor_emprestimo: float,
    ip: str = None,
    user_agent: str = None
) -> dict:
    """Gera o termo de ciencia de risco personalizado."""
    from datetime import datetime, timezone
    import hashlib
    
    agora = datetime.now(timezone.utc)
    
    termo = {
        "tipo": "TERMOS_CIENCIA_RISCO",
        "versao": "1.0",
        "data_geracao": agora.isoformat(),
        "investidor": {
            "nome": investidor_nome,
            "cpf": investidor_cpf
        },
        "operacao": {
            "pedido_id": pedido_id,
            "valor_emprestimo": valor_emprestimo
        },
        "aceite": {
            "aceito": False,
            "data_aceite": None,
            "ip": ip,
            "user_agent": user_agent,
            "hash": None
        }
    }
    
    # Gera hash
    termo_json = json.dumps(termo, sort_keys=True, default=str)
    termo["hash_geracao"] = hashlib.sha256(termo_json.encode()).hexdigest()
    
    return termo


def registrar_aceite_ciencia_risco(termo: dict, ip: str, user_agent: str) -> dict:
    """Registra o aceite do investidor no termo de ciencia de risco."""
    from datetime import datetime, timezone
    import hashlib
    
    agora = datetime.now(timezone.utc)
    
    aceite_str = f"ACEITE:{termo['investidor']['cpf']}:{agora.isoformat()}:{ip}"
    hash_aceite = hashlib.sha256(aceite_str.encode()).hexdigest()
    
    termo["aceite"]["aceito"] = True
    termo["aceite"]["data_aceite"] = agora.isoformat()
    termo["aceite"]["ip"] = ip
    termo["aceite"]["user_agent"] = user_agent
    termo["aceite"]["hash"] = hash_aceite
    
    return termo


import json

if __name__ == "__main__":
    # Teste
    termo = gerar_termo_ciencia_risco(
        "Joao Silva",
        "12345678900",
        123,
        1000.00,
        "192.168.1.1",
        "Mozilla/5.0"
    )
    print(json.dumps(termo, indent=2, default=str))
