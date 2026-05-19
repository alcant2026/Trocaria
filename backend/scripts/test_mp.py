import mercadopago
import json

mp_access_token = "APP_USR-7169331045259642-033008-5118fedff55b2a1686d9e68c417ddf13-2235264298"
sdk = mercadopago.SDK(mp_access_token)

print("Iniciando requisição de teste para geração de PIX (R$ 5.00)...")

payment_data = {
    "transaction_amount": 5.0,
    "description": "Teste Unitário Trocaria PIX",
    "payment_method_id": "pix",
    "payer": {
        "email": "test_script@trocaria.com.br",
        "first_name": "Sr Teste",
        "identification": {
            "type": "CPF",
            "number": "00000000000"
        }
    }
}

result = sdk.payment().create(payment_data)

status_http = result.get('status')
print(f"\nStatus HTTP da API Mercado Pago: {status_http}")

if status_http in [200, 201]:
    response = result.get("response", {})
    payment_id = response.get('id')
    status_pgto = response.get('status')
    
    transaction_data = response.get('point_of_interaction', {}).get('transaction_data', {})
    qr_code = transaction_data.get('qr_code')
    qr_code_b64 = transaction_data.get('qr_code_base64')
    
    print(f"✅ SUCESSO! Transação Criada.")
    print(f"-> Payment ID: {payment_id}")
    print(f"-> Status do Pix: {status_pgto}")
    print(f"-> PIX Copia e Cola: {qr_code[:50]}... (truncado)")
    print(f"-> Tem Imagem Base64? {'SIM' if qr_code_b64 else 'NÃO'}")
else:
    print(f"❌ FALHA. A API retornou erro:")
    print(json.dumps(result.get("response", {}), indent=2))
