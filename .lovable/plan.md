

# Correcoes Criticas da LLM Agent API v3.2.0

## Resumo

Plano de correcoes priorizadas para os problemas identificados na API `llm-agent-api`, organizados por criticidade e impacto.

---

## Fase 1: Bug Critico - Parametros Invertidos (Imediato)

### Problema
A funcao `calcularVagasDisponiveisComLimites` espera 7 parametros nesta ordem:
```
(supabase, clienteId, medicoId, data, servicoKey, servicoConfig, regras)
```

Em duas chamadas (linhas 5285-5292 e 5652-5659), os parametros estao invertidos E falta o `servicoKey`:
- `medico.id` esta sendo passado como `clienteId`
- `clienteId` esta sendo passado como `medicoId`
- `servicoKey` (string) esta ausente -- `servicoConfig` (objeto) esta no lugar de `servicoKey`

### Correcao
Alinhar as duas chamadas com o padrao correto usado nas linhas 2169-2177 e 4593-4601:

```
Antes (linha 5285):
  calcularVagasDisponiveisComLimites(supabase, medico.id, clienteId, dataFormatada, servicoConfigComAtendId, regras)

Depois:
  calcularVagasDisponiveisComLimites(supabase, clienteId, medico.id, dataFormatada, servicoKey, servicoConfigComAtendId, regras)
```

O mesmo ajuste sera aplicado na segunda ocorrencia (linha 5652).

### Impacto
Corrige calculo de vagas incorreto para todos os clientes nos fluxos de disponibilidade sem periodos.

---

## Fase 2: Extracao de Funcao Interna (Curto prazo)

### Problema
`buscarProximasDatasDisponiveis` (linha 4879) e declarada dentro do handler `handleAvailability`, criando uma nova instancia a cada request.

### Correcao
Mover a funcao para o nivel superior do modulo (junto com `calcularVagasDisponiveisComLimites` e outras funcoes utilitarias), sem alterar sua logica interna.

---

## Fase 3: Migrar IPADO para banco (Medio prazo)

### Problema
As `BUSINESS_RULES` hardcoded (linhas 1106-1222) contem UUIDs de medicos do IPADO. Servem como fallback, mas criam acoplamento.

### Correcao
1. Verificar se o IPADO ja possui registros na tabela `business_rules`
2. Se nao, inserir as regras atuais do hardcode como registros no banco
3. Remover o fallback hardcoded do IPADO, mantendo apenas um fallback generico minimo

### Impacto
Torna a API 100% dinamica para todos os clientes, sem necessidade de deploy para mudancas de regras.

---

## Pontos que NAO precisam de correcao

As seguintes criticas foram verificadas e estao incorretas ou ja mitigadas:

- **Vazamento de dados entre clientes**: As queries usam `cliente_id` consistentemente. O RLS do Supabase tambem garante isolamento.
- **Cache compartilhado**: O `CONFIG_CACHE` e indexado por `clienteId`, nao ha risco de colisao.
- **Race conditions**: A funcao `criar_agendamento_atomico_externo` usa `FOR UPDATE` no banco, garantindo atomicidade.

---

## Refatoracao de longo prazo (fora do escopo deste plano)

Estes itens sao importantes mas nao serao implementados agora:
- Quebrar o arquivo de 6.766 linhas em modulos separados
- Criar RPC `verificar_disponibilidade_periodo` para eliminar queries N+1
- Adicionar testes automatizados para a Edge Function

---

## Secao tecnica

### Arquivos alterados
- `supabase/functions/llm-agent-api/index.ts` (correcao de parametros + extracao de funcao)

### Alteracoes no banco de dados
- Possivel INSERT na tabela `business_rules` para migrar regras do IPADO (Fase 3)

### Ordem de execucao
1. Corrigir parametros invertidos (Fase 1)
2. Extrair funcao interna (Fase 2)
3. Migrar regras IPADO (Fase 3)
4. Deploy da Edge Function (automatico)

### Riscos
- Fase 1: Risco baixo, correcao pontual alinhando com padrao existente
- Fase 2: Risco baixo, refatoracao sem mudanca de logica
- Fase 3: Risco medio, requer validacao de que as regras no banco estao corretas antes de remover fallback
