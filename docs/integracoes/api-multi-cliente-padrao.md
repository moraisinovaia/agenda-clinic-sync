# Padrão de API Multi-Cliente LLM Agent

## Arquitetura Centralizada

A partir da v3.1.0, o sistema utiliza uma **única API principal** (`llm-agent-api`) que atende todos os clientes dinamicamente, carregando configurações do banco de dados.

```
┌──────────────────────────────────────────────────────────┐
│                    N8N Workflows                         │
└────────────────────┬─────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐    ┌─────────────────────┐
│  llm-agent-api  │◄───│ llm-agent-api-venus │
│   (Principal)   │    │      (Proxy)        │
│                 │    │                     │
│ - Multi-cliente │    │ - Injeta cliente_id │
│ - Config banco  │    │ - Redireciona       │
│ - Cache 1min    │    └─────────────────────┘
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌───────┐
│ IPADO │  │ Vênus │  (+ outros clientes)
└───────┘  └───────┘
```

## Como Funciona

### 1. API Principal (`llm-agent-api`)

Aceita o parâmetro `cliente_id` no body da requisição:

```json
POST /llm-agent-api/availability
{
  "cliente_id": "20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a",
  "medico_nome": "Dr. João Silva",
  "data_consulta": "2025-01-20"
}
```

**Se `cliente_id` não for fornecido**, usa IPADO como fallback (compatibilidade retroativa).

### 2. APIs Proxy (ex: `llm-agent-api-venus`)

São thin proxies que:
1. Recebem a requisição
2. Injetam o `cliente_id` específico da clínica
3. Redirecionam para a API principal

```typescript
// Exemplo: llm-agent-api-venus injeta:
const enrichedBody = {
  ...body,
  cliente_id: '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a' // Clínica Vênus
};
```

## Configuração no Banco de Dados

### Tabelas Necessárias

| Tabela | Descrição |
|--------|-----------|
| `llm_clinic_config` | Configuração da clínica (telefone, dias de busca, etc) |
| `business_rules` | Regras por médico (serviços, períodos, limites) |
| `llm_mensagens` | Mensagens personalizadas |

### Exemplo: Configurar Nova Clínica

```sql
-- 1. Criar registro em llm_clinic_config
INSERT INTO llm_clinic_config (
  cliente_id, nome_clinica, telefone, whatsapp, endereco,
  dias_busca_inicial, dias_busca_expandida, data_minima_agendamento
) VALUES (
  'uuid-da-clinica',
  'Nome da Clínica',
  '(11) 1234-5678',
  '(11) 98765-4321',
  'Endereço completo',
  14, 45, '2025-01-01'
);

-- 2. Criar business_rules para cada médico
INSERT INTO business_rules (cliente_id, medico_id, config, ativo)
VALUES (
  'uuid-da-clinica',
  'uuid-do-medico',
  '{
    "nome": "Dr. Nome",
    "especialidade": "Especialidade",
    "tipo_agendamento": "hora_marcada",
    "servicos": {
      "Consulta": {
        "permite_online": true,
        "tipo": "hora_marcada",
        "dias_semana": [1, 3, 5],
        "periodos": {
          "manha": { "inicio": "08:00", "fim": "12:00", "limite": 6, "intervalo_minutos": 30 }
        },
        "valor": 200.00,
        "convenios_aceitos": ["PARTICULAR", "UNIMED"]
      }
    }
  }'::jsonb,
  true
);
```

## Onboarding de Novo Cliente

### Opção A: Usar API Principal Diretamente

Configure o N8N para enviar `cliente_id` em todas as requisições:

```
URL: https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api/availability

Body:
{
  "cliente_id": "uuid-do-cliente",
  "medico_nome": "...",
  ...
}
```

### Opção B: Criar API Proxy (Recomendado para Isolamento)

Criar uma edge function proxy minimalista:

```typescript
// supabase/functions/llm-agent-api-{cliente}/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CLIENTE_ID = 'uuid-do-cliente';
const MAIN_API = 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();
  const body = await req.json();
  
  const response = await fetch(`${MAIN_API}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, cliente_id: CLIENTE_ID })
  });
  
  return new Response(await response.text(), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

## Endpoints Disponíveis

| Endpoint | Descrição |
|----------|-----------|
| `/availability` | Verificar disponibilidade |
| `/schedule` | Agendar consulta |
| `/check-patient` | Consultar agendamentos do paciente |
| `/reschedule` | Remarcar consulta |
| `/cancel` | Cancelar consulta |
| `/confirm` | Confirmar consulta |
| `/patient-search` | Buscar pacientes |
| `/list-appointments` | Listar agendamentos |
| `/list-doctors` | Listar médicos da clínica |
| `/clinic-info` | Informações da clínica |

## Cache e Performance

- **TTL do Cache**: 1 minuto
- Configurações são cacheadas por `cliente_id`
- Alterações no admin panel aplicam em até 60 segundos

## Vantagens da Arquitetura

1. **Manutenção Centralizada**: Correções e melhorias beneficiam todos os clientes
2. **Onboarding Rápido**: Novo cliente = apenas configuração no banco
3. **Escalabilidade**: Edge Functions escalam automaticamente
4. **Isolamento de Dados**: RLS + cliente_id garantem separação

## Clientes Configurados

| Cliente | ID | Status |
|---------|-----|--------|
| IPADO | `2bfb98b5-ae41-4f96-8ba7-acc797c22054` | ✅ Ativo (Principal) |
| Clínica Vênus | `20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a` | ✅ Ativo |
| ENDOGASTRO | `39e120b4-5fb7-4d6f-9f91-a598a5bbd253` | ✅ Ativo |
