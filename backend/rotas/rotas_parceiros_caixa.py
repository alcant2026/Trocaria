from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from database import get_db
from rotas.rotas_auth import obter_usuario_logado
from modelos.modelos_db import Usuario, Parceiro, Transacao, TipoTransacao
from decimal import Decimal
import datetime

router = APIRouter(prefix="/parceiros", tags=["Caixa Parceiro"])

# ================= COMISSIONAMENTO =================
TAXA_TOTAL = Decimal("0.02")           # 2% taxa total da operação
TAXA_COMISSAO_PARCEIRO = Decimal("0.005") # 0.5% vai pro parceiro (balcão)
TAXA_PLATAFORMA = Decimal("0.015")     # 1.5% fica pra plataforma (Peer)

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
        "comissoes_acumuladas": float(parceiro.comissoes_acumuladas)
    }

@router.post("/abrir-caixa")
async def abrir_caixa(valor_gaveta: Decimal = Body(..., embed=True), db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if valor_gaveta < 0:
        raise HTTPException(status_code=400, detail="Valor na gaveta inicial não pode ser negativo.")
        
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if not parceiro:
        raise HTTPException(status_code=403, detail="Você não tem permissão de parceiro lojista.")
    
    if parceiro.caixa_aberto:
        raise HTTPException(status_code=400, detail="O caixa já está aberto.")
        
    parceiro.caixa_aberto = True
    parceiro.saldo_caixa_inicial = valor_gaveta
    parceiro.saldo_caixa_atual = valor_gaveta
    db.commit()
    
    return {"message": f"Caixa aberto com sucesso com R$ {valor_gaveta:.2f} de fundo."}

@router.post("/fechar-caixa")
async def fechar_caixa(db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if not parceiro:
        raise HTTPException(status_code=403, detail="Você não tem permissão de parceiro lojista.")
    
    if not parceiro.caixa_aberto:
        raise HTTPException(status_code=400, detail="Caixa não está aberto.")
    
    comissao_para_pagar = parceiro.comissoes_acumuladas
    if comissao_para_pagar > 0:
        # Credita lucro real do parceiro no saldo digital
        usuario.saldo += comissao_para_pagar
        
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=comissao_para_pagar,
            tipo=TipoTransacao.COMISSAO_PARCEIRO,
            status="concluido",
            detalhes=f"Fechamento de caixa. Comissão de balcão creditada. (Parceiro #{parceiro.id})"
        ))

    # Reseta os contadores para o próximo turno
    resultado = {
        "message": "Caixa encerrado com sucesso.",
        "comissao_recebida": float(comissao_para_pagar),
        "saldo_final_gaveta": float(parceiro.saldo_caixa_atual)
    }

    parceiro.caixa_aberto = False
    parceiro.saldo_caixa_inicial = 0
    parceiro.saldo_caixa_atual = 0
    parceiro.comissoes_acumuladas = 0
    db.commit()
    
    return resultado

from pydantic import BaseModel

class IntermediacaoRequest(BaseModel):
    codigo_cliente: str # Pode ser o ID do usuario (ex: U928A) ou CPF parcial
    valor: Decimal
    tipo_operacao: str # "saque" ou "deposito"
    valor: Decimal
    tipo_operacao: str # "saque" ou "deposito"

@router.post("/intermediar")
async def intermediar_operacao(dados: IntermediacaoRequest, db: Session = Depends(get_db), usuario: Usuario = Depends(obter_usuario_logado)):
    if dados.valor <= 0:
         raise HTTPException(status_code=400, detail="Valor da operação deve ser maior que zero.")
         
    parceiro = db.query(Parceiro).filter(Parceiro.usuario_id == usuario.id, Parceiro.is_active == True).first()
    if not parceiro or not parceiro.caixa_aberto:
        raise HTTPException(status_code=403, detail="Seu caixa está fechado ou você não tem acesso.")
        
    # Identificar cliente
    cliente = db.query(Usuario).filter(Usuario.id == dados.codigo_cliente).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado com este código ID.")
    
    if cliente.id == usuario.id:
        raise HTTPException(status_code=400, detail="Você não pode intermediar seu próprio pagamento no seu próprio caixa.")

    # Processamento dependendo do tipo
    if dados.tipo_operacao == "deposito":
        # Cliente traz papel -> Parceiro transfere do seu dig -> pro cliente
        if usuario.saldo < dados.valor:
            raise HTTPException(status_code=400, detail="Você não tem saldo virtual disponível suficiente na Peer para enviar este depósito.")
        
        # Cálculo de Taxas
        valor_liquido = dados.valor * (Decimal("1.0") - TAXA_TOTAL)
        comissao_parceiro = dados.valor * TAXA_COMISSAO_PARCEIRO
        taxa_plataforma = dados.valor * TAXA_PLATAFORMA
        
        # Debitar parceiro (valor bruto), Creditar cliente (valor líquido)
        # O parceiro transfere o valor digital para o cliente.
        # Aqui o parceiro transfere o valor solicitado, e o sistema retém a taxa.
        usuario.saldo -= dados.valor
        cliente.saldo += valor_liquido
        
        # Incrementar Gaveta Dinheiro Vivo do parceiro (Ele recebeu o valor cheio em papel)
        parceiro.saldo_caixa_atual += dados.valor
        parceiro.comissoes_acumuladas += comissao_parceiro
        
        # Creditar lucro à plataforma (000PL)
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if plataforma:
            plataforma.saldo += taxa_plataforma

        # Registro de Taxa da Plataforma
        db.add(Transacao(
            usuario_id=cliente.id,
            valor=taxa_plataforma,
            tipo=TipoTransacao.TAXA_ESPECIE,
            status="concluido",
            detalhes=f"Taxa Peer: Depósito em Espécie (Parceiro #{parceiro.id})"
        ))
        
        # Transação de Envio pelo Parceiro
        db.add(Transacao(
            usuario_id=usuario.id,
            valor=dados.valor,
            tipo=TipoTransacao.TAXA_INTERMEDIACAO, # Subtração logica
            status="concluido",
            detalhes=f"Intermediou DEPÓSITO presencial para o cliente ID {cliente.id}."
        ))
        
        # Transação de Depósito na Conta do Cliente
        db.add(Transacao(
            usuario_id=cliente.id,
            valor=dados.valor,
            tipo=TipoTransacao.DEPOSITO,
            status="concluido",
            metodo="especie",
            parceiro_id=parceiro.id,
            detalhes=f"DEPÓSITO em Espécie (Pix Loja: {parceiro.nome})"
        ))

        db.commit()
        return {
            "message": f"Depósito concluído. O cliente {cliente.nome} recebeu R$ {dados.valor:.2f}.", 
            "novo_saldo_gaveta": float(parceiro.saldo_caixa_atual)
        }
        
    elif dados.tipo_operacao == "saque":
        # Cliente quer papel vivo e o Parceiro desconta conta.
        # Tem que checar se o cliente tem saldo O APP
        if cliente.saldo < dados.valor:
            raise HTTPException(status_code=400, detail="O cliente não tem saldo digital suficiente para sacar esse valor.")
        
        if parceiro.saldo_caixa_atual < dados.valor:
            raise HTTPException(status_code=400, detail="Você não tem dinheiro físico em gaveta suficiente para pagar este saque.")
            
        # Cálculo de Taxas
        valor_em_maos = dados.valor * (Decimal("1.0") - TAXA_TOTAL)
        comissao_parceiro = dados.valor * TAXA_COMISSAO_PARCEIRO
        taxa_plataforma = dados.valor * TAXA_PLATAFORMA
        
        # Debitar cliente (valor cheio) e creditar parceiro digitalmente (valor cheio)
        cliente.saldo -= dados.valor
        usuario.saldo += dados.valor
        
        # Tirar dinheiro vivo da gaveta (O cliente recebe o valor líquido em mãos)
        parceiro.saldo_caixa_atual -= valor_em_maos
        parceiro.comissoes_acumuladas += comissao_parceiro
        
        # Creditar lucro à plataforma (000PL)
        plataforma = db.query(Usuario).filter(Usuario.id == "000PL").first()
        if plataforma:
            plataforma.saldo += taxa_plataforma

        # Registro de Taxa da Plataforma
        db.add(Transacao(
            usuario_id=cliente.id,
            valor=taxa_plataforma,
            tipo=TipoTransacao.TAXA_ESPECIE,
            status="concluido",
            detalhes=f"Taxa Peer: Saque em Espécie (Parceiro #{parceiro.id})"
        ))
        
        # Transação Saque Cliente
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
            "message": f"Saque liberado! Dinheiro entregue. R$ {dados.valor:.2f} creditado em sua conta.",
            "novo_saldo_gaveta": float(parceiro.saldo_caixa_atual)
        }

    else:
        raise HTTPException(status_code=400, detail="Operação inválida. Use 'deposito' ou 'saque'.")
