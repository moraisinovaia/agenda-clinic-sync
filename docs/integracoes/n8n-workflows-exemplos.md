# N8N Workflows - Exemplos Práticos

## 1. Workflow: Agendamento via WhatsApp

### Estrutura do Workflow
```
Webhook → Function (Parse) → HTTP Request (API) → Function (Format) → HTTP Request (WhatsApp Response)
```

### 1.1 Webhook Node
```json
{
  "httpMethod": "POST",
  "path": "whatsapp-scheduling",
  "responseMode": "responseNode"
}
```

### 1.2 Function Node - Parse Message
```javascript
// Extrair dados da mensagem do WhatsApp
const body = $node["Webhook"].json.body;
const message = body.message.toLowerCase();
const from = body.from;

// Patterns para extração
const patterns = {
  nome: /nome:\s*(.+?)(?:\n|$)/i,
  nascimento: /nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i,
  convenio: /convenio:\s*(.+?)(?:\n|$)/i,
  data: /data:\s*(\d{2}\/\d{2}\/\d{4})/i,
  hora: /hora:\s*(\d{2}:\d{2})/i,
  medico: /medico:\s*(.+?)(?:\n|$)/i
};

// Extrair informações
const extracted = {};
for (const [key, pattern] of Object.entries(patterns)) {
  const match = message.match(pattern);
  extracted[key] = match ? match[1].trim() : null;
}

// Converter data para formato ISO
if (extracted.nascimento) {
  const [dia, mes, ano] = extracted.nascimento.split('/');
  extracted.data_nascimento = `${ano}-${mes}-${dia}`;
}

if (extracted.data) {
  const [dia, mes, ano] = extracted.data.split('/');
  extracted.data_agendamento = `${ano}-${mes}-${dia}`;
}

return {
  nome_completo: extracted.nome,
  data_nascimento: extracted.data_nascimento,
  convenio: extracted.convenio || 'SUS',
  celular: from,
  telefone: from,
  data_agendamento: extracted.data_agendamento,
  hora_agendamento: extracted.hora,
  medico_nome: extracted.medico,
  observacoes: `Agendado via WhatsApp - ${new Date().toISOString()}`
};
```

### 1.3 HTTP Request Node - Get Doctor ID
```json
{
  "method": "GET",
  "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api",
  "headers": {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
  }
}
```

### 1.4 Function Node - Find Doctor
```javascript
const doctorName = $node["Parse Message"].json.medico_nome;
const doctors = $node["Get Doctors"].json.medicos;

const doctor = doctors.find(d => 
  d.nome.toLowerCase().includes(doctorName.toLowerCase())
);

if (!doctor) {
  return { error: `Médico "${doctorName}" não encontrado` };
}

// Pegar primeiro atendimento disponível (ou implementar lógica específica)
const atendimento = $node["Get Doctors"].json.atendimentos[0];

return {
  medico_id: doctor.id,
  atendimento_id: atendimento.id,
  medico_encontrado: doctor.nome
};
```

### 1.5 HTTP Request Node - Create Appointment
```json
{
  "method": "POST",
  "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
  },
  "body": {
    "nome_completo": "={{ $node['Parse Message'].json.nome_completo }}",
    "data_nascimento": "={{ $node['Parse Message'].json.data_nascimento }}",
    "convenio": "={{ $node['Parse Message'].json.convenio }}",
    "celular": "={{ $node['Parse Message'].json.celular }}",
    "telefone": "={{ $node['Parse Message'].json.telefone }}",
    "medico_id": "={{ $node['Find Doctor'].json.medico_id }}",
    "atendimento_id": "={{ $node['Find Doctor'].json.atendimento_id }}",
    "data_agendamento": "={{ $node['Parse Message'].json.data_agendamento }}",
    "hora_agendamento": "={{ $node['Parse Message'].json.hora_agendamento }}",
    "observacoes": "={{ $node['Parse Message'].json.observacoes }}"
  }
}
```

### 1.6 Function Node - Format Response
```javascript
const parseResult = $node["Parse Message"].json;
const apiResult = $node["Create Appointment"].json;

let responseMessage;

if (apiResult.success) {
  responseMessage = `✅ *Agendamento Confirmado!*

👤 *Paciente:* ${parseResult.nome_completo}
👨‍⚕️ *Médico:* ${$node["Find Doctor"].json.medico_encontrado}
📅 *Data:* ${parseResult.data_agendamento}
🕐 *Hora:* ${parseResult.hora_agendamento}
🏥 *Convênio:* ${parseResult.convenio}

📋 *ID do Agendamento:* ${apiResult.agendamento_id}

⚠️ *Importante:* Chegue 15 minutos antes do horário marcado.`;
} else {
  responseMessage = `❌ *Erro no Agendamento*

${apiResult.error}

💡 *Dica:* Verifique os dados e tente novamente.`;
}

return {
  message: responseMessage,
  phone: parseResult.celular
};
```

## 2. Workflow: Consulta de Disponibilidade

### Estrutura
```
Webhook → Function (Parse) → HTTP Request (Availability) → Function (Format) → Response
```

### 2.1 Function Node - Parse Availability Request
```javascript
const message = $node["Webhook"].json.body.message.toLowerCase();
const from = $node["Webhook"].json.body.from;

// Extrair médico e data
const medicoMatch = message.match(/disponibilidade\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})/i);

if (!medicoMatch) {
  return {
    error: true,
    message: "Formato: 'disponibilidade NomeMedico DD/MM/AAAA'"
  };
}

const [, medico, dataStr] = medicoMatch;
const [dia, mes, ano] = dataStr.split('/');
const data = `${ano}-${mes}-${dia}`;

return {
  medico_nome: medico.trim(),
  data: data,
  phone: from
};
```

### 2.2 HTTP Request - Check Availability
```json
{
  "method": "GET",
  "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api/availability",
  "qs": {
    "date": "={{ $node['Parse Request'].json.data }}",
    "days": "1"
  }
}
```

### 2.3 Function Node - Format Availability
```javascript
const availability = $node["Check Availability"].json;
const requestData = $node["Parse Request"].json;

if (!availability.doctors || availability.doctors.length === 0) {
  return {
    message: `❌ Nenhum médico encontrado para a data ${requestData.data}`,
    phone: requestData.phone
  };
}

let responseMessage = `📅 *Disponibilidade para ${requestData.data}*\n\n`;

availability.doctors.forEach(doctor => {
  responseMessage += `👨‍⚕️ *${doctor.nome}*\n`;
  responseMessage += `🩺 ${doctor.especialidade}\n`;
  
  if (doctor.available_slots && doctor.available_slots.length > 0) {
    responseMessage += `✅ *Horários Livres:*\n`;
    doctor.available_slots.forEach(slot => {
      responseMessage += `   • ${slot}\n`;
    });
  } else {
    responseMessage += `❌ Sem horários disponíveis\n`;
  }
  responseMessage += `\n`;
});

return {
  message: responseMessage,
  phone: requestData.phone
};
```

## 3. Workflow: Cancelamento com Lista de Espera

### 3.1 HTTP Request - Cancel Appointment
```json
{
  "method": "PATCH",
  "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api/{{ $node['Parse Cancel'].json.agendamento_id }}/status",
  "body": {
    "status": "cancelado"
  }
}
```

### 3.2 Function Node - Process Waiting List
```javascript
const cancelResult = $node["Cancel Appointment"].json;

if (cancelResult.success) {
  // A trigger do banco automaticamente processará a fila de espera
  return {
    message: `✅ Agendamento cancelado com sucesso!\n\n🔄 Verificando lista de espera...`,
    agendamento_id: $node["Parse Cancel"].json.agendamento_id
  };
} else {
  return {
    error: true,
    message: `❌ Erro ao cancelar: ${cancelResult.error}`
  };
}
```

## 4. Workflow: Confirmação Automática

### 4.1 Schedule Trigger
```json
{
  "rule": {
    "interval": [{"field": "hour", "value": 9}]
  }
}
```

### 4.2 Function Node - Check Appointments Tomorrow
```javascript
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split('T')[0];

return {
  date: tomorrowStr,
  message: `Verificando agendamentos para ${tomorrowStr}`
};
```

### 4.3 HTTP Request - Get Tomorrow's Appointments
```json
{
  "method": "GET",
  "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api",
  "qs": {
    "date": "={{ $node['Check Date'].json.date }}",
    "status": "agendado"
  }
}
```

## 5. Error Handling Pattern

### 5.1 Function Node - Error Handler
```javascript
const response = $node["API Call"].json;

if (response.success === false) {
  const errorMappings = {
    "horário já está ocupado": "⏰ Este horário não está mais disponível. Escolha outro horário.",
    "Médico não está ativo": "👨‍⚕️ Este médico não está disponível no momento.",
    "idade mínima": "👶 Este médico não atende pacientes desta faixa etária.",
    "Convênio": "🏥 Este médico não aceita o convênio informado.",
    "agenda está bloqueada": "🚫 A agenda está bloqueada nesta data."
  };
  
  let friendlyError = response.error;
  for (const [key, value] of Object.entries(errorMappings)) {
    if (response.error.includes(key)) {
      friendlyError = value;
      break;
    }
  }
  
  return {
    error: true,
    message: friendlyError,
    original_error: response.error
  };
}

return response;
```

## 6. Testing Checklist

### Casos de Teste
- [ ] Agendamento simples válido
- [ ] Agendamento múltiplo válido
- [ ] Conflito de horário
- [ ] Médico inativo
- [ ] Convênio não aceito
- [ ] Idade incompatível
- [ ] Data/hora no passado
- [ ] Dados obrigatórios faltando
- [ ] Consulta de disponibilidade
- [ ] Remarcação válida
- [ ] Cancelamento com fila de espera
- [ ] Confirmação automática

### Dados de Teste
```json
{
  "agendamento_valido": {
    "nome_completo": "João Teste",
    "data_nascimento": "1990-01-01",
    "convenio": "SUS",
    "telefone": "11999999999",
    "celular": "11999999999",
    "data_agendamento": "2025-12-31",
    "hora_agendamento": "14:00"
  },
  "agendamento_conflito": {
    "data_agendamento": "2025-01-01",
    "hora_agendamento": "08:00"
  }
}
```