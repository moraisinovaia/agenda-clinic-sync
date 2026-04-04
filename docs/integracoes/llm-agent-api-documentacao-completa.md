# LLM Agent API - Documentação para N8N (HTTP Request)

**Versão:** 3.2.0  
**Base URL:** `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api`

---

## 🔐 Autenticação

Todas as requisições exigem o header:

```
x-api-key: <valor do segredo N8N_API_KEY>
```

---

## 📌 Formato Geral

- **Método:** `POST`
- **Content-Type:** `application/json`
- **URL:** `{BASE_URL}/{action}`
- **Body:** JSON com `cliente_id` obrigatório (identifica a clínica)

### IDs dos Clientes

| Clínica | cliente_id |
|---------|-----------|
| IPADO | `2bfb98b5-ae41-4f96-8ba7-acc797c22054` |
| ENDOGASTRO | `39e120b4-5fb7-4d6f-9f91-a598a5bbd253` |
| Clínica Vênus | `20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a` |
| HOP (Clínica Olhos) | `d7d7b7cf-4ec0-437b-8377-d7555fc5ee6a` |
| Clínica Orion | `e8f7d6c5-b4a3-4c2d-9e1f-0a1b2c3d4e5f` |

> **Nota:** Clínica Orion também requer `config_id: "223a7ffd-337b-4379-95b6-85bed89e47d0"`

---

## 📋 Endpoints Disponíveis

### 1. `check-patient` — Verificar/Buscar Paciente

**URL:** `POST {BASE_URL}/check-patient`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "paciente_nome": "João Silva",
  "data_nascimento": "1990-05-15",
  "celular": "87999998888"
}
```

> Informe pelo menos um dos campos: `paciente_nome`, `data_nascimento` ou `celular`.  
> Busca fuzzy por nome. Celulares mascarados (com `*`) são ignorados automaticamente.

**Resposta (paciente encontrado):**
```json
{
  "success": true,
  "paciente_encontrado": true,
  "paciente": {
    "id": "uuid",
    "nome_completo": "João da Silva",
    "data_nascimento": "1990-05-15",
    "celular": "87999998888",
    "convenio": "PARTICULAR"
  },
  "agendamentos_recentes": [...]
}
```

---

### 2. `availability` — Consultar Disponibilidade

**URL:** `POST {BASE_URL}/availability`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "medico_nome": "Dr. Marcelo",
  "atendimento_nome": "Consulta Cardiológica",
  "data_consulta": "2026-04-10",
  "dias_busca": 14,
  "buscar_proximas": false,
  "quantidade_dias": 7,
  "mensagem_original": "quero agendar pela manhã"
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `medico_nome` ou `medico_id` | Sim (um dos dois) | Nome (fuzzy match) ou UUID do médico |
| `atendimento_nome` | Não | Tipo de atendimento (ex: "Consulta", "Teste Ergométrico") |
| `data_consulta` | Não | Data inicial da busca (YYYY-MM-DD). Se omitido, busca a partir de hoje |
| `dias_busca` | Não | Quantos dias buscar (padrão: 14) |
| `buscar_proximas` | Não | Se `true`, busca os próximos dias disponíveis |
| `quantidade_dias` | Não | Quantos dias retornar (padrão: 7) |
| `mensagem_original` | Não | Mensagem do paciente — extrai período (manhã/tarde) automaticamente |

**Resposta:**
```json
{
  "success": true,
  "medico": "Dr. Marcelo D'Carli",
  "disponibilidade": [
    {
      "data": "2026-04-10",
      "dia_semana": "quinta-feira",
      "periodos": [
        {
          "periodo": "manha",
          "tipo_agenda": "ordem_chegada",
          "vagas_total": 9,
          "vagas_ocupadas": 3,
          "vagas_disponiveis": 6,
          "horario_inicio": "07:00",
          "horario_fim": "12:00"
        }
      ]
    }
  ],
  "mensagem_formatada": "..."
}
```

---

### 3. `schedule` — Agendar Consulta

**URL:** `POST {BASE_URL}/schedule`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "paciente_nome": "João da Silva",
  "data_nascimento": "1990-05-15",
  "convenio": "PARTICULAR",
  "celular": "87999998888",
  "telefone": "8730241274",
  "medico_nome": "Dr. Marcelo",
  "atendimento_nome": "Consulta Cardiológica",
  "data_agendamento": "2026-04-10",
  "hora_agendamento": "07:00",
  "periodo": "manha",
  "observacoes": "Primeira consulta"
}
```

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `paciente_nome` | Sim | Nome completo do paciente |
| `data_nascimento` | Sim | YYYY-MM-DD |
| `convenio` | Sim | Nome do convênio |
| `celular` | Sim | Celular com DDD |
| `telefone` | Não | Telefone fixo |
| `medico_nome` ou `medico_id` | Sim | Nome (fuzzy) ou UUID |
| `atendimento_nome` | Não | Tipo de atendimento |
| `data_agendamento` | Sim | Data (YYYY-MM-DD) |
| `hora_agendamento` | Sim* | Horário (HH:MM). *Para ordem de chegada, pode ser o horário de início do turno |
| `periodo` | Não | "manha" ou "tarde" (para ordem de chegada) |
| `observacoes` | Não | Observações livres |

> Aceita tanto `snake_case` quanto `camelCase` nos campos.

**Resposta:**
```json
{
  "success": true,
  "agendamento_id": "uuid",
  "mensagem": "Agendamento realizado com sucesso!",
  "detalhes": {
    "paciente": "João da Silva",
    "medico": "Dr. Marcelo D'Carli",
    "data": "2026-04-10",
    "hora": "07:00",
    "atendimento": "Consulta Cardiológica"
  }
}
```

---

### 4. `reschedule` — Remarcar Consulta

**URL:** `POST {BASE_URL}/reschedule`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "agendamento_id": "uuid-do-agendamento",
  "nova_data": "2026-04-15",
  "nova_hora": "13:00",
  "observacoes": "Paciente solicitou remarcação"
}
```

| Campo | Obrigatório |
|-------|-------------|
| `agendamento_id` | Sim |
| `nova_data` | Sim |
| `nova_hora` | Sim |
| `observacoes` | Não |

---

### 5. `cancel` — Cancelar Consulta

**URL:** `POST {BASE_URL}/cancel`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "agendamento_id": "uuid-do-agendamento",
  "motivo": "Paciente desistiu"
}
```

| Campo | Obrigatório |
|-------|-------------|
| `agendamento_id` | Sim |
| `motivo` | Não |

---

### 6. `confirm` — Confirmar Consulta

**URL:** `POST {BASE_URL}/confirm`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "agendamento_id": "uuid-do-agendamento",
  "observacoes": "Confirmado via WhatsApp"
}
```

| Campo | Obrigatório |
|-------|-------------|
| `agendamento_id` | Sim |
| `observacoes` | Não |

---

### 7. `list-doctors` — Listar Médicos

**URL:** `POST {BASE_URL}/list-doctors`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-..."
}
```

**Resposta:** Lista de médicos ativos com nome, especialidade, CRM e convênios aceitos.

---

### 8. `clinic-info` — Informações da Clínica

**URL:** `POST {BASE_URL}/clinic-info`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-..."
}
```

**Resposta:** Nome, endereço, telefone, WhatsApp e configurações da clínica.

---

### 9. `doctor-schedules` (ou `horarios-medicos`) — Horários do Médico

**URL:** `POST {BASE_URL}/doctor-schedules`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "medico_nome": "Dr. Marcelo",
  "medico_id": "uuid"
}
```

**Resposta:** Horários configurados por dia da semana e período.

---

### 10. `list-appointments` — Listar Agendamentos

**URL:** `POST {BASE_URL}/list-appointments`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "data": "2026-04-10",
  "medico_id": "uuid",
  "status": "agendado"
}
```

---

### 11. `patient-search` — Busca Avançada de Pacientes

**URL:** `POST {BASE_URL}/patient-search`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "termo": "João",
  "tipo": "nome"
}
```

| Campo | Descrição |
|-------|-----------|
| `termo` | Texto de busca |
| `tipo` | `"nome"`, `"telefone"` ou `"nascimento"` |

---

### 12. `consultar-fila` — Consultar Fila de Espera

**URL:** `POST {BASE_URL}/consultar-fila`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "medico_id": "uuid",
  "atendimento_id": "uuid",
  "status": "aguardando"
}
```

---

### 13. `adicionar-fila` — Adicionar à Fila de Espera

**URL:** `POST {BASE_URL}/adicionar-fila`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "paciente_nome": "João Silva",
  "data_nascimento": "1990-05-15",
  "celular": "87999998888",
  "convenio": "PARTICULAR",
  "medico_nome": "Dr. Marcelo",
  "atendimento_nome": "Consulta Cardiológica",
  "data_preferida": "2026-04-10",
  "periodo_preferido": "manha",
  "observacoes": "Urgente"
}
```

---

### 14. `responder-fila` — Responder Oferta da Fila

**URL:** `POST {BASE_URL}/responder-fila`

**Body:**
```json
{
  "cliente_id": "2bfb98b5-...",
  "fila_id": "uuid-da-fila",
  "resposta": "ACEITAR",
  "data_agendamento": "2026-04-10",
  "hora_agendamento": "07:00"
}
```

| Campo | Descrição |
|-------|-----------|
| `resposta` | `"ACEITAR"` ou `"RECUSAR"` |

---

## 🔄 Aliases (Nomes em Português)

A API aceita os seguintes aliases nas URLs:

| Alias (PT) | Endpoint Real |
|-------------|---------------|
| `/verificar-paciente` | `/check-patient` |
| `/disponibilidade` | `/availability` |
| `/agendar` | `/schedule` |
| `/remarcar` | `/reschedule` |
| `/cancelar` | `/cancel` |
| `/confirmar` | `/confirm` |
| `/lista-medicos` | `/list-doctors` |
| `/info-clinica` | `/clinic-info` |

---

## 🏥 Proxies por Clínica

Para clínicas com proxy dedicado, a URL muda e o `cliente_id` é injetado automaticamente:

| Clínica | Base URL |
|---------|----------|
| Vênus | `.../v1/llm-agent-api-venus/{action}` |
| Orion | `.../v1/llm-agent-api-orion/{action}` |
| HOP (Olhos) | `.../v1/llm-agent-api-olhos/{action}` |
| Dr. Marcelo | `.../v1/llm-agent-api-marcelo/{action}` |

> Nos proxies, **não é necessário** enviar `cliente_id` no body (é injetado automaticamente).

---

## ⚙️ Configuração no N8N (HTTP Request)

### Node HTTP Request

1. **Method:** POST
2. **URL:** `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/{action}`
3. **Authentication:** None (usar header customizado)
4. **Headers:**
   - `x-api-key`: `{{$credentials.n8nApiKey}}` (ou valor direto)
   - `Content-Type`: `application/json`
5. **Body:** JSON com os campos documentados acima

### Exemplo Completo (Verificar Paciente)

```
Method: POST
URL: https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/check-patient
Headers:
  x-api-key: SUA_API_KEY
  Content-Type: application/json
Body:
{
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054",
  "paciente_nome": "João Silva",
  "data_nascimento": "1990-05-15"
}
```

---

## ❌ Respostas de Erro

Todas as respostas de erro seguem o formato:

```json
{
  "success": false,
  "error": "CODIGO_ERRO",
  "message": "Descrição legível do erro",
  "codigo_erro": "ERRO_ESPECIFICO"
}
```

| Código HTTP | Significado |
|-------------|-------------|
| 401 | API Key inválida ou ausente |
| 400 | `cliente_id` ou `config_id` não fornecido |
| 200 + `success: false` | Erro de negócio (paciente não encontrado, sem vagas, etc.) |
