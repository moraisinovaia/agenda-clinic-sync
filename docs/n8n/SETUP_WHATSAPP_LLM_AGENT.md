# Setup do workflow n8n — WhatsApp LLM Agent (Marcelo + Suely)

Workflow que conecta **Evolution API → llm-agent-api → WhatsApp** para os 2
médicos hoje em piloto: Dr. Marcelo D'Carli (Cardio) e Dra. Maria Suely
Amorim Mendes (Oftalmo).

## Pré-requisitos

- [x] Edge function `llm-agent-api` deployada (já está em prod)
- [x] Tabela `n8n_status_atendimento` com colunas `estado_atual`/`dados_coletados`/`historico_contexto`/`config_id` (migration 20260511170000 já aplicada)
- [x] Suite p0p1 verde (52/52) para Marcelo
- [x] Schema da Suely normalizado para formato canônico
- [ ] n8n rodando + acessível externamente (você confirma)
- [ ] 2 instances Evolution já conectadas aos chips (você confirma)

## Importar o workflow

1. n8n → menu → **Workflows** → **Import from File**
2. Selecionar `docs/n8n/whatsapp-llm-agent-workflow.json`
3. Após importar, configurar:

### Credencial Postgres (Supabase)
- Tipo: **Postgres**
- Host: `db.qxlvzbvzajibdtlzngdy.supabase.co`
- Port: `5432`
- Database: `postgres`
- User: `postgres`
- Password: (do dashboard Supabase → Settings → Database)
- SSL: `enable`
- Substituir `PLACEHOLDER_POSTGRES_CRED_ID` em ambos os nodes Postgres (Load state, Save state)

### Variáveis de ambiente n8n
Adicionar em **Settings → Variables** (ou via `docker-compose.yml`):

```bash
EVOLUTION_URL=https://evolution.seu-dominio.com
EVOLUTION_API_KEY=<api-key-global-evolution>
EVOLUTION_INSTANCE_MARCELO=<nome-da-instance-marcelo>
EVOLUTION_INSTANCE_SUELY=<nome-da-instance-suely>
```

## Configurar webhook nas instances Evolution

Para cada instance, apontar o webhook para o n8n:

```bash
# Instance Marcelo
curl -X POST "$EVOLUTION_URL/webhook/set/$EVOLUTION_INSTANCE_MARCELO" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://<seu-n8n>/webhook/whatsapp/marcelo",
    "events": ["MESSAGES_UPSERT"]
  }'

# Instance Suely
curl -X POST "$EVOLUTION_URL/webhook/set/$EVOLUTION_INSTANCE_SUELY" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://<seu-n8n>/webhook/whatsapp/suely",
    "events": ["MESSAGES_UPSERT"]
  }'
```

## Arquitetura do fluxo

```
WhatsApp paciente → Evolution instance
                         ↓ webhook MESSAGES_UPSERT
[Webhook Marcelo OU Webhook Suely]
                         ↓
[Set ids]  ← define cliente_id + config_id fixos da clínica
                         ↓
[Extract payload]
  - Filtra fromMe=true (não responde a si mesmo)
  - Normaliza telefone (remove @s.whatsapp.net)
  - Extrai texto (conversation | extendedTextMessage | caption)
                         ↓
[Load state] — SELECT n8n_status_atendimento por (session_id, cliente_id)
                         ↓
[Merge state] — defaults se conversa nova; flag _skip_llm se lock_conversa=true
                         ↓
[Conversa bloqueada?] — IF lock=true: descarta (humano assumiu via Chatwoot)
                         ↓ false
[POST /chat] — llm-agent-api retorna { resposta, novo_estado, dados_coletados, historico_contexto }
                         ↓
[Save state] — UPSERT em n8n_status_atendimento
                         ↓
[Send WhatsApp] — Evolution sendText
```

## Como saber qual instance enviar resposta

O node **Set ids** define `evolution_instance` baseado em qual webhook
disparou (Marcelo ou Suely). O node **Send WhatsApp** usa essa variável na
URL: `/message/sendText/{{ $('Merge state').first().json.evolution_instance }}`.

## State persistido

Tabela `n8n_status_atendimento` (uma row por `session_id` + `cliente_id`):

| Coluna | Origem | Uso |
|---|---|---|
| `session_id` | telefone normalizado | Chave de busca |
| `cliente_id` | hardcoded por webhook | Multi-tenant |
| `config_id` | hardcoded por webhook | Roteia para business_rules |
| `estado_atual` | `/chat` retorna `novo_estado` | Próximo turno |
| `dados_coletados` | `/chat` retorna | Próximo turno |
| `historico_contexto` | `/chat` retorna (capado em 20 msgs) | Próximo turno |
| `lock_conversa` | manual via Chatwoot | Pausa LLM |
| `modo_atendimento` | livre — `bot` / `humano` | Operacional |
| `updated_at` | now() | Cleanup de conversas antigas |

## Testando antes de ligar nas instances reais

Antes de apontar Evolution → n8n, simule um payload via curl:

```bash
curl -X POST "https://<seu-n8n>/webhook/whatsapp/marcelo" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "key": { "remoteJid": "5587991234567@s.whatsapp.net", "fromMe": false },
      "message": { "conversation": "quero marcar consulta" }
    }
  }'
```

Esperado:
1. n8n executa workflow completo (ver em **Executions**)
2. Linha aparece em `n8n_status_atendimento` com `cliente_id=2bfb98b5-...`
3. Mensagem é enviada pelo Evolution instance do Marcelo
4. Olhando o WhatsApp do número-teste, recebe: *"Você possui convênio? Se sim, qual?..."*

## Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| Workflow não dispara | URL webhook errada no Evolution | `curl GET $EVOLUTION_URL/webhook/find/$INSTANCE` |
| Bot responde a si mesmo (loop) | Filtro `fromMe` falhou | Logar `data.key.fromMe` no Code node |
| `/chat` retorna 401 | x-api-key errada no header | Conferir `N8N_API_KEY` |
| State não persiste entre turnos | Postgres cred sem permissão UPDATE | RLS ou GRANT em `n8n_status_atendimento` |
| Mensagem chega vazia | Payload Evolution v1 vs v2 difere | Ajustar `extract-payload` Code node |
| Lock conversa não bloqueia | Coluna `lock_conversa` ainda boolean false | Setar true via SQL pra testar transbordo |

## Próximos passos depois de ativar

1. **Monitorar primeiros 50 atendimentos** — olhar `n8n_status_atendimento.dados_coletados` pra ver onde o LLM trava
2. **Adicionar Chatwoot integration** — quando paciente diz "quero falar com atendente", marcar `lock_conversa=true` e abrir conversation no Chatwoot
3. **Onboarding de mais médicos** — usar pattern do Set ids + webhook isolado por clínica
4. **Suite de testes pros outros clientes** (Joana, cardios, etc) antes de ligar n8n pra eles
