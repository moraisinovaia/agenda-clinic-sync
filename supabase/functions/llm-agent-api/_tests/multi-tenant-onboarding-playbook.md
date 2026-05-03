# Playbook — Onboarding Multi-Tenant

Procedimento operacional para colocar uma clínica nova em produção sem quebrar
isolamento, performance ou consistência. Cada passo aponta a ferramenta criada
no sprint multi-tenant e o critério objetivo de aprovação.

## 1. Setup do tenant no banco

Inserir/atualizar:
- `clientes` (id, nome, ativo=true)
- `medicos` (id, cliente_id, nome, ativo=true, convenios_aceitos[], especialidade)
- `atendimentos` (id, cliente_id, nome, ativo=true) — um por serviço oferecido
- `business_rules` (cliente_id, medico_id, ativo=true, config JSONB)
- (opcional) `bloqueios_agenda` para feriados/férias

**Crítico**: TODA linha tem `cliente_id` correto. UNIQUE indexes existentes
impedem dois pacientes/atendimentos com nomes iguais no mesmo cliente.

## 2. Validar a config — bloqueador de go-live

```
POST {endpoint}/validate-config
{
  "cliente_id": "<uuid-da-clinica>"
}
```

**Critério para liberar onboarding**:
- `ok: true` no top-level
- `summary.errors: 0`

**Se `ok: false`**: percorra `reports[].findings[]`. Cada finding tem `path`
(dot-notation no JSON), `rule` (machine-readable) e `message`. Corrija e re-rode.

**Regras críticas que o validador detecta** (todas vieram de bugs reais em prod):
- `dias_semana_must_cover_dias_especificos` — bug do MRPA-sexta (Dr. Marcelo)
- `tipo_enum` / `tipo_agendamento_enum` — typo em config
- `inicio_lt_fim` / `contagem_inicio_lt_contagem_fim` — janela invertida
- `limite_positive_int` — limite ausente ou ≤ 0
- `dias_especificos_valid_range` — número fora de 0-6
- `compartilha_limite_com_target_exists` — pool aponta pra serviço inexistente

## 3. Smoke da `/availability` por serviço

Para cada serviço cadastrado, rode:

```
POST {endpoint}/availability
{ "cliente_id": ..., "atendimento_nome": "<serviço>", "buscar_proximas": true,
  "allowed_doctor_ids": ["<medico_id>"] }
```

Verifique:
- `success: true`
- `proximas_datas[].length >= 1` (ou retorno `walk_in_info_only` para serviços sem agendamento)
- Vagas batem com a expectativa da secretaria (recomendamos amostrar 2 datas e validar contra o banco)

## 4. Smoke de erros estruturais

```
POST {endpoint}/availability
{ "cliente_id": "<uuid>", "atendimento_nome": "Coisa Que Não Existe",
  "allowed_doctor_ids": ["<medico_id>"] }
```

Esperado: `codigo_erro: "SERVICO_NAO_ENCONTRADO"` + `servicos_disponiveis[]` com
todos os serviços não-ocultos.

```
POST {endpoint}/availability
{ "cliente_id": "<uuid>", "atendimento_nome": "<serviço>",
  "allowed_doctor_ids": ["00000000-0000-0000-0000-000000000000"] }
```

Esperado: `codigo_erro: "MEDICO_NAO_ENCONTRADO_NO_ESCOPO"` (não `ESCOPO_SEM_MEDICOS`).

## 5. Idempotência do `/schedule` — ambiente isolado

Antes de produção, rodar em uma branch de teste:

```
SUPABASE_URL=<branch-test> SUPABASE_SERVICE_ROLE_KEY=<key> \
  deno test --allow-all \
  supabase/functions/_shared/scheduling-core/integration/idempotency-race.integration.test.ts
```

Esperado: 2 testes passam (race 2x e race 5x). Confirma que retry do n8n não
duplica agendamento.

## 6. Validação de isolamento multi-tenant

```
deno test --allow-all \
  supabase/functions/_shared/scheduling-core/integration/multi-tenant.integration.test.ts
```

5 testes — cada um cria 2 clínicas e valida que NENHUMA query do scheduling-core
vaza dados entre tenants. Crítico antes do primeiro cliente compartilhando
infra com outro tenant.

## 7. Health check após go-live

`GET {endpoint}/metrics` retorna snapshot da instância (cold-start zera).
Campos importantes:
- `healthy`: true quando error_rate < 10%
- `error_rate`: erros / total
- `by_action[]`: latência média e taxa de erro por endpoint
- `by_cliente[]`: mesmo recorte por tenant — **descobrir rapido se UMA clínica está com problema**

Configurar UptimeRobot/Grafana pra:
- Hit `/health` a cada 60s; alertar se status != 200
- Alertar se `error_rate > 0.05` por 5 min
- Alertar se `by_cliente[].error_rate > 0.2` (cliente específico)

## 8. Logflare / structuredLog

Cada request emite `structuredLog` com:
- `timestamp`, `request_id`, `cliente_id`, `config_id`, `medico_id`, `action`
- `level` (`info` / `warn` / `error`)
- `phase` (`request` / `response`)
- `duration_ms`
- `success` + `error_code` (na resposta)

Configurar Logflare drain pra Supabase Edge Functions e criar saved searches:
- `level=error` → alerta imediato
- `error_code=SLOT_TAKEN` → métrica de overbooking real
- `cliente_id=X AND duration_ms>3000` → tenant lento específico

## Checklist final pra liberar tenant

- [ ] Config criada e `validate-config` retorna `ok:true`
- [ ] Smoke `/availability` por serviço com vagas reais validadas
- [ ] Smoke de erros estruturais retorna códigos corretos
- [ ] (opcional) `idempotency-race.integration` em branch de teste
- [ ] (opcional) `multi-tenant.integration` em branch de teste
- [ ] Painel Logflare configurado
- [ ] UptimeRobot/Grafana em `/health` configurado

Tempo médio: 30-45 min por tenant após o primeiro.
