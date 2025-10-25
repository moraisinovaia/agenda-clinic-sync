# Sistema de Confirmação Automática de Agendamentos

Sistema completo para confirmação automática de agendamentos via WhatsApp utilizando N8N e LLM Agent API.

## 📋 Visão Geral

O sistema envia lembretes automáticos para pacientes em 3 momentos:
- **D-5**: 5 dias antes do agendamento (09:00)
- **D-3**: 3 dias antes do agendamento (14:00)
- **D-0**: No dia do agendamento (07:00)

Os pacientes podem responder confirmando ou cancelando o agendamento diretamente pelo WhatsApp.

## 🔧 API - Endpoint de Confirmação

### POST `/llm-agent-api/confirm`

Confirma um agendamento existente.

**Request Body:**
```json
{
  "agendamento_id": "uuid-do-agendamento",
  "observacoes": "Confirmado via WhatsApp automático",
  "confirmado_por": "Sistema Automático"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Consulta confirmada com sucesso! ✅",
  "agendamento_id": "uuid",
  "paciente": "NOME DO PACIENTE",
  "celular": "5511999999999",
  "medico": "Dr. Nome",
  "data": "2025-01-15",
  "hora": "14:00:00",
  "confirmado_em": "2025-01-10T10:30:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Mensagem de erro detalhada"
}
```

## 📊 Tabela de Auditoria

A tabela `confirmacoes_automaticas` registra todas as interações:

```sql
CREATE TABLE confirmacoes_automaticas (
  id UUID PRIMARY KEY,
  agendamento_id UUID REFERENCES agendamentos(id),
  cliente_id UUID REFERENCES clientes(id),
  tipo_notificacao TEXT CHECK (tipo_notificacao IN ('D-5', 'D-3', 'D-0', 'LEMBRETE')),
  data_envio TIMESTAMP,
  mensagem_enviada TEXT,
  resposta_paciente TEXT,
  resposta_recebida_em TIMESTAMP,
  acao_tomada TEXT CHECK (acao_tomada IN ('confirmado', 'cancelado', 'sem_resposta', 'aguardando')),
  processado_em TIMESTAMP,
  tentativas INTEGER DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## 🔄 Workflow N8N Completo

### Estrutura do Workflow

```
Schedule Trigger (3x) → Buscar Agendamentos → Loop → Enviar WhatsApp → Registrar Auditoria
                                                          ↓
                                              Webhook Resposta → Processar Resposta → 
                                                                  ↓                      ↓
                                                            Confirmar API        Cancelar API
                                                                  ↓                      ↓
                                                       Atualizar Auditoria    Notificar Fila
```

### JSON do Workflow N8N

```json
{
  "name": "Confirmação Automática de Agendamentos",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 9 * * *"
            }
          ]
        }
      },
      "name": "Schedule D-5 (09:00)",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 200],
      "typeVersion": 1.2
    },
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 14 * * *"
            }
          ]
        }
      },
      "name": "Schedule D-3 (14:00)",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 400],
      "typeVersion": 1.2
    },
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "cronExpression",
              "expression": "0 7 * * *"
            }
          ]
        }
      },
      "name": "Schedule D-0 (07:00)",
      "type": "n8n-nodes-base.scheduleTrigger",
      "position": [250, 600],
      "typeVersion": 1.2
    },
    {
      "parameters": {
        "jsCode": "const tipo = $input.all()[0].json.tipo || 'D-5';\nconst diasAdicionar = tipo === 'D-5' ? 5 : tipo === 'D-3' ? 3 : 0;\n\nconst dataAlvo = new Date();\ndataAlvo.setDate(dataAlvo.getDate() + diasAdicionar);\n\nconst dataFormatada = dataAlvo.toISOString().split('T')[0];\n\nreturn {\n  data_alvo: dataFormatada,\n  tipo_notificacao: tipo\n};"
      },
      "name": "Calcular Data Alvo",
      "type": "n8n-nodes-base.code",
      "position": [450, 400],
      "typeVersion": 2
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/functions/v1/scheduling-api",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "status",
              "value": "agendado"
            },
            {
              "name": "data_agendamento",
              "value": "={{$json.data_alvo}}"
            }
          ]
        },
        "options": {}
      },
      "name": "Buscar Agendamentos",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 400],
      "typeVersion": 4.2
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "name": "Loop Agendamentos",
      "type": "n8n-nodes-base.splitInBatches",
      "position": [850, 400],
      "typeVersion": 3
    },
    {
      "parameters": {
        "url": "={{$env.EVOLUTION_API_URL}}/message/sendText/{{$env.EVOLUTION_INSTANCE}}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "number",
              "value": "={{$json.pacientes.celular}}"
            },
            {
              "name": "text",
              "value": "Olá {{$json.pacientes.nome_completo}}! 👋\\n\\n📅 *Lembrete de Consulta*\\n\\n📍 Data: {{$json.data_agendamento}}\\n⏰ Horário: {{$json.hora_agendamento}}\\n👨‍⚕️ Médico: {{$json.medicos.nome}}\\n🏥 Tipo: {{$json.atendimentos.nome}}\\n\\nPor favor, responda:\\n✅ *CONFIRMAR* - Para confirmar sua presença\\n❌ *CANCELAR* - Se precisar desmarcar\\n\\nAguardamos sua confirmação! 😊"
            }
          ]
        },
        "options": {}
      },
      "name": "Enviar WhatsApp",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1050, 400],
      "typeVersion": 4.2
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/rest/v1/confirmacoes_automaticas",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "agendamento_id",
              "value": "={{$json.id}}"
            },
            {
              "name": "cliente_id",
              "value": "={{$json.cliente_id}}"
            },
            {
              "name": "tipo_notificacao",
              "value": "={{$node['Calcular Data Alvo'].json.tipo_notificacao}}"
            },
            {
              "name": "mensagem_enviada",
              "value": "={{$json.text}}"
            },
            {
              "name": "acao_tomada",
              "value": "aguardando"
            }
          ]
        },
        "options": {}
      },
      "name": "Registrar Auditoria",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1250, 400],
      "typeVersion": 4.2
    },
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "confirmacao-resposta",
        "responseMode": "lastNode",
        "options": {}
      },
      "name": "Webhook Resposta WhatsApp",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 800],
      "typeVersion": 2,
      "webhookId": "confirmacao-whatsapp"
    },
    {
      "parameters": {
        "jsCode": "const message = $json.message?.toLowerCase() || '';\nconst agendamentoId = $json.agendamento_id;\n\nlet acao = 'sem_resposta';\n\nif (message.includes('confirmar') || message.includes('sim') || message.includes('ok') || message === '1') {\n  acao = 'confirmar';\n} else if (message.includes('cancelar') || message.includes('não') || message.includes('nao') || message === '2') {\n  acao = 'cancelar';\n}\n\nreturn {\n  agendamento_id: agendamentoId,\n  acao: acao,\n  resposta_original: message\n};"
      },
      "name": "Processar Resposta",
      "type": "n8n-nodes-base.code",
      "position": [450, 800],
      "typeVersion": 2
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "leftValue": "",
            "caseSensitive": true,
            "typeValidation": "strict"
          },
          "combinator": "and",
          "conditions": [
            {
              "id": "1",
              "operator": {
                "type": "string",
                "operation": "equals"
              },
              "leftValue": "={{$json.acao}}",
              "rightValue": "confirmar"
            }
          ]
        },
        "options": {}
      },
      "name": "Switch Ação",
      "type": "n8n-nodes-base.switch",
      "position": [650, 800],
      "typeVersion": 3
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/functions/v1/llm-agent-api/confirm",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "agendamento_id",
              "value": "={{$json.agendamento_id}}"
            },
            {
              "name": "observacoes",
              "value": "Confirmado via WhatsApp automático"
            },
            {
              "name": "confirmado_por",
              "value": "Sistema Automático"
            }
          ]
        },
        "options": {}
      },
      "name": "Confirmar Agendamento",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 700],
      "typeVersion": 4.2
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/functions/v1/llm-agent-api/cancel",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "agendamento_id",
              "value": "={{$json.agendamento_id}}"
            },
            {
              "name": "motivo",
              "value": "Cancelado pelo paciente via WhatsApp"
            }
          ]
        },
        "options": {}
      },
      "name": "Cancelar Agendamento",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 900],
      "typeVersion": 4.2
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/rest/v1/confirmacoes_automaticas",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendQuery": true,
        "queryParameters": {
          "parameters": [
            {
              "name": "agendamento_id",
              "value": "eq.{{$json.agendamento_id}}"
            },
            {
              "name": "order",
              "value": "created_at.desc"
            },
            {
              "name": "limit",
              "value": "1"
            }
          ]
        },
        "options": {
          "response": {
            "response": {
              "responseFormat": "json"
            }
          }
        }
      },
      "name": "Buscar Registro Auditoria",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1050, 800],
      "typeVersion": 4.2
    },
    {
      "parameters": {
        "url": "={{$env.SUPABASE_URL}}/rest/v1/confirmacoes_automaticas?id=eq.{{$json[0].id}}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "method": "PATCH",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "resposta_paciente",
              "value": "={{$node['Processar Resposta'].json.resposta_original}}"
            },
            {
              "name": "resposta_recebida_em",
              "value": "={{new Date().toISOString()}}"
            },
            {
              "name": "acao_tomada",
              "value": "={{$node['Processar Resposta'].json.acao}}"
            },
            {
              "name": "processado_em",
              "value": "={{new Date().toISOString()}}"
            }
          ]
        },
        "options": {}
      },
      "name": "Atualizar Auditoria",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1250, 800],
      "typeVersion": 4.2
    }
  ],
  "connections": {
    "Schedule D-5 (09:00)": {
      "main": [
        [
          {
            "node": "Calcular Data Alvo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Schedule D-3 (14:00)": {
      "main": [
        [
          {
            "node": "Calcular Data Alvo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Schedule D-0 (07:00)": {
      "main": [
        [
          {
            "node": "Calcular Data Alvo",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Calcular Data Alvo": {
      "main": [
        [
          {
            "node": "Buscar Agendamentos",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Buscar Agendamentos": {
      "main": [
        [
          {
            "node": "Loop Agendamentos",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Loop Agendamentos": {
      "main": [
        [
          {
            "node": "Enviar WhatsApp",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Enviar WhatsApp": {
      "main": [
        [
          {
            "node": "Registrar Auditoria",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Webhook Resposta WhatsApp": {
      "main": [
        [
          {
            "node": "Processar Resposta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Processar Resposta": {
      "main": [
        [
          {
            "node": "Switch Ação",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Switch Ação": {
      "main": [
        [
          {
            "node": "Confirmar Agendamento",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Cancelar Agendamento",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Confirmar Agendamento": {
      "main": [
        [
          {
            "node": "Buscar Registro Auditoria",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Cancelar Agendamento": {
      "main": [
        [
          {
            "node": "Buscar Registro Auditoria",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Buscar Registro Auditoria": {
      "main": [
        [
          {
            "node": "Atualizar Auditoria",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {}
}
```

## 🚀 Configuração no N8N

### 1. Variáveis de Ambiente

Configure no N8N:
```
SUPABASE_URL=https://qxlvzbvzajibdtlzngdy.supabase.co
EVOLUTION_API_URL=https://seu-evolution-api.com
EVOLUTION_INSTANCE=sua-instancia
```

### 2. Credenciais HTTP

Configure 2 credenciais:

**Supabase API:**
- Type: Header Auth
- Name: `Authorization`
- Value: `Bearer YOUR_SUPABASE_SERVICE_KEY`

**Evolution API:**
- Type: Header Auth
- Name: `apikey`
- Value: `YOUR_EVOLUTION_API_KEY`

### 3. Webhook Evolution API

Configure o webhook no Evolution API para enviar respostas para:
```
https://seu-n8n.com/webhook/confirmacao-resposta
```

## 📱 Mensagens WhatsApp

### Template D-5 (5 dias antes)
```
Olá [NOME]! 👋

📅 Lembrete de Consulta

📍 Data: [DATA]
⏰ Horário: [HORA]
👨‍⚕️ Médico: [MEDICO]
🏥 Tipo: [ATENDIMENTO]

Por favor, responda:
✅ CONFIRMAR - Para confirmar sua presença
❌ CANCELAR - Se precisar desmarcar

Aguardamos sua confirmação! 😊
```

### Respostas Automáticas

**Após Confirmação:**
```
✅ Consulta confirmada com sucesso!

Você receberá novos lembretes mais próximo da data.
Até lá! 👋
```

**Após Cancelamento:**
```
❌ Consulta cancelada.

Se desejar remarcar, entre em contato conosco.
Obrigado! 📞
```

## 📊 Monitoramento

### Consultar Confirmações

```sql
-- Estatísticas de confirmação
SELECT 
  tipo_notificacao,
  acao_tomada,
  COUNT(*) as total
FROM confirmacoes_automaticas
WHERE data_envio >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tipo_notificacao, acao_tomada
ORDER BY tipo_notificacao, acao_tomada;

-- Taxa de resposta
SELECT 
  tipo_notificacao,
  COUNT(*) as total_enviados,
  SUM(CASE WHEN acao_tomada IN ('confirmado', 'cancelado') THEN 1 ELSE 0 END) as total_respondidos,
  ROUND(
    100.0 * SUM(CASE WHEN acao_tomada IN ('confirmado', 'cancelado') THEN 1 ELSE 0 END) / COUNT(*),
    2
  ) as taxa_resposta_pct
FROM confirmacoes_automaticas
WHERE data_envio >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tipo_notificacao;
```

## 🔧 Troubleshooting

### Webhook não está recebendo respostas

1. Verifique logs do Evolution API
2. Confirme URL do webhook está correta
3. Teste manualmente com curl:
```bash
curl -X POST https://seu-n8n.com/webhook/confirmacao-resposta \
  -H "Content-Type: application/json" \
  -d '{"agendamento_id":"uuid","message":"confirmar"}'
```

### Confirmações não estão sendo salvas

1. Verifique permissões RLS na tabela `confirmacoes_automaticas`
2. Confirme que `cliente_id` está sendo enviado corretamente
3. Verifique logs do Edge Function

### Horários incorretos

1. Ajuste timezone nos cron jobs do N8N
2. Verifique se o servidor N8N está no timezone correto
3. Use `TZ=America/Sao_Paulo` nas configurações

## 📈 Melhorias Futuras

- [ ] Integração com LLM para interpretar respostas ambíguas
- [ ] Notificação automática da fila de espera quando há cancelamento
- [ ] Dashboard de analytics de confirmações
- [ ] Lembretes personalizados por tipo de exame
- [ ] Integração com calendário (iCal/Google Calendar)

## 🎯 KPIs Importantes

- **Taxa de Confirmação**: % de pacientes que confirmam
- **Taxa de Cancelamento**: % de pacientes que cancelam
- **Taxa de Não-Resposta**: % de pacientes que não respondem
- **Tempo Médio de Resposta**: Quanto tempo leva para responder
- **Taxa de No-Show**: Comparar com/sem confirmação automática
