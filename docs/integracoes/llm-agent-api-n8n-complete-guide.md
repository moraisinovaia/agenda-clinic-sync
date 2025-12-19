# LLM Agent API - Guia Completo para N8N HTTP Request

> **Versão:** 3.1.0  
> **Última atualização:** Dezembro 2024  
> **Base URL:** `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api`

---

## 📋 Índice

1. [Informações Gerais](#informações-gerais)
2. [Agendar Consulta](#1-agendar-consulta)
3. [Verificar Paciente](#2-verificar-paciente)
4. [Consultar Disponibilidade](#3-consultar-disponibilidade)
5. [Remarcar Consulta](#4-remarcar-consulta)
6. [Cancelar Consulta](#5-cancelar-consulta)
7. [Confirmar Consulta](#6-confirmar-consulta)
8. [Listar Médicos](#7-listar-médicos)
9. [Listar Agendamentos](#8-listar-agendamentos)
10. [Pesquisar Pacientes](#9-pesquisar-pacientes)
11. [Informações da Clínica](#10-informações-da-clínica)
12. [Códigos de Erro](#códigos-de-erro)
13. [Exemplos N8N](#exemplos-n8n)

---

## Informações Gerais

### 🔗 URLs Disponíveis

A API aceita tanto endpoints em **Português** quanto em **Inglês**:

| Ação | Português | Inglês |
|------|-----------|--------|
| Agendar | `/agendar` | `/schedule` |
| Verificar Paciente | `/verificar-paciente` | `/check-patient` |
| Disponibilidade | `/disponibilidade` | `/availability` |
| Remarcar | `/remarcar` | `/reschedule` |
| Cancelar | `/cancelar` | `/cancel` |
| Confirmar | `/confirmar` | `/confirm` |
| Listar Médicos | `/lista-medicos` | `/list-doctors` |
| Listar Agendamentos | `/lista-consultas` | `/list-appointments` |
| Pesquisar Pacientes | `/pesquisa-pacientes` | `/patient-search` |
| Info Clínica | `/info-clinica` | `/clinic-info` |

### 📡 Headers Obrigatórios

```
Content-Type: application/json
```

> **Nota:** Não é necessário `Authorization` - a API usa `verify_jwt = false`.

### 🏥 Multi-Cliente

A API suporta múltiplos clientes. Use o campo `cliente_id` no body para especificar:

| Cliente | ID |
|---------|-----|
| IPADO (padrão) | `2bfb98b5-ae41-4f96-8ba7-acc797c22054` |
| Clínica Vênus | `20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a` |
| ENDOGASTRO | `39e120b4-5fb7-4d6f-9f91-a598a5bbd253` |

---

## 1. Agendar Consulta

### Endpoint
```
POST /agendar
POST /schedule
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/agendar
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/agendar` |
| **Headers** | `Content-Type: application/json` |
| **Body Type** | JSON |

### Body (JSON)

```json
{
  "paciente_nome": "João da Silva",
  "data_nascimento": "1985-03-15",
  "convenio": "UNIMED",
  "celular": "87999998888",
  "telefone": "8738664050",
  "medico_nome": "Dr. Marcelo D'Carli",
  "medico_id": "1e110923-50df-46ff-a57a-29d88e372900",
  "atendimento_nome": "Consulta Cardiológica",
  "data_consulta": "2026-01-20",
  "hora_consulta": "08:00",
  "observacoes": "Paciente via WhatsApp",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `paciente_nome` | string | Nome completo do paciente |
| `data_nascimento` | string | Data no formato `YYYY-MM-DD` |
| `convenio` | string | Ex: `UNIMED`, `PARTICULAR`, `UNIMED 40%` |
| `celular` | string | Número com DDD (apenas dígitos ou formatado) |
| `medico_nome` ou `medico_id` | string | Nome parcial ou UUID do médico |
| `data_consulta` | string | Data no formato `YYYY-MM-DD` |
| `hora_consulta` | string | Horário `HH:MM` ou período (`manhã`, `tarde`) |

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `telefone` | string | Telefone fixo |
| `atendimento_nome` | string | Tipo de atendimento (Consulta, Retorno, Exame) |
| `observacoes` | string | Observações adicionais |
| `cliente_id` | string | UUID do cliente (multi-tenant) |

### Resposta de Sucesso

```json
{
  "success": true,
  "timestamp": "2024-12-19T10:30:00.000Z",
  "message": "Consulta agendada com sucesso",
  "agendamento_id": "uuid-do-agendamento",
  "paciente": "João da Silva",
  "medico": "Dr. Marcelo D'Carli",
  "data": "2026-01-20",
  "hora": "08:00:00",
  "tipo_agendamento": "ordem_chegada",
  "mensagem_whatsapp": "✅ Agendamento confirmado!\n\n📅 20/01/2026 às 08:00..."
}
```

### Possíveis Erros

| Código | Descrição |
|--------|-----------|
| `DADOS_INCOMPLETOS` | Campos obrigatórios faltando |
| `MEDICO_NAO_ENCONTRADO` | Médico não existe ou está inativo |
| `SERVICO_NAO_ENCONTRADO` | Atendimento não disponível para o médico |
| `SERVICO_NAO_DISPONIVEL_ONLINE` | Serviço não permite agendamento online |
| `IDADE_INCOMPATIVEL` | Paciente não atende idade mínima |
| `DIA_NAO_PERMITIDO` | Médico não atende neste dia |
| `LIMITE_VAGAS_ATINGIDO` | Sem vagas disponíveis |
| `DATA_BLOQUEADA` | Data anterior à mínima permitida |
| `HORARIO_OCUPADO` | Conflito de horário |

### Expressão N8N

```javascript
// Body dinâmico
{
  "paciente_nome": "{{ $json.nome }}",
  "data_nascimento": "{{ $json.nascimento }}",
  "convenio": "{{ $json.convenio }}",
  "celular": "{{ $json.telefone }}",
  "medico_nome": "{{ $json.medico }}",
  "data_consulta": "{{ $json.data }}",
  "hora_consulta": "{{ $json.hora }}",
  "atendimento_nome": "{{ $json.servico }}"
}
```

---

## 2. Verificar Paciente

### Endpoint
```
POST /verificar-paciente
POST /check-patient
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/verificar-paciente
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/verificar-paciente` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "paciente_nome": "Maria Santos",
  "data_nascimento": "1990-05-20",
  "celular": "87999997777",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos (pelo menos 1 obrigatório)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `paciente_nome` | string | Nome completo ou parcial |
| `data_nascimento` | string | Data `YYYY-MM-DD` |
| `celular` | string | Número do celular |

### Resposta de Sucesso

```json
{
  "success": true,
  "timestamp": "2024-12-19T10:30:00.000Z",
  "encontrado": true,
  "message": "1 consulta(s) encontrada(s):\n\n1. Consulta Cardiológica com Dr. Marcelo...",
  "consultas": [
    {
      "id": "uuid-agendamento",
      "paciente_nome": "Maria Santos",
      "medico_id": "uuid-medico",
      "medico_nome": "Dr. Marcelo D'Carli",
      "especialidade": "Cardiologia",
      "atendimento_nome": "Consulta Cardiológica",
      "data_agendamento": "2026-01-20",
      "hora_agendamento": "08:00:00",
      "status": "agendado",
      "convenio": "UNIMED",
      "mensagem": "📅 Consulta Cardiológica com Dr. Marcelo..."
    }
  ],
  "total": 1
}
```

### Resposta - Paciente Sem Consultas Futuras

```json
{
  "success": true,
  "encontrado": true,
  "paciente_cadastrado": true,
  "consultas": [],
  "message": "Paciente Maria Santos está cadastrado(a) no sistema, mas não possui consultas futuras agendadas",
  "observacao": "Paciente pode agendar nova consulta",
  "total": 0
}
```

### Resposta - Paciente Não Encontrado

```json
{
  "success": true,
  "encontrado": false,
  "consultas": [],
  "message": "Não encontrei agendamentos no sistema novo. Se sua consulta é anterior a janeiro/2026...",
  "observacao": "Sistema em migração",
  "total": 0
}
```

---

## 3. Consultar Disponibilidade

### Endpoint
```
POST /disponibilidade
POST /availability
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/disponibilidade
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/disponibilidade` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "medico_nome": "Dra. Adriana",
  "medico_id": "32d30887-b876-4502-bf04-e55d7fb55b50",
  "atendimento_nome": "Consulta Endocrinológica",
  "data_consulta": "2026-01-20",
  "dias_busca": 14,
  "buscar_proximas": true,
  "quantidade_dias": 7,
  "mensagem_original": "quero agendar para manhã",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `medico_nome` | string | Sim* | Nome parcial do médico |
| `medico_id` | string | Sim* | UUID do médico |
| `atendimento_nome` | string | Não | Tipo de atendimento |
| `data_consulta` | string | Não | Data inicial (default: hoje) |
| `dias_busca` | number | Não | Dias para buscar (default: 14) |
| `buscar_proximas` | boolean | Não | Buscar próximas datas se não houver vaga |
| `quantidade_dias` | number | Não | Quantidade de dias a retornar |
| `mensagem_original` | string | Não | Para detectar período (manhã/tarde) |

> *`medico_nome` OU `medico_id` é obrigatório

### Resposta - Ordem de Chegada

```json
{
  "success": true,
  "disponivel": true,
  "tipo_agendamento": "ordem_chegada",
  "medico": "Dra. Adriana Carla de Sena",
  "servico": "Consulta Endocrinológica",
  "data": "2026-01-20",
  "periodos": [
    {
      "periodo": "Manhã",
      "horario_distribuicao": "08:00 às 10:00",
      "vagas_ocupadas": 3,
      "vagas_disponiveis": 6,
      "total_vagas": 9,
      "disponivel": true,
      "hora_inicio": "08:00",
      "hora_fim": "10:00"
    }
  ],
  "mensagem_whatsapp": "✅ Dra. Adriana Carla de Sena - Consulta Endocrinológica\n📅 2026-01-20\n\nManhã: 6 vaga(s) disponível(is)...",
  "message": "✅ Dra. Adriana Carla de Sena..."
}
```

### Resposta - Hora Marcada

```json
{
  "success": true,
  "disponivel": true,
  "tipo_agendamento": "hora_marcada",
  "medico": "Dr. João Silva",
  "servico": "Consulta",
  "data": "2026-01-20",
  "horarios_disponiveis": [
    { "hora": "08:00:00", "disponivel": true, "periodo": "manha" },
    { "hora": "08:30:00", "disponivel": true, "periodo": "manha" },
    { "hora": "09:00:00", "disponivel": true, "periodo": "manha" }
  ],
  "total": 3,
  "mensagem_whatsapp": "✅ Dr. João Silva - Consulta\n📅 2026-01-20\n\n3 horários disponíveis:\n• 08:00:00\n• 08:30:00...",
  "message": "✅ Dr. João Silva..."
}
```

### Resposta - Sem Disponibilidade

```json
{
  "success": true,
  "disponivel": false,
  "medico": "Dra. Adriana",
  "servico": "Consulta Endocrinológica",
  "data_solicitada": "2026-01-20",
  "proximas_datas": [
    { "data": "2026-01-21", "dia_semana": "Ter", "periodo": "Manhã", "vagas_disponiveis": 5 },
    { "data": "2026-01-22", "dia_semana": "Qua", "periodo": "Manhã", "vagas_disponiveis": 7 }
  ],
  "message": "❌ Sem vagas disponíveis para Dra. Adriana em 2026-01-20.\n\n✅ Próximas datas disponíveis..."
}
```

---

## 4. Remarcar Consulta

### Endpoint
```
POST /remarcar
POST /reschedule
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/remarcar
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/remarcar` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "agendamento_id": "uuid-do-agendamento",
  "nova_data": "2026-01-25",
  "nova_hora": "09:00",
  "observacoes": "Remarcado a pedido do paciente",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `agendamento_id` | string | ✅ Sim | UUID do agendamento |
| `nova_data` | string | ✅ Sim | Nova data `YYYY-MM-DD` |
| `nova_hora` | string | ✅ Sim | Novo horário `HH:MM` |
| `observacoes` | string | Não | Observações adicionais |

### Resposta de Sucesso

```json
{
  "success": true,
  "timestamp": "2024-12-19T10:30:00.000Z",
  "message": "Consulta remarcada com sucesso",
  "agendamento_id": "uuid-do-agendamento",
  "paciente": "Maria Santos",
  "medico": "Dra. Adriana Carla de Sena",
  "data_anterior": "2026-01-20",
  "hora_anterior": "08:00:00",
  "nova_data": "2026-01-25",
  "nova_hora": "09:00"
}
```

### Possíveis Erros

| Erro | Descrição |
|------|-----------|
| `Agendamento não encontrado` | UUID inválido ou de outro cliente |
| `Não é possível remarcar consulta cancelada` | Consulta já foi cancelada |
| `Horário já ocupado para este médico` | Conflito com outro agendamento |
| `DATA_BLOQUEADA` | Nova data anterior à mínima permitida |

---

## 5. Cancelar Consulta

### Endpoint
```
POST /cancelar
POST /cancel
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/cancelar
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/cancelar` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "agendamento_id": "uuid-do-agendamento",
  "motivo": "Paciente não pode comparecer",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `agendamento_id` | string | ✅ Sim | UUID do agendamento |
| `motivo` | string | Não | Motivo do cancelamento |

### Resposta de Sucesso

```json
{
  "success": true,
  "timestamp": "2024-12-19T10:30:00.000Z",
  "message": "Consulta cancelada com sucesso",
  "agendamento_id": "uuid-do-agendamento",
  "paciente": "Maria Santos",
  "medico": "Dra. Adriana Carla de Sena",
  "data": "2026-01-20",
  "hora": "08:00:00",
  "motivo": "Paciente não pode comparecer"
}
```

### Possíveis Erros

| Erro | Descrição |
|------|-----------|
| `Campo obrigatório: agendamento_id` | ID não informado |
| `Agendamento não encontrado` | UUID inválido |
| `Consulta já está cancelada` | Já foi cancelada anteriormente |

---

## 6. Confirmar Consulta

### Endpoint
```
POST /confirmar
POST /confirm
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/confirmar
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/confirmar` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "agendamento_id": "uuid-do-agendamento",
  "observacoes": "Confirmado via WhatsApp",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `agendamento_id` | string | ✅ Sim | UUID do agendamento |
| `observacoes` | string | Não | Observações adicionais |

### Resposta de Sucesso

```json
{
  "success": true,
  "timestamp": "2024-12-19T10:30:00.000Z",
  "message": "Consulta confirmada com sucesso",
  "agendamento_id": "uuid-do-agendamento",
  "paciente": "Maria Santos",
  "celular": "87999997777",
  "medico": "Dra. Adriana Carla de Sena",
  "data": "2026-01-20",
  "hora": "08:00:00",
  "status": "confirmado",
  "confirmado_em": "2024-12-19T10:30:00.000Z"
}
```

### Resposta - Já Confirmada

```json
{
  "success": true,
  "message": "Consulta já está confirmada",
  "agendamento_id": "uuid-do-agendamento",
  "already_confirmed": true
}
```

### Possíveis Erros

| Erro | Descrição |
|------|-----------|
| `Campo obrigatório: agendamento_id` | ID não informado |
| `Agendamento não encontrado` | UUID inválido |
| `Não é possível confirmar consulta cancelada` | Consulta cancelada |
| `Consulta já foi realizada` | Status = realizado |
| `Não é possível confirmar consulta que já passou` | Data/hora no passado |

---

## 7. Listar Médicos

### Endpoint
```
POST /lista-medicos
POST /list-doctors
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/lista-medicos
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/lista-medicos` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `cliente_id` | string | Não | UUID do cliente (default: IPADO) |

### Resposta de Sucesso

```json
{
  "success": true,
  "timestamp": "2024-12-19T10:30:00.000Z",
  "message": "3 médico(s) disponível(is)",
  "medicos": [
    {
      "id": "1e110923-50df-46ff-a57a-29d88e372900",
      "nome": "DR. MARCELO D'CARLI",
      "especialidade": "Cardiologia",
      "convenios_aceitos": ["UNIMED", "PARTICULAR"],
      "tipo_agendamento": "ordem_chegada",
      "servicos": ["Consulta Cardiológica", "Teste Ergométrico", "ECG"],
      "ativo": true
    },
    {
      "id": "32d30887-b876-4502-bf04-e55d7fb55b50",
      "nome": "DRA. ADRIANA CARLA DE SENA",
      "especialidade": "Endocrinologia",
      "convenios_aceitos": ["UNIMED", "PARTICULAR"],
      "tipo_agendamento": "ordem_chegada",
      "servicos": ["Consulta Endocrinológica"],
      "ativo": true
    }
  ],
  "total": 3,
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

---

## 8. Listar Agendamentos

### Endpoint
```
POST /lista-consultas
POST /list-appointments
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/lista-consultas
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/lista-consultas` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "medico_nome": "Dr. Marcelo",
  "data": "2026-01-20",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `medico_nome` | string | ✅ Sim | Nome do médico |
| `data` | string | ✅ Sim | Data `YYYY-MM-DD` |

### Resposta de Sucesso

```json
{
  "success": true,
  "encontrado": true,
  "agendamentos": [
    {
      "paciente_nome": "Maria Santos",
      "tipo_atendimento": "Consulta Cardiológica",
      "hora_agendamento": "08:00:00",
      "status": "agendado",
      "periodo": "manhã"
    }
  ],
  "total": 5,
  "resumo": {
    "total": 5,
    "manha": 3,
    "tarde": 2,
    "tipos": {
      "Consulta Cardiológica": 3,
      "Teste Ergométrico": 2
    }
  },
  "message": "Encontrei 5 agendamento(s) para o Dr. Marcelo em 20/01/2026..."
}
```

---

## 9. Pesquisar Pacientes

### Endpoint
```
POST /pesquisa-pacientes
POST /patient-search
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/pesquisa-pacientes
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/pesquisa-pacientes` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "busca": "Maria Santos",
  "tipo": "nome",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Campos

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `busca` | string | ✅ Sim | Termo de busca |
| `tipo` | string | Não | `nome`, `telefone`, `nascimento` (auto-detecta se não informado) |

### Resposta de Sucesso

```json
{
  "success": true,
  "message": "3 paciente(s) encontrado(s)",
  "pacientes": [
    {
      "id": "uuid-paciente",
      "nome_completo": "Maria Santos",
      "data_nascimento": "1990-05-20",
      "celular": "87999997777",
      "telefone": "8738664050",
      "convenio": "UNIMED"
    }
  ],
  "total": 3
}
```

---

## 10. Informações da Clínica

### Endpoint
```
POST /info-clinica
POST /clinic-info
```

### URL Completa
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/info-clinica
```

### Configuração N8N HTTP Request

| Campo | Valor |
|-------|-------|
| **Method** | `POST` |
| **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/info-clinica` |
| **Headers** | `Content-Type: application/json` |

### Body (JSON)

```json
{
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Resposta de Sucesso

```json
{
  "success": true,
  "message": "Informações da clínica IPADO",
  "clinica": {
    "id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054",
    "nome": "IPADO",
    "telefone": "(87) 3866-4050",
    "whatsapp": "87981126744",
    "endereco": "Rua Exemplo, 123 - Centro",
    "data_minima_agendamento": "2026-01-01",
    "dias_busca_inicial": 14,
    "dias_busca_expandida": 45
  },
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054",
  "fonte": "llm_clinic_config"
}
```

---

## Códigos de Erro

### Erros de Validação (success: false, status: 200)

| Código | Descrição |
|--------|-----------|
| `DADOS_INCOMPLETOS` | Campos obrigatórios faltando |
| `MEDICO_NAO_ENCONTRADO` | Médico não existe ou inativo |
| `SERVICO_NAO_ENCONTRADO` | Atendimento não encontrado |
| `SERVICO_NAO_DISPONIVEL_ONLINE` | Não permite agendamento online |
| `IDADE_INCOMPATIVEL` | Paciente não atende idade mínima |
| `DIA_NAO_PERMITIDO` | Médico não atende neste dia |
| `PERIODO_NAO_PERMITIDO` | Período indisponível |
| `LIMITE_VAGAS_ATINGIDO` | Sem vagas no período |
| `LIMITE_POOL_ATINGIDO` | Limite compartilhado esgotado |
| `SUBLIMITE_PROPRIO_ATINGIDO` | Limite específico do serviço |
| `DATA_BLOQUEADA` | Data anterior à mínima permitida |
| `HORARIO_OCUPADO` | Conflito de horário |
| `FORMATO_DATA_INVALIDO` | Formato de data incorreto |
| `ERRO_SISTEMA` | Erro interno (raro) |

### Erros Técnicos (status: 400)

```json
{
  "success": false,
  "error": "Mensagem de erro técnico",
  "timestamp": "2024-12-19T10:30:00.000Z"
}
```

---

## Exemplos N8N

### Fluxo Completo de Agendamento

```
[Webhook] → [Function: Processar Intenção] → [HTTP Request: API] → [Function: Formatar] → [WhatsApp]
```

### Configuração do HTTP Request Node

1. **Método:** POST
2. **URL:** Use expressão: `{{ "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/" + $json.action }}`
3. **Headers:**
   - `Content-Type`: `application/json`
4. **Body:** JSON
5. **Especificação do Body:**

```json
{
  "paciente_nome": "={{ $json.paciente_nome }}",
  "data_nascimento": "={{ $json.data_nascimento }}",
  "convenio": "={{ $json.convenio }}",
  "celular": "={{ $json.celular }}",
  "medico_nome": "={{ $json.medico_nome }}",
  "data_consulta": "={{ $json.data_consulta }}",
  "hora_consulta": "={{ $json.hora_consulta }}",
  "atendimento_nome": "={{ $json.atendimento_nome }}",
  "cliente_id": "2bfb98b5-ae41-4f96-8ba7-acc797c22054"
}
```

### Function Node: Extrair Resposta

```javascript
// Após HTTP Request
const response = $json;

if (response.success) {
  return {
    mensagem_whatsapp: response.mensagem_whatsapp || response.message,
    sucesso: true,
    dados: response
  };
} else {
  return {
    mensagem_whatsapp: response.mensagem_usuario || response.error || "Ocorreu um erro",
    sucesso: false,
    codigo_erro: response.codigo_erro
  };
}
```

---

## 📞 Suporte

- **Documentação:** Este arquivo
- **Logs:** Supabase Dashboard → Edge Functions → llm-agent-api → Logs
- **Contato:** Equipe de desenvolvimento

---

> **Dica:** Use o endpoint `/lista-medicos` primeiro para obter os IDs corretos dos médicos antes de agendar ou verificar disponibilidade.
