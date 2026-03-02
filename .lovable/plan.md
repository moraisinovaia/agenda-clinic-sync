

## Plan: Webhook dispatch + SQL cleanup for fila de espera

### 1. SQL Migration: Drop old trigger

Single migration to remove the `trigger_notificar_fila_webhook` and `notificar_fila_webhook()` function that were replaced by the Edge Function logic.

```sql
DROP TRIGGER IF EXISTS trigger_notificar_fila_webhook ON fila_notificacoes;
DROP FUNCTION IF EXISTS notificar_fila_webhook();
```

### 2. SQL Migration: Add `evolution_instance_name` to `configuracoes_clinica`

The payload requires `evolution_instance_name` per `cliente_id`, but this field doesn't exist in any table. A new row per clinic in `configuracoes_clinica` will store it (chave = `evolution_instance_name`, categoria = `integracao`). No schema change needed — just INSERT seed data if you provide the values, or the code will send `null` when not configured.

### 3. Edge Function changes (`supabase/functions/llm-agent-api/index.ts`)

**3a. New helper function `dispararWebhookFilaEspera`**

A reusable async function that:
- Receives: supabase client, clienteId, medicoId, atendimentoId, notif data (notif_id, fila_id, paciente_nome, paciente_celular, medico_nome, atendimento_nome, data_agendamento, hora_agendamento, tempo_limite)
- Looks up business rules via `getMedicoRules` to determine `tipo_agendamento` for the relevant day/period
- If `ordem_chegada`: extracts `horario_inicio`/`horario_fim` from the period config
- If `hora_marcada`: sets hora exact, no horario_inicio/fim
- Queries `configuracoes_clinica` for `evolution_instance_name` by `cliente_id`
- Sends POST to `https://n8n-medical.inovaia-automacao.com.br/webhook/fila-espera-notificar` with full payload
- Wrapped entirely in try/catch — never blocks caller

**3b. handleCancel modifications**

- Add `atendimentos(nome)` to the agendamento select query (line ~3864)
- After building `filaEsperaNotificado` (line ~3952), if not null, call `dispararWebhookFilaEspera` with the gathered data

**3c. handleResponderFila modifications**

- After building `proximoNotificado` (line ~4453), if not null, call `dispararWebhookFilaEspera` with the next candidate's data
- The medico_nome and atendimento_nome are already available from `filaItem.medicos.nome` and `filaItem.atendimentos.nome`

### Technical details

The helper function signature:

```typescript
async function dispararWebhookFilaEspera(
  supabase: any, config: DynamicConfig | null,
  clienteId: string, medicoId: string, atendimentoId: string,
  notifData: {
    notif_id: string, fila_id: string,
    paciente_nome: string, paciente_celular: string,
    medico_nome: string, atendimento_nome: string,
    data_agendamento: string, hora_agendamento: string,
    tempo_limite: string
  }
)
```

Inside:
1. `getMedicoRules(config, medicoId, BUSINESS_RULES.medicos[medicoId])` to get rules
2. Determine day-of-week from `data_agendamento`, map `hora_agendamento` to period (manhã/tarde)
3. Find matching period config → check `tipo_agendamento`
4. Query `configuracoes_clinica` where `cliente_id` = clienteId and `chave` = 'evolution_instance_name'
5. Build payload, fetch webhook URL, log result

Both call sites (handleCancel and handleResponderFila) will call this with `await` but inside try/catch so it never blocks the response.

