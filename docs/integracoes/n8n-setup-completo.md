# Guia Completo de Integração N8N

## 1. Configuração Inicial

### Base URL da API
```
https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api
```

### Headers Necessários
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
}
```

## 2. Endpoints Disponíveis

### 2.1 Listar Agendamentos
- **Método**: GET
- **URL**: `/scheduling-api`
- **Resposta**: Lista todos os agendamentos

### 2.2 Criar Agendamento Simples
- **Método**: POST
- **URL**: `/scheduling-api`
- **Body**:
```json
{
  "nome_completo": "João Silva",
  "data_nascimento": "1990-01-15",
  "convenio": "SUS",
  "telefone": "11999999999",
  "celular": "11999999999",
  "medico_id": "uuid-do-medico",
  "atendimento_id": "uuid-do-atendimento",
  "data_agendamento": "2025-01-20",
  "hora_agendamento": "14:00",
  "observacoes": "Primeira consulta"
}
```

### 2.3 Criar Agendamento Múltiplo
- **Body**:
```json
{
  "nome_completo": "Maria Santos",
  "data_nascimento": "1985-05-10",
  "convenio": "Unimed",
  "telefone": "11888888888",
  "celular": "11888888888",
  "medico_id": "uuid-do-medico",
  "atendimento_ids": ["uuid-exame1", "uuid-exame2"],
  "data_agendamento": "2025-01-21",
  "hora_agendamento": "09:00",
  "observacoes": "Exames de rotina"
}
```

### 2.4 Remarcar Agendamento
- **Método**: PUT
- **URL**: `/scheduling-api/{agendamento_id}`
- **Body**:
```json
{
  "data_agendamento": "2025-01-22",
  "hora_agendamento": "15:30",
  "observacoes": "Reagendado a pedido do paciente"
}
```

### 2.5 Alterar Status
- **Método**: PATCH
- **URL**: `/scheduling-api/{agendamento_id}/status`
- **Body**:
```json
{
  "status": "confirmado"
}
```

### 2.6 Consultar Disponibilidade
- **Método**: GET
- **URL**: `/scheduling-api/availability?doctorId={uuid}&date={YYYY-MM-DD}&days={numero}`

## 3. Códigos de Resposta

### Sucesso
- **200**: Operação realizada com sucesso
- **201**: Agendamento criado

### Erros
- **400**: Dados inválidos ou conflito de horário
- **404**: Recurso não encontrado
- **500**: Erro interno do servidor

## 4. Tratamento de Erros Comuns

### Conflito de Horário
```json
{
  "success": false,
  "error": "Este horário já está ocupado para o médico selecionado"
}
```

### Médico Inativo
```json
{
  "success": false,
  "error": "Médico não está ativo"
}
```

### Idade Incompatível
```json
{
  "success": false,
  "error": "Paciente com 5 anos está abaixo da idade mínima (18 anos) para este médico"
}
```

### Convênio Não Aceito
```json
{
  "success": false,
  "error": "Convênio \"Particular\" não é aceito por este médico"
}
```

## 5. Exemplo de Integração WhatsApp

### Fluxo Básico
1. **Webhook** recebe mensagem do WhatsApp
2. **Parse** extrai dados da mensagem
3. **HTTP Request** para API de agendamento
4. **Response** formatada de volta para WhatsApp

### Exemplo de Parsing
```javascript
// Function Node para extrair dados
const message = $node["Webhook"].json.body.message;
const phone = $node["Webhook"].json.body.from;

// Regex para extrair informações
const nameMatch = message.match(/nome:\s*(.+)/i);
const dateMatch = message.match(/data:\s*(\d{2}\/\d{2}\/\d{4})/i);
const timeMatch = message.match(/hora:\s*(\d{2}:\d{2})/i);

return {
  nome_completo: nameMatch ? nameMatch[1].trim() : null,
  data_agendamento: dateMatch ? dateMatch[1] : null,
  hora_agendamento: timeMatch ? timeMatch[1] : null,
  celular: phone
};
```

## 6. Monitoramento e Logs

### Headers para Tracking
```json
{
  "X-Request-ID": "unique-request-id",
  "X-Source": "n8n-webhook"
}
```

### Log de Sucesso
```json
{
  "success": true,
  "agendamento_id": "uuid",
  "message": "Agendamento criado com sucesso"
}
```

## 7. Rate Limiting

- **Limite**: 100 requisições por minuto por IP
- **Header de resposta**: `X-RateLimit-Remaining`
- **Retry**: Aguardar 60 segundos em caso de limite excedido