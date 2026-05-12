# Plano Produto — Automação WhatsApp com IA para Clínicas (Inovaia)

**Versão:** 1.0 — 2026-05-12
**Status:** Draft para aprovação
**Owner:** Gabriela Morais
**Stack atual:** 6 clínicas, 45 médicos ativos, 3.825 agendamentos/mês

---

## 0. Sumário Executivo

A Inovaia já tem um backend conversacional (`llm-agent-api`) maduro:
296 testes automatizados, 14 handlers, suporte multi-tenant a 6 clínicas, defesa
em profundidade (RLS + auditRules + audit log). Falta o **canal**
(WhatsApp via Evolution + n8n + Chatwoot) e features de produto (multimodal,
fila ativa, handover). Este plano cobre como entregar isso em **4 sprints
semanais (4 semanas)** sem comprometer prod e com compliance LGPD/CFM.

**MVP (Sprint 1+2, 2 semanas):** Marcelo + Suely respondendo no WhatsApp via
agente IA, com handover pra recepção via Chatwoot, fila de espera ativa, e
remarcação automática em caso de cancelamento da agenda médica.

**Pós-MVP (Sprint 3+4, +2 semanas):** Multimodal (foto de guia/exame),
migração pra WhatsApp Business API (Meta), saudação personalizada por nome,
onboarding automatizado de novas clínicas.

**Custo operacional:** ~$0.005-0.01 por atendimento via IA. Ponto de equilíbrio
versus atendente humano: ~50 atendimentos/dia por clínica.

**Risco principal:** uso de Evolution API (não-oficial). Mitigação: migração
planejada pra Meta API após validação do piloto (Sprint 4).

---

## A. Arquitetura

### A.1 Diagrama lógico de componentes

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PACIENTE (WhatsApp)                                                     │
└────────────────┬────────────────────────────────────────────────────────┘
                 │ texto / imagem / PDF
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ EVOLUTION API (1 instância por clínica)                                 │
│  - Webhook MESSAGES_UPSERT                                              │
│  - sendText / sendPresence (typing) / sendMedia                         │
└────────────────┬────────────────────────────────────────────────────────┘
                 │ POST /webhook/whatsapp/{cliente}
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ n8n (orchestrator)                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ 1. Extract payload (telefone, msg, fromMe filter)                │   │
│  │ 2. Lookup paciente por telefone → nome_paciente                  │   │
│  │ 3. Load state (n8n_status_atendimento)                           │   │
│  │ 4. IF lock_conversa=true → SKIP IA (humano operando Chatwoot)    │   │
│  │ 5. IF mídia: chama /analyze-media → texto enriquecido            │   │
│  │ 6. POST /chat → resposta + audit_reason                          │   │
│  │ 7. IF audit_reason=HANDOVER_*: lock=true + Chatwoot etiqueta     │   │
│  │ 8. Save state                                                    │   │
│  │ 9. Send typing presence (3-5s) → Send text (picotado)            │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────┬───────────────────────┘
                 │                                │
                 ▼                                ▼
┌──────────────────────────┐         ┌─────────────────────────────┐
│ llm-agent-api            │         │ CHATWOOT                    │
│ (Supabase Edge Function) │◀───────▶│  - 1 inbox por clínica      │
│  - /chat                 │ etiqueta │  - Etiqueta "atendimento    │
│  - /availability         │   +      │    humano"                  │
│  - /schedule             │ webhook  │  - Recepção responde paciente│
│  - /cancel /reschedule   │          │  - Mark resolved → desbloq IA│
│  - /analyze-media (novo) │          │  - Timeout 4h sem msg → IA  │
│  - + 9 handlers          │          └─────────────────────────────┘
└────────────────┬─────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SUPABASE (PostgreSQL)                                                   │
│  - agendamentos, pacientes, medicos, atendimentos, business_rules       │
│  - n8n_status_atendimento (state da conversa)                           │
│  - n8n_chat_histories (histórico LangChain-compatible)                  │
│  - fila_espera, bloqueios_agenda, audit_logs                            │
│  - clientes (multi-tenant root)                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ WORKERS ASSÍNCRONOS (n8n cron / Postgres triggers)                      │
│  - Fila ativa: monitora cancelamentos, notifica fila, gerencia 4h       │
│  - Cancelamento médico em massa: webhook → remarca pacientes            │
│  - Timeout Chatwoot: 4h sem resposta → desbloqueia IA                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ OPENAI                                                                  │
│  - gpt-4o-mini (extração + resposta)                                    │
│  - gpt-4o vision (imagem/PDF de guia/exame)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### A.2 State machine da conversa

```
                    [INÍCIO]
                       │
                       ▼
    ┌──────────────[IA RESPONDENDO]──────────────┐
    │                  │                         │
    │ HANDOVER_*       │ /schedule sucesso       │ /chat normal
    │                  │                         │
    ▼                  ▼                         ▼
[LOCK HUMANO]    [AGENDADO/CONFIRMADO]      [COLETANDO DADOS]
    │                                            │
    │ Chatwoot                                   │
    │ resolved                                   │ todos campos
    │ OU 4h timeout                              │ preenchidos
    │                                            │
    └─────────────────┬──────────────────────────┘
                      ▼
              [IA RESPONDENDO] (volta ao topo)


Estados em n8n_status_atendimento:
  - estado_atual: "inicio" | "identificando_servico" | "coletando_dados" |
                  "confirmando_dados" | "verificando_disponibilidade" |
                  "finalizado" | "encaixe_fila_espera"
  - lock_conversa: bool (true = IA não responde, humano operando)
  - modo_atendimento: "bot" | "humano" | "transbordo"
  - aguardando_followup: bool (fila de espera notificou, esperando resposta)
```

### A.3 Contratos de API entre componentes

**Evolution → n8n** (webhook MESSAGES_UPSERT):
```json
{
  "data": {
    "key": { "remoteJid": "5587991234567@s.whatsapp.net", "fromMe": false },
    "message": {
      "conversation": "texto" |
      "extendedTextMessage": { "text": "..." } |
      "imageMessage": { "caption": "...", "url": "..." } |
      "documentMessage": { "fileName": "...", "url": "..." }
    },
    "messageTimestamp": 1234567890
  }
}
```

**n8n → llm-agent-api `/chat`**:
```json
{
  "cliente_id": "uuid",
  "config_id": "uuid",
  "mensagem": "texto da msg (ou texto extraído da imagem)",
  "estado_atual": "inicio",
  "dados_coletados": { "nome_paciente": "Maria" (pré-populado pelo lookup), ... },
  "historico_contexto": [{ "role": "user|assistant", "content": "..." }],
  "telefone": "5587991234567"
}
```

**n8n → llm-agent-api `/analyze-media` (NOVO Sprint 3)**:
```json
{
  "cliente_id": "uuid",
  "config_id": "uuid",
  "media_url": "https://...",
  "media_type": "image" | "pdf",
  "telefone": "55..."
}
```
Retorna: `{ texto_extraido, exames_identificados[], confianca, sugestao }`

**llm-agent-api → Chatwoot** (handover):
```
POST /api/v1/accounts/{id}/conversations/{conv}/labels
  { "labels": ["atendimento humano"] }
```

**Chatwoot → n8n** (webhook `conversation_status_changed`):
```json
{ "event": "conversation_resolved", "conversation_id": 123, "meta": { "sender": { "phone": "55..." } } }
```
n8n: `UPDATE n8n_status_atendimento SET lock_conversa=false WHERE session_id='55...'`

### A.4 Estratégia de identidade

**Telefone é o identificador único do paciente** no WhatsApp. Fluxo:

1. n8n recebe webhook com `remoteJid = 5587991234567@s.whatsapp.net`
2. Normaliza pra `5587991234567`
3. Lookup `pacientes WHERE celular = $1 AND cliente_id = $2` (multi-tenant)
4. Se achou: usa `paciente_id`, popula `nome_paciente` no contexto
5. Se não achou: trata como paciente novo, agente coleta dados durante a conversa
6. Mesmo telefone pode existir em clínicas diferentes (paciente atendido em várias)
   — sempre filtra por `cliente_id`

`session_id` = telefone normalizado (sem `@s.whatsapp.net`).
`(session_id, cliente_id)` é UNIQUE em `n8n_status_atendimento`.

### A.5 Estratégia de fila + idempotência

**Idempotência de agendamento:** chave `cliente_id:celular:medico_id:data:hora_consulta`
— se mesmo input chega de novo, retorna mesmo agendamento_id. Já implementado.

**Fila de espera ativa (Sprint 2):**

```
1. RECEPÇÃO cancela um agendamento (via frontend ou paciente cancela via WhatsApp)
   → trigger DB ou /cancel handler enfileira evento em fila_pendente_resposta
2. WORKER n8n (cron a cada 5min OU webhook do trigger):
   - SELECT next paciente da fila_espera ordenado por prioridade + created_at
   - Verifica que o agendamento aberto bate com periodo_preferido e atendimento
   - sendText: "Maria, surgiu uma vaga em 18/05 14:30. Confirma? (sim/não/depois)"
   - Marca aguardando_followup=true, salva expires_at = now + 4h
3. PACIENTE responde:
   - "sim" → /schedule com idempotency_key → marca fila item como respondido
   - "não" → próximo da fila
   - 4h sem resposta → notifica próximo + envia ao paciente original:
     "Devido à falta de resposta, outro paciente foi notificado. Você continua
      na fila — avisaremos quando surgir nova vaga."
4. Loop até alguém aceitar ou fila vazia.
```

**Garantias:**
- 1 notificação ativa por vaga (não dispara N notificações pra N pacientes)
- Idempotência: se worker rodar 2x na mesma fila, só envia 1 sendText (lock by expires_at)
- Auditoria: cada notificação grava em audit_logs (action='fila_notificacao')

---

## B. Produto

### B.1 Definição MVP (Sprint 1+2)

**Objetivo MVP:** Marcelo e Suely respondendo via IA no WhatsApp em produção,
com a recepção podendo intervir via Chatwoot, e fila de espera ativa.

**Inclui no MVP:**
- ✅ Conversação natural (já temos)
- ✅ Agendamento/cancelamento/remarcação (já temos)
- ✅ Regras clínicas Marcelo: MAPA guia, ECG walk-in, Ergométrico fístula/peso (já temos)
- ✅ CASEMBRAPA condicional, parceiros bloqueados (já temos)
- ✅ Handover triggers básicos: NF, receita, humano (Sprint 1 entregue)
- ✅ Pré-operatório (Sprint 1 entregue)
- ✅ Convênio fallback particular (Sprint 1 entregue)
- 🔨 Workflow n8n base (Evolution ↔ /chat ↔ sendText)
- 🔨 Lookup paciente por telefone + saudação personalizada
- 🔨 Mensagens picotadas + indicador de digitação
- 🔨 Chatwoot integration: conversation auto-create + etiqueta + lock
- 🔨 Webhook Chatwoot: desbloqueio IA (resolved OU 4h timeout)
- 🔨 Fila de espera ativa: cancelamento → notifica → 4h timeout → próximo
- 🔨 Webhook cancelamento médico em massa: remarca pacientes do dia

**NÃO inclui no MVP:**
- ❌ Multimodal (foto de guia/exame) → Sprint 3
- ❌ Migração WhatsApp Business API (Meta) → Sprint 4
- ❌ Onboarding self-service de novas clínicas → Sprint 4
- ❌ Outros médicos além de Marcelo+Suely → ativação gradual pós-MVP

### B.2 Roadmap completo

| Sprint | Duração | Entregas |
|---|---|---|
| **S1** | Semana 1 | Workflow n8n base + saudação + handover + Chatwoot setup parcial |
| **S2** | Semana 2 | Chatwoot completo (handover bidirecional) + fila ativa + webhook cancelamento médico |
| **S3** | Semana 3 | Multimodal (imagem/PDF de guia) + refinamentos baseados em piloto |
| **S4** | Semana 4 | Meta WhatsApp Business API + onboarding auto + outras clínicas |

### B.3 Definition of Done por feature

**Feature está "pronta" quando atende TODOS estes critérios:**

1. **Funcional**: cenário happy path automatizado em suite passa em prod
2. **Errors handled**: 2+ cenários error path automatizados passam
3. **Multi-tenant**: testado com Marcelo E Suely (clientes diferentes)
4. **Observabilidade**: emite log estruturado + audit_log se for ação sensível
5. **Documentação**: 1 parágrafo em `docs/automacao-whatsapp/` explicando
6. **Rollback**: feature flag OU pode ser desativada via config sem deploy
7. **Latência**: p95 ≤ 5s (chat com LLM) ou ≤ 1s (handlers fast)

### B.4 Métricas de sucesso

Medidas semanalmente, dashboard simples (Metabase/Supabase Studio):

| Métrica | Target MVP | Como medir |
|---|---|---|
| **Taxa de resolução autônoma** | ≥ 70% das conversas | `audit_logs` sem handover trigger |
| **Taxa de handover correto** | ≥ 90% (quando dispara é caso real) | Recepção marca "falso-positivo" no Chatwoot |
| **Latência p95 chat** | ≤ 5s | Logs edge function |
| **NPS pós-atendimento** | ≥ 60 | Mensagem opcional ao final: "De 0-10 como foi seu atendimento?" |
| **Agendamentos concluídos via IA** | ≥ 60% dos novos | `criado_por = 'LLM Agent WhatsApp'` |
| **Custo médio por atendimento** | ≤ R$ 0.05 | OpenAI billing / total conversas |
| **Conversas perdidas (paciente não responde)** | ≤ 15% | Aguardando 4h+ sem msg |

### B.5 User stories

**Paciente (Maria, 45 anos, paciente da Pro Oftalmo):**
> Como paciente da Dra. Suely, quero agendar consulta pelo WhatsApp sem
> ligar pra clínica, em qualquer horário, sabendo se meu convênio é
> atendido e qual horário tem vaga.

> Como paciente, quero mandar foto da minha guia médica e ter o agente
> identificando o exame e me orientando sobre o agendamento.

**Recepção (Jeniffe, Pro Oftalmo):**
> Como recepcionista, quero acompanhar as conversas do agente no Chatwoot
> pra intervir quando necessário, sem precisar abrir o WhatsApp.

> Como recepcionista, quero que quando eu marco a conversa como "concluída",
> o agente volte a responder o paciente automaticamente.

> Como recepcionista, quero que quando eu cancelar a agenda do médico
> (ex: emergência), os pacientes do dia sejam avisados e remarcados
> automaticamente pelo agente.

**Médico (Dr. Marcelo):**
> Como médico, quero que pacientes com fístula ou peso > 150kg NUNCA agendem
> Teste Ergométrico — mesmo que insistam — porque é contra-indicação clínica.

> Como médico, quero que o agente NUNCA dê diagnóstico ou alterar prescrição
> — só agendar e informar.

### B.6 Casos extremos (documentar agora pra não virar bug)

| Caso | Comportamento esperado |
|---|---|
| Paciente menor de idade tenta agendar | Agente confirma idade. Se < 18, exige acompanhante. |
| Paciente em óbito (CPF na lista de óbito) | Bloqueio "Esse cadastro tem restrição. Procure a recepção." |
| Médico de férias (bloqueio_agenda dia inteiro) | Já tratado. Sugere próxima data disponível. |
| Conversa de spam (link malicioso) | Detecta padrão, ignora. Após 3 spams seguidos, lock_conversa = true. |
| Paciente fala em outro idioma | Agente responde "Atendemos apenas em português. Pode me dizer em português?" |
| Mensagem de voz | "Recebi um áudio. Não consigo transcrever ainda. Pode mandar por texto?" |
| Sticker, gif, emoji só | Ignora ou responde "Recebi seu sticker 😊" sem coletar dado |
| Múltiplas mensagens em sequência rápida (< 5s) | n8n debounce: agrega últimas 3 msgs antes de chamar /chat |
| Paciente cancela com paciente da fila notificado | Re-notifica próximo da fila imediatamente |
| Sistema OpenAI fora do ar | Fallback humanizado: "Estou com instabilidade. Posso te transferir pra recepção?" |

---

## C. Implementação

### C.1 Backlog priorizado

**Notação:** [Sprint #]:[Estimativa em dias]:[Prioridade P0/P1/P2]

#### Sprint 1 — Foundation (5 dias úteis)

| # | Item | Est | Prio | Dependência |
|---|---|---|---|---|
| 1 | Setup n8n + import workflow | 0.5d | P0 | Evolution rodando |
| 2 | Lookup paciente por telefone (node Postgres no n8n) | 0.5d | P0 | — |
| 3 | Mensagens picotadas + typing (sendPresence Evolution) | 0.5d | P0 | Evolution |
| 4 | Chatwoot setup: 1 inbox por clínica + API key | 1d | P0 | Chatwoot rodando |
| 5 | Sync conversation Evolution → Chatwoot (criar/buscar) | 1d | P0 | #4 |
| 6 | Handover quando audit_reason=HANDOVER_*: etiqueta + lock | 1d | P0 | #5 |
| 7 | Smoke test Marcelo+Suely no WhatsApp do dev | 0.5d | P0 | tudo |

#### Sprint 2 — Operações (5 dias úteis)

| # | Item | Est | Prio | Dependência |
|---|---|---|---|---|
| 8 | Webhook Chatwoot `conversation_resolved` → unlock IA | 1d | P0 | Sprint 1 |
| 9 | Cron 4h timeout → unlock IA automaticamente | 0.5d | P0 | #8 |
| 10 | Fila de espera ATIVA: worker que notifica próximo após cancel | 2d | P0 | — |
| 11 | Webhook outbound: recepção cancela dia médico → remarca pacientes | 2d | P0 | #10 |
| 12 | Triggers DB pra disparar workers (cancel, bloqueio_agenda) | 0.5d | P1 | #10 #11 |

#### Sprint 3 — Multimodal + Refinamentos (5 dias úteis)

| # | Item | Est | Prio |
|---|---|---|---|
| 13 | Novo handler `/analyze-media` com GPT-4o Vision | 2d | P1 |
| 14 | Storage de mídia (Supabase Storage ou Cloudflare R2) | 1d | P1 |
| 15 | Integração: imagem/PDF → /analyze-media → enriquece /chat | 1d | P1 |
| 16 | Refinar saudação por nome (resposta determinística via override) | 0.5d | P2 |
| 17 | Detecção de mensagens picotadas (debounce 5s) | 0.5d | P2 |

#### Sprint 4 — Escala (5 dias úteis)

| # | Item | Est | Prio |
|---|---|---|---|
| 18 | Migração Evolution → Meta WhatsApp Business API | 2d | P1 |
| 19 | Templates de mensagem aprovados pela Meta | 1d | P1 |
| 20 | Onboarding automatizado de nova clínica (script) | 1d | P2 |
| 21 | Dashboard de métricas (Metabase ou view SQL) | 1d | P2 |

**Total estimado:** 20 dias úteis = 4 semanas de trabalho focado.

### C.2 Estimativas honestas

- Estimativas têm **buffer de 20%** embutido.
- "1 dia útil" = 6h efetivas (descontando reunião/contexto).
- Cada sprint reserva **1 dia pra imprevistos** (debug, refactor descoberto, etc).
- **Não há sprint zero** — estamos partindo de backend já maduro.

### C.3 Dependências críticas (caminho crítico)

```
Sprint 1: Evolution → n8n → Chatwoot setup
                                    ↓
Sprint 2: Chatwoot bidi ← Fila ativa ← Webhooks
                                    ↓
Sprint 3: Multimodal (independente — pode ser paralelo)
                                    ↓
Sprint 4: Meta API (após validar piloto na Evolution)
```

**Bloqueadores:**
- Evolution API precisa estar rodando + número WhatsApp registrado por clínica
- Chatwoot precisa estar rodando + 1 inbox por clínica
- OpenAI API key com quota suficiente
- Acesso DB Supabase (já tem)

### C.4 Riscos + mitigações

| # | Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Conta WhatsApp banida (Evolution não-oficial) | Média | Alto | Migrar pra Meta API no Sprint 4. Não enviar mensagens em massa. Respeitar TOS |
| R2 | LGPD: PII enviado pra OpenAI (server US) | Alto | Alto | Mascarar nome/celular antes de enviar; consentimento no 1º turno; DPO assinar; Anthropic ou OpenAI on Azure (Brasil region) como alternativa futura |
| R3 | CFM 2.314/22: IA dando "diagnóstico" | Médio | Alto | Prompt explícito "NUNCA diagnóstico/prescrição"; revisar mensagens com médico antes de soltar; auditar 50 primeiras conversas reais |
| R4 | Quota OpenAI estourada | Baixa | Alto | Hard cap por cliente_id; circuit breaker; fallback "estamos com instabilidade, transferindo pra recepção" |
| R5 | LLM responde besteira pro paciente | Média | Médio | Audit logs review semanal; recepção marca "resposta errada" no Chatwoot; feedback loop |
| R6 | Chatwoot self-hosted cai | Baixa | Médio | Backup do volume Docker; deploy 2 nodes se necessário; alerta uptime |
| R7 | Custo OpenAI escalando além do previsto | Média | Médio | Monitorar billing diário; hard limit; otimizar prompt pra reduzir tokens |
| R8 | Recepção não adota Chatwoot | Alto | Alto | Treinamento + 1 semana acompanhada + UX polida; alertar via WhatsApp pessoal se demorar |
| R9 | n8n self-hosted cai | Baixa | Alto | Backup workflows export json; alerta uptime; deploy em VPS confiável; opcional: n8n cloud |

### C.5 Critérios Go/No-Go por sprint

**Sprint 1 → Sprint 2 (Go):**
- ✅ Workflow n8n recebe webhook Evolution, chama /chat, envia resposta
- ✅ Handover funcional: paciente pede humano → Chatwoot etiqueta
- ✅ Suíte 296 + Sprint 1 testes verde

**Sprint 2 → Sprint 3 (Go):**
- ✅ Recepção consegue operar 100% via Chatwoot
- ✅ Resolved → IA volta automaticamente
- ✅ Fila ativa: cancelei agendamento → próximo paciente notificado em < 1min
- ✅ Webhook cancelamento médico: remarcou 10 pacientes corretamente

**Sprint 3 → Sprint 4 (Go):**
- ✅ Multimodal: foto de guia identifica exame corretamente em 80% dos casos
- ✅ Métricas MVP atingidas (taxa resolução ≥ 70%)
- ✅ 50 conversas reais auditadas sem falha grave

**Sprint 4 → escala (Go):**
- ✅ Migração Meta concluída ou Evolution estável por 30 dias
- ✅ Onboarding documentado e testado com 1 clínica nova
- ✅ Custo por atendimento dentro do target

### C.6 Critérios No-Go (para)

**Para qualquer sprint:**
- ❌ Bug crítico em prod afetando agendamentos
- ❌ LGPD ou CFM compliance comprometido
- ❌ Custo OpenAI > 3x o previsto
- ❌ Taxa de erro do agente > 20% em 1 semana
- ❌ Recepção pedindo pra "desligar a IA" (sinal de UX ruim)

---

## D. Operacional

### D.1 Ambientes

**Hoje:** só `produção` (`qxlvzbvzajibdtlzngdy`).

**Recomendação para Sprint 2:**
- Manter prod
- Criar **staging** (`Supabase project new`): clone com dados anonimizados
- Variável `EXECUTION_MODE=staging|prod` no edge function
- Testes E2E rodam no staging via CI antes de deploy prod

**Alternativa low-cost:** feature flags por cliente_id (cliente "demo" para testes
em prod). Menos seguro mas mais barato.

### D.2 Deploy strategy

**Edge function (llm-agent-api):**
- Versionamento por commit hash
- Deploy via `supabase functions deploy` (já automatizado)
- Rollback: re-deploy commit anterior em ~1min

**Frontend (Lovable):**
- Auto-deploy via push em `lovable-dev`

**Database (migrations):**
- Sempre via MCP `apply_migration` ou supabase CLI
- Migrations são append-only com timestamp YYYYMMDDHHMMSS
- Rollback: criar nova migration que reverte (NUNCA editar histórico)

**Canário por cliente_id:**
- Sprint 1+2: ativar n8n SÓ pra Marcelo (cliente_id `2bfb98b5`)
- Validar 1 semana → ativar Suely (`0b6a0a35`)
- Validar 2 semanas → ativar outras clínicas

### D.3 Rollback plan

**Cenário 1: IA respondendo errado**
```sql
-- Lockear TODAS conversas de 1 clínica
UPDATE n8n_status_atendimento SET lock_conversa = true WHERE cliente_id = '...';
```
→ Recepção opera via Chatwoot até fix.

**Cenário 2: Edge function quebrada**
```bash
git revert <commit-bug>
git push  # Lovable não deploy edge functions — fazer manual:
supabase functions deploy llm-agent-api
```

**Cenário 3: Bug crítico em produção**
- Desativar webhook Evolution → n8n (Evolution stop sending)
- WhatsApp volta a chegar manual na recepção
- Fix → re-ativar webhook

### D.4 On-call

**Pra MVP:**
- Owner: Gabriela (única dev)
- Alertas: configurar Supabase logs → Telegram/Email quando audit_logs.error
- SLA não-comprometido: best-effort durante horário comercial
- Fora-de-horário: Chatwoot lock_conversa=true em todas conversas (fail-safe)

**Pós-MVP (10+ clínicas):**
- Considerar adicionar 1 dev pra suporte
- SLA formal por contrato
- Pagerduty ou similar

### D.5 Onboarding de nova clínica/médico

**Hoje (manual, 5+ passos):**

1. Cliente cadastrado em `clientes`
2. Médico cadastrado em `medicos`
3. `business_rules.config` populada
4. `atendimentos` + `medico_atendimento` linkados
5. (Se WhatsApp) Evolution instance + Chatwoot inbox + webhook

**Sprint 4 — automatizar:**

Script `scripts/onboard-clinica.ts`:
```typescript
onboardClinica({
  nome: "Clínica X",
  email: "...",
  medicos: [{ nome, especialidade, crm, rqe, convenios, ... }],
  whatsapp: { numero, evolution_url },
})
```

Cria tudo (clientes, medicos, business_rules, atendimentos, medico_atendimento,
configura Evolution instance via API, cria Chatwoot inbox via API, configura
webhook). ~30s end-to-end.

---

## E. Compliance

### E.1 LGPD

**Dados pessoais tratados:**
- Nome completo, telefone, data de nascimento, convênio, número de carteirinha
- Mensagens trocadas (podem conter informação clínica sensível)

**Bases legais:**
- Execução de contrato (paciente quer agendar)
- Legítimo interesse (relação prévia paciente-clínica)

**Obrigações:**

1. **Consentimento no 1º turno:** mensagem inicial inclui
   > "Suas informações serão usadas apenas para agendamento e atendimento.
   > Saiba mais em [link/politica-privacidade]. Continuando, você concorda."

2. **Anonimização em logs:**
   - PII NÃO loggado em logs estruturados (já fazemos: só booleans `has_*`)
   - OpenAI request NÃO inclui CPF, número de carteirinha, sintomas detalhados
   - `maskPIIDeep()` já existe em `_lib/pii.ts` — auditar uso

3. **Retenção:**
   - `n8n_chat_histories` + `n8n_status_atendimento`: 90 dias após última interação
   - Cron diário: `DELETE FROM ... WHERE updated_at < now() - interval '90 days'`
   - Agendamentos e pacientes: retenção indefinida (legítimo interesse médico)

4. **Direito de exclusão:**
   - Paciente pode pedir exclusão: handler `/lgpd-delete` (futuro Sprint 4+)
   - Anonimização: substitui `nome_completo`, `celular`, `telefone` por `[EXCLUÍDO]`

5. **DPO/Encarregado:**
   - Inovaia precisa designar encarregado LGPD
   - Política de Privacidade publicada em URL pública

### E.2 CFM Res. 2.314/22 (telemedicina + IA em saúde)

**Limites explícitos no prompt do agente:**

```
PROIBIDO:
- Dar diagnóstico ("você tem hipertensão", "isso é fibrilação")
- Prescrever medicação ("tome captopril 25mg")
- Alterar tratamento ("pode parar o losartan")
- Interpretar exames ("seu eletro está normal/alterado")
- Decisão de urgência ("vai pro PS agora" / "espera amanhã")

PERMITIDO:
- Agendar/cancelar/remarcar consultas e exames
- Informar valores, formas de pagamento, convênios aceitos
- Informar horário, endereço, telefone da clínica
- Pedir foto de guia médica para identificar exame solicitado
- Transferir para humano quando solicitado
```

**Auditoria mensal:** revisar 50 conversas aleatórias contra essas regras.
Se IA cruzou linha → ajustar prompt + audit log + comunicação Conselho.

### E.3 Backup e DR

**Hoje:** Supabase auto-backup (PIT recovery 7 dias).

**Pra produção em escala:**
- Backup diário off-site (Supabase → S3 ou Backblaze B2) — 30 dias retenção
- Teste de restore trimestral (validar que backup funciona)
- DR objetivo: RPO 24h, RTO 4h

### E.4 Auditoria

**Já temos:**
- `audit_logs` com action, user_id, old/new values, changed_fields, ip_address
- Trigger genérico em UPDATE de agendamentos
- Trigger específico em `agendamento_forcado`
- Trigger específico em `observacao_editada`

**Adicionar pro MVP:**
- `agente_decisao_critica`: log quando agente toma decisão sensível (handover,
  bloqueio convênio, encaixe fila)
- `lgpd_consent_given`: log quando paciente aceita política no 1º turno
- `lgpd_exclusion_requested`: log de pedidos de exclusão

---

## F. Financeiro

### F.1 Custos operacionais (1 clínica, 200 conversas/mês)

| Item | Custo/mês | Observação |
|---|---|---|
| OpenAI gpt-4o-mini | $3-6 | ~$0.015-0.030 por conversa de 5-10 turnos |
| OpenAI gpt-4o vision | $2-5 | Só quando paciente manda imagem (~20% das conversas) |
| Evolution API | hardware atual | self-hosted, custo marginal |
| n8n | $0 ou hardware | self-hosted |
| Chatwoot | $0 ou hardware | self-hosted |
| Supabase Pro | $25 | Único custo "vendor lock-in" |
| WhatsApp Meta (pós-Sprint 4) | $1.7-2.85 | $0.0085 por conversa Meta-iniciada |

**Total por clínica:** R$ 30-80/mês (escala suave com volume).

### F.2 Custo por atendimento

- Atendimento simples (4 turnos texto): ~$0.005 = **R$ 0.025**
- Atendimento com imagem (vision): ~$0.012 = **R$ 0.060**
- Atendimento longo (15+ turnos): ~$0.020 = **R$ 0.100**

**Comparação:** atendente humano custa ~R$ 5-15 por hora.
1 atendente faz ~6 atendimentos/hora (10min cada). Custo por atendimento humano:
R$ 0.80 - R$ 2.50.

**ROI:** IA é 30-100x mais barata por atendimento.

### F.3 Hard caps de gasto

**OpenAI:**
- Hard limit conta: $200/mês (10x o esperado)
- Soft limit notificação: $50/mês

**Por cliente_id (no edge function):**
- `tenant_quota_daily` table já existe — popular com limite OpenAI/dia
- Default: 1000 turnos chat/dia + 200 vision/dia
- Excedeu: agente responde "Estou com instabilidade, transferindo pra recepção"

### F.4 ROI projetado

**Cenário conservador (Marcelo + Suely):**
- ~150 conversas/mês cada = 300 conversas/mês total
- Custo IA: R$ 30/mês
- Equivalente humano: 50h trabalho/mês = R$ 750-1500
- **Economia: R$ 720+/mês** (descontando custo do contrato Inovaia)

**Cenário escala (10 clínicas, 500 conversas cada):**
- 5000 conversas/mês
- Custo IA: R$ 500/mês
- Equivalente humano: 800h = R$ 12.000-24.000
- **Economia agregada: R$ 11.500+/mês**

---

## Anexo I — Checklist de Go-Live (Sprint 2 → piloto produção)

**Ambiente:**
- [ ] n8n rodando em VPS estável (uptime monitoring)
- [ ] Evolution instances Marcelo + Suely conectadas
- [ ] Chatwoot rodando + inboxes criadas
- [ ] Supabase RLS ativa em `n8n_status_atendimento` (já feito ✅)
- [ ] OpenAI key com quota mensal $200+

**Configuração:**
- [ ] Webhook Evolution → n8n
- [ ] Webhook Chatwoot `conversation_resolved` → n8n
- [ ] Variáveis ambiente n8n setadas (EVOLUTION_URL, etc)
- [ ] Política de Privacidade publicada em URL
- [ ] DPO designado

**Operação:**
- [ ] Recepção treinada (1h sessão por clínica)
- [ ] Documento "como usar Chatwoot" entregue
- [ ] Telegram/email alerta erros configurado
- [ ] Plano rollback documentado
- [ ] Contatos emergência (eu/Gabriela)

**Validação:**
- [ ] 1 dia em "modo sombra" (IA processa mas não responde, recepção valida)
- [ ] 50 conversas reais auditadas
- [ ] Métricas MVP atingidas (taxa resolução ≥ 70%)

---

## Anexo II — Decisões pendentes (para você responder)

Antes de avançar, preciso de respostas a estas perguntas:

1. **Orçamento de tempo:** 4 semanas de trabalho focado é viável? Ou prefere 6 semanas com folga?
2. **Recursos:** sou o único dev ou outro time vai ajudar?
3. **Política de Privacidade:** já existe? Quem é o DPO?
4. **Chatwoot:** já roda? Versão? Onde (Hetzner, Hostinger, AWS)?
5. **Evolution:** estável? Quantos chips/instances disponíveis?
6. **Meta WhatsApp Business:** já tem aplicação aprovada ou precisa começar do zero?
7. **Métricas:** quer dashboard real-time (Metabase) ou semanal por email é OK?
8. **CFM:** Dr. Marcelo / Dra. Suely revisaram as regras "permitido vs proibido"?
9. **Prazo:** quando você quer Marcelo+Suely no ar (data limite)?
10. **Outros médicos:** quais 3 próximos depois de Marcelo+Suely?

**Após você responder essas 10 perguntas, ajusto o plano e começamos Sprint 1
(Foundation) com tudo definido.**
