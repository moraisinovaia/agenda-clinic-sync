# Matriz de testes — `POST /availability`

Documento canônico de validação do endpoint. Multi-cliente, parametrizável.
Gerado após auditoria do handler + cruzamento com banco em produção.

## Convenção

- Variáveis usadas (ENVs):
  - `ENDPOINT` — `https://<projeto>.supabase.co/functions/v1/llm-agent-api`
  - `API_KEY` — header `x-api-key`
  - `CLIENTE_ID` — uuid do tenant
  - `CONFIG_ID` — uuid de config (opcional)
  - `MEDICO_ID` — uuid do médico principal
  - `MEDICO_NOME` — nome canônico
- Dia da semana: `0=dom 1=seg 2=ter 3=qua 4=qui 5=sex 6=sab`.
- Todas as chamadas: `POST {{endpoint}}/availability` com headers `Content-Type: application/json` e `x-api-key: {{api_key}}`.

## Mapa rápido das 4 rotas internas do handler

| Rota | Acionada quando | Como conta | Onde |
|---|---|---|---|
| **walk_in_info_only** | `servico.tipo === 'walk_in_info_only'` | NÃO conta vagas; só lista dias/horários | `availability.ts:695-742` |
| **fixed_time** | `servico.tipo === 'fixed_time'` | `count(agendamentos do medico_id no dia)`; sem hora exata (F1.4) | `availability.ts:745-819` |
| **hasSharedLimits** | `servico.compartilha_limite_com \|\| servico.limite_proprio` | `calcularVagasDisponiveisComLimites()` com pool derivado (F0) | `availability.ts:824-887` |
| **default (CheckAvailabilityUseCase)** | resto | UseCase em `_shared/scheduling-core` | `availability.ts:889-1079` |

---

## A. Felizes — 1 chamada por serviço (multi-rota)

### A1 — Consulta Cardiológica (rota: hasSharedLimits via pool com Retorno)
```json
{
  "cliente_id":         "{{cliente_id}}",
  "config_id":          "{{config_id}}",
  "medico_nome":        "{{medico_nome}}",
  "atendimento_nome":   "Consulta Cardiológica",
  "buscar_proximas":    true,
  "allowed_doctor_ids": ["{{medico_id}}"]
}
```
**Esperado**:
- `success: true`
- `tipo_atendimento: "ordem_chegada"`
- `proximas_datas[]` apenas com manhã em `[1,2,4]` ou tarde em `[3]`
- Toda data tem `vagas_disponiveis > 0`
- Logs devem mostrar `[POOL_DERIVADO]` (etapa F0)

### A2 — MAPA 24H (rota: fixed_time)
```json
{ "atendimento_nome": "MAPA 24H", "buscar_proximas": true, ... }
```
**Esperado**:
- `proximas_datas[].periodos[0].tipo === "fixed_time"`
- `vagas_disponiveis > 0` em todos
- Datas oferecidas batem com config (seg 08:00, ter 09:00, qua 10:00, qui 10:30)
- Logs devem mostrar `[SCOPE] Expandido com médicos relacionados: 1 → 3` (F1.1)

### A3 — Teste Ergométrico (rota: default)
```json
{ "atendimento_nome": "Teste Ergométrico", "buscar_proximas": true, ... }
```
**Esperado**:
- `tipo_atendimento: "ordem_chegada"`
- Datas: manhã em qua/sex `[3,5]` ou tarde em ter/qui `[2,4]`
- Vagas dentro do limite 13 por turno

### A4 — ECG (rota: walk_in_info_only)
```json
{ "atendimento_nome": "ECG", "buscar_proximas": true, ... }
```
**Esperado**:
- `tipo_atendimento: "walk_in_info_only"`
- **NÃO** ter `proximas_datas`
- `horarios_atendimento[]` com dias seg/ter/qui (manhã) e quarta (tarde)
- Sem `vagas_disponiveis` ou `limite_total`

### A5 — MRPA (rota: default)
```json
{ "atendimento_nome": "MRPA", "buscar_proximas": true, ... }
```
**Esperado**:
- Datas: manhã qua/qui `[3,4]`, tarde ter/qua/qui `[2,3,4]`
- Limite 5 por turno
- **NÃO oferece** terça-manhã (validação Doc 2)

### A6 — Retorno Cardiológico (rota: hasSharedLimits)
```json
{ "atendimento_nome": "Retorno Cardiológico", "buscar_proximas": true, ... }
```
**Esperado**:
- Mesmas datas/disponibilidade da Consulta (compartilha pool de 14)

---

## B. Casos de uso (F1.3.1) — aliases inteligentes

### B1 — Pré-operatório → Consulta + orientação
```json
{ "atendimento_nome": "Pré-operatório", ... }
```
**Esperado**:
- `caso_de_uso.identificado: "Pré-operatório"`
- `caso_de_uso.atendimento_principal: "Consulta Cardiológica"`
- `caso_de_uso.mensagem_orientacao` contém orientação sobre ECG no mesmo dia
- `proximas_datas` da Consulta

### B2 — "Pré-op" (alias) → mesmo resultado
```json
{ "atendimento_nome": "Pré-op", ... }
```

### B3 — "Parecer cardiológico" (alias)
```json
{ "atendimento_nome": "Parecer cardiológico", ... }
```

### B4 — "Cirurgia" (alias)
```json
{ "atendimento_nome": "Cirurgia", ... }
```

### B5 — "Checkup" (caso de uso distinto)
```json
{ "atendimento_nome": "Checkup", ... }
```
**Esperado**:
- `caso_de_uso.identificado: "Checkup"`
- `mensagem_orientacao` diferente (cita Teste Ergométrico)

### B6 — Serviço inexistente → SERVICO_NAO_ENCONTRADO (F1.3)
```json
{ "atendimento_nome": "Tatuagem cardíaca", ... }
```
**Esperado**:
- `success: false`
- `codigo_erro: "SERVICO_NAO_ENCONTRADO"`
- `detalhes.servicos_disponiveis` — lista com 7+ itens reais

---

## C. Filtros

### C1 — Consulta com data futura específica permitida
```json
{ "atendimento_nome": "Consulta Cardiológica", "data_consulta": "2026-06-02", ... }
```
**Esperado**: 02/06 (terça) é dia permitido para manhã. Retorna a data com vagas se houver.

### C2 — Consulta com período manhã
```json
{ "atendimento_nome": "Consulta Cardiológica", "periodo": "manha", "buscar_proximas": true, ... }
```
**Esperado**: somente turnos manhã, dias `[1,2,4]`.

### C3 — Consulta com período tarde
```json
{ "atendimento_nome": "Consulta Cardiológica", "periodo": "tarde", "buscar_proximas": true, ... }
```
**Esperado**: somente turnos tarde, dia `[3]` (quarta).

### C4 — Consulta + mensagem "próxima quarta"
```json
{ "atendimento_nome": "Consulta Cardiológica", "mensagem_original": "tem vaga próxima quarta?", ... }
```
**Esperado**: handler detecta dia da semana → filtra somente quartas.

### C5 — Teste Ergométrico em sexta (manhã permitida)
```json
{ "atendimento_nome": "Teste Ergométrico", "data_consulta": "2026-05-29", ... }
```
**Esperado**: 29/05 é sexta → manhã permitida `[3,5]`. Retorna a data se houver vagas.

---

## D. Edge cases

### D1 — Data passada → ajusta para hoje/amanhã
```json
{ "atendimento_nome": "Consulta Cardiológica", "data_consulta": "2020-01-15", ... }
```
**Esperado**: handler ignora a data e usa hoje/amanhã (logs `🌙 Horário noturno`/`📅 Ponto de partida da busca`).

### D2 — Sábado para Consulta → redireciona
```json
{ "atendimento_nome": "Consulta Cardiológica", "data_consulta": "2026-05-02", ... }
```
**Esperado**: 02/05 é sábado → redireciona busca automática.

### D3 — Sexta para Consulta → não retorna sexta nas datas
```json
{ "atendimento_nome": "Consulta Cardiológica", "buscar_proximas": true, ... }
```
**Esperado**: nenhuma `data` em `proximas_datas` cai em sexta-feira.

### D4 — Dia totalmente lotado para Consulta (manhã 30/04)
Consulta+Retorno no banco: 30/04 manhã = 22 ocupados, limite 14 → 0 vagas reais.
**Esperado**: 30/04 não aparece em `proximas_datas`.

### D5 — `data_consulta` em DD/MM/YYYY
```json
{ "atendimento_nome": "MAPA 24H", "data_consulta": "04/05/2026", ... }
```
**Esperado**: handler aceita formato BR; converte para 2026-05-04 (segunda 08:00).

### D6 — `quantidade_dias` baixo encontra rapidamente
```json
{ "atendimento_nome": "Consulta Cardiológica", "buscar_proximas": true, "quantidade_dias": 100, ... }
```
**Esperado**: API encontra 3 datas (não exaure 100 — early stop).

---

## E. Erros estruturais

### E1 — `cliente_id` ausente
```json
{ "atendimento_nome": "Consulta Cardiológica" }
```
**Esperado**: HTTP 400 + `error: "cliente_id é obrigatório"`.

### E2 — `atendimento_nome` ausente
```json
{ "cliente_id": "...", "medico_nome": "Dr. Marcelo" }
```
**Esperado**: erro de validação ou fallback (legado para chamadas genéricas).

### E3 — `medico_nome` desconhecido → MEDICO_NAO_ENCONTRADO
```json
{ "atendimento_nome": "Consulta Cardiológica", "medico_nome": "Dr. Inexistente" }
```
**Esperado**: `success: false`, `codigo_erro: "MEDICO_NAO_ENCONTRADO"`.

### E4 — `config_id` cross-tenant (etapa B)
```json
{ "atendimento_nome": "Consulta Cardiológica", "config_id": "00000000-0000-0000-0000-000000000000", ... }
```
**Esperado**: log `🚨 [SECURITY] config_id ... não pertence ao cliente_id`. Resposta sem regras dinâmicas (config null).

### E5 — `allowed_doctor_ids` errado → MEDICO_FORA_DO_ESCOPO
```json
{ "atendimento_nome": "Consulta Cardiológica", "medico_nome": "Dr. Marcelo", "allowed_doctor_ids": ["00000000-0000-0000-0000-000000000000"] }
```
**Esperado**: `codigo_erro: "MEDICO_FORA_DO_ESCOPO"`.

---

## F. Multi-tenant + virtuais (F1.1)

### F1 — MAPA destrava com scope só do principal
```json
{ "atendimento_nome": "MAPA 24H", "allowed_doctor_ids": ["{{medico_id_principal}}"] }
```
**Esperado**: NÃO retorna MEDICO_FORA_DO_ESCOPO. Logs mostram `🔗 [SCOPE] Expandido`.

### F2 — Teste Ergométrico destrava com scope só do principal
```json
{ "atendimento_nome": "Teste Ergométrico", "allowed_doctor_ids": ["{{medico_id_principal}}"] }
```
**Esperado**: idem F1.

---

## G. Não cobertos por Insomnia (recomendar k6 ou pgsql)

### G1 — Concorrência: 50 chamadas simultâneas para Consulta
**Por que importa**: validar que não há race condition em contagem de vagas.
**Como**: script `k6 run` — fora do escopo desta matriz.

### G2 — Carga: latência média / p95 / erro %
**Como**: `k6 run --vus 10 --duration 60s`.

### G3 — Idempotência (etapa F ainda pendente)
**Por que importa**: `/schedule` pode duplicar agendamento — `/availability` é read-only, então não aplica aqui.

---

## Critério de "validado para produção"

- [ ] Todos os A1-A6 retornam coerente com banco
- [ ] B1-B5 mostram `caso_de_uso` correto
- [ ] B6 retorna SERVICO_NAO_ENCONTRADO com lista
- [ ] C1-C5 filtram corretamente
- [ ] D1-D6 lidam com edge cases sem erro técnico
- [ ] E1-E5 retornam código de erro estável
- [ ] F1, F2 destravam virtuais

Após 100% dessa matriz verde, `/availability` está apto para produção em escala.
