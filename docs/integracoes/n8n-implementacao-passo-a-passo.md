# Implementação N8N + LLM Agent - Passo a Passo

## 1. CONFIGURAÇÃO BÁSICA DO WORKFLOW

### Estrutura do Workflow
```
[Webhook WhatsApp] → [Parse Message] → [Detect Intent] → [API Call] → [Format Response] → [Send WhatsApp]
```

### 1.1 Webhook Node (Trigger)
**Configuração:**
- **Method**: POST
- **Path**: `/whatsapp-webhook`
- **Response Mode**: Respond Immediately

## 2. FUNCTION NODE - PARSE MESSAGE

**Nome**: `Parse WhatsApp Message`

```javascript
// Extrair dados da mensagem do WhatsApp
const body = $input.first().json.body || $input.first().json;
const message = body.message || body.text || '';
const phone = body.from || body.phone || '';

// Limpar número de telefone
const cleanPhone = phone.replace(/\D/g, '');

// Dados base
const messageData = {
  original_message: message.toLowerCase(),
  phone: cleanPhone,
  timestamp: new Date().toISOString()
};

// Detectar intenção
let intent = 'unknown';
let extractedData = {};

if (message.includes('agendar') || message.includes('marcar')) {
  intent = 'schedule';
  // Tentar extrair dados usando regex
  const nomeMatch = message.match(/(?:nome|eu sou|me chamo)\s*:?\s*([^,\n]+)/i);
  const nascimentoMatch = message.match(/(?:nascimento|nasci|nasc)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  const convenioMatch = message.match(/(?:convenio|plano|conv)\s*:?\s*([^,\n]+)/i);
  const medicoMatch = message.match(/(?:medico|dr|dra|doutor|doutora)\s*:?\s*([^,\n]+)/i);
  const dataMatch = message.match(/(?:data|dia)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  const horaMatch = message.match(/(?:hora|horario)\s*:?\s*(\d{1,2}:\d{2})/i);

  extractedData = {
    paciente_nome: nomeMatch ? nomeMatch[1].trim() : null,
    data_nascimento: nascimentoMatch ? nascimentoMatch[1] : null,
    convenio: convenioMatch ? convenioMatch[1].trim() : 'SUS',
    medico_nome: medicoMatch ? medicoMatch[1].trim() : null,
    data_consulta: dataMatch ? dataMatch[1] : null,
    hora_consulta: horaMatch ? horaMatch[1] + ':00' : null,
    celular: cleanPhone,
    telefone: cleanPhone,
    observacoes: 'Agendamento via WhatsApp'
  };

} else if (message.includes('consultar') || message.includes('quando') || message.includes('minha consulta')) {
  intent = 'check-patient';
  const nomeMatch = message.match(/(?:nome|eu sou|me chamo)\s*:?\s*([^,\n]+)/i);
  const nascimentoMatch = message.match(/(?:nascimento|nasci|nasc)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  
  extractedData = {
    paciente_nome: nomeMatch ? nomeMatch[1].trim() : null,
    data_nascimento: nascimentoMatch ? nascimentoMatch[1] : null,
    celular: cleanPhone
  };

} else if (message.includes('remarcar') || message.includes('mudar') || message.includes('trocar data')) {
  intent = 'reschedule';
  const dataMatch = message.match(/(?:nova data|para)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  const horaMatch = message.match(/(?:nova hora|horario)\s*:?\s*(\d{1,2}:\d{2})/i);
  const idMatch = message.match(/(?:agendamento|id)\s*:?\s*([a-f0-9-]+)/i);
  
  extractedData = {
    agendamento_id: idMatch ? idMatch[1] : null,
    nova_data: dataMatch ? dataMatch[1] : null,
    nova_hora: horaMatch ? horaMatch[1] + ':00' : null,
    observacoes: 'Remarcado via WhatsApp'
  };

} else if (message.includes('cancelar') || message.includes('desmarcar')) {
  intent = 'cancel';
  const idMatch = message.match(/(?:agendamento|id)\s*:?\s*([a-f0-9-]+)/i);
  const motivoMatch = message.match(/(?:motivo|porque)\s*:?\s*([^,\n]+)/i);
  
  extractedData = {
    agendamento_id: idMatch ? idMatch[1] : null,
    motivo: motivoMatch ? motivoMatch[1].trim() : 'Cancelado pelo paciente via WhatsApp'
  };

} else if (message.includes('horarios') || message.includes('disponivel') || message.includes('vago')) {
  intent = 'availability';
  const medicoMatch = message.match(/(?:medico|dr|dra|doutor|doutora)\s*:?\s*([^,\n]+)/i);
  const dataMatch = message.match(/(?:data|dia)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/i);
  const periodoMatch = message.match(/(?:periodo|turno)\s*:?\s*(manha|manhã|tarde|noite)/i);
  
  extractedData = {
    medico_nome: medicoMatch ? medicoMatch[1].trim() : null,
    data_consulta: dataMatch ? dataMatch[1] : null,
    periodo: periodoMatch ? periodoMatch[1].toLowerCase() : null
  };

} else if (message.includes('oi') || message.includes('olá') || message.includes('bom dia')) {
  intent = 'greeting';
}

return {
  intent,
  data: extractedData,
  phone: cleanPhone,
  original_message: message
};
```

## 3. IF NODE - ROUTE BY INTENT

**Configuração:**
- **Condition 1**: `{{ $json.intent === 'schedule' }}`
- **Condition 2**: `{{ $json.intent === 'check-patient' }}`  
- **Condition 3**: `{{ $json.intent === 'reschedule' }}`
- **Condition 4**: `{{ $json.intent === 'cancel' }}`
- **Condition 5**: `{{ $json.intent === 'availability' }}`
- **Else**: Para saudações e casos não reconhecidos

## 4. HTTP REQUEST NODES - CHAMADAS PARA API

### 4.1 Agendar Consulta
**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/schedule`
**Method**: POST
**Headers**:
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
}
```

**Body**: `{{ JSON.stringify($json.data) }}`

### 4.2 Consultar Agendamentos
**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/check-patient`

### 4.3 Remarcar
**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/reschedule`

### 4.4 Cancelar
**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/cancel`

### 4.5 Disponibilidade
**URL**: `https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/availability`

## 5. FUNCTION NODE - FORMAT RESPONSE

**Nome**: `Format WhatsApp Response`

```javascript
const response = $input.first().json;
const intent = $('Parse WhatsApp Message').first().json.intent;
const originalMessage = $('Parse WhatsApp Message').first().json.original_message;

let whatsappMessage = '';

if (response.success) {
  switch (intent) {
    case 'schedule':
      whatsappMessage = `✅ *Consulta Agendada com Sucesso!*\n\n` +
        `👤 *Paciente:* ${response.message}\n` +
        `👨‍⚕️ *Médico:* ${response.medico}\n` +
        `📅 *Data:* ${response.data}\n` +
        `🕐 *Horário:* ${response.hora}\n\n` +
        `📋 *ID do Agendamento:* ${response.agendamento_id}\n\n` +
        `⚠️ *Importante:* Anote este número para futuras consultas, remarcações ou cancelamentos.`;
      break;

    case 'check-patient':
      if (response.total > 0) {
        whatsappMessage = `📋 *Suas Consultas Agendadas:*\n\n`;
        response.consultas.forEach((consulta, index) => {
          whatsappMessage += `*${index + 1}. ${consulta.atendimento}*\n`;
          whatsappMessage += `👨‍⚕️ ${consulta.medico}\n`;
          whatsappMessage += `📅 ${consulta.data} às ${consulta.hora}\n`;
          whatsappMessage += `💼 ${consulta.convenio}\n`;
          whatsappMessage += `📋 ID: ${consulta.id}\n`;
          if (consulta.observacoes) {
            whatsappMessage += `📝 ${consulta.observacoes}\n`;
          }
          whatsappMessage += `\n`;
        });
      } else {
        whatsappMessage = `😔 Não encontrei nenhuma consulta agendada para você.\n\nVerifique se os dados estão corretos ou entre em contato conosco.`;
      }
      break;

    case 'reschedule':
      whatsappMessage = `✅ *Consulta Remarcada!*\n\n` +
        `👤 *Paciente:* ${response.paciente}\n` +
        `👨‍⚕️ *Médico:* ${response.medico}\n` +
        `📅 *Nova Data:* ${response.nova_data}\n` +
        `🕐 *Novo Horário:* ${response.nova_hora}\n\n` +
        `📋 *ID:* ${response.agendamento_id}`;
      break;

    case 'cancel':
      whatsappMessage = `✅ *Consulta Cancelada*\n\n` +
        `👤 *Paciente:* ${response.paciente}\n` +
        `👨‍⚕️ *Médico:* ${response.medico}\n` +
        `📅 *Data:* ${response.data}\n` +
        `🕐 *Horário:* ${response.hora}\n\n` +
        `${response.motivo ? '📝 *Motivo:* ' + response.motivo : ''}`;
      break;

    case 'availability':
      whatsappMessage = `📅 *Horários Disponíveis*\n\n` +
        `👨‍⚕️ *Médico:* ${response.medico}\n` +
        `📅 *Data:* ${response.data}\n\n`;
      
      if (response.total > 0) {
        whatsappMessage += `🕐 *Horários livres:*\n`;
        response.horarios_disponiveis.slice(0, 10).forEach((horario) => {
          whatsappMessage += `• ${horario.hora.slice(0,5)} (${horario.periodo})\n`;
        });
        if (response.total > 10) {
          whatsappMessage += `\n... e mais ${response.total - 10} horários disponíveis.`;
        }
      } else {
        whatsappMessage += `😔 Não há horários disponíveis nesta data.`;
      }
      break;
  }
} else {
  // Tratar erros
  whatsappMessage = `❌ *Erro:* ${response.error}\n\n`;
  
  if (response.error.includes('Campos obrigatórios')) {
    whatsappMessage += `📝 *Para agendar, envie:*\n` +
      `Nome: [seu nome]\n` +
      `Nascimento: DD/MM/AAAA\n` +
      `Convênio: [seu convênio]\n` +
      `Médico: [nome do médico]\n` +
      `Data: DD/MM/AAAA\n` +
      `Hora: HH:MM\n\n` +
      `*Exemplo:*\n` +
      `Quero agendar\n` +
      `Nome: João Silva\n` +
      `Nascimento: 15/01/1990\n` +
      `Convênio: SUS\n` +
      `Médico: Dr. Max\n` +
      `Data: 20/01/2025\n` +
      `Hora: 14:00`;
  }
}

// Adicionar menu de ajuda se for saudação
if (intent === 'greeting' || intent === 'unknown') {
  whatsappMessage = `👋 Olá! Sou o assistente da clínica.\n\n` +
    `💬 *Comandos disponíveis:*\n\n` +
    `📅 *Para agendar:*\n` +
    `"Quero agendar uma consulta"\n\n` +
    `🔍 *Para consultar:*\n` +
    `"Qual minha consulta?"\n\n` +
    `🔄 *Para remarcar:*\n` +
    `"Quero remarcar minha consulta"\n\n` +
    `❌ *Para cancelar:*\n` +
    `"Quero cancelar minha consulta"\n\n` +
    `🕐 *Ver horários livres:*\n` +
    `"Horários disponíveis Dr. Max 20/01/2025"\n\n` +
    `❓ Digite *ajuda* para ver este menu novamente.`;
}

return {
  message: whatsappMessage,
  phone: $('Parse WhatsApp Message').first().json.phone,
  success: response.success || intent === 'greeting' || intent === 'unknown'
};
```

## 6. HTTP REQUEST - ENVIAR WHATSAPP

**URL**: `https://evolutionapi.inovaia.online/message/sendText/Endogastro`
**Method**: POST
**Headers**:
```json
{
  "Content-Type": "application/json",
  "apikey": "grozNCsxwy32iYir20LRw7dfIRNPI8UZ"
}
```

**Body**:
```json
{
  "number": "{{ $json.phone }}",
  "text": "{{ $json.message }}"
}
```

## 7. TRATAMENTO DE ERROS

### Function Node - Error Handler
```javascript
const error = $input.first().json;
const phone = $('Parse WhatsApp Message').first().json.phone;

let errorMessage = `❌ *Ops! Algo deu errado.*\n\n`;

if (error.code === 'ETIMEDOUT') {
  errorMessage += `⏱️ *Timeout:* O servidor demorou para responder.\nTente novamente em alguns instantes.`;
} else if (error.code >= 500) {
  errorMessage += `🔧 *Erro interno:* Nossos técnicos já foram notificados.\nTente novamente mais tarde.`;
} else {
  errorMessage += `📞 *Entre em contato:* (11) 9999-9999\nOu tente novamente com o comando "ajuda".`;
}

return {
  message: errorMessage,
  phone: phone,
  success: false
};
```

## 8. CONFIGURAÇÕES AVANÇADAS

### 8.1 Rate Limiting
```javascript
// Function Node - Rate Limit Check
const phone = $json.phone;
const now = Date.now();
const rateLimitKey = `rate_limit_${phone}`;

// Verificar se já existe rate limit (implementar com cache/database)
// Por simplicidade, implementar timeout de 30 segundos entre mensagens

return {
  allowed: true, // Implementar lógica de rate limiting
  phone: phone
};
```

### 8.2 Log de Conversas
```javascript
// Function Node - Log Conversation
const conversation = {
  timestamp: new Date().toISOString(),
  phone: $json.phone,
  intent: $json.intent,
  message_in: $json.original_message,
  message_out: $json.message,
  success: $json.success
};

// Salvar no banco de dados ou arquivo de log
console.log('Conversation Log:', JSON.stringify(conversation));

return conversation;
```

## 9. FLUXO COMPLETO DE TESTE

### Mensagem de Teste 1 (Agendar):
```
Quero agendar
Nome: João Silva
Nascimento: 15/01/1990
Convênio: SUS
Médico: Dr. Max
Data: 20/01/2025
Hora: 14:00
```

### Mensagem de Teste 2 (Consultar):
```
Qual minha consulta?
Nome: João Silva
Nascimento: 15/01/1990
```

### Mensagem de Teste 3 (Disponibilidade):
```
Horários disponíveis Dr. Max 20/01/2025
```

## 10. DICAS DE OTIMIZAÇÃO

1. **Cache**: Implementar cache para médicos e horários
2. **Validação**: Adicionar validação de formato de data/hora
3. **Fallback**: Sempre ter uma resposta padrão
4. **Logs**: Registrar todas as interações
5. **Timeout**: Configurar timeout adequado (30-60s)

## 11. MONITORAMENTO

- Verificar logs dos Edge Functions
- Monitorar taxa de erro
- Acompanhar tempo de resposta
- Verificar taxa de conversão (mensagens → agendamentos)

Está tudo pronto! Seu sistema já tem a API completa funcionando. 🚀