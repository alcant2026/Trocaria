from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import Usuario, Parceiro, Transacao, TipoTransacao
from decimal import Decimal
import datetime

router = APIRouter(prefix="/parceiros", tags=["Caixa Parceiro"])

# ================= CONFIGURAÇÕES GERAIS =================
TAXA_OPERACAO_ESPECIE = Decimal("0.05") # Taxa fixa de 5% cobrada do cliente final

@router.get("/meu-caixa")
async def obter_meu_caixa(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Verifica se o usuário atual é parceiro logista físico e retorna status do caixa."""
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    
    if not parceiro:
        return {"is_parceiro": False}
        
    return {
        "is_parceiro": True,
        "parceiro_id": parceiro.id,
        "nome_loja": parceiro.nome,
        "caixa_aberto": parceiro.caixa_aberto,
        "saldo_inicial": float(parceiro.saldo_caixa_inicial),
        "saldo_gaveta": float(parceiro.saldo_caixa_atual),
        "comissoes_acumuladas": float(parceiro.comissoes_acumuladas),
        "comissoes_pendentes": float(parceiro.comissoes_pendentes),
        "prazo": parceiro.prazo_liquidacao,
        "taxa_loja": float(parceiro.taxa_comissao)
    }

@router.post("/abrir-caixa")
async def abrir_caixa(valor_gaveta: Decimal = Body(..., embed=True), db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if valor_gaveta < 0:
        raise HTTPException(status_code=400, detail="Valor na gaveta inicial não pode ser negativo.")
        
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if valor_gaveta < 10:
        raise HTTPException(status_code=400, detail="O fundo de reserva mínimo para abrir o caixa é de R$ 10,00.")

    if not parceiro:
        raise HTTPException(status_code=403, detail="Você não tem permissão de parceiro lojista.")
    
    # Proteção Atômica: Marca como aberto ANTES de qualquer transação
    parceiro.caixa_aberto = True
    db.flush() # Envia pro banco mas não finaliza a transação ainda
    
    db.refresh(usuario) # Garante que temos o saldo digital MAIS RECENTE
    if usuario.saldo < valor_gaveta:
        parceiro.caixa_aberto = False # Reverte se não tiver saldo
        db.commit()
        raise HTTPException(status_code=400, detail=f"Saldo insuficiente para abrir o caixa. Você precisa de R$ {valor_gaveta:.2f} em conta.")

    # Deduz do saldo digital para "abastecer" o físico
    usuario.saldo -= valor_gaveta
    parceiro.saldo_caixa_inicial = valor_gaveta
    parceiro.saldo_caixa_atual = valor_gaveta
    
    # Registra a saída do digital para o físico
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=valor_gaveta,
        tipo=TipoTransacao.ABERTURA_GAVETA,
        status="concluido",
        detalhes=f"Abertura de Caixa (Saque p/ Gaveta - Loja #{parceiro.id})"
    ))
    
    db.commit()
    db.refresh(usuario) # Atualiza o objeto com o novo saldo pós-dedução
    
    return {"message": f"Caixa aberto com sucesso! R$ {valor_gaveta:.2f} transferidos para o fundo de reserva."}

@router.post("/fechar-caixa")
async def fechar_caixa(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if not parceiro:
        raise HTTPException(status_code=403, detail="Você não tem permissão de parceiro lojista.")
    
    if not parceiro.caixa_aberto:
        raise HTTPException(status_code=400, detail="Caixa não está aberto.")
    
    comissao_para_pagar = parceiro.comissoes_acumuladas
    valor_resgate_total = parceiro.saldo_caixa_atual + comissao_para_pagar

    # Proteção Atômica: Muda o status do caixa NO INÍCIO
    parceiro.caixa_aberto = False
    db.flush()
    
    comissao_para_pagar = parceiro.comissoes_acumuladas
    valor_resgate_total = parceiro.saldo_caixa_inicial + comissao_para_pagar

    db.refresh(usuario) # Pega o saldo digital exato do lojista
    
    # Devolve fundo inicial + ganhos do dia (D+0) para o saldo digital
    usuario.saldo += valor_resgate_total
    
    # Registro do fechamento (Resgate do fundo semente do digital para digital)
    db.add(Transacao(
        usuario_id=usuario.id,
        valor=parceiro.saldo_caixa_inicial,
        tipo=TipoTransacao.FECHAMENTO_GAVETA,
        status="concluido",
        detalhes=f"Encerrado: Resgate do Fundo de Reserva Inicial (Loja #{parceiro.id})"
    ))

    if comissao_para_pagar > 0:
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=comissao_para_pagar,
            tipo=TipoTransacao.COMISSAO_PARCEIRO,
            status="concluido",
            detalhes=f"Encerrado: Comissões D+0 creditadas (Loja #{parceiro.id})"
        ))

    # Reseta os contadores para o próximo turno
    resultado = {
        "message": "Caixa encerrado com sucesso. Todo o valor da gaveta + comissões foram devolvidos ao seu saldo digital.",
        "comissao_recebida": float(comissao_para_pagar),
        "valor_resgatado": float(valor_resgate_total),
        "total_creditado": float(valor_resgate_total)
    }

    parceiro.saldo_caixa_inicial = 0
    parceiro.saldo_caixa_atual = 0
    parceiro.comissoes_acumuladas = 0
    db.commit()
    db.refresh(usuario)
    
    return resultado

from pydantic import BaseModel

class IntermediacaoRequest(BaseModel):
    codigo_cliente: str # Pode ser o ID do usuario (ex: U928A) ou CPF parcial
    valor: Decimal
    tipo_operacao: str # "saque" ou "deposito"

@router.post("/intermediar")
async def intermediar_operacao(dados: IntermediacaoRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if dados.valor <= 0:
         print(f"❌ ERRO 400: Valor inválido ({dados.valor})")
         raise HTTPException(status_code=400, detail="Valor da operação deve ser maior que zero.")
         
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if not parceiro or not parceiro.caixa_aberto:
        print(f"❌ ERRO 403: Caixa fechado p/ usuario {usuario.id}")
        raise HTTPException(status_code=403, detail="Seu caixa está fechado ou você não tem acesso.")
        
    # Identificar cliente
    cliente = db.query(Usuario).filter(Usuario.id == dados.codigo_cliente).first()
    if not cliente:
        print(f"❌ ERRO 404: Cliente {dados.codigo_cliente} não encontrado")
        raise HTTPException(status_code=404, detail="Cliente não encontrado com este código ID.")
    
    if cliente.id == usuario.id:
        print(f"❌ ERRO 400: Auto-intermediação detectada para {usuario.id}")
        raise HTTPException(status_code=400, detail="Você não pode intermediar seu próprio pagamento no seu próprio caixa.")

    # Processamento dependendo do tipo
    taxa_parceiro_percentual = parceiro.taxa_comissao / 100
    
    if dados.tipo_operacao == "deposito":
        # Cliente traz papel -> Parceiro transfere do seu dig -> pro cliente
        if usuario.saldo < dados.valor:
            print(f"❌ ERRO 400: Parceiro {usuario.id} sem saldo digital (Saldo: {usuario.saldo}, Pedido: {dados.valor})")
            raise HTTPException(status_code=400, detail="Você não tem saldo virtual disponível suficiente na PSY PAY para enviar este depósito.")
        
        # Cálculo de Taxas
        # Cliente traz R$ 100. Taxa 5%. Recebe R$ 95.
        valor_liquido_cliente = dados.valor * (Decimal("1.0") - TAXA_OPERACAO_ESPECIE)
        comissao_parceiro = dados.valor * taxa_parceiro_percentual
        lucro_plataforma = (dados.valor * TAXA_OPERACAO_ESPECIE) - comissao_parceiro
        
        # Debitar parceiro (valor bruto), Creditar cliente (valor líquido)
        usuario.saldo -= dados.valor
        cliente.saldo += valor_liquido_cliente
        
        # Incrementar Gaveta Dinheiro Vivo do parceiro (Ele recebeu o valor cheio em papel)
        parceiro.saldo_caixa_atual += dados.valor
        
        # Lógica de Prazo de Liquidação da Comissão
        data_liberacao = None
        if parceiro.prazo_liquidacao > 0:
            data_liberacao = datetime.datetime.utcnow() + datetime.timedelta(days=parceiro.prazo_liquidacao)
            parceiro.comissoes_pendentes += comissao_parceiro
        else:
            parceiro.comissoes_acumuladas += comissao_parceiro
        
        # Creditar lucro à plataforma (000PL)
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if plataforma:
            plataforma.saldo += lucro_plataforma

        # Registro de Taxa paga pelo cliente
        taxa_paga = dados.valor * TAXA_OPERACAO_ESPECIE
        db.add(Transacao(
            usuario_id=cliente.id,
            valor=taxa_paga,
            tipo=TipoTransacao.TAXA_ESPECIE,
            status="concluido",
            detalhes=f"Taxa de Serviço: Depósito em Espécie (Loja #{parceiro.id})"
        ))

        # NOVO: Acumular no gasto total de taxas para dividendos
        if cliente.gasto_total_taxas is None: cliente.gasto_total_taxas = Decimal("0.00")
        cliente.gasto_total_taxas += taxa_paga
        
        # Transação de Envio pelo Parceiro
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=dados.valor,
            tipo=TipoTransacao.TAXA_INTERMEDIACAO,
            status="concluido",
            detalhes=f"Intermediou DEPÓSITO presencial para o cliente ID {cliente.id}."
        ))
        
        # Transação de Comissão do Parceiro (Agendada ou Imediata)
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=comissao_parceiro,
            tipo=TipoTransacao.COMISSAO_PARCEIRO,
            status="pendente" if parceiro.prazo_liquidacao > 0 else "concluido",
            data_liquidacao=data_liberacao,
            detalhes=f"Comissão DEPÓSITO (Loja #{parceiro.id}). Plano: D+{parceiro.prazo_liquidacao}"
        ))
        
        # Transação de Depósito na Conta do Cliente
        db.add(Transacao(
            usuario_id=cliente.id,
            valor=valor_liquido_cliente,
            tipo=TipoTransacao.DEPOSITO,
            status="concluido",
            metodo="especie",
            parceiro_id=parceiro.id,
            detalhes=f"DEPÓSITO em Espécie (Via Loja: {parceiro.nome})"
        ))

        db.commit()
        return {
            "message": f"Depósito concluído. O cliente {cliente.nome} recebeu R$ {valor_liquido_cliente:.2f}.", 
            "novo_saldo_gaveta": float(parceiro.saldo_caixa_atual)
        }
        
    elif dados.tipo_operacao == "saque":
        # Cliente quer papel vivo e o Parceiro desconta conta.
        if cliente.saldo < dados.valor:
            print(f"❌ ERRO 400: Cliente {cliente.id} sem saldo digital para saque (Saldo: {cliente.saldo})")
            raise HTTPException(status_code=400, detail="O cliente não tem saldo digital suficiente para sacar esse valor.")
        
        if parceiro.saldo_caixa_atual < (dados.valor * (Decimal("1.0") - TAXA_OPERACAO_ESPECIE)):
            print(f"❌ ERRO 400: Parceiro {usuario.id} sem dinheiro em gaveta (Gaveta: {parceiro.saldo_caixa_atual})")
            raise HTTPException(status_code=400, detail="Você não tem dinheiro físico em gaveta suficiente para pagar este saque (considerando o valor líquido).")
            
        # Cálculo de Taxas
        # Cliente quer R$ 100 em mãos. Débito digital R$ 100.
        # Ele recebe R$ 95 (retirada a taxa de 5%).
        valor_em_maos_cliente = dados.valor * (Decimal("1.0") - TAXA_OPERACAO_ESPECIE)
        comissao_parceiro = dados.valor * taxa_parceiro_percentual
        lucro_plataforma = (dados.valor * TAXA_OPERACAO_ESPECIE) - comissao_parceiro
        
        # Debitar cliente (valor cheio) e creditar parceiro digitalmente (reembolso do que deu em mãos)
        cliente.saldo -= dados.valor
        usuario.saldo += valor_em_maos_cliente
        
        # Tirar dinheiro vivo da gaveta (O cliente recebe o valor líquido em mãos)
        parceiro.saldo_caixa_atual -= valor_em_maos_cliente
        
        # Lógica de Prazo de Liquidação da Comissão
        data_liberacao = None
        if parceiro.prazo_liquidacao > 0:
            data_liberacao = datetime.datetime.utcnow() + datetime.timedelta(days=parceiro.prazo_liquidacao)
            parceiro.comissoes_pendentes += comissao_parceiro
        else:
            parceiro.comissoes_acumuladas += comissao_parceiro
            
        # Transação de Comissão do Parceiro (Agendada ou Imediata)
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=comissao_parceiro,
            tipo=TipoTransacao.COMISSAO_PARCEIRO,
            status="pendente" if parceiro.prazo_liquidacao > 0 else "concluido",
            data_liquidacao=data_liberacao,
            detalhes=f"Comissão SAQUE (Loja #{parceiro.id}). Plano: D+{parceiro.prazo_liquidacao}"
        ))
        
        # Creditar lucro à plataforma (000PL)
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if plataforma:
            plataforma.saldo += lucro_plataforma

        # Registro de Taxa paga pelo cliente
        taxa_paga = dados.valor * TAXA_OPERACAO_ESPECIE
        db.add(Transacao(
            usuario_id=cliente.id,
            valor=taxa_paga,
            tipo=TipoTransacao.TAXA_ESPECIE,
            status="concluido",
            detalhes=f"Taxa de Serviço: Saque em Espécie (Loja #{parceiro.id})"
        ))

        # NOVO: Acumular no gasto total de taxas para dividendos
        if cliente.gasto_total_taxas is None: cliente.gasto_total_taxas = Decimal("0.00")
        cliente.gasto_total_taxas += taxa_paga
        
        # Transação Saque Cliente (Registro do Fluxo)
        db.add(Transacao(
            usuario_id=cliente.id,
            valor=dados.valor,
            tipo=TipoTransacao.SAQUE,
            status="concluido",
            metodo="especie",
            parceiro_id=parceiro.id,
            detalhes=f"SAQUE em Espécie na loja Parceira: {parceiro.nome}"
        ))
        
        # Transação Recebimento Parceiro
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=dados.valor,
            tipo=TipoTransacao.TAXA_INTERMEDIACAO,
            status="concluido",
            detalhes=f"Recebeu fundos por intermediar SAQUE do ID {cliente.id}."
        ))
        
        db.commit()
        return {
            "message": f"Saque liberado! Dinheiro entregue ao cliente. R$ {dados.valor:.2f} creditado em sua conta virtual.",
            "novo_saldo_gaveta": float(parceiro.saldo_caixa_atual)
        }

    else:
        raise HTTPException(status_code=400, detail="Operação inválida. Use 'deposito' ou 'saque'.")

class PlanoPrazoRequest(BaseModel):
    prazo: int # 0, 14, 35

@router.patch("/configurar-plano")
async def configurar_plano_caixa(dados: PlanoPrazoRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Permite que o lojista escolha seu plano de recebimento."""
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if not parceiro:
        raise HTTPException(status_code=403, detail="Apenas parceiros lojistas podem configurar planos.")
    
    # REGRA B: Quem espera mais, ganha mais (D+0=1%, D+14=2%, D+35=3%)
    tabela_taxas = {0: Decimal("1.00"), 14: Decimal("2.00"), 35: Decimal("3.00")}
    
    if dados.prazo not in tabela_taxas:
        raise HTTPException(status_code=400, detail="Prazo inválido. Escolha entre 0, 14 ou 35 dias.")
    
    parceiro.prazo_liquidacao = dados.prazo
    parceiro.taxa_comissao = tabela_taxas[dados.prazo]
    db.commit()
    
    return {
        "message": f"Plano atualizado para D+{dados.prazo}. Sua comissão agora é de {tabela_taxas[dados.prazo]}% por operação.",
        "prazo": parceiro.prazo_liquidacao,
        "taxa": float(parceiro.taxa_comissao)
    }

@router.get("/buscar-saque-pendente/{codigo_cliente}")
async def buscar_saque_pendente(codigo_cliente: str, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Busca se existe um saque reservado para o cliente nesta loja específica."""
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if not parceiro or not parceiro.caixa_aberto:
        raise HTTPException(status_code=403, detail="Apenas parceiros com caixa aberto podem buscar saques.")
    
    # Busca transação pendente do tipo SAQUE vinculada a este parceiro e cliente
    transacao = db.query(Transacao).filter(
        Transacao.usuario_id == codigo_cliente,
        Transacao.parceiro_id == parceiro.id,
        Transacao.tipo == TipoTransacao.SAQUE,
        Transacao.metodo == "especie",
        Transacao.status == "pendente"
    ).first()
    
    if not transacao:
        raise HTTPException(status_code=404, detail="Nenhum saque reservado encontrado para este cliente nesta loja.")
    
    # Cálculo do valor líquido (O que o lojista deve entregar em mãos)
    taxa_servico = transacao.valor * Decimal("0.05")
    valor_entrega = transacao.valor - taxa_servico
    
    return {
        "transacao_id": transacao.id,
        "cliente_nome": transacao.usuario.nome,
        "valor_bruto": float(transacao.valor),
        "valor_entrega": float(valor_entrega),
        "taxa_plataforma": float(taxa_servico)
    }

class ConfirmarEntregaRequest(BaseModel):
    transacao_id: int

@router.post("/confirmar-entrega")
async def confirmar_entrega_especie(dados: ConfirmarEntregaRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    """Lojista confirma que entregou o dinheiro e recebe o crédito digital."""
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).with_for_update().first()
    if not parceiro or not parceiro.caixa_aberto:
        raise HTTPException(status_code=403, detail="Caixa fechado ou sem permissão.")
    
    transacao = db.query(Transacao).filter(
        Transacao.id == dados.transacao_id,
        Transacao.parceiro_id == parceiro.id,
        Transacao.status == "pendente"
    ).with_for_update().first()
    
    if not transacao:
        raise HTTPException(status_code=404, detail="Transação não encontrada ou expirada.")

    # 1. Regras de Negócio e Taxas
    taxa_loja_percentual = parceiro.taxa_comissao / 100
    taxa_servico_total = transacao.valor * Decimal("0.05")
    valor_entregue_maos = transacao.valor - taxa_servico_total
    
    comissao_loja = transacao.valor * taxa_loja_percentual
    lucro_plataforma = taxa_servico_total - comissao_loja

    # 2. Validar se o parceiro tem dinheiro físico em gaveta para entregar
    if parceiro.saldo_caixa_atual < valor_entregue_maos:
        raise HTTPException(status_code=400, detail="Você não tem dinheiro físico suficiente em gaveta para confirmar este saque.")

    # 3. Operação Financeira
    # Lojista recebe o REEMBOLSO digitalmente (Exatamente o que deu em mãos)
    usuario.saldo += valor_entregue_maos
    
    # Lojista remove o LÍQUIDO da gaveta física
    parceiro.saldo_caixa_atual -= valor_entregue_maos
    
    # 4. Lógica de Comissões (D+0, D+14, D+35)
    if parceiro.prazo_liquidacao > 0:
        parceiro.comissoes_pendentes += comissao_loja
        transacao.data_liquidacao = datetime.datetime.utcnow() + datetime.timedelta(days=parceiro.prazo_liquidacao)
    else:
        parceiro.comissoes_acumuladas += comissao_loja
    
    # 5. Lucro da Plataforma (000PL)
    plataforma = db.query(Usuario).filter(Usuario.id == "000PL").with_for_update().first()
    if plataforma:
        plataforma.saldo += lucro_plataforma

    # 6. Finalizar Transação e Auditoria
    transacao.status = "concluido"
    transacao.detalhes = f"Saque Entregue em Mãos (Loja #{parceiro.id}). Cliente ID {transacao.usuario_id}"
    
    # TAXA_ESPECIE REMOVIDA A PEDIDO DO USUÁRIO 🛡️🚀💎

    db.commit()
    
    # Limpar Cache
    from rotas.rotas_snapshot import cache_snapshot_data
    cache_snapshot_data.pop(usuario.id, None)
    cache_snapshot_data.pop(transacao.usuario_id, None)
    cache_snapshot_data.pop("000PL", None)

    return {
        "message": f"Sucesso! R$ {transacao.valor:.2f} creditados em sua conta e dinheiro entregue ao cliente.",
        "saldo_digital": float(usuario.saldo),
        "saldo_gaveta": float(parceiro.saldo_caixa_atual)
    }
