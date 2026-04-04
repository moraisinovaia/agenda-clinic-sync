# GT Inova — API de Agendamento Inteligente

> Documentação técnica da API REST para integração via N8N, Postman ou qualquer cliente HTTP.

**Versão da API:** 3.2.0  
**Última atualização:** Abril 2026  
**Suporte:** contato@gtinova.com.br

---

## Sumário

1. [Visão Geral](#visão-geral)
2. [Autenticação](#autenticação)
3. [Convenções](#convenções)
4. [Início Rápido](#início-rápido)
5. [Referência de Endpoints](#referência-de-endpoints)
   - [Pacientes](#pacientes)
   - [Disponibilidade e Agendamentos](#disponibilidade-e-agendamentos)
   - [Médicos e Clínica](#médicos-e-clínica)
   - [Fila de Espera](#fila-de-espera)
6. [Configuração no N8N](#configuração-no-n8n)
7. [Tratamento de Erros](#tratamento-de-erros)
8. [Limites e Boas Práticas](#limites-e-boas-práticas)
9. [Glossário](#glossário)

---

## Visão Geral

A API GT Inova permite gerenciar agendamentos médicos de forma programática. Através dela é possível:

- Buscar e cadastrar pacientes
- Consultar disponibilidade de médicos em tempo real
- Criar, remarcar, cancelar e confirmar agendamentos
- Listar médicos, serviços e horários configurados
- Gerenciar fila de espera inteligente

A API é multi-tenant: cada clínica possui um identificador único (`cliente_id`) que isola completamente seus dados.

---

## Autenticação

Todas as requisições devem incluir o header de autenticação:

```
x-api-key: SUA_CHAVE_DE_API
```

A chave de API é fornecida pelo administrador do sistema no momento da ativação da sua clínica. Guarde-a em local seguro e nunca a exponha publicamente.

| Header | Valor | Obrigatório |
|--------|-------|:-----------:|
| `x-api-key` | Chave fornecida pela GT Inova | Sim |
| `Content-Type` | `application/json` | Sim |

> **Importante:** Requisições sem a chave ou com chave inválida retornam `HTTP 401 Unauthorized`.

---

## Convenções

| Item | Detalhe |
|------|---------|
| **Protocolo** | HTTPS (obrigatório) |
| **Método** | `POST` para todos os endpoints |
| **Formato do body** | JSON |
| **Encoding** | UTF-8 |
| **Formato de data** | `YYYY-MM-DD` (ex: `2026-04-10`) |
| **Formato de hora** | `HH:MM` (ex: `14:30`) |
| **Fuso horário** | América/Recife (UTC-3) |
| **Identificadores** | UUID v4 (ex: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`) |

### Nomes de campos

A API aceita campos tanto em `snake_case` (padrão) quanto em `camelCase` para retrocompatibilidade:

| snake_case (recomendado) | camelCase (aceito) |
|--------------------------|-------------------|
| `paciente_nome` | `pacienteNome` |
| `data_nascimento` | `dataNascimento` |
| `data_agendamento` | `dataAgendamento` |
| `hora_agendamento` | `horaAgendamento` |

### Aliases de URL (Português)

Os endpoints aceitam nomes em inglês (padrão) ou português:

| Português | Inglês |
|-----------|--------|
| `/verificar-paciente` | `/check-patient` |
| `/disponibilidade` | `/availability` |
| `/agendar` | `/schedule` |
| `/remarcar` | `/reschedule` |
| `/cancelar` | `/cancel` |
| `/confirmar` | `/confirm` |
| `/lista-medicos` | `/list-doctors` |
| `/info-clinica` | `/clinic-info` |

---

## Início Rápido

### Base URL

```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api
```

### Exemplo: verificar se um paciente existe

```bash
curl -X POST \
  https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/check-patient \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE_DE_API" \
  -d '{
    "cliente_id": "SEU_CLIENTE_ID",
    "paciente_nome": "Maria da Silva",
    "data_nascimento": "1985-03-20"
  }'
```

### Exemplo: consultar disponibilidade

```bash
curl -X POST \
  https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/availability \
  -H "Content-Type: application/json" \
  -H "x-api-key: SUA_CHAVE_DE_API" \
  -d '{
    "cliente_id": "SEU_CLIENTE_ID",
    "medico_nome": "Dr. João",
    "atendimento_nome": "Consulta"
  }'
```

> Substitua `SEU_CLIENTE_ID` pelo identificador fornecido pela GT Inova para sua clínica.

---

## Referência de Endpoints

---

### Pacientes

---

#### `POST /check-patient` — Verificar Paciente

Busca um paciente no cadastro da clínica. Utiliza busca inteligente (fuzzy) por nome e suporta múltiplos critérios de pesquisa.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `paciente_nome` | `string` | Condicional* | Nome completo ou parcial do paciente |
| `data_nascimento` | `string` | Condicional* | Data de nascimento (`YYYY-MM-DD`) |
| `celular` | `string` | Condicional* | Número de celular com DDD |

> *Informe pelo menos um dos três campos de busca.

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "paciente_nome": "Maria Silva",
  "data_nascimento": "1985-03-20",
  "celular": "87999998888"
}
```

**Exemplo de Response (paciente encontrado):**

```json
{
  "success": true,
  "paciente_encontrado": true,
  "paciente": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "nome_completo": "MARIA DA SILVA SANTOS",
    "data_nascimento": "1985-03-20",
    "celular": "87999998888",
    "telefone": "8730241274",
    "convenio": "UNIMED REGIONAL"
  },
  "agendamentos_recentes": [
    {
      "id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
      "data_agendamento": "2026-04-05",
      "hora_agendamento": "08:00",
      "status": "confirmado",
      "medico_nome": "Dr. João Pereira",
      "atendimento_nome": "Consulta Cardiológica"
    }
  ],
  "total_agendamentos": 1
}
```

**Exemplo de Response (paciente não encontrado):**

```json
{
  "success": true,
  "paciente_encontrado": false,
  "pacientes_similares": [],
  "message": "Nenhum paciente encontrado com os critérios informados"
}
```

**Observações:**
- Celulares mascarados (contendo `*`) são ignorados automaticamente na busca.
- A busca por nome suporta nomes parciais (ex: "Maria" encontra "Maria da Silva Santos").

---

#### `POST /patient-search` — Busca Avançada de Pacientes

Busca pacientes com filtro por tipo de campo.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `busca` | `string` | Sim | Texto de busca |
| `tipo` | `string` | Não | Tipo de busca: `nome`, `telefone` ou `nascimento`. Se omitido, detecta automaticamente |

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "busca": "87999998888",
  "tipo": "telefone"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "pacientes": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "nome_completo": "MARIA DA SILVA SANTOS",
      "data_nascimento": "1985-03-20",
      "celular": "87999998888",
      "telefone": "8730241274",
      "convenio": "PARTICULAR"
    }
  ],
  "total": 1
}
```

---

### Disponibilidade e Agendamentos

---

#### `POST /availability` — Consultar Disponibilidade

Retorna os horários e vagas disponíveis de um médico para os próximos dias.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `medico_nome` | `string` | Condicional* | Nome do médico (busca fuzzy) |
| `medico_id` | `string` | Condicional* | UUID do médico |
| `atendimento_nome` | `string` | Não | Tipo de atendimento (ex: "Consulta", "Teste Ergométrico") |
| `data_consulta` | `string` | Não | Data inicial da busca (`YYYY-MM-DD`). Padrão: data atual |
| `dias_busca` | `number` | Não | Quantidade de dias a buscar. Padrão: `14` |
| `buscar_proximas` | `boolean` | Não | Se `true`, busca os próximos dias com vagas disponíveis |
| `quantidade_dias` | `number` | Não | Quantidade de dias a retornar. Padrão: `7` |
| `mensagem_original` | `string` | Não | Mensagem do paciente (extrai preferência de período: manhã/tarde) |

> *Informe `medico_nome` ou `medico_id`. O nome suporta busca fuzzy (ex: "Dr. Marcelo" encontra "Dr. Marcelo D'Carli Cavalcanti").

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "medico_nome": "Dr. Marcelo",
  "atendimento_nome": "Consulta Cardiológica",
  "data_consulta": "2026-04-10",
  "dias_busca": 14
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "medico": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "nome": "Dr. Marcelo D'Carli"
  },
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
          "horario_fim": "12:00",
          "atendimento_inicio": "07:45"
        }
      ]
    },
    {
      "data": "2026-04-10",
      "dia_semana": "quinta-feira",
      "periodos": [
        {
          "periodo": "tarde",
          "tipo_agenda": "ordem_chegada",
          "vagas_total": 9,
          "vagas_ocupadas": 0,
          "vagas_disponiveis": 9,
          "horario_inicio": "13:00",
          "horario_fim": "17:00",
          "atendimento_inicio": "13:45"
        }
      ]
    }
  ],
  "mensagem_formatada": "Dr. Marcelo D'Carli tem 6 vagas na manhã (07:00-12:00) e 9 vagas na tarde (13:00-17:00) no dia 10/04."
}
```

**Tipos de Agenda:**
- `ordem_chegada` — Pacientes são atendidos por ordem de chegada dentro do turno. Não há horário fixo individual.
- `hora_marcada` — Cada paciente tem um horário específico agendado.

---

#### `POST /schedule` — Criar Agendamento

Cria um novo agendamento. Se o paciente não existir no cadastro, será criado automaticamente.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `paciente_nome` | `string` | Sim | Nome completo do paciente |
| `data_nascimento` | `string` | Sim | Data de nascimento (`YYYY-MM-DD`) |
| `convenio` | `string` | Sim | Nome do convênio (ex: "PARTICULAR", "UNIMED REGIONAL") |
| `celular` | `string` | Sim | Celular com DDD (ex: "87999998888") |
| `telefone` | `string` | Não | Telefone fixo |
| `medico_nome` | `string` | Condicional* | Nome do médico (busca fuzzy) |
| `medico_id` | `string` | Condicional* | UUID do médico |
| `atendimento_nome` | `string` | Não | Tipo de atendimento |
| `data_agendamento` | `string` | Sim | Data do agendamento (`YYYY-MM-DD`) |
| `hora_agendamento` | `string` | Sim | Horário (`HH:MM`). Para ordem de chegada, usar o horário de início do turno |
| `periodo` | `string` | Não | `"manha"` ou `"tarde"` (necessário para agenda por ordem de chegada) |
| `observacoes` | `string` | Não | Observações adicionais |

> *Informe `medico_nome` ou `medico_id`.

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "paciente_nome": "Maria da Silva Santos",
  "data_nascimento": "1985-03-20",
  "convenio": "PARTICULAR",
  "celular": "87999998888",
  "medico_nome": "Dr. Marcelo",
  "atendimento_nome": "Consulta Cardiológica",
  "data_agendamento": "2026-04-10",
  "hora_agendamento": "07:00",
  "periodo": "manha",
  "observacoes": "Primeira consulta"
}
```

**Exemplo de Response (sucesso):**

```json
{
  "success": true,
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "mensagem": "Agendamento realizado com sucesso!",
  "detalhes": {
    "paciente": "MARIA DA SILVA SANTOS",
    "medico": "Dr. Marcelo D'Carli",
    "data": "2026-04-10",
    "hora": "07:00",
    "atendimento": "Consulta Cardiológica",
    "convenio": "PARTICULAR"
  }
}
```

**Exemplo de Response (sem vagas):**

```json
{
  "success": false,
  "error": "SEM_VAGAS",
  "message": "Não há vagas disponíveis para esta data e horário"
}
```

---

#### `POST /reschedule` — Remarcar Agendamento

Altera a data e/ou horário de um agendamento existente.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `agendamento_id` | `string` | Sim | UUID do agendamento a remarcar |
| `nova_data` | `string` | Sim | Nova data (`YYYY-MM-DD`) |
| `nova_hora` | `string` | Sim | Novo horário (`HH:MM`) |
| `observacoes` | `string` | Não | Motivo da remarcação |

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "nova_data": "2026-04-15",
  "nova_hora": "13:00",
  "observacoes": "Paciente solicitou remarcação por conflito de horário"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "message": "Agendamento remarcado com sucesso",
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "data_anterior": "2026-04-10",
  "hora_anterior": "07:00",
  "nova_data": "2026-04-15",
  "nova_hora": "13:00"
}
```

---

#### `POST /cancel` — Cancelar Agendamento

Cancela um agendamento existente.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `agendamento_id` | `string` | Sim | UUID do agendamento |
| `motivo` | `string` | Não | Motivo do cancelamento |

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "motivo": "Paciente desistiu da consulta"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "message": "Agendamento cancelado com sucesso",
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "paciente": "MARIA DA SILVA SANTOS",
  "data": "2026-04-15",
  "hora": "13:00"
}
```

---

#### `POST /confirm` — Confirmar Agendamento

Confirma a presença do paciente em um agendamento.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `agendamento_id` | `string` | Sim | UUID do agendamento |
| `observacoes` | `string` | Não | Observações (ex: "Confirmado via WhatsApp") |

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "observacoes": "Confirmado via WhatsApp"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "message": "Agendamento confirmado com sucesso",
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "paciente": "MARIA DA SILVA SANTOS",
  "data": "2026-04-15",
  "hora": "13:00",
  "status_anterior": "agendado",
  "status_atual": "confirmado"
}
```

---

#### `POST /list-appointments` — Listar Agendamentos do Dia

Retorna todos os agendamentos de um médico em uma data específica.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `medico_nome` | `string` | Sim | Nome do médico |
| `data` | `string` | Sim | Data no formato `YYYY-MM-DD` ou `CURRENT_DATE` para hoje |

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "medico_nome": "Dr. Marcelo",
  "data": "2026-04-10"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "encontrado": true,
  "agendamentos": [
    {
      "paciente_nome": "MARIA DA SILVA SANTOS",
      "hora_agendamento": "07:00",
      "tipo_atendimento": "Consulta Cardiológica",
      "convenio": "PARTICULAR",
      "status": "agendado",
      "periodo": "manhã"
    }
  ],
  "total": 1,
  "resumo": {
    "total": 1,
    "manha": 1,
    "tarde": 0,
    "tipos": {
      "Consulta Cardiológica": 1
    }
  },
  "data_busca": "2026-04-10",
  "medico_busca": "Dr. Marcelo"
}
```

---

### Médicos e Clínica

---

#### `POST /list-doctors` — Listar Médicos

Retorna todos os médicos ativos da clínica com suas especialidades e convênios.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "medicos": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "nome": "Dr. Marcelo D'Carli",
      "especialidade": "Cardiologia",
      "crm": "15056/PE",
      "rqe": "67",
      "convenios_aceitos": ["PARTICULAR", "UNIMED REGIONAL", "UNIMED NACIONAL", "HGU"],
      "tipo_agendamento": "ordem_chegada",
      "servicos": ["Consulta Cardiológica", "Teste Ergométrico"],
      "ativo": true
    }
  ],
  "total": 1
}
```

---

#### `POST /clinic-info` — Informações da Clínica

Retorna dados cadastrais e configurações da clínica.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |

**Exemplo de Response:**

```json
{
  "success": true,
  "clinica": {
    "id": "SEU_CLIENTE_ID",
    "nome": "Clínica IPADO",
    "telefone": "(87) 3024-1274",
    "whatsapp": "(87) 98112-6744",
    "endereco": "Rua Tobias Barreto, 164, Centro, Petrolina/PE",
    "data_minima_agendamento": null,
    "dias_busca_inicial": 14,
    "dias_busca_expandida": 45
  }
}
```

---

#### `POST /doctor-schedules` — Horários do Médico

Retorna a grade de horários configurada para um ou todos os médicos da clínica.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `medico_nome` | `string` | Não | Filtrar por nome do médico. Se omitido, retorna todos |

> Alias alternativo: `POST /horarios-medicos`

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "medico_nome": "Dr. Marcelo"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "medicos": [
    {
      "nome": "Dr. Marcelo D'Carli",
      "especialidade": "Cardiologia",
      "tipo_agendamento": "ordem_chegada",
      "convenios_aceitos": ["PARTICULAR", "UNIMED REGIONAL"],
      "servicos": [
        {
          "nome": "Consulta Cardiológica",
          "dias": "Segunda a Sexta",
          "periodos": [
            {
              "periodo": "manha",
              "horario": "07:00 - 12:00",
              "inicio_atendimento": "07:45",
              "limite_pacientes": 9
            }
          ]
        }
      ]
    }
  ]
}
```

---

### Fila de Espera

A fila de espera permite que pacientes sejam notificados automaticamente quando uma vaga é liberada por cancelamento ou remarcação.

---

#### `POST /consultar-fila` — Consultar Fila de Espera

Retorna os pacientes aguardando na fila de espera.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `medico_id` | `string` | Não | Filtrar por médico |
| `atendimento_id` | `string` | Não | Filtrar por tipo de atendimento |
| `status` | `string` | Não | Filtrar por status. Padrão: `"aguardando"` |

**Status possíveis:** `aguardando`, `notificado`, `agendado`, `expirado`, `cancelado`

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "medico_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "aguardando"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "fila": [
    {
      "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "status": "aguardando",
      "prioridade": 1,
      "data_preferida": "2026-04-10",
      "periodo_preferido": "manha",
      "observacoes": "Urgente",
      "tentativas_contato": 0,
      "created_at": "2026-04-01T10:30:00Z",
      "pacientes": {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "nome_completo": "MARIA DA SILVA SANTOS",
        "celular": "87999998888",
        "convenio": "PARTICULAR"
      },
      "medicos": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "nome": "Dr. Marcelo D'Carli"
      },
      "atendimentos": {
        "id": "b3c4d5e6-f7a8-9012-bcde-f34567890abc",
        "nome": "Consulta Cardiológica"
      }
    }
  ],
  "total": 1
}
```

---

#### `POST /adicionar-fila` — Adicionar à Fila de Espera

Insere um paciente na fila de espera de um médico/serviço.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `paciente_nome` | `string` | Sim | Nome completo do paciente |
| `data_nascimento` | `string` | Sim | Data de nascimento (`YYYY-MM-DD`) |
| `celular` | `string` | Sim | Celular com DDD |
| `convenio` | `string` | Não | Convênio do paciente. Padrão: `"PARTICULAR"` |
| `medico_nome` | `string` | Condicional* | Nome do médico |
| `medico_id` | `string` | Condicional* | UUID do médico |
| `atendimento_nome` | `string` | Não | Tipo de atendimento desejado |
| `data_preferida` | `string` | Não | Data preferida (`YYYY-MM-DD`) |
| `periodo_preferido` | `string` | Não | `"manha"` ou `"tarde"` |
| `observacoes` | `string` | Não | Observações |

> *Informe `medico_nome` ou `medico_id`.

**Exemplo de Request:**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "paciente_nome": "Maria da Silva Santos",
  "data_nascimento": "1985-03-20",
  "celular": "87999998888",
  "convenio": "PARTICULAR",
  "medico_nome": "Dr. Marcelo",
  "atendimento_nome": "Consulta Cardiológica",
  "data_preferida": "2026-04-10",
  "periodo_preferido": "manha",
  "observacoes": "Paciente com urgência"
}
```

**Exemplo de Response:**

```json
{
  "success": true,
  "message": "Paciente adicionado à fila de espera com sucesso",
  "fila_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "paciente": "MARIA DA SILVA SANTOS",
  "medico": "Dr. Marcelo D'Carli",
  "posicao": 3
}
```

---

#### `POST /responder-fila` — Responder Oferta de Vaga

Quando o sistema notifica um paciente sobre uma vaga disponível, este endpoint registra a resposta.

**Request Body:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:-----------:|-----------|
| `cliente_id` | `string` | Sim | Identificador da clínica |
| `fila_id` | `string` | Sim | UUID do item na fila de espera |
| `notif_id` | `string` | Sim | UUID da notificação recebida |
| `resposta` | `string` | Sim | `"SIM"` para aceitar ou `"NAO"` para recusar |
| `data_agendamento` | `string` | Condicional* | Data do agendamento (`YYYY-MM-DD`) — obrigatório se `"SIM"` |
| `hora_agendamento` | `string` | Condicional* | Horário (`HH:MM`) — obrigatório se `"SIM"` |

> *Obrigatórios apenas quando `resposta = "SIM"`.

**Exemplo de Request (aceitar vaga):**

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "fila_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "notif_id": "e3a1f2b4-c5d6-7890-ef12-345678901234",
  "resposta": "SIM",
  "data_agendamento": "2026-04-10",
  "hora_agendamento": "07:00"
}
```

**Exemplo de Response (vaga aceita):**

```json
{
  "success": true,
  "message": "Vaga confirmada! Agendamento criado para MARIA DA SILVA SANTOS",
  "agendamento_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "paciente": "MARIA DA SILVA SANTOS",
  "medico": "Dr. Marcelo D'Carli",
  "data": "2026-04-10",
  "hora": "07:00",
  "acao": "agendado"
}
```

**Exemplo de Response (vaga recusada):**

```json
{
  "success": true,
  "message": "Resposta registrada. O próximo paciente da fila será notificado.",
  "fila_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
  "acao": "recusado",
  "proximo_notificado": {
    "nome": "JOSÉ CARLOS OLIVEIRA",
    "celular": "87988887777"
  }
}
```

---

## Configuração no N8N

### Passo a passo para o node HTTP Request

1. Adicione um node **HTTP Request** ao seu workflow.

2. Configure os campos:

   | Campo | Valor |
   |-------|-------|
   | **Method** | `POST` |
   | **URL** | `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/{endpoint}` |
   | **Authentication** | `None` |
   | **Send Headers** | Ativado |
   | **Header 1 — Name** | `x-api-key` |
   | **Header 1 — Value** | Sua chave de API |
   | **Header 2 — Name** | `Content-Type` |
   | **Header 2 — Value** | `application/json` |
   | **Send Body** | Ativado |
   | **Body Content Type** | `JSON` |
   | **Body** | O JSON do endpoint desejado |

3. Substitua `{endpoint}` pelo nome do endpoint (ex: `check-patient`, `availability`, `schedule`).

### Usando com AI Agent (Agente LLM)

Para integração com o node **AI Agent** do N8N, configure cada endpoint como uma **Tool** do agente:

1. Crie um node **Tool** do tipo **HTTP Request** para cada ação.
2. Descreva a ferramenta para que o agente saiba quando usá-la (ex: "Use esta ferramenta para verificar se um paciente já existe no sistema").
3. O agente decidirá automaticamente qual ferramenta usar com base na conversa do paciente.

### Dica: usando variáveis do N8N

Para tornar o workflow dinâmico, use expressões do N8N no body:

```json
{
  "cliente_id": "SEU_CLIENTE_ID",
  "paciente_nome": "{{ $json.nome_paciente }}",
  "data_nascimento": "{{ $json.nascimento }}",
  "celular": "{{ $json.telefone }}"
}
```

---

## Tratamento de Erros

### Formato padrão de erro

Todas as respostas de erro seguem a mesma estrutura:

```json
{
  "success": false,
  "error": "CODIGO_DO_ERRO",
  "message": "Descrição legível do erro para o usuário"
}
```

### Códigos HTTP

| Código | Significado | Ação recomendada |
|--------|-------------|------------------|
| `200` | Sucesso **ou** erro de negócio | Verifique o campo `success` no body |
| `400` | Requisição inválida (campos obrigatórios ausentes) | Revise os parâmetros enviados |
| `401` | Chave de API inválida ou ausente | Verifique o header `x-api-key` |
| `500` | Erro interno do servidor | Tente novamente. Se persistir, entre em contato |

### Erros comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `Unauthorized - Invalid API Key` | Header `x-api-key` ausente ou incorreto | Verifique a chave de API |
| `cliente_id ou config_id é obrigatório` | Body sem identificador da clínica | Adicione o `cliente_id` ao body |
| `Agendamento não encontrado` | UUID inválido ou de outra clínica | Verifique o `agendamento_id` |
| `Não há vagas disponíveis` | Limite de pacientes atingido para o dia/turno | Consulte outra data via `/availability` |
| `Paciente já possui agendamento` | Conflito de horário para o mesmo paciente | Cancele ou remarque o agendamento existente |

---

## Limites e Boas Práticas

| Item | Recomendação |
|------|-------------|
| **Rate limit** | Máximo de 30 requisições por segundo (global, compartilhado entre todas as clínicas) |
| **Timeout** | As requisições possuem timeout de 25 segundos |
| **Retry** | Em caso de erro 500, aguarde 2 segundos e tente novamente (máximo 3 tentativas) |
| **Cache** | As configurações de médicos são cacheadas por 1 minuto. Alterações no painel admin podem levar até 60s para refletir na API |
| **Dados sensíveis** | Nunca armazene a chave de API em código-fonte público |
| **Validação** | Sempre valide os dados antes de enviar à API para evitar erros desnecessários |

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **cliente_id** | Identificador único da clínica no sistema. Fornecido pela GT Inova |
| **config_id** | Identificador de configuração específica (usado por filiais) |
| **ordem_chegada** | Modalidade de agenda onde pacientes são atendidos por ordem de chegada, sem horário fixo |
| **hora_marcada** | Modalidade de agenda com horário individual agendado para cada paciente |
| **fuzzy match** | Busca inteligente que encontra resultados mesmo com pequenas variações no texto |
| **período** | Turno de atendimento: `manha` (manhã) ou `tarde` |
| **fila de espera** | Sistema que notifica pacientes automaticamente quando uma vaga é liberada |

---

*Documentação gerada pela GT Inova — Sistema de Agendamento Inteligente*  
*Em caso de dúvidas, entre em contato com o suporte técnico.*
