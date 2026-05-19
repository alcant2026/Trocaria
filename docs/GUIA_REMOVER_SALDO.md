# GUIA DE MIGRACAO: REMOVER SISTEMA DE SALDO (Intermediacao Financeira)

**URGENTE - ANTES DE IR PARA PRODUCAO**

O sistema atual tem `saldo`, `deposito` e `saque`, o que caracteriza **intermediacao financeira** e exigiria autorizacao do Bacen. Este guia mostra como remover.

---

## O QUE PRECISA SER REMOVIDO

### 1. MODELO DE BANCO (`modelos/modelos_db.py`)

**REMOVER ou DESATIVAR os campos abaixo do modelo `Usuario`:**
```python
# REMOVER ESTES CAMPOS:
saldo = Column(Numeric(precision=20, scale=2), default=0)
saldo_caixa = Column(Numeric(precision=20, scale=2), default=0)
```

**Justificativa:** Usuario nao pode ter "saldo" na plataforma. A plataforma nao e banco nem carteira digital.

---

### 2. ROTAS FINANCEIRAS (`rotas/rotas_financeiro.py`)

**REMOVER completamente as seguintes rotas:**

#### A) `/financeiro/notificar-deposito`
- Usuario nao pode "depositar" dinheiro na plataforma
- O dinheiro de emprestimo vai direto P2P

#### B) `/financeiro/solicitar-saque` 
- Usuario nao pode "sacar" saldo da plataforma
- Nao existe saldo para sacar

#### C) `/financeiro/admin/adicionar-saldo`
- Admin nao pode adicionar saldo ficticio

#### D) `/financeiro/admin/resgatar-lucro` (se houver)
- Lucro da plataforma e gerenciado diretamente na conta bancaria PJ

**MANTER (sao taxas de servico, permitidas):**
- `/financeiro/webhook` - para receber confirmacao de pagamento de TAXAS
- `/financeiro/processar-pagamento-aprovado` - mas APENAS para taxas (publicacao, cobranca, premium)

---

### 3. COMO FICAM AS TAXAS DE SERVICO

As taxas de servico (R$ 2,00 de publicacao, R$ 2,00 de cobranca) continuam funcionando assim:

1. Usuario gera PIX para pagar a taxa
2. Pagamento vai DIRETO para a conta do Mercado Pago / conta PJ da Trocaria
3. Webhook confirma o pagamento
4. A plataforma libera o servico (publica o pedido, libera ferramenta de cobranca)

**Nao precisa de "saldo" para isso.** O webhook apenas confirma que a taxa foi paga.

---

### 4. AJUSTES NECESSARIOS NAS ROTAS

#### Em `rotas_emprestimo.py`:

**REMOVER ou MODIFICAR:**
```python
# NAO deve existir mais:
# - usuario.saldo += valor (creditar saldo)
# - usuario.saldo -= valor (debitar saldo)
```

**O que deve acontecer no `aceitar_oferta`:**
1. Investidor clica "Aceitar"
2. Sistema mostra chave PIX do Tomador para o Investidor transferir
3. Investidor transfere via PIX (fora da plataforma)
4. Investidor clica "Confirmar que paguei"
5. Tomador clica "Confirmar que recebi"
6. Sistema registra a confirmacao e gera o contrato

**NENHUMA transferencia de dinheiro acontece pelo backend.**

---

### 5. NOVAS ROTAS NECESSARIAS

#### `/emprestimos/chave-pix/{pedido_id}`
Retorna a chave PIX do Tomador para o Investidor fazer a transferencia.

```python
@router.get("/chave-pix/{pedido_id}")
async def obter_chave_pix_tomador(
    pedido_id: int, 
    db: Session = Depends(get_db), 
    usuario: Usuario = Depends(obter_usuario_logado)
):
    pedido = db.query(SolicitacaoEmprestimo).filter(SolicitacaoEmprestimo.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido nao encontrado")
    
    # Apenas o investidor que aceitou pode ver a chave PIX
    if pedido.credor_id != usuario.id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    tomador = db.query(Usuario).filter(Usuario.id == pedido.usuario_id).first()
    return {
        "chave_pix": tomador.chave_pix,
        "nome_tomador": tomador.nome,
        "valor": float(pedido.valor),
        "mensagem": f"Transfira R$ {pedido.valor} diretamente para {tomador.nome} via PIX usando a chave acima."
    }
```

#### `/emprestimos/confirmar-transferencia/{pedido_id}`
Investidor confirma que transferiu o dinheiro.

#### `/emprestimos/confirmar-recebimento/{pedido_id}`
Tomador confirma que recebeu o dinheiro.

#### `/emprestimos/confirmar-parcela/{pedido_id}`
Investidor confirma que recebeu uma parcela.

---

### 6. O QUE MUDA NO FRONTEND

**REMOVER telas de:**
- Deposito
- Saque
- Saldo da conta
- Extrato de saldo

**MANTER telas de:**
- Publicar pedido (pagamento de taxa R$ 2,00)
- Visualizar pedidos
- Aceitar pedido (mostra chave PIX do tomador)
- Confirmar pagamento/recebimento
- Historico de operacoes
- Score e reputacao
- Ferramenta de cobranca (pagamento de taxa R$ 2,00)

---

### 7. MODELO DE RECEITA DA TROCARIA

A Trocaria ganha dinheiro APENAS com:
1. Taxa de publicacao de pedido: R$ 2,00
2. Taxa de ferramenta de cobranca: R$ 2,00
3. Taxa de destaque no marketplace: R$ 5,00 / variavel
4. Assinatura Premium: R$ 19,99/mes ou R$ 199,99/ano
5. Taxa de verificacao KYC: (se houver)

**Tudo isso vai direto para a conta bancaria PJ da empresa via PIX/Mercado Pago.**

**Nao existe "saldo da plataforma" retido no sistema.** O dinheiro entra na conta bancaria real e sai das despesas da empresa (servidor, impostos, etc.).

---

### 8. CHECKLIST DE IMPLEMENTACAO

- [ ] Remover campos `saldo` e `saldo_caixa` do modelo `Usuario`
- [ ] Remover rotas de deposito e saque
- [ ] Criar rota para exibir chave PIX do tomador ao investidor
- [ ] Modificar `aceitar_oferta` para nao transferir dinheiro, apenas registrar aceite
- [ ] Modificar confirmacoes de pagamento para serem apenas registradas (sem movimentacao de saldo)
- [ ] Atualizar contrato PDF para refletir que dinheiro foi transferido diretamente
- [ ] Atualizar frontend (remover telas de saldo/deposito/saque)
- [ ] Testar fluxo completo: publicar -> aceitar -> transferir PIX direto -> confirmar -> pagar parcelas direto -> confirmar

---

### 9. EXEMPLO DE FLUXO CORRETO

```
1. Joao (Tomador) quer R$ 1.000,00
   -> Paga R$ 2,00 de taxa de publicacao (vai para conta da Trocaria)
   -> Pedido fica visivel

2. Maria (Investidora) aceita o pedido
   -> Sistema mostra chave PIX de Joao
   -> Maria transfere R$ 1.000,00 diretamente para Joao via PIX (fora da plataforma)
   -> Maria clica "Confirmar que paguei" na plataforma
   -> Joao clica "Confirmar que recebi" na plataforma
   -> Contrato e gerado

3. Joao paga parcelas diretamente para Maria via PIX
   -> Maria clica "Confirmar recebimento" na plataforma (apenas registro)

4. Se Joao nao pagar:
   -> Maria pode usar ferramenta de cobranca (paga R$ 2,00 de taxa para Trocaria)
   -> Sistema gera cobranca PIX para Joao pagar Maria
   -> Se persistir, Maria pode acionar judicialmente (fora da plataforma)
```

---

**IMPORTANTE:** Este e o UNICO modelo juridico seguro para operar sem autorizacao do Bacen. **Nao segure dinheiro de usuarios.**

---

**Documento confidencial - Uso interno**
**Data:** 18/05/2026

