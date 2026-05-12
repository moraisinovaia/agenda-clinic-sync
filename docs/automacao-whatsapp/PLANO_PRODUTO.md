# Plano Produto v2 — Automação WhatsApp + IA (Inovaia Medical)

**Versão:** 2.0 — 2026-05-12
**Status:** Draft para aprovação (substitui v1 que foi escrita antes do audit dos 13 workflows existentes)
**Owner:** Gabriela Morais
**Backend ops:** 6 clínicas, 45 médicos ativos, 3.825 agendamentos/mês

---

## 0. Sumário Executivo

A Inovaia já tem **infraestrutura quase completa** para o produto descrito:

- **13 workflows n8n** com arquitetura LangChain Agent + 9 tools modulares + RAG full-text + memória Postgres
- **5 RPCs atômicas** no DB (criar / remarcar / fila / disponibilidade / regras)
- **500 convênios cadastrados** em 47 médicos, com `tipo` (informativo/bloqueado/etc) e `mensagem_orientacao`
- **Backend Edge Function `llm-agent-api`** maduro (296 testes, regras hardcoded Marcelo) — útil pro frontend web
- **Schema Chatwoot** já planejado em `clinica_motor_config` (url, account, inbox, provisionamento)
- **`fila_pendente_resposta`** existe + sub-workflow `ProcessarRespostaFila` existe

**O que falta é completar o "última milha":** plugar o que existe + corrigir 3 bugs estruturais + construir Chatwoot bidirecional + ativar trigger de fila + popular `clinica_motor_config`.

**Estimativa realista pós-audit:** 2-3 semanas (não 4 como na v1), porque a base é mais madura do que eu havia avaliado.

---

## A. Arquitetura REAL (descoberta pós-audit)

### A.1 Diagrama lógico

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PACIENTE (WhatsApp)                                                     │
└────────────────┬────────────────────────────────────────────────────────┘
                 │ texto / áudio / imagem / PDF
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ EVOLUTION API (1 instância por clínica)                                 │
│  POST /webhook (MESSAGES_UPSERT) → n8n                                  │
└────────────────┬────────────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ n8n — MTCL__RecepcaoMensagemWhatsapp (HUB)                              │
│  1. Filtra fromMe                                                       │
│  2. Lookup clínica via evolution_instance_id (configuracoes_clinica)    │
│  3. Consulta modo_atendimento (ia | humano)                             │
│  4. Checa fila_pendente_resposta (notificação pendente?)                │
│  5. Roteia tipo mensagem: texto / áudio+img+pdf / não-suportado         │
│  6. Triagem mídia → MLTC_WF__TriagemMidia_v3                            │
│  7. Adiciona mensagem em fila Redis + debounce 10s                      │
│  8. Anti-duplicidade por message_id                                     │
│  9. Verifica lock_conversa (humano operando?)                           │
│ 10. Chama MotorAtendimentoIA OU descarta                                │
└────────────────┬────────────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ n8n — MTCL__MLTC_WF__MotorAtendimentoIA                                 │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  PreBloco (lock_conversa=true, busca config dinâmica do prompt)  │   │
│  │  Limpa histórico se inativo > 12h (defesa D2)                    │   │
│  │  AI Agent (LangChain) — OpenRouter (modelo por clínica)          │   │
│  │   Memory: Postgres Chat (session_id = cliente:numero)            │   │
│  │   Tools: 9 sub-workflows                                         │   │
│  │  PosBloco (lock=false, picota resposta, sendText + typing)       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────────────────┘
                 │ chama tools via $fromAI
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 9 TOOLS (sub-workflows n8n)                                             │
│  - consultarMedicos        (lista médicos + convênios + atendimentos)   │
│  - consultarDisponibilidade (rpc_get_disponibilidade)                   │
│  - consultarAgendamentosPaciente (busca por celular/nome+nasc)          │
│  - criarAgendamento        (criar_agendamento_atomico_externo)          │
│  - remarcarAgendamento     (remarcar_agendamento_atomico)               │
│  - entrarFilaEspera        (entrar_fila_espera_atomico)                 │
│  - consultarPreparoProcedimento (jejum, medicações, itens)              │
│  - consultarRegrasAtendimento (consultar_regras_atendimento RPC)        │
│  - consultarFaq            (full-text search em knowledge_chunks → RAG) │
│  - tool_diaDaSemana        (resolve "sexta" → data ISO)                 │
│  - transferirHumano        (modo_atendimento='humano')                  │
└────────────────┬────────────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SUPABASE (operacional) + Supabase RAG separado                          │
│  Operacional: agendamentos, pacientes, medicos, atendimentos,           │
│               convenios_medico, business_rules, fila_espera,            │
│               fila_pendente_resposta, n8n_status_atendimento,           │
│               n8n_chat_histories, historico_eventos, audit_logs         │
│  RAG: knowledge_chunks (FTS websearch_to_tsquery)                       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ WORKERS / TRIGGERS (a construir)                                        │
│  - Trigger DB: agendamento cancelado → enfileira notif próximo da fila  │
│  - Cron 4h: timeout fila + timeout humano                               │
│  - Webhook recepção: cancela agenda médica em massa → remarca pacientes │
│  - Webhook Chatwoot: conversation_resolved → unlock IA                  │
│  - Cron LGPD: retenção 90d em n8n_chat_histories                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ OPENROUTER (modelo configurável por clínica via clinica_motor_config)   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ CHATWOOT (a integrar bidirecionalmente)                                 │
│  - 1 inbox por clínica (campos em clinica_motor_config)                 │
│  - n8n cria conversation no 1º contato                                  │
│  - tool_transferirHumano: adiciona etiqueta "atendimento humano"        │
│  - Webhook Chatwoot resolved → unlock IA                                │
│  - Cron 4h sem msg → unlock IA                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### A.2 State machine real (já implementada parcialmente)

```
                  [PACIENTE ENVIA MSG]
                          │
                          ▼
                ┌── tem clínica? ──┐
                │ não              │ sim
                ▼                  ▼
        [notifica admin]    [fila pendente?]
                                   │
                ┌──────────────────┴──────────────┐
                │                                 │
                ▼                                 ▼
       [ProcessarRespostaFila]                [tipo msg]
                                                  │
                          ┌──── texto / áudio+img ────┴── não-suportado
                          ▼                                 │
                  [Redis + debounce 10s]                    ▼
                          │                          [notifica + para]
                          ▼
                ┌── lock_conversa? ──┐
                │ true               │ false
                ▼                    ▼
            [para — humano]    [MotorAtendimentoIA]
                                    │
                                    ▼
                            [AI Agent + tools]
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
                  [resposta normal]  [tool_transferirHumano]
                          │                   │
                          ▼                   ▼
                  [PosBloco envia]    [modo='humano', etiqueta]
                                              │
                                              ▼
                                   (aguarda recepção concluir
                                    OU timeout 4h)
```

---

## B. Estado real por feature solicitada

Comparação ponta-a-ponta entre **o que você pediu** e **o que existe hoje**:

| # | Feature solicitada | Status atual | Esforço pra completar |
|---|---|---|---|
| 1 | Conversação natural | ✅ LangChain Agent + OpenRouter | — |
| 2 | Memória contexto, não perde fio | ✅ Postgres Chat Memory + reset 12h | — |
| 3 | Mensagens picotadas + typing | ✅ `presence: composing, delay: 3000` no PosBloco | — |
| 4 | Tolerância a português quebrado/erros | ✅ LLM nativo | — |
| 5 | Agendar consulta | ✅ tool_criarAgendamento + RPC atômica | — |
| 6 | Cancelar | ⚠️ Sem tool dedicada (usa endpoint Edge?) | Criar tool_cancelarAgendamento (1h) |
| 7 | Remarcar | ✅ tool_remarcarAgendamento + RPC atômica | — |
| 8 | Confirmar presença | ⚠️ Sem tool dedicada | Criar tool_confirmarAgendamento (1h) |
| 9 | Fila de espera (entrar) | ✅ tool_entrarFilaEspera + RPC | — |
| 10 | Fila ativa (notifica próximo qd cancela) | 🔴 fila_pendente_resposta existe, mas FALTA trigger inicial | 2 dias |
| 11 | Loop 4h fila (próximo, próximo...) | 🔴 ProcessarRespostaFila existe mas não vi loop final | 1 dia |
| 12 | Saudação personalizada por nome | 🔴 Prompt genérico, não consulta paciente | 30min |
| 13 | "Primeira interação do dia" saúda mesmo se já pergunta | 🔴 Não tem | 30min |
| 14 | Consulta rotina vs pré-operatório | 🔴 Prompt não distingue | 1h (atualizar prompt + checks no consultarRegrasAtendimento) |
| 15 | Pré-op: agenda consulta + avisa ECG + cobrança dupla | 🔴 Não tem fluxo | 2h |
| 16 | MAPA: precisa identificar tipo + foto guia | ⚠️ Triagem mídia existe (subworkflow), mas não vi orquestração | 2-3 dias (depende multimodal) |
| 17 | Convênio aceito → agenda; não aceito → particular com valor | 🟡 Depende de `convenios_medico.tipo` + prompt instrui | 30min ajuste prompt |
| 18 | Imagem + PDF de guia → identificar exame e propor | 🟡 `MLTC_WF__TriagemMidia_v3` existe mas conteúdo não auditado | 2-3 dias |
| 19 | Áudio do paciente → transcrever | ⚠️ Roteado pra TriagemMidia, mesma incerteza | (incluído em #18) |
| 20 | Formato não suportado → orientar | ✅ Resposta padrão "Desculpe nao consigo interpretar..." | — |
| 21 | Transferir humano (NF, receita, pedido) | 🟡 tool_transferirHumano existe, MAS prompt diz "PROIBIDO oferecer humano" | Refinar prompt + adicionar gatilho automático |
| 22 | Chatwoot: criar conversation + etiqueta | 🔴 Schema existe, sem workflow | 1-2 dias |
| 23 | Volta IA quando recepção marca resolvido | 🔴 Sem webhook receiver | 1 dia |
| 24 | Volta IA após 4h sem msg | 🔴 Sem cron | 0.5 dia |
| 25 | Webhook cancelamento agenda médica em massa | 🔴 Não existe | 1-2 dias |
| 26 | Migração Evolution → Meta WhatsApp Business | 🔴 Não iniciada | 2-3 dias (depois piloto) |

**Resumo de gaps:** ~12-15 dias úteis de trabalho focado = **2.5-3 semanas**.

---

## C. Bugs ESTRUTURAIS descobertos no audit (P0 — fix antes de plugar)

### C.1 `fila_pendente_resposta` schema desalinhado

`checarFilaPendente` faz SELECT em colunas que NÃO existem: `fila_id, cliente_id, cliente_id_agendamento, data_agendamento, hora_agendamento, medico_nome, atendimento_nome`. Schema real tem `id, celular, notif_id, tempo_limite, payload jsonb`.

**Fix:** ou ajustar workflow pra ler `payload->>'campo'` ou adicionar colunas via migration.

### C.2 `buscarClinicaSupabase` mistura tabelas

Workflow busca em `configuracoes_clinica` mas usa campos `transbordo_humano_ativo`, `mensagem_transbordo` que estão em `clinica_motor_config` (vazia hoje). Como `clinica_motor_config` está vazia, todo workflow assume defaults silenciosamente.

**Fix:** mudar query pra JOIN `configuracoes_clinica c LEFT JOIN clinica_motor_config cmc ON cmc.id = c.cliente_id` (ou similar).

### C.3 `clinica_motor_config` vazia

0 rows. Workflow `buscarConfigClinica` faz `LEFT JOIN cmc` e cai em defaults (`'gemini-2.5-flash'`). Pra Marcelo e Suely operarem, precisa popular:
- `nome_clinica` (já tem em `clientes` mas duplicado aqui)
- `prompt_sistema` (custom por clínica se necessário)
- `prompt_agendamentos`
- `modelo_ia` (default `gemini-2.5-flash`)
- `transbordo_humano_ativo` (bool)
- `mensagem_transbordo` (texto)
- `chatwoot_url`, `chatwoot_account_id`, `chatwoot_inbox_id` (quando plugar)

### C.4 `consultarFaq` aponta pra Supabase separado

Credencial `Supabase-RAG Local Setup` (porta 54332 / Kong 54331). Se essa infra não estiver rodando ou `knowledge_chunks` estiver vazia, **toda pergunta de FAQ falha silenciosamente**. Não consegui validar (DB separado).

**Ação:** validar se o Supabase RAG está rodando e tem chunks aprovados. Senão, todo fluxo informativo (preço, política, regras) fica órfão.

### C.5 Tools ausentes: `cancelar` e `confirmar`

`MotorAtendimentoIA` lista 11 tools, mas não tem `tool_cancelarAgendamento` nem `tool_confirmarAgendamento`. Você pediu "cancelamentos e confirmações" — falta criar essas 2 tools (~1h cada, mesmo template das outras).

---

## D. Roadmap revisado

### Sprint 1 — Foundation (1 semana)

**Objetivo:** Marcelo + Suely respondendo no WhatsApp em piloto fechado.

| # | Item | Esforço | Prioridade |
|---|---|---|---|
| 1 | Fix bug `fila_pendente_resposta` (alinhar schema OU workflow) | 30min | P0 |
| 2 | Fix bug `buscarClinicaSupabase` (JOIN com `clinica_motor_config`) | 30min | P0 |
| 3 | Popular `clinica_motor_config` pra Marcelo + Suely (sem Chatwoot ainda) | 30min | P0 |
| 4 | Validar Supabase RAG + popular `knowledge_chunks` com info essencial Marcelo+Suely | 4h | P0 |
| 5 | Criar `tool_cancelarAgendamento` | 1h | P0 |
| 6 | Criar `tool_confirmarAgendamento` | 1h | P0 |
| 7 | Sub-workflow que adiciona `nome_paciente` no contexto via lookup `pacientes.celular` antes do agente | 1h | P0 |
| 8 | Ajustar prompt: saudação por nome + "primeira interação do dia" + pré-op + fallback particular + handover triggers | 2h | P0 |
| 9 | Validar `MLTC_WF__TriagemMidia_v3.0` (auditar conteúdo, testar com imagem real) | 4h | P0 |
| 10 | Plugar 1 instância Evolution → 1 clínica → testar fim a fim 5 cenários | 4h | P0 |

**Total Sprint 1:** ~3-4 dias úteis.

### Sprint 2 — Chatwoot bidirecional (1 semana)

| # | Item | Esforço |
|---|---|---|
| 11 | Provisionar Chatwoot (1 inbox por clínica) | 2h |
| 12 | Sub-workflow que cria conversation no Chatwoot no 1º contato + sync mensagens | 4h |
| 13 | Sub-workflow que adiciona etiqueta "atendimento humano" quando `tool_transferirHumano` dispara | 2h |
| 14 | Webhook receiver: Chatwoot `conversation_resolved` → unlock IA | 2h |
| 15 | Cron 4h timeout sem msg do paciente → unlock IA | 2h |
| 16 | Triggers automáticos de handover via prompt (NF, receita, agente confuso) | 2h |
| 17 | Treinar recepção (1h por clínica + doc 1 página) | 2h |
| 18 | Smoke real 50 atendimentos | — |

**Total Sprint 2:** ~2-3 dias úteis + tempo de validação.

### Sprint 3 — Operações automáticas (1 semana)

| # | Item | Esforço |
|---|---|---|
| 19 | Trigger DB: agendamento cancelado → enfileira notif próximo da fila | 4h |
| 20 | Cron worker: processa fila_pendente_resposta com timeout 4h + loop próximo | 1 dia |
| 21 | Sub-workflow completo `ProcessarRespostaFila` (parsear sim/não/depois) | 4h |
| 22 | Webhook recepção: cancelamento agenda médica em massa → workflow itera + remarca | 1 dia |
| 23 | Cron LGPD: retenção 90d em `n8n_chat_histories` + `historico_eventos` | 2h |

**Total Sprint 3:** ~3-4 dias úteis.

### Sprint 4 — Escala (1 semana)

| # | Item | Esforço |
|---|---|---|
| 24 | Migração Evolution → Meta WhatsApp Business API | 2 dias |
| 25 | Templates aprovados pela Meta (mensagens fora de janela 24h) | 1 dia |
| 26 | Onboarding automatizado de nova clínica (script CLI) | 1 dia |
| 27 | Dashboard métricas (Metabase ou query Supabase) | 1 dia |

**Total Sprint 4:** ~5 dias úteis (mas opcional dependendo do volume).

---

## E. Compliance LGPD / CFM (mantida da v1)

(Conteúdo idêntico ao v1 — ver `PLANO_PRODUTO_v1_DEPRECATED.md` seção E)

**Pontos críticos:**

1. **Consentimento no 1º turno** — adicionar no prompt e auditar em `historico_eventos`
2. **`maskPIIDeep`** já existe no Edge Function, **mas as tools n8n NÃO mascaram PII antes de enviar pro OpenRouter** — risco LGPD. Adicionar normalize antes de chamar AI Agent.
3. **Retenção 90 dias** em `n8n_chat_histories` — cron a construir (item 23)
4. **CFM 2.314/22** — adicionar bloco "PROIBIDO" no system prompt:
   ```
   PROIBIDO:
   - Dar diagnóstico
   - Prescrever ou alterar medicação
   - Interpretar exames
   - Decisão de urgência médica
   PERMITIDO: agendar, informar valores, preparos, transferir humano
   ```
5. **Anonimização em logs** — verificar se `historico_eventos.dados_extraidos` não vaza PII completa.

---

## F. Financeiro revisado (com OpenRouter)

**Custos:**

| Item | Antes (OpenAI direto) | Agora (OpenRouter + gemini-2.5-flash) |
|---|---|---|
| Chat por conversa (5-10 turnos) | $0.015-0.030 | **$0.001-0.003** (10x mais barato!) |
| Vision por imagem | $0.005-0.010 | $0.002-0.005 (mais barato também) |
| Memória Postgres | $0 (já paga Supabase) | $0 |

**Por 1000 conversas/mês:**
- Antes (OpenAI): $15-30/mês
- Agora (OpenRouter Gemini): $1-3/mês

**Razão:** Gemini 2.5 Flash via OpenRouter custa fração do GPT-4o. Você JÁ fez essa escolha de arquitetura — economia significativa.

**ROI ainda mais favorável** comparado a atendente humano:
- 1000 conversas/mês = R$ 5-15 de IA vs R$ 750-1500 humano
- **Razão: 50-100× mais barato**

---

## G. Riscos atualizados

| # | Risco | Mitigação |
|---|---|---|
| R1 | **Supabase RAG offline** (workflow consultarFaq) | Verificar uptime + adicionar fallback gracioso ("não tenho essa info, vou transferir") |
| R2 | **Modelo OpenRouter cai** | Configurar fallback chain em `modelo_ia` (Gemini → Claude → GPT) |
| R3 | **PII em logs OpenRouter** | Adicionar maskPIIDeep em PreBloco antes de chamar Agent |
| R4 | **`fila_pendente_resposta` bug** vaza dados de fila pra próxima conversa | Fix C.1 antes de plugar |
| R5 | **Evolution API ban** | Mesma da v1 — Meta API no Sprint 4 |
| R6 | **Chatwoot self-hosted cai** | Backup volume Docker + alerta uptime |
| R7 | **LLM dá diagnóstico apesar do prompt** | Auditoria semanal de 50 conversas + ajuste prompt iterativo |
| R8 | **Recepção rejeita Chatwoot** | UX polida + treinamento 1:1 + alertar via WhatsApp pessoal nos primeiros dias |

---

## H. Anexos

### Anexo I — Checklist Go-Live (após Sprint 1)

**Pré-requisitos:**
- [ ] Bugs C.1, C.2 corrigidos
- [ ] `clinica_motor_config` populada para Marcelo + Suely
- [ ] Supabase RAG validado + `knowledge_chunks` com info essencial
- [ ] Tools `cancelar` + `confirmar` criadas
- [ ] Saudação personalizada testada
- [ ] Sub-workflow TriagemMidia auditado

**Plug:**
- [ ] Evolution instance Marcelo conectada + webhook apontado
- [ ] Smoke test interno: 5 cenários happy path + 3 error path
- [ ] DPO designado + Política de Privacidade publicada
- [ ] Alerta uptime n8n + Supabase + Evolution

**Validação:**
- [ ] 1 dia "modo sombra" (n8n recebe mas IA não responde, valida fluxo)
- [ ] 50 conversas reais auditadas
- [ ] Métricas: taxa resolução ≥ 70%, latência p95 ≤ 6s

### Anexo II — Decisões pendentes

1. **Edge Function `llm-agent-api` — manter ou deprecar?**
   - Opção A: manter pro frontend web (recepção operando) — pouco esforço, agrega valor
   - Opção B: deprecar tudo pra eliminar duplicação — economiza custo Supabase
   - Recomendo: A. Custo marginal mas mantém o frontend funcionando.

2. **Migração Meta WhatsApp Business — quando?**
   - Esperar 30 dias de Evolution estável antes de migrar
   - Aplicação Meta leva 2-3 semanas pra aprovar

3. **Onboarding automático de novas clínicas (item 26) — prioridade?**
   - Hoje você tem 6 clínicas. Manual ainda funciona.
   - Vira prioritário quando passar de 10+ clínicas.

4. **Multimodal (item #18) — escopo realista?**
   - GPT-4o Vision identifica nome do exame com ~85% acurácia em fotos boas
   - Em fotos ruins (papel amassado, baixa luz) cai pra ~50%
   - Recomendo: lançar, mas com fallback "Não consegui ler a guia, pode me dizer qual exame seu médico solicitou?"

5. **Onde implementar regras Marcelo (MAPA guia, ECG walk-in, Ergo fistula)?**
   - Opção A: `knowledge_chunks` (RAG) + LLM segue orientações
   - Opção B: hard check no `consultar_regras_atendimento` RPC
   - Opção C: manter no `llm-agent-api` Edge Function e n8n consulta
   - Recomendo: **B** (regras críticas têm que ser determinísticas, não dependentes do LLM seguir prompt). 1-2 dias de trabalho na RPC.

---

## I. Versão anterior

`PLANO_PRODUTO_v1_DEPRECATED.md` foi mantido pra histórico. **NÃO seguir aquele plano** — foi escrito antes do audit dos 13 workflows existentes e propunha implementar features no Edge Function `llm-agent-api`. A arquitetura real (n8n hub + LangChain + tools) é superior. Este v2 reflete isso.
