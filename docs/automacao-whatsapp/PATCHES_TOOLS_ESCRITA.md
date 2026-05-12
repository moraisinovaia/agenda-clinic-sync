# Patches Tools de Escrita — Sprint 1.5 (Arquitetura Híbrida Prática)

## Decisão arquitetural

**Híbrido prático**: tools n8n de **LEITURA** mantém SQL direto (já validado, latência menor, baixo risco). Tools de **ESCRITA** passam a chamar HTTP do `llm-agent-api` pra herdar as regras clínicas, idempotência, multi-tenant binding e auditoria já testadas (295+ testes).

| Categoria | Tools | Acesso a dados |
|---|---|---|
| **Leitura** (mantém SQL) | consultar_medicos, consultar_disponibilidade, consultar_agendamentos_paciente, consultar_regras, consultar_preparo, consultar_faq | Postgres direto |
| **Escrita** (refatorar pra HTTP) | criar_agendamento, remarcar_agendamento, entrar_fila_espera | POST llm-agent-api |
| **Novas (já nascem HTTP)** | cancelar_agendamento, confirmar_agendamento | POST llm-agent-api |

## Endpoint base

```
URL base: https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/<rota>
Auth:     header `x-api-key: <key plaintext>`
```

**Keys já cadastradas** (em `api_keys` no Sistema INOVAIA):

| Cliente | Label | Status | Plaintext |
|---|---|---|---|
| **PRO OFTALMO** | `n8n-suely-piloto-2026-05-12` | ✅ ativa | ⚠️ Anotada na conversa (12/05) |
| **IPADO** | `n8n-marcelo-rotation-2026-05-04` | ✅ ativa | Você já tem |
| **3ª clínica nova** | a criar | pendente | a gerar |

## Convenção dos credentials n8n

Recomendo criar UM credential por clínica no n8n:
- Nome: `llm-agent-api - PRO OFTALMO`
- Tipo: HTTP Header Auth
- Header name: `x-api-key`
- Header value: `<key plaintext>`

Repetir pra IPADO e (depois) 3ª clínica.

Selecionar dinamicamente no nó HttpRequest via expressão (se possível) ou criar versão por clínica do workflow (mais simples pra MVP).

---

## Tool 1 — criar_agendamento → `POST /llm-agent-api/agendar`

### Body esperado pelo endpoint

```jsonc
{
  "cliente_id":       "<uuid do cliente, obrigatório>",
  "paciente_nome":    "<string>",          // alias: nome_paciente, nome_completo
  "data_nascimento":  "YYYY-MM-DD",        // alias: paciente_nascimento, birth_date, nascimento
  "convenio":         "<string>",
  "celular":          "<10-13 dígitos>",   // alias: mobile, whatsapp, telefone_celular
  "telefone":         "<opcional>",
  "medico_id":        "<uuid>",            // ou medico_nome
  "atendimento_id":   "<uuid>",            // ou atendimento_nome
  "data_consulta":    "YYYY-MM-DD",        // alias: data_agendamento, appointment_date, data
  "hora_consulta":    "HH:MM",             // alias: hora_agendamento, appointment_time, hora
  "observacoes":      "<opcional>",
  "idempotency_key":  "<opcional, gerado se vazio>"
}
```

### Substituição no Motor IA

Atualmente é um `toolWorkflow` que chama o sub-workflow `DEV__Tool__criarAgendamento` (id `PGYy0zhkykcWPShH`). Refator: **substituir esse sub-workflow** por uma versão que faz `HttpRequest`.

**Opção A (recomendada)** — manter o nó `toolWorkflow` no Motor IA inalterado, e dentro do sub-workflow `DEV__Tool__criarAgendamento` trocar a lógica SQL pelo HttpRequest. Vantagem: a "assinatura" da tool (parâmetros via `$fromAI`) continua igual e o Motor IA não precisa mudar.

**Opção B** — trocar o `toolWorkflow` por `toolHttpRequest` direto no Motor IA. Mais simples mas obriga editar 2 workflows.

Vou usar Opção A nos templates abaixo.

### Template do novo sub-workflow `DEV__Tool__criarAgendamento` (Opção A)

```jsonc
{
  "name": "DEV__Tool__criarAgendamento",
  "nodes": [
    {
      "id": "trigger-001",
      "name": "receberDadosDaTool",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.1,
      "parameters": {
        "workflowInputs": {
          "values": [
            { "name": "cliente_id" },
            { "name": "nome_completo" },
            { "name": "data_nascimento" },
            { "name": "convenio" },
            { "name": "telefone" },
            { "name": "celular" },
            { "name": "medico_id" },
            { "name": "atendimento_id" },
            { "name": "data_agendamento" },
            { "name": "hora_agendamento" },
            { "name": "observacoes" },
            { "name": "criado_por" },
            { "name": "idempotency_key" }
          ]
        }
      }
    },
    {
      "id": "http-001",
      "name": "chamarLlmAgentApi",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "parameters": {
        "method": "POST",
        "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/agendar",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            { "name": "Content-Type", "value": "application/json" }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"cliente_id\": {{ JSON.stringify($json.cliente_id) }},\n  \"paciente_nome\": {{ JSON.stringify($json.nome_completo) }},\n  \"data_nascimento\": {{ JSON.stringify($json.data_nascimento) }},\n  \"convenio\": {{ JSON.stringify($json.convenio) }},\n  \"telefone\": {{ JSON.stringify($json.telefone || '') }},\n  \"celular\": {{ JSON.stringify($json.celular) }},\n  \"medico_id\": {{ JSON.stringify($json.medico_id) }},\n  \"atendimento_id\": {{ JSON.stringify($json.atendimento_id) }},\n  \"data_consulta\": {{ JSON.stringify($json.data_agendamento) }},\n  \"hora_consulta\": {{ JSON.stringify($json.hora_agendamento) }},\n  \"observacoes\": {{ JSON.stringify($json.observacoes || '') }},\n  \"idempotency_key\": {{ JSON.stringify($json.idempotency_key || '') }}\n}",
        "options": {
          "timeout": 30000
        }
      },
      "credentials": {
        "httpHeaderAuth": {
          "id": "<id_credential_pro_oftalmo>",
          "name": "llm-agent-api - PRO OFTALMO"
        }
      }
    }
  ],
  "connections": {
    "receberDadosDaTool": {
      "main": [[ { "node": "chamarLlmAgentApi", "type": "main", "index": 0 } ]]
    }
  }
}
```

### Tratamento de erro

O endpoint retorna:
- **200**: `{ ok: true, agendamento: {...}, mensagem_usuario: "..." }`
- **400**: `{ ok: false, codigo_erro: "...", mensagem_usuario: "..." }` — bloqueio por regra clínica (CASEMBRAPA_BLOCK, MAPA_PESO, etc)
- **429**: `{ codigo_erro: "RATE_LIMITED", retry_after_ms: ... }`

A IA do Motor lê `mensagem_usuario` e devolve pro paciente.

---

## Tool 2 — remarcar_agendamento → `POST /llm-agent-api/remarcar`

### Body esperado

```jsonc
{
  "cliente_id":     "<uuid>",
  "agendamento_id": "<uuid, obrigatório>",
  "nova_data":      "YYYY-MM-DD",
  "nova_hora":      "HH:MM",
  "observacoes":    "<opcional>"
}
```

### Substituição

Mesma estratégia (Opção A). Trocar lógica do sub-workflow `DEV__Tool__remarcarAgendamento` (`Q08KbrpSx2WjTJFo`) por HttpRequest:

```jsonc
{
  "method": "POST",
  "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/remarcar",
  "jsonBody": "={\n  \"cliente_id\": {{ JSON.stringify($json.cliente_id) }},\n  \"agendamento_id\": {{ JSON.stringify($json.agendamento_id) }},\n  \"nova_data\": {{ JSON.stringify($json.nova_data) }},\n  \"nova_hora\": {{ JSON.stringify($json.nova_hora) }}\n}"
}
```

---

## Tool 3 — entrar_fila_espera → `POST /llm-agent-api/adicionar-fila`

### Body esperado

```jsonc
{
  "cliente_id":         "<uuid>",
  "nome_completo":      "<string>",
  "data_nascimento":    "YYYY-MM-DD",
  "convenio":           "<string>",
  "celular":            "<10-13 dígitos>",
  "medico_id":          "<uuid>",          // ou medico_nome
  "atendimento_id":     "<uuid>",          // ou atendimento_nome
  "data_preferida":     "YYYY-MM-DD",
  "periodo_preferido":  "manha | tarde | qualquer",
  "observacoes":        "<opcional>",
  "prioridade":         "<opcional>"
}
```

### Substituição

Tool atual passa só `paciente_id` (UUID); o endpoint quer dados denormalizados (nome, nascimento, etc) pra criar/reusar paciente. Solução: a IA agora **pede esses dados ao paciente antes de chamar a tool**. Atualizar a descrição da tool pra coletar nome + nascimento + convênio + celular.

```jsonc
{
  "method": "POST",
  "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/adicionar-fila",
  "jsonBody": "={\n  \"cliente_id\": {{ JSON.stringify($json.cliente_id) }},\n  \"nome_completo\": {{ JSON.stringify($json.nome_completo) }},\n  \"data_nascimento\": {{ JSON.stringify($json.data_nascimento) }},\n  \"convenio\": {{ JSON.stringify($json.convenio) }},\n  \"celular\": {{ JSON.stringify($json.celular) }},\n  \"medico_id\": {{ JSON.stringify($json.medico_id) }},\n  \"atendimento_id\": {{ JSON.stringify($json.atendimento_id) }},\n  \"data_preferida\": {{ JSON.stringify($json.data_preferida) }},\n  \"periodo_preferido\": {{ JSON.stringify($json.periodo_preferido || 'qualquer') }}\n}"
}
```

---

## Tool 4 (NOVA) — cancelar_agendamento → `POST /llm-agent-api/cancelar`

Tool **não existe** no Motor IA hoje (C.5 do plano original). Vai nascer HTTP.

### Body esperado

```jsonc
{
  "cliente_id":     "<uuid>",
  "agendamento_id": "<uuid, obrigatório>",
  "motivo":         "<opcional>"
}
```

### Como criar no Motor IA

Adicionar novo nó `toolWorkflow` apontando pra um novo sub-workflow `DEV__Tool__cancelarAgendamento`. Conectar ao `AI Agent` via edge `ai_tool`.

**Descrição da tool (pro AI Agent):**
```
Cancela um agendamento existente. Use APENAS após:
1. Confirmar com o paciente qual agendamento cancelar (via consultar_agendamentos_paciente).
2. Confirmar explicitamente que o paciente quer mesmo cancelar (não apenas remarcar).

Parâmetros:
- agendamento_id (string UUID, OBRIGATÓRIO)
- motivo (string, opcional)

Retorno: { ok, resultado }. Se ok=false, leia resultado.mensagem_usuario.
```

**Workflow inputs (`$fromAI`):**
```jsonc
{
  "agendamento_id": "{{ $fromAI('agendamento_id', 'UUID do agendamento a cancelar. Obtenha via consultar_agendamentos_paciente.', 'string') }}",
  "motivo":         "{{ $fromAI('motivo', 'Motivo do cancelamento informado pelo paciente. Opcional.', 'string', '') }}"
}
```

---

## Tool 5 (NOVA) — confirmar_agendamento → `POST /llm-agent-api/confirmar`

Tool **não existe** no Motor IA hoje. Nasce HTTP.

### Body esperado

```jsonc
{
  "cliente_id":     "<uuid>",
  "agendamento_id": "<uuid, obrigatório>"
}
```

### Quando usar

Em D-1 (dia anterior à consulta) o sistema envia mensagem "Confirma sua consulta amanhã às XX:XX?". Se paciente responde "sim/confirmo/ok" → IA chama esta tool. Por ora a tool fica disponível mas a confirmação automática (timer D-1) é Sprint 4.

**Descrição da tool:**
```
Confirma a presença do paciente em um agendamento marcado. Use APENAS quando:
1. Você já tiver mostrado o agendamento ao paciente.
2. O paciente confirmou explicitamente (ex: "sim, vou", "confirmado", "ok pode ser").

Parâmetro: agendamento_id (string UUID, OBRIGATÓRIO).
Retorno: { ok, resultado }.
```

---

## Plano de aplicação (ordem importa)

### Passo 1 — credentials n8n (5 min)
Criar credentials HTTP Header Auth:
- `llm-agent-api - PRO OFTALMO` → header `x-api-key: bfa6d3475af7480fb72ab5a78619d18c841f7940cc2bf42265e4da66470e0305`
- `llm-agent-api - IPADO` → key existente

### Passo 2 — refatorar 3 sub-workflows existentes (~1h)
- `DEV__Tool__criarAgendamento` (`PGYy0zhkykcWPShH`) → HttpRequest
- `DEV__Tool__remarcarAgendamento` (`Q08KbrpSx2WjTJFo`) → HttpRequest
- `DEV__Tool__entrarFilaEspera` (`GgtV0gfzRuKubIVf`) → HttpRequest

Pra cada um: manter o `executeWorkflowTrigger` com os mesmos inputs (assinatura preservada pro Motor IA) + trocar resto por `HttpRequest`.

### Passo 3 — criar 2 sub-workflows novos (~30 min)
- `DEV__Tool__cancelarAgendamento` (HttpRequest direto)
- `DEV__Tool__confirmarAgendamento` (HttpRequest direto)

Anotar os IDs gerados pelo n8n.

### Passo 4 — Motor IA — adicionar 2 nós `toolWorkflow` (~10 min)
- Conectar `tool_cancelarAgendamento` → AI Agent (edge ai_tool)
- Conectar `tool_confirmarAgendamento` → AI Agent (edge ai_tool)
- Atualizar systemMessage (Patch 3 do PATCHES_WORKFLOWS_v2.md) — adicionar regra que diz pra IA cancelar/confirmar usando essas tools

### Passo 5 — smoke test (~30 min)
Mandar mensagens reais ao Pro Oftalmo:
- "Oi" → saudação OK?
- "Quero marcar com Dra. Suely amanhã às 9h" → chama criar_agendamento (HTTP) → vê retorno regular
- "Quero remarcar para 14h" → chama remarcar_agendamento (HTTP)
- "Cancela meu agendamento" → chama cancelar_agendamento (HTTP, novo)
- "Não tem vaga essa semana, me coloca na fila" → entrar_fila_espera (HTTP)

Após cada smoke, conferir no DB:
```sql
SELECT created_at, acao, status, payload_request, payload_response, duracao_ms
FROM agendamentos_log
WHERE cliente_id = '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad'
ORDER BY created_at DESC LIMIT 10;
```

Se algum vier `status='bloqueado_regra'`, é regra clínica funcionando — bom sinal. Erro real seria `status='erro'`.

---

## Por que essa arquitetura é correta (pra healthcare)

- **Regras clínicas centralizadas**: validações já testadas em TypeScript (peso pra MAPA, idade, exige_guia, particular fallback) rodam SEMPRE em escrita. Não escapa nenhuma.
- **Idempotência built-in**: `/agendar` rejeita duplicata via `idempotency_key` ou chave composta. Mensagem reenviada pelo paciente não duplica.
- **Multi-tenant verificado**: `enforceTenantBinding` rejeita se a key da Pro Oftalmo tentar agir em IPADO. Impede o C.7.b que eu detectei.
- **Audit trail**: `agendamentos_log` (no agenda-clinic-sync) loga tudo. Investigação de incidente fica rastreável.
- **Rate limit**: 60 req/min com burst 20 por cliente_id. Webhook flood não derruba.

## O que NÃO mudou e por quê

- **Tools de leitura** seguem SQL direto pela latência (cada chamada de tool no Agent toma 200ms — multiplicar por HTTP é caro). Risco baixo (read-only).
- **Recepção/PreBloco/PosBloco** seguem SQL pra estado da conversa (lock, memory, status atendimento) — são tabelas de uso exclusivo n8n.
- **fila_pendente_resposta** (notificar vaga aberta) — fica SQL no INOVAIA por ora. Considerar mover pra agenda-clinic-sync.fila_whatsapp em Sprint 4.
