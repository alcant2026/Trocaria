# PLANO DE RESPOSTA A INCIDENTES DE SEGURANÇA - PSY PAY

**Versão:** 1.0  
**Classificação:** Confidencial - Uso Interno  
**Responsável:** Equipe de Segurança / DPO  

---

## 1. OBJETIVO

Este documento estabelece os procedimentos para identificação, contenção, erradicação, recuperação e lições aprendidas em caso de incidentes de segurança cibernética, vazamento de dados, fraudes ou qualquer evento que comprometa a integridade, confidencialidade ou disponibilidade da Psy Pay.

---

## 2. DEFINIÇÕES

- **Incidente de Segurança:** Qualquer evento adverso que afete a segurança da informação da plataforma.
- **Vazamento de Dados (Data Breach):** Acesso não autorizado, divulgação ou perda de dados pessoais de usuários.
- **Fraude Financeira:** Operações fraudulentas que resultem em prejuízo financeiro a usuários ou à plataforma.
- **Ransomware:** Sequestro de dados ou sistemas mediante criptografia.
- **DDoS:** Ataque de negação de serviço distribuído.

---

## 3. EQUIPE DE RESPOSTA (CSIRT)

| Função | Responsabilidade | Contato |
|--------|-----------------|---------|
| **Incident Commander** | Coordena toda a resposta ao incidente | [INSERIR] |
| **DPO (Encarregado)** | Interface legal, notificações à ANPD e usuários | dpo@psypay.com.br |
| **Tech Lead** | Análise técnica, contenção e recuperação | [INSERIR] |
| **Comunicação** | Comunicação externa (imprensa, usuários) | [INSERIR] |
| **Jurídico** | Avaliação de riscos legais e processuais | [INSERIR] |

---

## 4. FASES DA RESPOSTA

### 4.1 PREPARAÇÃO (Antes do Incidente)

- [ ] Manter backups criptografados e testados (diários);
- [ ] Manter lista de contatos da equipe de resposta atualizada;
- [ ] Ter contrato de resposta a incidentes com empresa especializada;
- [ ] Realizar simulações (tabletop exercises) a cada 6 meses;
- [ ] Manter logs de auditoria centralizados e imutáveis;
- [ ] Ter plano de comunicação pré-aprovado (templates de e-mail);
- [ ] Manter chaves de criptografia em local seguro (HSM ou cofre físico).

### 4.2 IDENTIFICAÇÃO

**Sinais de alerta:**
- Alertas de monitoramento (falha de login massiva, acesso de IPs estranhos);
- Relatos de usuários (golpes, valores desaparecidos);
- Detecção de malware ou código malicioso;
- Vazamento de dados em fóruns da dark web;
- Indisponibilidade da plataforma (DDoS);
- Alteração não autorizada em código ou configuração.

**Ações imediatas:**
1. Documentar data/hora do primeiro sinal;
2. Coletar evidências iniciais (screenshots, logs);
3. Classificar a severidade do incidente:
   - **CRÍTICO:** Vazamento de dados de usuários, fraude em massa, ransomware;
   - **ALTO:** Acesso não autorizado a sistema, falha de segurança que expõe dados;
   - **MÉDIO:** Tentativa de ataque bloqueada, vulnerabilidade descoberta;
   - **BAIXO:** Spam, tentativa de phishing isolada.

### 4.3 CONTENÇÃO

**Objetivo:** Limitar o dano e impedir a propagação.

#### Contenção de Curto Prazo (Imediata)
- [ ] Isolar sistemas comprometidos (desligar ou isolar na rede);
- [ ] Revogar tokens de API e sessões de administradores;
- [ ] Bloquear IPs atacantes no firewall/WAF;
- [ ] Desativar contas de usuários comprometidas;
- [ ] Congelar transações suspeitas;
- [ ] Ativar modo de manutenção na plataforma, se necessário.

#### Contenção de Longo Prazo
- [ ] Aplicar patches de segurança;
- [ ] Reforçar regras de firewall e WAF;
- [ ] Aumentar monitoramento;
- [ ] Implementar autenticação adicional para admins.

### 4.4 ERRADICAÇÃO

- [ ] Remover malware e backdoors;
- [ ] Corrigir vulnerabilidades exploradas;
- [ ] Reinstalar sistemas comprometidos do zero (se necessário);
- [ ] Alterar TODAS as senhas e chaves de API;
- [ ] Revogar e reemitir certificados SSL, se comprometidos;
- [ ] Verificar integridade do código-fonte (git log, hashes).

### 4.5 RECUPERAÇÃO

- [ ] Restaurar sistemas a partir de backups limpos;
- [ ] Verificar que os sistemas estão seguros antes de voltar ao ar;
- [ ] Restaurar serviços gradualmente (monitoramento intenso);
- [ ] Validar que todas as funcionalidades estão operacionais;
- [ ] Comunicar usuários sobre a restauração.

### 4.6 LIÇÕES APRENDIDAS (POST-INCIDENTE)

Dentro de **7 dias** após o encerramento:
- [ ] Escrever relatório técnico do incidente;
- [ ] Identificar falhas que permitiram o incidente;
- [ ] Atualizar procedimentos e políticas;
- [ ] Treinar equipe com base no aprendizado;
- [ ] Arquivar evidências para possíveis processos.

---

## 5. NOTIFICAÇÕES OBRIGATÓRIAS

### 5.1 Vazamento de Dados Pessoais (LGPD)

**Prazo:** Até 72 horas após a descoberta.

**Notificar:**
1. **ANPD** (Autoridade Nacional de Proteção de Dados)
   - E-mail: atendimento@anpd.gov.br
   - Canal: www.gov.br/anpd
   
2. **Usuários afetados**
   - E-mail e notificação na plataforma;
   - Informar: natureza do incidente, dados envolvidos, medidas adotadas, orientações.

3. **Autoridades policiais** (se houver crime)
   - DEIC/DCIB (estadual) ou PF (federal) para crimes cibernéticos.

### 5.2 Fraude Financeira

**Notificar:**
1. **Banco Central** (se valores significativos ou esquema sistemático);
2. **Coaf** (se indícios de lavagem de dinheiro);
3. **Polícia Civil** - registro de Boletim de Ocorrência;
4. **Usuários vítimas** - com orientações de proteção.

### 5.3 Template de Notificação a Usuários

```
Assunto: Notificação de Segurança - Psy Pay

Prezado(a) [Nome],

Informamos que identificamos um incidente de segurança em [data] que pode ter 
afetado seus dados pessoais.

O que aconteceu:
[Descrição breve e transparente]

Dados potencialmente envolvidos:
[Lista dos tipos de dados]

O que estamos fazendo:
- [Medida 1]
- [Medida 2]

O que você deve fazer:
- Alterar sua senha imediatamente;
- Ativar autenticação de dois fatores (2FA);
- Monitorar suas contas bancárias;
- Desconfiar de e-mails ou mensagens suspeitas.

Para dúvidas: dpo@psypay.com.br

Atenciosamente,
Equipe de Segurança Psy Pay
```

---

## 6. PREVENÇÃO

### 6.1 Checklist Mensal de Segurança
- [ ] Revisar logs de auditoria de acessos administrativos;
- [ ] Verificar tentativas de login falhas e bloqueios;
- [ ] Revisar transações de alto valor (acima de R$ 5.000);
- [ ] Atualizar dependências e bibliotecas (npm, pip);
- [ ] Verificar certificados SSL (validade);
- [ ] Testar backups (restauração parcial);
- [ ] Revisar permissões de acesso (princípio do menor privilégio);
- [ ] Verificar contas de usuários com privilégios administrativos.

### 6.2 Checklist Semanal
- [ ] Verificar alertas de segurança do WAF/firewall;
- [ ] Revisar denúncias de usuários;
- [ ] Verificar novas vulnerabilidades publicadas (CVEs);
- [ ] Monitorar taxa de churn e reclamações (possível indício de problema).

---

## 7. CONTATOS DE EMERGÊNCIA

| Instituição | Telefone | E-mail/Site |
|------------|----------|-------------|
| ANPD | - | atendimento@anpd.gov.br |
| CERT.br | - | cert@cert.br |
| Polícia Federal (Cyber) | 194 | www.pf.gov.br |
| Coaf | - | www.gov.br/coaf |
| Render.com Support | - | dashboard.render.com |
| Neon DB Support | - | neon.tech |

---

## 8. ANEXOS

- **Anexo A:** Mapa de rede e diagrama de arquitetura
- **Anexo B:** Inventário de ativos críticos
- **Anexo C:** Procedimentos de backup e recuperação
- **Anexo D:** Templates de comunicação

---

**Última atualização:** 18/05/2026  
**Próxima revisão:** 18/08/2026  
**Documento confidencial - Não distribuir externamente.**

