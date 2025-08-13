# Guia de Integração N8N + LLM Agent + WhatsApp

## API LLM Agent - Endpoints Disponíveis

**Base URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api`

### Headers Necessários
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
}
```

## 1. AGENDAR CONSULTA

**Endpoint**: `POST /llm-agent-api/schedule`

```json
{
  "paciente_nome": "João Silva",
  "data_nascimento": "1990-01-15",
  "convenio": "SUS",
  "telefone": "11999999999",
  "celular": "11999999999", 
  "medico_nome": "Dr. Max",
  "atendimento_nome": "Teste Ergométrico",
  "data_consulta": "2025-01-20",
  "hora_consulta": "14:00",
  "observacoes": "Primeira consulta via WhatsApp"
}
```

**Resposta de Sucesso**:
```json
{
  "success": true,
  "message": "Consulta agendada com sucesso para João Silva",
  "agendamento_id": "uuid",
  "paciente_id": "uuid",
  "medico": "Dr. Max",
  "data": "2025-01-20",
  "hora": "14:00"
}
```

## 2. CONSULTAR AGENDAMENTOS

**Endpoint**: `POST /llm-agent-api/check-patient`

```json
{
  "paciente_nome": "João Silva",
  "data_nascimento": "1990-01-15",
  "celular": "11999999999"
}
```

**Resposta**:
```json
{
  "success": true,
  "message": "2 consulta(s) encontrada(s)",
  "consultas": [
    {
      "id": "uuid",
      "paciente": "João Silva", 
      "medico": "Dr. Max",
      "especialidade": "Cardiologia",
      "atendimento": "Teste Ergométrico",
      "data": "2025-01-20",
      "hora": "14:00",
      "status": "agendado",
      "convenio": "SUS"
    }
  ],
  "total": 2
}
```

## 3. REMARCAR CONSULTA

**Endpoint**: `POST /llm-agent-api/reschedule`

```json
{
  "agendamento_id": "uuid-do-agendamento",
  "nova_data": "2025-01-22", 
  "nova_hora": "15:30",
  "observacoes": "Remarcado via WhatsApp"
}
```

## 4. CANCELAR CONSULTA

**Endpoint**: `POST /llm-agent-api/cancel`

```json
{
  "agendamento_id": "uuid-do-agendamento",
  "motivo": "Paciente não poderá comparecer"
}
```

## 5. VERIFICAR DISPONIBILIDADE

**Endpoint**: `POST /llm-agent-api/availability`

```json
{
  "medico_nome": "Dr. Max",
  "data_consulta": "2025-01-20",
  "periodo": "manha"
}
```

**Resposta**:
```json
{
  "success": true,
  "message": "12 horários disponíveis encontrados",
  "medico": "Dr. Max",
  "data": "2025-01-20", 
  "horarios_disponiveis": [
    {
      "hora": "08:00:00",
      "disponivel": true,
      "periodo": "manhã"
    }
  ]
}
```

## 6. BUSCAR PACIENTES

**Endpoint**: `POST /llm-agent-api/patient-search`

```json
{
  "busca": "João",
  "tipo": "nome"
}
```

## Integração N8N + WhatsApp

### Workflow Exemplo: Bot Inteligente

1. **Webhook WhatsApp** → Recebe mensagem
2. **Function Node** → Extrai dados da mensagem
3. **LLM Node** → Processa intenção do usuário
4. **HTTP Request** → Chama API LLM Agent apropriada
5. **Function Node** → Formata resposta
6. **WhatsApp Response** → Envia resposta

### Function Node - Processar Intenção

```javascript
// Detectar intenção da mensagem
const message = $input.first().json.message.toLowerCase();

let action = null;
let extractedData = {};

if (message.includes('agendar') || message.includes('marcar')) {
  action = 'schedule';
  // Extrair dados: nome, data, médico, etc.
} else if (message.includes('consultar') || message.includes('quando')) {
  action = 'check-patient';
} else if (message.includes('remarcar') || message.includes('mudar')) {
  action = 'reschedule';
} else if (message.includes('cancelar')) {
  action = 'cancel';
} else if (message.includes('horarios') || message.includes('disponivel')) {
  action = 'availability';
}

return {
  action,
  data: extractedData,
  original_message: message
};
```

### HTTP Request Node - Chamar API

**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/{{ $json.action }}`

**Body**: `{{ $json.data }}`

### Tratamento de Erros

```javascript
const response = $input.first().json;

if (response.success) {
  return {
    message: `✅ ${response.message}`,
    details: response
  };
} else {
  return {
    message: `❌ Erro: ${response.error}`,
    retry: true
  };
}
```

## Médicos Disponíveis

- **Dr. Max** (Cardiologia) 
  - Teste Ergométrico
- **Dr. Sydney** (Endoscopia)
  - Colonoscopia
  - Endoscopia Digestiva Alta

## Exemplo de Conversa WhatsApp

**Usuário**: "Oi, gostaria de agendar uma consulta com Dr. Max"

**Bot**: "Claro! Para agendar com Dr. Max, preciso de:
- Seu nome completo
- Data de nascimento (DD/MM/AAAA)  
- Convênio
- Telefone
- Data desejada para consulta
- Horário preferido"

**Usuário**: "João Silva, 15/01/1990, SUS, 11999999999, 20/01/2025, 14:00"

**Bot**: "✅ Consulta agendada com sucesso para João Silva com Dr. Max no dia 20/01/2025 às 14:00h para Teste Ergométrico"

## Status de Resposta

- **200**: Sucesso
- **400**: Dados inválidos
- **404**: Recurso não encontrado  
- **500**: Erro interno

## Logs e Monitoramento

Todos os requests ficam logados nos Edge Functions do Supabase para debugging.