# Manual de Integração — llm-agent-api

**Versão da API:** 3.2.0
**Última atualização:** 2026-05-12
**Audiência:** equipes que automatizam fluxos n8n / WhatsApp / sistemas externos que precisam chamar o llm-agent-api.

---

## 1. Visão geral

`llm-agent-api` é uma Edge Function Supabase que centraliza **todas as escritas e validações clínicas** do sistema de agendamento. Qualquer automação (n8n, app externo, bot) que precise criar/remarcar/cancelar/confirmar agendamento, consultar disponibilidade, listar pacientes, etc., chama esta API por HTTP.

### Por que existe

- Garantir que as **regras clínicas** (idade, peso, convênio, exige_guia, scope por canal, etc.) sejam aplicadas **uniformemente**, qualquer que seja o canal de entrada.
- Garantir **idempotência** (mensagem reenviada não duplica agendamento).
- Garantir **isolamento multi-tenant** (clínica A não pode ler/escrever dados da clínica B).
- Centralizar **audit + rate limit** num só lugar.

### Quando usar HTTP vs SQL direto

| Operação | HTTP (recomendado) | SQL direto |
|---|---|---|
| Criar agendamento | ✅ sempre | ⚠️ só se houver controle clínico fora da API |
| Cancelar / remarcar / confirmar | ✅ sempre | ❌ |
| Adicionar paciente à fila | ✅ sempre | ❌ |
| Consultar médicos / horários disponíveis | ✅ recomendado | ✅ aceitável (read-only, baixo risco) |
| Estado de conversa (lock, memória) | ❌ | ✅ tabelas dedicadas n8n |

### Stack

- **Edge Function**: Deno + TypeScript.
- **DB**: Postgres no projeto `qxlvzbvzajibdtlzngdy` (Sistema INOVAIA).
- **Autenticação**: header `x-api-key` (SHA-256, tabela `api_keys`).
- **Endpoint base**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/<rota>`

### Versionado por cliente (alternativa)

Existem **funções dedicadas por cliente** (ex.: `llm-agent-api-marcelo`, `llm-agent-api-olhos`, `llm-agent-api-orion`, `llm-agent-api-venus`) para rollouts isolados. Para uso comum, **prefira a função master** (`llm-agent-api`) que é multi-tenant e mais atualizada.

---

## 2. Autenticação

### Header obrigatório

```
x-api-key: <chave em texto puro>
Content-Type: application/json
```

A key é resolvida contra `public.api_keys.key_hash` (SHA-256 hex). Cada tenant tem sua própria key.

### Fluxo de resolução

1. SHA-256 do `x-api-key` recebido.
2. SELECT em `api_keys WHERE key_hash = ? AND ativo = true AND revoked_at IS NULL`.
3. Se encontrar: resolve `cliente_id` da row.
4. **Tenant binding**: o `body.cliente_id` enviado **DEVE** ser igual ao `cliente_id` da key. Diferente = `403 TENANT_MISMATCH`.
5. Modo legacy (`N8N_API_KEY` env): aceita key global sem binding — só pra retrocompatibilidade durante migração. Logs `level: warn` alertam.

### Criar uma key nova

```sql
-- Passo 1 — gerar key plaintext e hash localmente (NÃO no DB)
-- bash:
--   RAW=$(openssl rand -hex 32)
--   HASH=$(printf "%s" "$RAW" | openssl dgst -sha256 -hex | awk '{print $2}')
-- Anote RAW (só você verá uma vez); HASH vai pro INSERT abaixo.

INSERT INTO public.api_keys (cliente_id, key_hash, label, ativo)
VALUES (
  '<UUID_DO_CLIENTE>',
  '<HASH_SHA256_HEX>',
  '<LABEL_DESCRITIVO>',           -- ex: 'n8n-suely-piloto-2026-05-12'
  true
)
RETURNING id, label, created_at;
```

**Boas práticas de label**: `<consumidor>-<contexto>-<YYYY-MM-DD>`. Facilita auditoria.

### Revogar

```sql
UPDATE public.api_keys
SET ativo = false, revoked_at = now()
WHERE id = '<UUID_DA_KEY>';
```

Keys revogadas NÃO são deletadas — preserva auditoria de `last_used_at`.

### Rotacionar

1. Criar key nova (passo acima).
2. Atualizar consumidor (n8n credential) com a nova plaintext.
3. Aguardar todos os consumidores reflectirem.
4. Revogar a antiga.

---

## 3. Padrão de chamada

### Request mínimo

```http
POST /functions/v1/llm-agent-api/<rota> HTTP/1.1
Host: qxlvzbvzajibdtlzngdy.supabase.co
x-api-key: <key>
Content-Type: application/json

{
  "cliente_id": "<uuid>",
  ...
}
```

**`cliente_id` é obrigatório no body** mesmo a key já resolvendo o tenant. É um check defensivo (rejeita ataque "key vazada de A tenta agir em B").

### Response — sempre status 200

A API retorna **status 200 em todos os casos** (sucesso, erro de negócio, erro técnico), exceto:
- `401` — auth ausente/inválida
- `403` — tenant mismatch
- `429` — rate limit
- `400` — JSON malformado
- `503` — config dinâmica não carregada

Status 200 unificado nos demais casos foi escolha deliberada pra que clientes (n8n / IA) processem o JSON em vez de tratar como exception.

### Shape do response

**Sucesso:**
```json
{
  "success": true,
  "timestamp": "2026-05-12T18:30:00.000Z",
  ...campos específicos do endpoint
}
```

**Erro de negócio** (regra clínica, validação, etc.):
```json
{
  "success": false,
  "codigo_erro": "CASEMBRAPA_BLOCK",
  "mensagem_usuario": "❌ Dr. Marcelo não atende fístula pelo Casembrapa...",
  "mensagem_whatsapp": "<mesma mensagem, alias>",
  "detalhes": { ... },
  "sugestoes": { ... },
  "timestamp": "..."
}
```

**Erro técnico** (exceção inesperada):
```json
{
  "success": false,
  "codigo_erro": "ERRO_GENERICO",
  "error": "<mensagem técnica>",
  "mensagem_usuario": "...",
  "timestamp": "..."
}
```

### `config_id` opcional

```json
{ "cliente_id": "...", "config_id": "...", ... }
```

Útil quando uma clínica tem múltiplas configurações (ex.: filiais com regras diferentes). Sem `config_id`, carrega a primeira config ativa do `cliente_id`.

---

## 4. Endpoints (referência completa)

Todas as rotas suportam **PT-BR e EN** (mapeadas via `actionMap`).

### 4.1 schedule — Criar agendamento

`POST /llm-agent-api/agendar` ou `/schedule`

**Body:**

| Campo | Tipo | Obrig. | Aliases aceitos |
|---|---|---|---|
| `cliente_id` | UUID | ✅ | — |
| `paciente_nome` | string | ✅ | nome_paciente, nome_completo, patient_name |
| `data_nascimento` | YYYY-MM-DD | ✅ | paciente_nascimento, birth_date, nascimento |
| `convenio` | string | ✅ | insurance, plano_saude |
| `celular` | string (10-13 dígitos) | ✅ | mobile, whatsapp, telefone_celular |
| `medico_id` ou `medico_nome` | UUID ou string | ✅ (1 dos 2) | doctor_id, doctor_name |
| `atendimento_id` ou `atendimento_nome` | UUID ou string | ✅ | tipo_consulta, service_name |
| `data_consulta` | YYYY-MM-DD | ✅ | data_agendamento, appointment_date, data |
| `hora_consulta` | HH:MM | ✅ | hora_agendamento, appointment_time, hora |
| `telefone` | string | ❌ | phone, telefone_fixo |
| `observacoes` | string | ❌ | — |
| `allowed_doctor_ids` | UUID[] | ❌ | doctor_scope (filtra escopo do canal) |
| `allowed_services` | string[] | ❌ | (idem) |

**Response sucesso:**
```json
{
  "success": true,
  "message": "✅ Consulta agendada para 15/05/2026 às 09:00 com Dra. Suely...",
  "agendamento_id": "uuid",
  "paciente_id": "uuid",
  "medico": "DRA MARIA SUELY AMORIM MENDES",
  "data": "2026-05-15",
  "hora": "09:00",
  "validado": true,
  "confirmacao_criado": true
}
```

**Códigos de erro de negócio:** `DADOS_INCOMPLETOS`, `DATA_PASSADA`, `HORARIO_PASSADO`, `MEDICO_NAO_ENCONTRADO`, `MEDICO_FORA_DO_ESCOPO`, `CONVENIO_NAO_ACEITO`, `IDADE_INCOMPATIVEL`, `SERVICO_FORA_DO_ESCOPO`, `SERVICO_SEM_AGENDAMENTO`, `SERVICO_NAO_DISPONIVEL_ONLINE`, `LIMITE_ATINGIDO`, `SUBLIMITE_CONVENIO_ATINGIDO`, `SEM_VAGAS_DISPONIVEIS`, `HORARIO_OCUPADO`, `SLOT_ESGOTADO`, `DATA_BLOQUEADA`.

**Idempotência:** o endpoint gera internamente uma chave `<cliente_id>:<celular>:<medico_id>:<data_consulta>:<hora_consulta>`. Reenviar a mesma payload retorna o agendamento original (não duplica).

---

### 4.2 reschedule — Remarcar

`POST /llm-agent-api/remarcar` ou `/reschedule`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `agendamento_id` | UUID | ✅ |
| `nova_data` | YYYY-MM-DD | ✅ |
| `nova_hora` | HH:MM | ✅ |
| `observacoes` | string | ❌ |

**Response sucesso:**
```json
{
  "success": true,
  "data": {
    "agendamento_id": "uuid",
    "paciente": "...",
    "medico": "...",
    "data_anterior": "2026-05-15",
    "hora_anterior": "09:00",
    "data_nova": "2026-05-20",
    "hora_nova": "14:00",
    "message": "Consulta remarcada com sucesso"
  }
}
```

**Erros:** `AGENDAMENTO_FORA_DO_ESCOPO`, `DATA_PASSADA`, `HORARIO_PASSADO`, `HORARIO_OCUPADO`, `SLOT_ESGOTADO`, `SEM_VAGAS_DISPONIVEIS`, `DIA_NAO_ATENDIDO`.

---

### 4.3 cancel — Cancelar

`POST /llm-agent-api/cancelar` ou `/cancel`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `agendamento_id` | UUID | ✅ |
| `motivo` | string | ❌ |

**Response sucesso:**
```json
{
  "success": true,
  "data": {
    "agendamento_id": "uuid",
    "paciente": "...",
    "medico": "...",
    "data": "2026-05-15",
    "hora": "09:00",
    "message": "Consulta cancelada com sucesso",
    "fila_espera_notificado": {
      "fila_id": "uuid",
      "paciente_nome": "...",
      "data_disponivel": "2026-05-15",
      "hora_disponivel": "09:00",
      "tempo_limite": 60
    }
  }
}
```

**Comportamento especial:** trigger Postgres `processar_fila_cancelamento` é executado automaticamente. Se houver paciente na fila de espera para esse médico/data, ele é notificado e o campo `fila_espera_notificado` retorna populado.

**Erros:** `AGENDAMENTO_FORA_DO_ESCOPO`.

---

### 4.4 confirm — Confirmar

`POST /llm-agent-api/confirmar` ou `/confirm`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `agendamento_id` | UUID | ✅ |
| `observacoes` | string | ❌ |

**Response sucesso:**
```json
{
  "success": true,
  "data": {
    "agendamento_id": "uuid",
    "paciente": "...",
    "celular": "...",
    "medico": "...",
    "data": "2026-05-15",
    "hora": "09:00",
    "status": "confirmado",
    "message": "Consulta confirmada..."
  }
}
```

**Idempotência:** UPDATE atômico com filtro `WHERE status = 'agendado'`. Confirmar duas vezes só altera a primeira; a segunda chamada retorna 200 com indicação `already_confirmed: true`.

---

### 4.5 availability — Disponibilidade

`POST /llm-agent-api/disponibilidade` ou `/availability`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `medico_nome` ou `medico_id` | string ou UUID | ❌ (filtra) |
| `atendimento_nome` | string | ❌ |
| `data_preferida` | YYYY-MM-DD | ❌ |
| `periodo_preferido` | `manha` \| `tarde` \| `noite` \| `qualquer` | ❌ |
| `mensagem_busca` | string | ❌ (auto-detecta "próxima vaga" vs data) |
| `allowed_doctor_ids` | UUID[] | ❌ |

**Response sucesso:**
```json
{
  "success": true,
  "data": {
    "datas_disponiveis": [
      {
        "data": "2026-05-15",
        "dia_semana": "Quinta-feira",
        "periodos": [
          {
            "periodo": "Manhã",
            "horario_distribuicao": "08:00 às 12:00",
            "vagas_disponiveis": 5,
            "total_vagas": 10,
            "tipo": "ordem_chegada"
          }
        ]
      }
    ],
    "message": "..."
  }
}
```

**Comportamento especial:** busca até 100 dias se necessário. Filtra períodos passados (hora atual + offset). Ordena por disponibilidade.

**Erros:** `MEDICO_NAO_ENCONTRADO`, `SERVICO_NAO_ENCONTRADO`, `SERVICO_FORA_DO_ESCOPO`, `DIA_NAO_ATENDIDO`, `PERIODO_NAO_PERMITIDO`, `DIA_PERIODO_NAO_PERMITIDO`, `SEM_VAGAS_DISPONIVEIS`, `REGRAS_NAO_CONFIGURADAS`.

---

### 4.6 check-patient — Verificar paciente

`POST /llm-agent-api/verificar-paciente` ou `/check-patient`

**Body:** ao menos UM dos campos abaixo deve ser preenchido:

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `paciente_nome` | string | ❌* |
| `data_nascimento` | YYYY-MM-DD | ❌* |
| `celular` | string | ❌* |
| `allowed_doctor_ids` | UUID[] | ❌ |

*Mínimo 1 obrigatório.

**Response sucesso:**
```json
{
  "success": true,
  "encontrado": true,
  "paciente_cadastrado": true,
  "consultas": [...],
  "total": 3,
  "message": "..."
}
```

Sem erros de negócio — retorna `encontrado: false` se não achou. Faz fuzzy match (últimos 4 dígitos celular com tolerância ±5).

---

### 4.7 patient-search — Pesquisar pacientes

`POST /llm-agent-api/pesquisa-pacientes` ou `/patient-search`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `busca` | string | ✅ |
| `tipo` | `nome` \| `telefone` \| `nascimento` | ❌ (default: auto-detect) |

---

### 4.8 list-appointments — Listar agendamentos do dia

`POST /llm-agent-api/lista-consultas` ou `/list-appointments`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `medico_nome` | string | ✅ |
| `data` | string (`hoje`, `CURRENT_DATE`, `YYYY-MM-DD`) | ✅ |

---

### 4.9 list-doctors — Listar médicos

`POST /llm-agent-api/lista-medicos` ou `/list-doctors`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `allowed_doctor_ids` | UUID[] | ❌ |

---

### 4.10 clinic-info — Info da clínica

`POST /llm-agent-api/info-clinica` ou `/clinic-info`

**Body:** apenas `cliente_id`.

---

### 4.11 doctor-schedules — Horários dos médicos

`POST /llm-agent-api/horarios-medicos` ou `/doctor-schedules`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `medico_nome` | string | ❌ |
| `servico_nome` | string | ❌ |

---

### 4.12 Fila de espera (3 endpoints)

#### consultar-fila

`POST /llm-agent-api/consultar-fila`

```json
{
  "cliente_id": "uuid",
  "medico_id": "uuid (opcional)",
  "atendimento_id": "uuid (opcional)",
  "status": "aguardando (opcional)"
}
```

#### adicionar-fila

`POST /llm-agent-api/adicionar-fila`

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `nome_completo` | string | ✅ |
| `data_nascimento` | YYYY-MM-DD | ✅ |
| `convenio` | string | ✅ |
| `celular` | string | ✅ |
| `medico_id` | UUID | ✅ |
| `atendimento_id` | UUID | ✅ |
| `prioridade` | int | ❌ |
| `data_preferida` | YYYY-MM-DD | ❌ |
| `periodo_preferido` | string | ❌ |
| `observacoes` | string | ❌ |

#### responder-fila

`POST /llm-agent-api/responder-fila`

```json
{
  "cliente_id": "uuid",
  "fila_id": "uuid",
  "resposta": "aceitar | rejeitar | cancelar"
}
```

---

### 4.13 chat — Conversacional

`POST /llm-agent-api/chat`

**Body:**

| Campo | Tipo | Obrig. |
|---|---|---|
| `cliente_id` | UUID | ✅ |
| `mensagem_usuario` | string | ✅ |
| `historico` | object[] | ❌ |

Extrai intenção via LLM, aplica regras de negócio, despacha automaticamente pro handler correto (schedule, availability, cancel, etc.). **Use este endpoint quando quiser delegar tudo à IA**. Use endpoints específicos quando o consumidor já sabe a intenção.

---

### 4.14 Admin

#### validate-config

`POST /llm-agent-api/validar-config` — retorna relatório estruturado da config.

#### invalidate-config

`POST /llm-agent-api/invalidate-config` — invalida cache de config. **Requer modo `tenant_key`** (rejeita legacy_global com `403 TENANT_KEY_REQUIRED`).

---

## 5. Idempotência

| Endpoint | Como funciona |
|---|---|
| `schedule` | Chave automática `<cliente_id>:<celular>:<medico_id>:<data>:<hora>`. Reenvio retorna o agendamento original. |
| `confirm` | UPDATE com `WHERE status = 'agendado'` (filtro). Confirmar 2x é seguro. |
| `cancel` | Não tem dedup nativa — confirme antes de chamar. Re-cancelar emite erro suave. |
| Demais | Não aplicável (read-only ou criação única). |

**Regra prática:** trate todo erro técnico (`status >= 500`, timeout, erro de rede) com **retry exponencial**. Erro de negócio (`success: false` com `codigo_erro`) **não retorne** — leia `mensagem_usuario` e mostre ao paciente.

---

## 6. Rate limit & Quotas

- **Default**: 60 req/min com burst 20 por `cliente_id`.
- **Resposta 429**: header `Retry-After: <segundos>` + body com `codigo_erro: RATE_LIMITED` e `retry_after_ms`.
- **Override**: env vars `RATE_LIMIT_PER_MIN` e `RATE_LIMIT_BURST`.
- **Camadas**: token bucket em memória (fast path) + RPC Postgres (`increment_rate_limit`) para coordenação multi-instance.

**Estratégia recomendada no consumidor:**
1. Receber 429 → ler `Retry-After`.
2. Sleep `Retry-After + jitter`.
3. Retentar até 3 vezes.
4. Se persistir, escalar pra log e/ou humano.

---

## 7. Tratamento de erros

### Erros técnicos (HTTP status)

| Status | Código | Causa |
|---|---|---|
| 400 | `BODY_INVALIDO` | JSON malformado ou tipo inválido |
| 400 | (schema-specific) | Campos obrigatórios faltando, valores fora do esperado |
| 401 | — | Header `x-api-key` ausente/inválida/revogada |
| 403 | `TENANT_MISMATCH` | Key vinculada a tenant A, body.cliente_id = B |
| 403 | `TENANT_KEY_REQUIRED` | Endpoint admin chamado em modo legacy_global |
| 429 | `RATE_LIMITED` | Excedeu limite |
| 503 | `CONFIG_INDISPONIVEL` | `cliente_id` inválido ou config não carregada |

### Erros de negócio (status 200 + `success: false`)

Sempre tem `codigo_erro` + `mensagem_usuario` legível. Lista canônica:

```
AGENDAMENTO_FORA_DO_ESCOPO   ALOCACAO_FALHOU            CAMPO_OBRIGATORIO
CONVENIO_NAO_ACEITO          DADOS_INCOMPLETOS          DATA_BLOQUEADA
DATA_PASSADA                 DIA_NAO_ATENDIDO           DIA_NAO_PERMITIDO
DIA_PERIODO_NAO_PERMITIDO    ERRO_AGENDAMENTO           ERRO_BUSCA_MEDICOS
ERRO_SISTEMA                 ESCOPO_SEM_MEDICOS         FORMATO_DATA_INVALIDO
HORARIO_OCUPADO              HORARIO_PASSADO            IDADE_INCOMPATIVEL
LIMITE_ATINGIDO              LIMITE_VAGAS_ATINGIDO      MEDICO_FORA_DO_ESCOPO
MEDICO_NAO_ENCONTRADO        NENHUM_MEDICO_ATIVO        PERIODO_LOTADO
PERIODO_NAO_PERMITIDO        REGRAS_NAO_CONFIGURADAS    SEM_VAGAS_DISPONIVEIS
SERVICO_FORA_DO_ESCOPO       SERVICO_NAO_DISPONIVEL_ONLINE
SERVICO_NAO_ENCONTRADO       SERVICO_SEM_AGENDAMENTO    SLOT_ESGOTADO
SUBLIMITE_CONVENIO_ATINGIDO
```

### Estratégia geral

```
if (response.status >= 500 || timeout || erro_rede)
   → retry com backoff exponencial (até 3x)

else if (response.status == 429)
   → respeitar Retry-After, retry depois

else if (response.status == 401 || 403)
   → erro de credencial; NÃO retentar; logar e alertar admin

else if (response.success === true)
   → seguir fluxo de sucesso

else (response.success === false, status 200)
   → MOSTRAR response.mensagem_usuario AO PACIENTE
   → não retentar (é erro de regra, retry só piora)
```

---

## 8. Multi-tenant

### Garantias

- Cada `cliente_id` tem isolamento completo de dados.
- Key vinculada a um tenant via `api_keys.cliente_id`.
- Endpoint rejeita se `body.cliente_id` divergir da key.
- Todas as queries internas filtram por `cliente_id` (sem exceção).

### Para múltiplas clínicas

Crie **uma key por tenant** e **um credential n8n por tenant**. Não compartilhe keys entre clínicas, mesmo que os fluxos sejam idênticos.

### `allowed_doctor_ids` e `allowed_services`

Campos opcionais que **reduzem ainda mais o escopo** dentro de um tenant. Útil quando o mesmo `cliente_id` tem um canal WhatsApp dedicado a um único médico (ex.: IPADO + linha do Dr. Marcelo): você envia `allowed_doctor_ids: ['<uuid_marcelo>']` em cada request e a API responde como se Dr. Marcelo fosse o único médico cadastrado.

---

## 9. Padrão pra n8n

### Credential

1. Settings → Credentials → "New" → **HTTP Header Auth**.
2. Nome: `llm-agent-api - <CLÍNICA>` (1 por tenant).
3. Header name: `x-api-key`.
4. Header value: chave plaintext do tenant.
5. Salvar. Anotar credential ID gerado.

### Template de sub-workflow tool (escrita)

Padrão recomendado pra encapsular cada endpoint num sub-workflow reutilizável. 4 nós em sequência:

```
[executeWorkflowTrigger]
   ↓ recebe inputs da assinatura "antiga" (compat. com AI Agent)
[Code: validarEMontarPayload]
   ↓ valida UUIDs/datas/horas, throw se inválido
   ↓ retorna { payload: {...} } pronto pra POST
[HttpRequest 4.4]
   ↓ POST {URL}/llm-agent-api/<rota>
   ↓ Auth: predefinedCredentialType + httpHeaderAuth
   ↓ Body: ={{ JSON.stringify($json.payload) }}
   ↓ Options:
   ↓   timeout: 30000
   ↓   response.neverError: true
   ↓   response.responseFormat: json
[Code: formatarResposta]
   ↓ converte response em { ok, resultado } pra AI Agent
```

#### Pq `neverError: true`?

Endpoint sempre devolve **status 200** em erros de negócio. Mas se a Edge Function cair (5xx), `neverError` evita que o sub-workflow falhe e quebre o AI Agent — a IA recebe `{ ok: false }` e reage adequadamente.

#### Tratamento na IA (AI Agent / LangChain)

A IA recebe `{ ok, resultado }`. Quando `ok: false`, deve ler `resultado.mensagem_usuario` e devolver pro paciente em vez de inventar resposta. Adicione no `systemMessage`:

```
=== Como tratar erros de tools ===
Se uma tool retornar { ok: false }, leia o campo resultado.mensagem_usuario
e devolva exatamente essa mensagem ao paciente. NÃO invente solução,
NÃO peça pra repetir, NÃO ofereça contornos.
```

### Template snippet — Code "validarEMontarPayload"

```javascript
// Valida e prepara payload pra POST /agendar (adapte pra outros endpoints).
const input = $json || {};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const norm = (v) => v == null ? null : String(v).trim() || null;
const reqUuid = (v, name) => {
  const s = norm(v);
  if (!s || !UUID_RE.test(s)) throw new Error(`${name} inválido: "${v ?? ''}"`);
  return s;
};

const payload = {
  cliente_id:      reqUuid(input.cliente_id, 'cliente_id'),
  paciente_nome:   norm(input.nome_completo),
  data_nascimento: (() => {
    const d = norm(input.data_nascimento);
    if (!d || !DATE_RE.test(d)) throw new Error(`data_nascimento inválida: "${input.data_nascimento}"`);
    return d;
  })(),
  convenio:        norm(input.convenio),
  celular:         norm(input.celular)?.replace(/\D/g, ''),
  medico_id:       reqUuid(input.medico_id, 'medico_id'),
  atendimento_id:  reqUuid(input.atendimento_id, 'atendimento_id'),
  data_consulta:   norm(input.data_agendamento),
  hora_consulta:   norm(input.hora_agendamento),
};

return [{ json: { payload } }];
```

### Template snippet — Code "formatarResposta"

```javascript
const resp = $input.first()?.json || null;
if (!resp) {
  return [{ json: { ok: false, mensagem: 'HTTP sem resposta.', resultado: null } }];
}
const ok = resp.success === true;
return [{ json: { ok, resultado: resp } }];
```

---

## 10. Smoke test e troubleshooting

### Teste rápido (curl)

```bash
# Listar médicos da Pro Oftalmo
curl -X POST https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/lista-medicos \
  -H "x-api-key: <KEY_PLAINTEXT>" \
  -H "Content-Type: application/json" \
  -d '{ "cliente_id": "0b6a0a35-0059-4a0c-9fb8-413b6253c2ad" }'
```

Esperado: `{ "success": true, "data": { "medicos": [...] } }`.

### Health check

```bash
curl https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/health
# {"status":"ok","version":"3.2.0","timestamp":"..."}
```

### Verificar uso da key

```sql
SELECT label, ativo, last_used_at, revoked_at
FROM public.api_keys
WHERE cliente_id = '<UUID>'
ORDER BY created_at DESC;
```

`last_used_at` mostra quando a key foi vista pela última vez. Se nada chega ao endpoint, esse campo não atualiza.

### Auditoria de chamadas externas (n8n → API)

Quando o caller é o agenda-clinic-sync, há log em `public.agendamentos_log`:

```sql
SELECT created_at, acao, status, duracao_ms, payload_request, payload_response, erro_detalhe
FROM agendamentos_log
WHERE cliente_id = '<UUID>'
ORDER BY created_at DESC
LIMIT 20;
```

### Problemas comuns

| Sintoma | Causa provável | Como resolver |
|---|---|---|
| 401 Unauthorized | Key ausente, inválida ou revogada | Verificar header, regenerar key |
| 403 TENANT_MISMATCH | Key de A enviando `cliente_id` de B | Ajustar credential ou body |
| 429 RATE_LIMITED | Burst de mensagens | Implementar backoff; revisar fluxo |
| 503 CONFIG_INDISPONIVEL | `cliente_id` inválido ou sem config | Conferir tabela `llm_clinic_config`/`configuracoes_clinica` |
| `success:false, codigo_erro:CONVENIO_NAO_ACEITO` | Convênio não está em `medicos.convenios_aceitos` | Mostrar `mensagem_usuario` ao paciente — comportamento esperado |
| Timeout | Endpoint lento (>30s) | Não retentar imediatamente; checar logs Supabase |

---

## 11. Versionamento

- Campo `version` no health endpoint reflete `API_VERSION` em `_lib/responses.ts`.
- Versão atual: `3.2.0`.
- **Não há quebra de contrato sem aviso prévio.** Mudanças de schema adicionam aliases, não removem.
- Deprecations são logadas via `console.warn` no servidor (visível em Supabase Logs).

---

## 12. Anexos

### A. SQL — criar key

```bash
# 1) Gerar plaintext e hash
RAW=$(openssl rand -hex 32)
HASH=$(printf "%s" "$RAW" | openssl dgst -sha256 -hex | awk '{print $2}')
echo "RAW (entregar ao consumidor): $RAW"
echo "HASH (vai pro DB): $HASH"
```

```sql
-- 2) INSERT no DB
INSERT INTO public.api_keys (cliente_id, key_hash, label, ativo)
VALUES (
  '<CLIENTE_UUID>',
  '<HASH_GERADO_NO_BASH>',
  '<consumidor>-<contexto>-<YYYY-MM-DD>',
  true
)
RETURNING id, label, created_at;
```

### B. SQL — auditar keys

```sql
SELECT
  ak.cliente_id,
  c.nome AS cliente_nome,
  ak.label,
  ak.ativo,
  ak.revoked_at IS NULL AS valida,
  ak.last_used_at,
  ak.created_at
FROM public.api_keys ak
LEFT JOIN public.clientes c ON c.id = ak.cliente_id
ORDER BY c.nome, ak.created_at DESC;
```

### C. SQL — revogar key

```sql
UPDATE public.api_keys
SET ativo = false, revoked_at = now()
WHERE id = '<UUID_DA_KEY>';
```

### D. cURL — exemplos por endpoint

```bash
# Agendar
curl -X POST $URL/agendar -H "x-api-key: $KEY" -H "Content-Type: application/json" -d '{
  "cliente_id": "...",
  "paciente_nome": "JOAO SILVA",
  "data_nascimento": "1990-01-15",
  "convenio": "PARTICULAR",
  "celular": "87999000000",
  "medico_id": "...",
  "atendimento_id": "...",
  "data_consulta": "2026-05-20",
  "hora_consulta": "09:00"
}'

# Disponibilidade
curl -X POST $URL/disponibilidade -H "x-api-key: $KEY" -H "Content-Type: application/json" -d '{
  "cliente_id": "...",
  "medico_id": "..."
}'

# Cancelar
curl -X POST $URL/cancelar -H "x-api-key: $KEY" -H "Content-Type: application/json" -d '{
  "cliente_id": "...",
  "agendamento_id": "...",
  "motivo": "Paciente solicitou via WhatsApp"
}'

# Confirmar
curl -X POST $URL/confirmar -H "x-api-key: $KEY" -H "Content-Type: application/json" -d '{
  "cliente_id": "...",
  "agendamento_id": "..."
}'
```

### E. Onboarding checklist (nova clínica)

1. [ ] Criar row em `public.clientes` (nome, telefone, whatsapp).
2. [ ] Cadastrar médicos em `public.medicos` com `cliente_id`, especialidade, convenios_aceitos.
3. [ ] Cadastrar atendimentos em `public.atendimentos`.
4. [ ] Cadastrar `convenios_medico` (1 row por par médico × convênio).
5. [ ] Cadastrar `business_rules` por médico (limites diários, períodos, dias_especificos).
6. [ ] Cadastrar `llm_clinic_config` ou `configuracoes_clinica` (config principal).
7. [ ] Gerar `api_key` (passos A acima) e entregar plaintext ao consumidor.
8. [ ] Smoke test: cURL de `lista-medicos`, `disponibilidade`, `agendar` (paciente fictício).
9. [ ] Configurar canal WhatsApp (Evolution/Meta) e mapear `evolution_instance_id` no router do consumidor.
10. [ ] Habilitar tráfego real após smoke test passar.

### F. Glossário

- **Tenant** = clínica (UUID em `clientes.id`).
- **Config dinâmica** = row em `llm_clinic_config` que define data mínima de agendamento, dias de busca, mensagens padrão. Buscada via RPC `get_dynamic_config`.
- **Scope** = filtro adicional aplicado a chamadas (subset de médicos/serviços visíveis pelo canal).
- **Erro de negócio** = validação clínica retornada como `success: false` (status 200).
- **Erro técnico** = falha inesperada (status 5xx) ou rate limit / auth (4xx).
- **Idempotency key** = hash que identifica unicamente uma intenção, usado pra evitar duplicatas em retries.

---

## Histórico de revisões

| Data | Versão | Alteração |
|---|---|---|
| 2026-05-12 | 1.0 | Documento inicial. Referência completa dos 14 endpoints. |
