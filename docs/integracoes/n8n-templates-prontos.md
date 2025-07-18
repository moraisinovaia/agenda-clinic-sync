# N8N Templates Prontos para Uso

## 1. Template Completo: WhatsApp Agendamento

### Importar no N8N
```json
{
  "name": "WhatsApp Agendamento Endogastro",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "whatsapp-agendamento",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "webhook-whatsapp",
      "name": "Webhook WhatsApp",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "functionCode": "const body = $input.all()[0].json.body;\nconst message = body.message.toLowerCase();\nconst from = body.from;\n\n// Patterns para extração\nconst patterns = {\n  nome: /nome:\\s*(.+?)(?:\\n|$)/i,\n  nascimento: /nascimento:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i,\n  convenio: /convenio:\\s*(.+?)(?:\\n|$)/i,\n  data: /data:\\s*(\\d{2}\\/\\d{2}\\/\\d{4})/i,\n  hora: /hora:\\s*(\\d{2}:\\d{2})/i,\n  medico: /medico:\\s*(.+?)(?:\\n|$)/i\n};\n\n// Extrair informações\nconst extracted = {};\nfor (const [key, pattern] of Object.entries(patterns)) {\n  const match = message.match(pattern);\n  extracted[key] = match ? match[1].trim() : null;\n}\n\n// Validar campos obrigatórios\nconst required = ['nome', 'nascimento', 'data', 'hora'];\nconst missing = required.filter(field => !extracted[field]);\n\nif (missing.length > 0) {\n  return {\n    error: true,\n    message: `❌ Campos obrigatórios faltando: ${missing.join(', ')}\\n\\n📝 Formato correto:\\nNome: João Silva\\nNascimento: 15/01/1990\\nConvenio: SUS\\nData: 20/01/2025\\nHora: 14:00\\nMedico: Dr. João`\n  };\n}\n\n// Converter datas\nif (extracted.nascimento) {\n  const [dia, mes, ano] = extracted.nascimento.split('/');\n  extracted.data_nascimento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;\n}\n\nif (extracted.data) {\n  const [dia, mes, ano] = extracted.data.split('/');\n  extracted.data_agendamento = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;\n}\n\nreturn {\n  nome_completo: extracted.nome,\n  data_nascimento: extracted.data_nascimento,\n  convenio: extracted.convenio || 'SUS',\n  celular: from,\n  telefone: from,\n  data_agendamento: extracted.data_agendamento,\n  hora_agendamento: extracted.hora,\n  medico_nome: extracted.medico,\n  observacoes: `Agendado via WhatsApp - ${new Date().toISOString()}`\n};"
      },
      "id": "parse-message",
      "name": "Parse WhatsApp Message",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [460, 300]
    },
    {
      "parameters": {
        "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "id": "get-doctors",
      "name": "Get Doctors",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [680, 300],
      "credentials": {
        "httpHeaderAuth": {
          "id": "supabase-auth",
          "name": "Supabase Auth"
        }
      }
    },
    {
      "parameters": {
        "functionCode": "const parseData = $input.all()[0].json;\nconst apiData = $input.all()[1].json;\n\nif (parseData.error) {\n  return parseData;\n}\n\n// Encontrar médico\nconst doctorName = parseData.medico_nome;\nconst doctors = apiData.medicos || [];\n\nconst doctor = doctors.find(d => \n  d.nome.toLowerCase().includes(doctorName.toLowerCase()) ||\n  doctorName.toLowerCase().includes(d.nome.toLowerCase().split(' ')[0])\n);\n\nif (!doctor) {\n  return {\n    error: true,\n    message: `❌ Médico \"${doctorName}\" não encontrado\\n\\n👨‍⚕️ Médicos disponíveis:\\n${doctors.map(d => `• ${d.nome}`).join('\\n')}`\n  };\n}\n\n// Buscar atendimento padrão (consulta)\nconst atendimentos = apiData.atendimentos || [];\nconst atendimento = atendimentos.find(a => \n  a.nome.toLowerCase().includes('consulta') ||\n  a.tipo === 'consulta'\n) || atendimentos[0];\n\nif (!atendimento) {\n  return {\n    error: true,\n    message: '❌ Nenhum tipo de atendimento disponível'\n  };\n}\n\nreturn {\n  ...parseData,\n  medico_id: doctor.id,\n  atendimento_id: atendimento.id,\n  medico_encontrado: doctor.nome,\n  atendimento_nome: atendimento.nome\n};"
      },
      "id": "process-data",
      "name": "Process Data",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [900, 300]
    },
    {
      "parameters": {
        "url": "https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api",
        "method": "POST",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json }}",
        "options": {}
      },
      "id": "create-appointment",
      "name": "Create Appointment",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1120, 300],
      "credentials": {
        "httpHeaderAuth": {
          "id": "supabase-auth",
          "name": "Supabase Auth"
        }
      }
    },
    {
      "parameters": {
        "functionCode": "const processData = $input.all()[0].json;\nconst apiResult = $input.all()[1].json;\n\nlet responseMessage;\nlet responseData = {\n  phone: processData.celular\n};\n\nif (processData.error) {\n  responseMessage = processData.message;\n} else if (apiResult.success) {\n  responseMessage = `✅ *Agendamento Confirmado!*\\n\\n👤 *Paciente:* ${processData.nome_completo}\\n👨‍⚕️ *Médico:* ${processData.medico_encontrado}\\n🩺 *Atendimento:* ${processData.atendimento_nome}\\n📅 *Data:* ${processData.data_agendamento}\\n🕐 *Hora:* ${processData.hora_agendamento}\\n🏥 *Convênio:* ${processData.convenio}\\n\\n📋 *ID:* ${apiResult.agendamento_id}\\n\\n⚠️ *Importante:* Chegue 15 min antes.`;\n} else {\n  // Mapear erros para mensagens amigáveis\n  const errorMappings = {\n    'horário já está ocupado': '⏰ Este horário não está mais disponível. Escolha outro horário.',\n    'Médico não está ativo': '👨‍⚕️ Este médico não está disponível no momento.',\n    'idade mínima': '👶 Este médico não atende pacientes desta faixa etária.',\n    'idade máxima': '👴 Este médico não atende pacientes desta faixa etária.',\n    'Convênio': '🏥 Este médico não aceita o convênio informado.',\n    'agenda está bloqueada': '🚫 A agenda está bloqueada nesta data.',\n    'data/hora que já passou': '⏰ Não é possível agendar no passado.'\n  };\n  \n  let friendlyError = apiResult.error;\n  for (const [key, value] of Object.entries(errorMappings)) {\n    if (apiResult.error.includes(key)) {\n      friendlyError = value;\n      break;\n    }\n  }\n  \n  responseMessage = `❌ *Erro no Agendamento*\\n\\n${friendlyError}\\n\\n💡 *Dica:* Verifique os dados e tente novamente.`;\n}\n\nreturn {\n  ...responseData,\n  message: responseMessage\n};"
      },
      "id": "format-response",
      "name": "Format Response",
      "type": "n8n-nodes-base.function",
      "typeVersion": 1,
      "position": [1340, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}"
      },
      "id": "response",
      "name": "Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1560, 300]
    }
  ],
  "connections": {
    "Webhook WhatsApp": {
      "main": [
        [
          {
            "node": "Parse WhatsApp Message",
            "type": "main",
            "index": 0
          },
          {
            "node": "Get Doctors",
            "type": "main", 
            "index": 0
          }
        ]
      ]
    },
    "Parse WhatsApp Message": {
      "main": [
        [
          {
            "node": "Process Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Get Doctors": {
      "main": [
        [
          {
            "node": "Process Data",
            "type": "main",
            "index": 1
          }
        ]
      ]
    },
    "Process Data": {
      "main": [
        [
          {
            "node": "Create Appointment",
            "type": "main",
            "index": 0
          },
          {
            "node": "Format Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create Appointment": {
      "main": [
        [
          {
            "node": "Format Response",
            "type": "main",
            "index": 1
          }
        ]
      ]
    },
    "Format Response": {
      "main": [
        [
          {
            "node": "Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## 2. Template: Consulta de Disponibilidade

### Workflow JSON
```json
{
  "name": "Consulta Disponibilidade",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "consulta-disponibilidade",
        "responseMode": "responseNode"
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "position": [240, 300]
    },
    {
      "parameters": {
        "functionCode": "const message = $input.all()[0].json.body.message.toLowerCase();\nconst from = $input.all()[0].json.body.from;\n\n// Formatos aceitos:\n// \"disponibilidade Dr João 20/01/2025\"\n// \"horarios livres Maria 20/01/2025\"\n// \"agenda Dr Silva 20/01/2025\"\n\nconst patterns = [\n  /(?:disponibilidade|horarios?|agenda)\\s+(?:dr\\.?\\s+|dra\\.?\\s+)?(.+?)\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})/i,\n  /(?:disponibilidade|horarios?|agenda)\\s+(\\d{1,2}\\/\\d{1,2}\\/\\d{4})\\s+(?:dr\\.?\\s+|dra\\.?\\s+)?(.+)/i\n];\n\nlet medico, dataStr;\n\nfor (const pattern of patterns) {\n  const match = message.match(pattern);\n  if (match) {\n    if (match[2] && match[2].includes('/')) {\n      medico = match[1].trim();\n      dataStr = match[2];\n    } else {\n      dataStr = match[1];\n      medico = match[2].trim();\n    }\n    break;\n  }\n}\n\nif (!medico || !dataStr) {\n  return {\n    error: true,\n    message: `❌ Formato inválido\\n\\n📝 Use:\\n• \"disponibilidade Dr João 20/01/2025\"\\n• \"horarios Dr Silva 25/01/2025\"\\n• \"agenda Dra Maria 30/01/2025\"`\n  };\n}\n\n// Converter data\nconst [dia, mes, ano] = dataStr.split('/');\nconst data = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;\n\nreturn {\n  medico_nome: medico,\n  data: data,\n  data_formatada: dataStr,\n  phone: from\n};"
      },
      "name": "Parse Request",
      "type": "n8n-nodes-base.function",
      "position": [460, 300]
    },
    {
      "parameters": {
        "url": "=https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api/availability?date={{ $json.data }}&days=1",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth"
      },
      "name": "Check Availability",
      "type": "n8n-nodes-base.httpRequest",
      "position": [680, 300]
    },
    {
      "parameters": {
        "functionCode": "const requestData = $input.all()[0].json;\nconst availability = $input.all()[1].json;\n\nif (requestData.error) {\n  return requestData;\n}\n\nif (!availability.doctors || availability.doctors.length === 0) {\n  return {\n    message: `❌ Nenhum médico encontrado para ${requestData.data_formatada}`,\n    phone: requestData.phone\n  };\n}\n\n// Filtrar médico específico se solicitado\nlet filteredDoctors = availability.doctors;\nif (requestData.medico_nome) {\n  filteredDoctors = availability.doctors.filter(doctor =>\n    doctor.nome.toLowerCase().includes(requestData.medico_nome.toLowerCase()) ||\n    requestData.medico_nome.toLowerCase().includes(doctor.nome.toLowerCase().split(' ')[0])\n  );\n}\n\nif (filteredDoctors.length === 0) {\n  return {\n    message: `❌ Médico \"${requestData.medico_nome}\" não encontrado para ${requestData.data_formatada}\\n\\n👨‍⚕️ Médicos disponíveis:\\n${availability.doctors.map(d => `• ${d.nome}`).join('\\n')}`,\n    phone: requestData.phone\n  };\n}\n\nlet responseMessage = `📅 *Disponibilidade ${requestData.data_formatada}*\\n\\n`;\n\nfilteredDoctors.forEach(doctor => {\n  responseMessage += `👨‍⚕️ *${doctor.nome}*\\n`;\n  responseMessage += `🩺 ${doctor.especialidade || 'Especialidade não informada'}\\n`;\n  \n  if (doctor.available_slots && doctor.available_slots.length > 0) {\n    responseMessage += `✅ *Horários Livres:*\\n`;\n    doctor.available_slots.forEach(slot => {\n      responseMessage += `   • ${slot}\\n`;\n    });\n  } else {\n    responseMessage += `❌ Sem horários disponíveis\\n`;\n  }\n  responseMessage += `\\n`;\n});\n\nresponseMessage += `📞 Para agendar, envie:\\n*Nome: [seu nome]*\\n*Nascimento: DD/MM/AAAA*\\n*Data: ${requestData.data_formatada}*\\n*Hora: [horário escolhido]*\\n*Medico: [nome do médico]*`;\n\nreturn {\n  message: responseMessage,\n  phone: requestData.phone\n};"
      },
      "name": "Format Response",
      "type": "n8n-nodes-base.function",
      "position": [900, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}"
      },
      "name": "Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "position": [1120, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Parse Request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse Request": {
      "main": [
        [
          {
            "node": "Check Availability",
            "type": "main",
            "index": 0
          },
          {
            "node": "Format Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Check Availability": {
      "main": [
        [
          {
            "node": "Format Response",
            "type": "main",
            "index": 1
          }
        ]
      ]
    },
    "Format Response": {
      "main": [
        [
          {
            "node": "Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## 3. Credenciais Supabase para N8N

### Configurar HTTP Header Auth
```json
{
  "name": "Supabase Auth",
  "type": "httpHeaderAuth",
  "data": {
    "name": "Authorization",
    "value": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8"
  }
}
```

## 4. Template: Cancelamento com Fila

### Workflow JSON Simplificado
```json
{
  "name": "Cancelamento",
  "nodes": [
    {
      "parameters": {
        "functionCode": "const message = $input.all()[0].json.body.message;\nconst cancelMatch = message.match(/cancelar\\s+(\\w+)/i);\n\nif (!cancelMatch) {\n  return {\n    error: true,\n    message: '❌ Formato: \"cancelar [ID_AGENDAMENTO]\"'\n  };\n}\n\nreturn {\n  agendamento_id: cancelMatch[1],\n  phone: $input.all()[0].json.body.from\n};"
      },
      "name": "Parse Cancel",
      "type": "n8n-nodes-base.function"
    },
    {
      "parameters": {
        "url": "=https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api/{{ $json.agendamento_id }}/status",
        "method": "PATCH",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "{\"status\": \"cancelado\"}"
      },
      "name": "Cancel Appointment",
      "type": "n8n-nodes-base.httpRequest"
    }
  ]
}
```

## 5. Configuração de Ambiente

### Variáveis de Ambiente N8N
```bash
# .env do N8N
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=sua_senha_segura

# URLs
WEBHOOK_URL=https://seu-n8n.com/webhook
SUPABASE_URL=https://qxlvzbvzajibdtlzngdy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MDg5MzMsImV4cCI6MjA2NjA4NDkzM30.iLhYwcxvF-2wBe3uWllrxMItGpQ09OA8c8_7VMlRDw8
```

## 6. Quick Start Guide

### Passos para Implementação
1. **Importar Template**
   - Copiar JSON do template
   - Importar no N8N (Settings > Import from URL/File)

2. **Configurar Credenciais**
   - Criar HTTP Header Auth
   - Adicionar token Supabase

3. **Testar Webhook**
   - Ativar workflow
   - Testar com dados de exemplo
   - Verificar logs

4. **Integrar com WhatsApp**
   - Configurar webhook URL no WhatsApp Business
   - Mapear números/grupos
   - Testar fluxo completo

### Exemplo de Teste via cURL
```bash
# Testar agendamento
curl -X POST https://seu-n8n.com/webhook/whatsapp-agendamento \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "message": "Nome: João Silva\nNascimento: 15/01/1990\nConvenio: SUS\nData: 25/01/2025\nHora: 14:00\nMedico: Dr. João",
      "from": "5511999999999"
    }
  }'

# Testar disponibilidade  
curl -X POST https://seu-n8n.com/webhook/consulta-disponibilidade \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "message": "disponibilidade Dr João 25/01/2025",
      "from": "5511999999999"
    }
  }'
```

## 7. Monitoramento de Workflows

### Template de Health Check
```json
{
  "name": "Health Check",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{"field": "minute", "value": 5}]
        }
      },
      "name": "Schedule",
      "type": "n8n-nodes-base.scheduleTrigger"
    },
    {
      "parameters": {
        "functionCode": "const checks = [\n  'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api',\n  'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/scheduling-api/availability?date=2025-12-31'\n];\n\nconst results = [];\n\nfor (const url of checks) {\n  try {\n    const start = Date.now();\n    const response = await fetch(url);\n    const duration = Date.now() - start;\n    \n    results.push({\n      url,\n      status: response.ok ? 'OK' : 'FAIL',\n      duration: duration + 'ms',\n      httpStatus: response.status\n    });\n  } catch (error) {\n    results.push({\n      url,\n      status: 'ERROR',\n      error: error.message\n    });\n  }\n}\n\nreturn { checks: results, timestamp: new Date().toISOString() };"
      },
      "name": "Run Health Checks",
      "type": "n8n-nodes-base.function"
    }
  ]
}
```