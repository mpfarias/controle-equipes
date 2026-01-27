# Análise das Regras de Registro de Férias dos Policiais

## 📋 Visão Geral

O sistema possui duas formas principais de gerenciar férias:
1. **Previsão de Férias** - Cadastro do mês previsto para férias (aba "Previsão de férias")
2. **Registro de Afastamento por Férias** - Cadastro efetivo do período de férias como afastamento

---

## 🗄️ Estrutura de Dados

### Tabela `FeriasPolicial`
- **Campos principais:**
  - `policialId` + `ano` (chave única composta)
  - `dataInicio` - Data de início do mês previsto (dia 1 do mês)
  - `dataFim` - Data de fim do mês previsto (último dia do mês)
  - `confirmada` - Boolean indicando se as férias foram confirmadas
  - `reprogramada` - Boolean indicando se as férias foram reprogramadas
  - `dataInicioOriginal` - Data original antes da reprogramação
  - `dataFimOriginal` - Data fim original antes da reprogramação
  - `createdById`, `createdByName`, `updatedById`, `updatedByName` - Auditoria

### Campos no Modelo `Policial` (mapeados)
- `mesPrevisaoFerias` - Mês previsto (1-12)
- `anoPrevisaoFerias` - Ano previsto
- `mesPrevisaoFeriasOriginal` - Mês original antes da reprogramação
- `anoPrevisaoFeriasOriginal` - Ano original antes da reprogramação
- `feriasConfirmadas` - Boolean
- `feriasReprogramadas` - Boolean

---

## 📝 Regras de Previsão de Férias

### 1. Cadastro Inicial de Previsão
- **Onde:** Aba "Previsão de férias" na tela "Gerenciar afastamentos"
- **Campos obrigatórios:**
  - Mês (1-12)
  - Ano (padrão: ano atual)
- **Regras:**
  - Um policial pode ter apenas uma previsão por ano
  - A previsão cria um registro na tabela `FeriasPolicial` com:
    - `dataInicio` = primeiro dia do mês selecionado
    - `dataFim` = último dia do mês selecionado
    - `confirmada` = false
    - `reprogramada` = false

### 2. Confirmação de Férias
- **Ação:** Botão "Confirmar férias" na lista de previsões
- **Regras:**
  - Só pode confirmar se já existe previsão cadastrada
  - Ao confirmar, define `confirmada = true`
  - Não pode confirmar se já foi reprogramada (`reprogramada = true`)

### 3. Reprogramação de Férias
- **Quando:** Apenas se `feriasConfirmadas = true`
- **Campos obrigatórios:**
  - Novo mês
  - **Documento SEI** (obrigatório para reprogramação)
- **Regras:**
  - Não pode reprogramar se já foi reprogramada anteriormente (`reprogramada = true`)
  - Valida se o novo mês possui restrição de afastamento que cobre o mês inteiro
  - Se o mês original não estava restrito mas o novo está, bloqueia a reprogramação
  - Ao reprogramar:
    - Salva `dataInicioOriginal` e `dataFimOriginal` (se não existirem)
    - Atualiza `dataInicio` e `dataFim` para o novo mês
    - Define `reprogramada = true`

### 4. Alteração de Mês Previsto (sem confirmação)
- **Quando:** Existe previsão mas `confirmada = false`
- **Regras:**
  - Pode alterar o mês livremente
  - Não precisa de documento SEI
  - Atualiza apenas `dataInicio` e `dataFim`

---

## 📝 Regras de Registro de Afastamento por Férias

### 1. Validações Gerais

#### Data de Início
- ❌ **Não pode ser anterior à data atual**
- ✅ Deve ser hoje ou futura

#### Data de Término
- ✅ **Obrigatória** para férias
- ✅ Deve ser informada diretamente OU calculada por quantidade de dias

#### Quantidade de Dias
- ✅ Para férias: máximo **30 dias por ano**
- ✅ Para abono: máximo **5 dias por ano**
- ✅ Período mínimo:
  - **Comissionados:** 10 dias por período
  - **Ativos/PTTC/Designados:** 5 dias por período

### 2. Validações por Status do Policial

#### Policiais ATIVOS, PTTC ou DESIGNADOS
- ✅ **Mínimo:** 5 dias por período
- ✅ **Máximo:** 30 dias por ano
- ✅ **Máximo:** 3 períodos por ano
- ✅ **Intervalo entre períodos:** Sem restrição (podem ser adjacentes)

#### Policiais COMISSIONADOS
- ✅ **Mínimo:** 10 dias por período
- ✅ **Máximo:** 30 dias por ano
- ✅ **Máximo:** 3 períodos por ano
- ✅ **Intervalo entre períodos:** Mínimo de **30 dias** entre períodos
- ✅ **Validação adicional:** Deve ser possível dividir os dias restantes em períodos válidos (mínimo 10 dias cada)

#### Policiais DESATIVADOS
- ❌ **Não podem tirar férias**

### 3. Validação de Sobreposição

- ❌ **Não pode haver sobreposição de períodos de férias**
- ✅ Períodos adjacentes são permitidos (um termina em X, outro começa em X+1)
- ✅ Validação considera:
  - Férias que começam no ano
  - Férias que terminam no ano
  - Férias que cobrem o ano inteiro

### 4. Validação de Mês Previsto

- ✅ Se existe previsão de férias confirmada:
  - A data de início do afastamento **não pode ser posterior ao último dia do mês previsto**
  - Exemplo: Se previsão é Janeiro/2026, as férias devem começar até 31/01/2026

### 5. Cálculo de Dias

- ✅ O cálculo considera:
  - Data de início (inclusiva)
  - Data de término (inclusiva)
  - Exemplo: 01/01 a 05/01 = 5 dias

### 6. Validação de Limite Anual

- ✅ Soma todos os dias de férias já cadastrados no ano
- ✅ Adiciona os dias solicitados
- ✅ Verifica se ultrapassa 30 dias
- ✅ Se ultrapassar, mostra quantos dias restam disponíveis

---

## 🔄 Fluxo Completo de Férias

### Fluxo 1: Previsão → Confirmação → Registro
1. **Cadastrar Previsão**
   - Usuário cadastra mês previsto (ex: Janeiro/2026)
   - Sistema cria registro em `FeriasPolicial` com `confirmada = false`

2. **Confirmar Férias**
   - Usuário clica em "Confirmar férias"
   - Sistema atualiza `confirmada = true`

3. **Registrar Afastamento**
   - Usuário cadastra afastamento com motivo "Férias"
   - Sistema valida:
     - Data não pode ser anterior a hoje
     - Data não pode ser posterior ao último dia do mês previsto
     - Não pode haver sobreposição
     - Limites de dias e períodos

### Fluxo 2: Reprogramação
1. **Férias Confirmadas**
   - Policial tem férias confirmadas para Janeiro/2026

2. **Solicitar Reprogramação**
   - Usuário seleciona novo mês (ex: Fevereiro/2026)
   - **Obrigatório:** Informar documento SEI

3. **Validações**
   - Verifica se já foi reprogramada (bloqueia se sim)
   - Verifica restrições de afastamento do novo mês
   - Compara com restrições do mês original

4. **Atualização**
   - Salva datas originais (se não existirem)
   - Atualiza para novo mês
   - Define `reprogramada = true`

---

## ⚠️ Restrições Especiais

### Restrições de Afastamento
- ✅ Sistema verifica se o mês inteiro está restrito para o motivo "Férias"
- ✅ Se o mês original não estava restrito mas o novo está, bloqueia reprogramação
- ✅ Mensagem de erro específica informando qual restrição bloqueia

### Validação de Mês Inteiro Restrito
- ✅ Verifica se existe `RestricaoAfastamento` que cobre:
  - Do dia 1 ao último dia do mês
  - Para o motivo "Férias"
  - No ano da reprogramação

---

## 🎯 Resumo das Regras por Status

| Status | Mínimo Dias/Período | Máximo Dias/Ano | Máximo Períodos/Ano | Intervalo Mínimo |
|--------|---------------------|-----------------|---------------------|------------------|
| **ATIVO** | 5 dias | 30 dias | 3 períodos | Sem restrição |
| **PTTC** | 5 dias | 30 dias | 3 períodos | Sem restrição |
| **DESIGNADO** | 5 dias | 30 dias | 3 períodos | Sem restrição |
| **COMISSIONADO** | 10 dias | 30 dias | 3 períodos | 30 dias |
| **DESATIVADO** | ❌ Não pode | ❌ Não pode | ❌ Não pode | ❌ Não pode |

---

## 📊 Validações Implementadas

### Frontend (`AfastamentosSection.tsx`)
- ✅ Validação de data não pode ser anterior a hoje
- ✅ Validação de sobreposição de períodos
- ✅ Validação de limite de dias (30 para férias, 5 para abono)
- ✅ Validação de limite anual
- ✅ Validação de campos obrigatórios

### Backend (`afastamentos.service.ts`)
- ✅ Validação completa de regras por status
- ✅ Validação de sobreposição (considera períodos adjacentes)
- ✅ Validação de mês previsto
- ✅ Validação de intervalo mínimo entre períodos (comissionados)
- ✅ Validação de possibilidade de dividir dias restantes (comissionados)
- ✅ Validação de limite de períodos (máximo 3)

### Backend (`policiais.service.ts`)
- ✅ Validação de restrições de afastamento na reprogramação
- ✅ Validação de não permitir segunda reprogramação
- ✅ Criação/atualização de previsão de férias
- ✅ Confirmação de férias

---

## 🔍 Pontos de Atenção

1. **Previsão vs. Registro:**
   - A previsão é apenas informativa (mês previsto)
   - O registro de afastamento é o que efetivamente conta para validações
   - A validação de mês previsto só funciona se as férias foram **confirmadas**

2. **Reprogramação:**
   - Só pode reprogramar uma vez
   - Requer documento SEI obrigatório
   - Valida restrições de afastamento

3. **Períodos Adjacentes:**
   - Períodos que terminam em X e começam em X+1 são permitidos
   - Não são considerados sobrepostos

4. **Cálculo de Dias:**
   - Inclui tanto o dia de início quanto o de término
   - Exemplo: 01/01 a 05/01 = 5 dias (01, 02, 03, 04, 05)

5. **Limite Anual:**
   - Conta todos os dias de férias do ano, não apenas do mês
   - Considera férias que começam no ano OU terminam no ano OU cobrem o ano inteiro

---

## 📝 Observações Técnicas

### Estrutura de Dados
- `FeriasPolicial` armazena previsão (mês inteiro)
- `Afastamento` com motivo "Férias" armazena o período efetivo
- Campos mapeados no `Policial` facilitam consulta sem joins

### Validações Duplicadas
- Frontend valida para melhor UX (feedback imediato)
- Backend valida para segurança (não confia no frontend)
- Backend tem validações mais completas (ex: intervalo entre períodos)

### Auditoria
- Todas as operações registram `createdBy` e `updatedBy`
- Histórico de reprogramação mantido em `dataInicioOriginal` e `dataFimOriginal`

---

**Data da Análise:** 27 de Janeiro de 2026  
**Analisado por:** Auto (Cursor AI)
