# Melhorias Futuras

Itens que foram **conscientemente adiados** durante os Sprints 3-7 (hardening pra escala 7 clínicas × 10 médicos).
Cada item tem: **o que é**, **por que ficou pra depois**, **quando reativar** (gatilho), e **esforço estimado**.

Última atualização: **2026-05-03** (após Sprint 7 + setup operacional UptimeRobot/cron).

---

## 🔴 Operacionais (sem código)

### 1. Logflare drain — alerting persistente de logs
- **O que**: Edge Function logs hoje só aparecem no dashboard Supabase. Logflare drena logs pra um backend persistente com query/alerta.
- **Por que adiado**: requer criar conta Logflare nova; UptimeRobot já cobre o caso "função fora do ar".
- **Quando reativar**: quando começar a precisar investigar bugs históricos (logs do dashboard somem em dias) ou alertar em padrões (ex: "spike de 401 no tenant X").
- **Esforço**: ~30 min (criar conta, configurar drain, testar).

### 2. CI integration tests
- **O que**: rodar `appointment.integration.test.ts`, `idempotency-race.integration.test.ts`, `multi-tenant.integration.test.ts` automaticamente em cada PR.
- **Por que adiado**: requer projeto Supabase staging separado (free tier OK) com todas as migrations aplicadas. Cobertura unit atual cobre ~80% dos bugs, e mudanças no scheduling-core são raras.
- **Quando reativar**: antes de refatoração grande no `scheduling-core` (RPCs, repositories, use-cases) ou quando o time crescer pra 3+ devs.
- **Esforço**: ~2h (criar projeto staging, aplicar migrations, configurar 2 GitHub secrets, adicionar job condicional no CI).

### 3. Migrar Dr. Marcelo de `N8N_API_KEY` legacy → `api_keys` per-tenant
- **O que**: hoje Dr. Marcelo usa env `N8N_API_KEY` global. O resto do sistema (futuros tenants) usa `api_keys` table com hash SHA-256 e `cliente_id` bound.
- **Por que adiado**: funciona; rotação é manual via env do n8n; sem urgência operacional.
- **Quando reativar**: quando onboardar tenant número 2 (ter 2 clínicas em modos diferentes vira complicação cognitiva). Ou se a env `N8N_API_KEY` precisar ser rotacionada por motivo de segurança.
- **Esforço**: ~30 min (rodar `_tests/scripts/generate-api-key.ts`, atualizar n8n, revogar key antiga).

---

## 🟡 Backlog de código conhecido

### F-8 — Menor de idade com responsável legal
- **O que**: agendamentos pra paciente menor de 18 não capturam quem é o responsável legal (nome + CPF + telefone do responsável). Hoje grava só dados do menor.
- **Por que adiado**: Dr. Marcelo é cardiologista, não atende muitos menores. Validação ficou "responsável = mesmo do menor" implicitamente.
- **Quando reativar**: ao onboardar pediatra, ginecologista, ou qualquer especialidade com volume de menores >10%.
- **Esforço**: ~3-4h (mudança de schema + LLM prompt + handler `schedule`/`check-patient`).

### F-9 — Convênio normalization drift
- **O que**: `normalizarConvenioParaComparacao()` em [schedule.ts](supabase/functions/llm-agent-api/_handlers/schedule.ts#L293) faz match fuzzy de strings de convênio ("UNIMED VSF" vs "Unimed-VSF" vs "unimed vsf"). Funciona pros casos atuais mas não tem cobertura de teste exaustiva.
- **Por que adiado**: nenhum bug reportado em produção. Trigger `validate_insurance_trigger` no DB pega divergências críticas.
- **Quando reativar**: ao onboardar tenant com >5 convênios distintos ou ao receber 1ª reclamação de "convênio aceito mas sistema rejeitou".
- **Esforço**: ~2h (extrair pra função pura testável + adicionar 20 casos de teste).

### F-10 — Security headers (HSTS, CSP, X-Frame-Options)
- **O que**: Edge Function só retorna `corsHeaders` básico. Falta `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, etc.
- **Por que adiado**: API consumida por servidor (n8n) — não é servida pra browser de end-user, então CSP/X-Frame não aplicam diretamente.
- **Quando reativar**: se algum dia tiver frontend público chamando direto a API (sem proxy).
- **Esforço**: ~30 min (atualizar `responses.ts` com headers padrão).

### F-CI — Tech debt aceito no lint do scheduling-core
- **O que**: `supabase/functions/_shared/scheduling-core/deno.json` exclui 3 regras de lint:
  - `no-explicit-any` (12 ocorrências) — construtores recebem `SupabaseClient` tipado como `any`. Fix correto: importar `SupabaseClient` type do `@supabase/supabase-js`.
  - `no-import-prefix` (7 ocorrências) — testes usam URLs `https://deno.land/std@.../assert/mod.ts`. Estilo antigo; novo é via `imports` em `deno.json`.
  - `require-await` (1 ocorrência) — função async sem await.
- **Por que adiado**: fix das 20 ocorrências dispersas leva ~2h. Excluir as regras é tech debt aceito explicitamente pra desbloquear o CI.
- **Quando reativar**: ao refatorar repositories ou ao migrar pra deno.json `imports` map. Pode-se fixar 1 categoria por vez e remover do `exclude`.
- **Esforço**: ~2h (todas as categorias) ou 30 min cada categoria.

### F-11 — Rollback procedure documentada
- **O que**: procedimento escrito de "Edge Function deployada quebrou produção, como reverter em <2 min". Hoje só tenho conhecimento tribal (`supabase functions deploy` da versão git anterior).
- **Por que adiado**: nunca precisei reverter; deploy atual é reversível em ~2 min mesmo sem doc.
- **Quando reativar**: antes de delegar deploy pra outra pessoa, ou se algum deploy quebrar.
- **Esforço**: ~30 min (escrever runbook em [docs/rollback.md] com comandos exatos).

### F-15 — Grace period em rotação de API key
- **O que**: hoje rotação deixa key antiga + nova ativas até admin revogar manual. Sem timeout automático. Se admin esquecer de revogar a antiga, ela fica ativa indefinidamente.
- **Por que adiado**: rotação é evento raro; última coluna `last_used_at` permite auditar manualmente.
- **Quando reativar**: ao implementar rotação automática agendada (ex: SOC2/compliance) ou quando tiver >10 tenants (esquecer fica fácil).
- **Esforço**: ~2h (cron job que revoga keys antigas com `last_used_at` ausente há >7 dias após criação de nova).

### F-16 — Observability avançada (latência p95, error rate por tenant, dashboards)
- **O que**: hoje `/metrics` retorna snapshot in-memory que zera no cold-start. Sem persistência, sem alerta em latência p95 > X, sem breakdown por handler/tenant.
- **Por que adiado**: UptimeRobot cobre uptime; logs estruturados em Supabase dashboard cobrem investigação ad-hoc; tráfego atual ainda é baixo.
- **Quando reativar**: quando o tráfego subir pra >1k req/dia ou quando começar a aparecer reclamação de "tá lento".
- **Esforço**: ~4-6h (escolher provider — Better Stack, Grafana Cloud, Logflare — + integrar `structuredLog` + criar dashboards).

### M4 — Chat request budget integrado em todos os handlers
- **O que**: [request-budget.ts](supabase/functions/llm-agent-api/_lib/request-budget.ts) já existe (deadline propagado por chamada — corta operações longas), mas só está usado em alguns lugares. Falta integrar em `availability`, `schedule`, `reschedule`.
- **Por que adiado**: handlers atuais raramente passam de 2s; sem timeout específico, função morre no global da Edge (60s) que é folgado.
- **Quando reativar**: se aparecer queda de SLA por requests longos ou se precisar de timeout fino tipo "OpenAI já gastou 5s, não chamar mais nada".
- **Esforço**: ~2h (passar `budget` por todos os handlers, ajustar repos/use-cases).

---

## 🟢 Já existem mas estão "pausados"

### Testes de integração (escritos, não rodam em CI)
- **Localização**: `supabase/functions/_shared/scheduling-core/integration/`
- **Como rodar localmente**:
  ```bash
  SUPABASE_URL=<staging-url> SUPABASE_SERVICE_ROLE_KEY=<staging-key> \
    deno test --allow-all supabase/functions/_shared/scheduling-core/integration/
  ```
- **Pré-condição**: ter projeto Supabase de staging com todas as migrations aplicadas.
- **Skip automático**: se `SUPABASE_URL` não estiver setado, testes são ignorados (pattern `ignore: !Deno.env.get('SUPABASE_URL')`).

---

## Como decidir quando reativar

Use estas perguntas como gatilho:

1. **"Estou prestes a refatorar `scheduling-core` ou RPCs?"** → ativar **CI integration tests** (item 2) ANTES.
2. **"Vou onboardar tenant número 2?"** → migrar Dr. Marcelo pra `api_keys` (item 3) primeiro.
3. **"Tráfego passou de 1k req/dia?"** → priorizar **F-16 observability**.
4. **"Preciso investigar bug que aconteceu há 3 dias?"** → ativar **Logflare drain** (item 1).
5. **"Vou delegar deploy pra outra pessoa?"** → escrever **F-11 rollback procedure** primeiro.
6. **"Onboardando pediatra/ginecologista?"** → priorizar **F-8 menor de idade**.

---

## O que NÃO entra aqui

Itens que **já estão prontos** e não precisam de revisita:

- Sprints 3-7: 27 bugs hardening (auth, idempotency, rate limit, quota, circuit breaker, cache, schema validation, etc).
- Migrations versionadas em `supabase/migrations/` (10+ aplicadas via MCP em produção).
- UptimeRobot health monitor.
- Cron `cleanup_rate_limit_old` rodando a cada 10 min.
- **Bug fix 2026-05-04** (migration `20260504142147_grant_service_role_permissions`):
  - Tabelas `api_keys`, `tenant_quota_daily`, `tenant_rate_limit`, `clientes`, `audit_logs`, `confirmacoes_automaticas` **estavam sem GRANTs pra `service_role`** desde sua criação via MCP.
  - Sintoma silencioso: `auth.ts:resolveAuth` caía SEMPRE no fallback legacy `N8N_API_KEY`; rate limit persistente e cost guard ficavam fail-open.
  - Detectado durante smoke de isolamento multi-tenant (tentativa de validar que tenant A não vê dado de B). Bloqueio cross-tenant com keys per-tenant agora valida 403 corretamente.
  - **Lição:** migrations criadas via MCP NÃO incluem GRANTs default. Sempre adicionar `GRANT ... TO service_role, authenticated` ao final de migrations que criam tabelas novas.

Pra contexto histórico desses, consulte o git log:
```bash
git log --oneline --grep="Sprint\|F[0-9]\|fix\|feat"
```
