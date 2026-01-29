
# Plano: Criar LLM Dedicado para Dr. Marcelo D'Carli

## Resumo
Criar uma configuração LLM separada para o Dr. Marcelo D'Carli que:
- Usa os **mesmos dados de agendamentos/pacientes** do IPADO (mesmo `cliente_id`)
- Tem **informações próprias**: telefone, horários, limites e mensagens personalizadas
- É **editável pelo painel administrativo**
- Funciona via **endpoint dedicado** para o fluxo N8N/WhatsApp

## Arquitetura

```text
┌─────────────────────────────────────────────────────────────┐
│                     N8N WhatsApp Flow                       │
│                  (WhatsApp Dr. Marcelo)                     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│            llm-agent-api-marcelo (Proxy)                    │
│  - Injeta config_id: "uuid-config-marcelo"                  │
│  - Injeta cliente_id: IPADO (para acessar mesmos dados)     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               llm-agent-api (Principal)                     │
│  - Carrega config específica pelo config_id                 │
│  - Usa business_rules vinculadas ao config_id               │
│  - Usa llm_mensagens vinculadas ao config_id                │
└─────────────────────────┬───────────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
    ┌───────────────┐           ┌───────────────┐
    │ llm_clinic_   │           │ business_     │
    │ config        │           │ rules         │
    │ (Dr. Marcelo) │           │ (Dr. Marcelo) │
    │               │           │               │
    │ - Telefone    │           │ - Horários    │
    │ - Endereço    │           │ - Limites     │
    │ - Dias busca  │           │ - Serviços    │
    └───────────────┘           └───────────────┘
```

## Etapas de Implementação

### 1. Criar Configuração no Banco de Dados

Inserir novo registro em `llm_clinic_config` para "Consultório Dr. Marcelo D'Carli":

```sql
INSERT INTO llm_clinic_config (
  cliente_id,
  nome_clinica,
  telefone,
  whatsapp,
  endereco,
  dias_busca_inicial,
  dias_busca_expandida,
  data_minima_agendamento,
  mensagem_bloqueio_padrao,
  ativo
) VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',  -- IPADO cliente_id (mesmo)
  'Consultório Dr. Marcelo D''Carli',
  '(87) 98112-6744',      -- Telefone secretária Jeniffe/Lu
  '(87) 98112-6744',      -- WhatsApp
  'IPADO - Petrolina-PE', -- Endereço (ajuste conforme necessário)
  14,                     -- Dias busca inicial
  45,                     -- Dias busca expandida
  '2026-01-01',           -- Data mínima
  'Para tentar encaixe entre em contato com a secretária Jeniffe ou Luh no WhatsApp: (87) 98112-6744',
  true
) RETURNING id;
```

### 2. Criar Business Rules Específicas

Criar regras de negócio vinculadas ao novo `config_id`, apenas para o Dr. Marcelo:

```sql
INSERT INTO business_rules (
  cliente_id,
  config_id,        -- Vincula à config "Consultório Dr. Marcelo"
  medico_id,
  config,
  ativo
) VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',  -- IPADO
  '{{CONFIG_ID_MARCELO}}',                  -- ID retornado do INSERT acima
  '1e110923-50df-46ff-a57a-29d88e372900',  -- Dr. Marcelo principal
  '{
    "nome": "Dr. Marcelo D''Carli",
    "especialidade": "Cardiologia",
    "tipo_agendamento": "ordem_chegada",
    "servicos": {
      "Consulta Cardiológica": {
        "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": { "limite": 9, "inicio": "07:00", "fim": "12:00" },
          "tarde": { "limite": 9, "inicio": "13:00", "fim": "18:00" }
        }
      },
      "Teste Ergométrico": {
        "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": { "limite": 9, "inicio": "07:45", "fim": "12:00" },
          "tarde": { "limite": 9, "inicio": "13:45", "fim": "17:00" }
        },
        "orientacoes": ["Lista de orientações do teste..."]
      }
    }
  }'::jsonb,
  true
);
```

### 3. Criar Mensagens Personalizadas

Criar mensagens específicas para o Dr. Marcelo:

```sql
INSERT INTO llm_mensagens (cliente_id, config_id, medico_id, tipo, mensagem, ativo)
VALUES 
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '{{CONFIG_ID_MARCELO}}', NULL, 'bloqueio_agenda', 
   'A agenda do Dr. Marcelo está bloqueada. Para encaixes, fale com Jeniffe/Luh: (87) 98112-6744', true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', '{{CONFIG_ID_MARCELO}}', NULL, 'confirmacao',
   'Consulta confirmada com Dr. Marcelo D''Carli! Chegue 15min antes.', true);
```

### 4. Criar Edge Function Proxy

Criar `supabase/functions/llm-agent-api-marcelo/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * v1.0.0 - LLM Agent API Dr. Marcelo D'Carli
 * 
 * Proxy que redireciona para a API principal com config_id específico
 * Usa mesmos dados de agendamentos do IPADO, mas com configurações próprias
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Config ID do "Consultório Dr. Marcelo D'Carli"
const CONFIG_ID_MARCELO = '{{CONFIG_ID_MARCELO}}'; // Será preenchido após INSERT

// Cliente ID do IPADO (para acessar mesmos pacientes/agendamentos)
const CLIENTE_ID_IPADO = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';

const MAIN_API_URL = 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    
    let action = '';
    if (pathSegments.length > 0) {
      action = pathSegments[pathSegments.length - 1];
      if (action === 'llm-agent-api-marcelo') {
        action = '';
      }
    }

    console.log(`🔄 [MARCELO PROXY v1.0.0] Redirecionando: ${req.method} /${action || '(root)'}`);
    
    let body: any = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
        if (Array.isArray(body) && body.length > 0) {
          body = body[0];
        }
      } catch (e) {
        body = {};
      }
    }

    // Injetar config_id específico e cliente_id IPADO
    const enrichedBody = {
      ...body,
      config_id: CONFIG_ID_MARCELO,
      cliente_id: CLIENTE_ID_IPADO
    };

    console.log(`📦 [MARCELO PROXY] config_id: ${CONFIG_ID_MARCELO}`);

    const targetUrl = action ? `${MAIN_API_URL}/${action}` : MAIN_API_URL;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method === 'POST' ? JSON.stringify(enrichedBody) : undefined
    });

    const responseData = await response.text();
    console.log(`✅ [MARCELO PROXY] Status: ${response.status}`);

    return new Response(responseData, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Proxy-From': 'llm-agent-api-marcelo',
        'X-Config-Id': CONFIG_ID_MARCELO
      }
    });

  } catch (error: any) {
    console.error(`❌ [MARCELO PROXY] Erro:`, error.message);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'PROXY_ERROR',
      message: 'Erro ao processar requisição.',
      codigo_erro: 'MARCELO_PROXY_ERROR',
      proxy_version: '1.0.0',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

## Configuração N8N

Após implementação, configure o workflow N8N do Dr. Marcelo para usar:

```text
URL Base: https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/llm-agent-api-marcelo

Endpoints:
- /availability  → Verificar disponibilidade
- /schedule      → Agendar consulta  
- /check-patient → Consultar agendamentos
- /cancel        → Cancelar
- /confirm       → Confirmar
- /reschedule    → Remarcar
```

## Gerenciamento pelo Admin Panel

Após criação, a configuração aparecerá automaticamente no seletor do painel LLM:

1. Acesse **Configuração LLM API** no admin
2. No dropdown, selecione **"Consultório Dr. Marcelo D'Carli"**
3. Edite horários, limites, mensagens conforme necessário
4. Alterações aplicam em até 1 minuto (cache TTL)

## O que será diferente do IPADO

| Aspecto | IPADO Principal | Dr. Marcelo Dedicado |
|---------|-----------------|----------------------|
| Telefone/WhatsApp | (87) 3024-1274 | (87) 98112-6744 |
| Mensagem bloqueio | Genérica | Secretária Jeniffe/Luh |
| Horários | Todos médicos | Apenas Dr. Marcelo |
| Limites | Configurados por médico | Específicos para ele |
| Mensagens confirmação | Padrão IPADO | Personalizadas |

## O que será igual (compartilhado)

- Dados de pacientes (mesma tabela `pacientes`)
- Dados de agendamentos (mesma tabela `agendamentos`)  
- Mesmo `cliente_id` IPADO
- Mesma lógica de bloqueios de agenda
