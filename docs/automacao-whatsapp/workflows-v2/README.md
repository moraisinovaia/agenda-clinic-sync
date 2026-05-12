# Workflows v2 — Tools de escrita HTTP

JSONs prontos pra **importar no n8n** (Workflow → Import from File).

## Como importar

1. Criar credential **HTTP Header Auth** no n8n por clínica:
   - Nome: `llm-agent-api - PRO OFTALMO` (e depois `... - IPADO` etc)
   - Header name: `x-api-key`
   - Header value: key plaintext da clínica (Pro Oftalmo: `bfa6d3475af7480fb72ab5a78619d18c841f7940cc2bf42265e4da66470e0305`)
   - Anotar o **credential ID** gerado (algo tipo `abc123XYZ`)

2. Em cada JSON deste diretório, substituir `REPLACE_WITH_PRO_OFTALMO_CREDENTIAL_ID` pelo ID do credential.

3. Importar no n8n. Os arquivos `criarAgendamento` preservam o ID original (`PGYy0zhkykcWPShH`) — sobrescreve a versão antiga. Os `cancelarAgendamento` e `confirmarAgendamento` têm `id: ""` — n8n gera ID novo na importação. Anote os IDs gerados.

4. No Motor IA (`MTCL__MLTC_WF__MotorAtendimentoIA-v1`), adicionar 2 nós `toolWorkflow` novos apontando pros sub-workflows `cancelar` e `confirmar`. Conectar ambos ao AI Agent via edge `ai_tool`.

## Tools cobertas

| Arquivo | Sub-workflow ID | Endpoint | Status |
|---|---|---|---|
| `MTCL__Tool__criarAgendamento-v2-http.json` | PGYy0zhkykcWPShH (preserva original) | POST /llm-agent-api/agendar | ✅ pronto |
| `MTCL__Tool__cancelarAgendamento-v1-http.json` | NOVO (n8n gera) | POST /llm-agent-api/cancelar | ✅ pronto |
| `MTCL__Tool__confirmarAgendamento-v1-http.json` | NOVO (n8n gera) | POST /llm-agent-api/confirmar | ✅ pronto |
| `MTCL__Tool__remarcarAgendamento-v2-http.json` | Q08KbrpSx2WjTJFo (preserva) | POST /llm-agent-api/remarcar | 🟡 aguardando JSON original |
| `MTCL__Tool__entrarFilaEspera-v2-http.json` | GgtV0gfzRuKubIVf (preserva) | POST /llm-agent-api/adicionar-fila | 🟡 aguardando JSON original |

Os 2 que faltam (remarcar + fila): me passe o JSON original do n8n e eu gero a v2 seguindo o mesmo template.

## Padrão dos JSONs

Todos seguem 4 nós em sequência:
1. `receberInputAgente` (executeWorkflowTrigger) — preserva inputs do v1
2. `validarEMontarPayload` (Code) — valida + monta payload pro HTTP
3. `chamarLlmAgentApi` (HttpRequest 4.4) — POST com `neverError: true` (evita 4xx parar fluxo)
4. `formatarResposta` (Code) — empacota response em `{ ok, resultado }` (shape compatível com v1)

## Por que `neverError: true`

O endpoint sempre retorna **status 200** (mesmo em erro de validação clínica — ver `responses.ts`). Mas se a Edge Function cair (5xx), `neverError` evita que o sub-workflow falhe e quebre o AI Agent. A IA ainda recebe um `{ ok: false }` e pode reagir.

## Como o AI Agent vai usar

O Motor IA já tem o tool descritor (com `$fromAI(...)`) apontando pros sub-workflow IDs. Como preservei os IDs do `criar` e `remarcar`, o Motor IA **não precisa mudar**. Pros novos (cancelar/confirmar) você adiciona o tool descritor no Motor IA seguindo o padrão dos existentes.

### Descritor sugerido pro cancelar (no Motor IA, novo nó `tool_cancelarAgendamento`):

```
Description:
Cancela um agendamento existente. Use APENAS após:
1. Confirmar com o paciente qual agendamento via consultar_agendamentos_paciente.
2. Confirmar explicitamente que o paciente quer mesmo cancelar (não apenas remarcar).

Parâmetros (a IA preenche):
- agendamento_id (UUID, OBRIGATÓRIO)
- motivo (string, opcional)

workflowInputs:
- cliente_id: ={{ $('receberDadosWorkflowPai').item.json.clinica_id }}
- agendamento_id: ={{ $fromAI('agendamento_id', 'UUID do agendamento a cancelar.', 'string') }}
- motivo: ={{ $fromAI('motivo', 'Motivo do cancelamento informado pelo paciente. Opcional.', 'string', '') }}
```

### Descritor sugerido pro confirmar:

```
Description:
Confirma a presença do paciente em um agendamento marcado. Use APENAS quando:
1. Você já mostrou o agendamento ao paciente.
2. O paciente confirmou explicitamente (ex: "sim, vou", "confirmado", "ok").

Parâmetro: agendamento_id (UUID, OBRIGATÓRIO).

workflowInputs:
- cliente_id: ={{ $('receberDadosWorkflowPai').item.json.clinica_id }}
- agendamento_id: ={{ $fromAI('agendamento_id', 'UUID do agendamento confirmado.', 'string') }}
```

## Smoke test sugerido (com curl, antes mesmo de subir n8n)

```bash
# Testar /agendar diretamente — usa key Pro Oftalmo
curl -X POST https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/agendar \
  -H "x-api-key: bfa6d3475af7480fb72ab5a78619d18c841f7940cc2bf42265e4da66470e0305" \
  -H "Content-Type: application/json" \
  -d '{
    "cliente_id": "0b6a0a35-0059-4a0c-9fb8-413b6253c2ad",
    "paciente_nome": "TESTE INTEGRACAO",
    "data_nascimento": "1990-01-15",
    "convenio": "PARTICULAR",
    "celular": "87999000000",
    "medico_id": "a38f801c-54fa-4676-b677-7593f05a527e",
    "atendimento_id": "<UUID_DO_ATENDIMENTO_CONSULTA_SUELY>",
    "data_consulta": "2026-05-20",
    "hora_consulta": "09:00"
  }'
```

Se voltar `{ success: true, agendamento_id: "..." }` → endpoint OK e pode importar JSONs.
Se voltar `{ success: false, codigo_erro: "..." }` → leia `mensagem_usuario` pra entender (é regra clínica funcionando).
