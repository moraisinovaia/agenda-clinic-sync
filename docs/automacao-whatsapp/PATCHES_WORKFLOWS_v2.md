# Patches Workflows v2 — Sprint 1

Patches dos 4 workflows n8n descobertos na auditoria. Aplique em ordem.
DB migrations C.1/C.2/C.3/C.7 já foram aplicadas via Supabase MCP (não precisa fazer nada).

## Resumo dos fixes

| ID | Severidade | Workflow | O que muda |
|---|---|---|---|
| **C.7** | 🔴 P0 **CRÍTICO** | Recepção | Buscar config em `clinica_motor_config` (não `configuracoes_clinica`). Sem isso, multi-tenant routing está quebrado E vazamento de dados entre clínicas |
| **C.6** | 🔴 P0 crítico | PosBloco | Trocar `telefone` por `numero` no UPDATE (lock travado infinito) |
| **C.1** | 🔴 P0 | DB (já aplicado) | 7 colunas adicionadas em `fila_pendente_resposta` (alinha com SELECT de `checarFilaPendente`) |
| **C.2** | 🔴 P0 | DB (já aplicado) | JOIN `clinica_motor_config` funcionando (cmc.id = clientes.id) |
| **C.3** | 🔴 P0 | DB (já aplicado) | 2 rows inseridos: IPADO + PRO OFTALMO |
| **A.1** | ⚠️ médio | PreBloco | Adicionar `nome_clinica` no SELECT (preparar pra Motor IA usar) |
| **A.2** | ⚠️ médio | Motor IA | Remover placeholder literal + saudação personalizada + flexibilizar handover |
| **PRE-REQ** | 🟡 dados | Você | Popular `evolution_instance_id` em `clinica_motor_config` pras 3 clínicas |

---

## Patch 0 — Recepção (C.7 P0 CRÍTICO — fazer PRIMEIRO)

**Arquivo no n8n**: `MTCL__RecepcaoMensagemWhatsapp-v1`
**Nó alterado**: `buscarClinicaSupabase`

### Por quê (urgência máxima)

Bug duplo gravíssimo descoberto:

**7.a** — `evolution_instance_id` está NULL em todas as 7 rows de `configuracoes_clinica`. O SELECT atual sempre volta vazio. Resultado: TODA mensagem cai no `notificarPacienteClinicaNaoEncontrada` ("serviço em manutenção"). **Em produção hoje, nenhuma mensagem chega ao Motor IA.**

**7.b** — Mesmo se 7.a fosse populada, `formatarDadosCredenciais` usa `.json.id` (ID da config) como `clinica_id`, mas o restante do sistema espera `clientes.id`. Tools filtrariam dados da clínica errada → **vazamento multi-tenant**.

### Correção arquitetural aplicada (DB)

Migração `clinica_motor_config_add_evolution_instance_id` já aplicada:
- Adicionada coluna `evolution_instance_id` em `clinica_motor_config`
- UNIQUE index pra evitar 2 clínicas com mesmo Evolution ID

Como `clinica_motor_config.id = clientes.id` por design (FK), basta a Recepção buscar nessa tabela e o `clinica_id` passado adiante já será o correto. **Bônus**: `transbordo_humano_ativo` e `mensagem_transbordo` também vêm dessa tabela, fixando o C.8 (campos undefined no `chamarSubAtendimento`).

### Patch — Nó `buscarClinicaSupabase`

**Antes:**
```
operation: getAll
tableId: configuracoes_clinica
filters:
  - keyName: evolution_instance_id
    condition: eq
    keyValue: {{ $json.body.data.instanceId }}
```

**Depois:**
```
operation: getAll
tableId: clinica_motor_config
filters:
  - keyName: evolution_instance_id
    condition: eq
    keyValue: {{ $json.body.data.instanceId }}
```

Só muda o `tableId`. Não é preciso alterar mais nada — `formatarDadosCredenciais` que usa `.json.id` agora vai pegar o ID correto (cmc.id = clientes.id), e o `chamarSubAtendimento` que lê `transbordo_humano_ativo` e `mensagem_transbordo` vai encontrar as colunas existentes.

### Pré-requisito: popular `evolution_instance_id`

**Antes de ativar os workflows**, você precisa rodar este SQL (substituindo os IDs reais Evolution de cada clínica):

```sql
UPDATE public.clinica_motor_config
SET evolution_instance_id = '<INSTANCE_ID_IPADO>',
    updated_at = now()
WHERE id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054'; -- IPADO

UPDATE public.clinica_motor_config
SET evolution_instance_id = '<INSTANCE_ID_PRO_OFTALMO>',
    updated_at = now()
WHERE id = '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad'; -- PRO OFTALMO

-- A 3ª clínica entrará separadamente quando cadastrada.
```

Sem isso, o SELECT continua voltando vazio.

### Sugestão extra (não bloqueante)

A Recepção tem várias queries com **SQL injection latente** (concatenação direta de strings):
- `consultarLockConversa`: `WHERE session_id = '{{ ... }}'`
- `consultarModoAtendimento`: `WHERE session_id = '{{ ... }}'`
- `checarFilaPendente`: `WHERE celular = '{{ ... }}'`

Em produção real (clientes legítimos), o risco é baixo. Mas se um número de telefone tiver apóstrofo malformado, quebra. Refatorar pra `queryReplacement` parametrizado em Sprint 2.

---

## Patch 1 — PosBloco (C.6 P0 crítico)

**Arquivo no n8n**: `MTCL__SUB__v4_PosBloco-v1`
**Nó alterado**: `desativarLockConversa`

### Antes (BUG)
```sql
UPDATE n8n_status_atendimento
SET lock_conversa = false, updated_at = NOW()
WHERE session_id = '{{ $('receberRespostaAgente').first().json.telefone }}'
  AND cliente_id = '{{ $('receberRespostaAgente').first().json.clinica_id }}';
```

### Depois (FIX)
Como o PreBloco UPSERT usa `numero` (só dígitos) como `session_id`, este UPDATE precisa receber e usar `numero` também, não `telefone` (formato com parênteses).

**1.1** No nó `receberRespostaAgente` (Execute Workflow Trigger), adicionar campo `numero` no `workflowInputs.values`:
```json
{
  "values": [
    { "name": "output" },
    { "name": "telefone" },
    { "name": "numero" },
    { "name": "clinica_id" },
    { "name": "server_url" },
    { "name": "instance" },
    { "name": "apikey" }
  ]
}
```

**1.2** No nó `desativarLockConversa`, alterar a query:
```sql
UPDATE n8n_status_atendimento
SET lock_conversa = false, updated_at = NOW()
WHERE session_id = '{{ $('receberRespostaAgente').first().json.numero }}'
  AND cliente_id = '{{ $('receberRespostaAgente').first().json.clinica_id }}';
```

**1.3** No Motor IA, nó `prepararDadosPosBloco`, adicionar mapping pra `numero`:
```json
{
  "id": "f7",
  "name": "numero",
  "type": "string",
  "value": "={{ $('receberDadosWorkflowPai').item.json.numero }}"
}
```

### Sugestão extra (não bloqueante, mas recomendado)
Trocar concatenação por parametrização (evita SQL injection):
```sql
UPDATE n8n_status_atendimento
SET lock_conversa = false, updated_at = NOW()
WHERE session_id = $1 AND cliente_id = $2;
```
Com `queryReplacement`:
```
={{ $('receberRespostaAgente').first().json.numero }},{{ $('receberRespostaAgente').first().json.clinica_id }}
```

---

## Patch 2 — PreBloco (A.1)

**Arquivo no n8n**: `MTCL__SUB__v4_PreBloco_minimal-v1`
**Nó alterado**: `buscarConfigClinica`

### Por quê
Hoje a query devolve só `prompt_sistema` e `modelo_ia`. O Motor IA precisa de `nome_clinica` separado pra preencher dinamicamente o placeholder `{nome da clínica}` que hoje aparece literal no prompt da saudação.

### Antes
```sql
... LEFT JOIN clinica_motor_config cmc ON cmc.id = c.id
WHERE c.id = $1;
```
Retorna: `prompt_sistema`, `modelo_ia`

### Depois
Substituir a query inteira por (adiciona `nome_clinica` + `transbordo_humano_ativo` + `mensagem_transbordo` retornados):

```sql
WITH especialidades AS (
  SELECT string_agg(DISTINCT m.especialidade, ', ' ORDER BY m.especialidade) AS lista
  FROM medicos m WHERE m.cliente_id = $1 AND m.ativo = true
),
medicos_lista AS (
  SELECT string_agg(m.nome || ' (' || m.especialidade || ')', '; ' ORDER BY m.nome || ' (' || m.especialidade || ')') AS lista
  FROM medicos m WHERE m.cliente_id = $1 AND m.ativo = true
),
atendimentos_lista AS (
  SELECT string_agg(DISTINCT a.nome, ', ' ORDER BY a.nome) AS lista
  FROM atendimentos a WHERE a.cliente_id = $1 AND a.ativo = true
),
convenios_lista AS (
  SELECT string_agg(DISTINCT cm.convenio_nome, ', ' ORDER BY cm.convenio_nome) AS lista
  FROM convenios_medico cm WHERE cm.cliente_id = $1
)
SELECT
  c.nome AS nome_clinica,
  format(
    E'Você é a assistente virtual da %s. Seja cordial, objetiva e clara. Use português do Brasil. NUNCA invente informações sobre médicos, exames, convênios ou disponibilidade — sempre consulte o sistema via tools antes de afirmar algo.\n\nReferência da clínica (sempre confirme via tools antes de prometer ao paciente):\n- Médicos ativos: %s\n- Especialidades atendidas: %s\n- Procedimentos/atendimentos disponíveis: %s\n- Convênios aceitos: %s',
    c.nome,
    COALESCE((SELECT lista FROM medicos_lista), 'sem médicos cadastrados'),
    COALESCE((SELECT lista FROM especialidades), 'não definidas'),
    COALESCE((SELECT lista FROM atendimentos_lista), 'não definidos'),
    COALESCE((SELECT lista FROM convenios_lista), 'a confirmar')
  ) AS prompt_sistema,
  COALESCE(cmc.modelo_ia, 'google/gemini-2.5-flash') AS modelo_ia,
  COALESCE(cmc.transbordo_humano_ativo, false) AS transbordo_humano_ativo,
  COALESCE(cmc.mensagem_transbordo, 'Encaminhando para um atendente humano. Aguarde um momento.') AS mensagem_transbordo
FROM clientes c
LEFT JOIN clinica_motor_config cmc ON cmc.id = c.id
WHERE c.id = $1;
```

**Mudanças**:
- `c.nome AS nome_clinica` adicionado no SELECT
- Default do modelo virou `google/gemini-2.5-flash` (com prefixo OpenRouter — antes era `gemini-2.5-flash` solto)
- `transbordo_humano_ativo` + `mensagem_transbordo` retornados (preparação Sprint 2 Chatwoot)

---

## Patch 3 — Motor IA (A.2)

**Arquivo no n8n**: `MTCL__MLTC_WF__MotorAtendimentoIA-v1`
**Nó alterado**: `AI Agent` → campo `systemMessage`

### Substituir o systemMessage inteiro por:

```
={{ $('chamarPreBloco').item.json.prompt_sistema }}

=== Contexto desta conversa ===
- Nome do paciente: {{ $('receberDadosWorkflowPai').item.json.nome || 'não informado' }}
- Número (WhatsApp): {{ $('receberDadosWorkflowPai').item.json.numero }}
- Clínica: {{ $('chamarPreBloco').item.json.nome_clinica }}

=== Saudação (somente 1ª mensagem da conversa) ===
Se for a primeira mensagem do paciente nesta sessão E você souber o primeiro nome dele, cumprimente pelo nome: "Olá, {primeiro_nome}! Sou a assistente virtual da {{ $('chamarPreBloco').item.json.nome_clinica }}. Como posso te ajudar?"
Se não souber o nome, use: "Olá! Sou a assistente virtual da {{ $('chamarPreBloco').item.json.nome_clinica }}. Como posso te ajudar?"
Em mensagens seguintes NÃO se reapresente.

=== PROIBIDO ===
- Sugerir contato com convênio/operadora/terceiros.
- Afirmar disponibilidade de horário sem ter chamado tool_consultarDisponibilidade no mesmo turno.
- Inventar item de preparo. Use APENAS o que tool_consultarPreparoProcedimento retornar.
- Hedging em guia médica: `exige_guia_medica=false` → "não é necessária guia"; `true` → peça a guia.

=== TRANSFERIR PARA ATENDENTE HUMANO ===
Você é a interface principal, mas alguns casos DEVEM ser transferidos pra atendente humano. Quando detectar QUALQUER um dos gatilhos abaixo, responda EXATAMENTE: "Vou te encaminhar para nossa equipe. Em instantes alguém entra em contato." e PARE de responder o paciente (não chame mais tools, não continue a conversa).

Gatilhos de transferência:
1. Paciente pede nota fiscal, recibo, comprovante de pagamento.
2. Paciente pede receita médica, atestado, laudo, declaração.
3. Paciente diz explicitamente "quero falar com humano", "atendente", "pessoa", "recepção", "não quero IA", "robô não resolve".
4. Reclamação grave ou ameaça de queixa formal (Procon, ANS, etc).
5. Pergunta médica de natureza diagnóstica ou prescritiva (ex: "que remédio tomar?", "esse sintoma é grave?").

NÃO transfira por: dúvida sobre preço, convênio, horário, preparo de exame, agendamento — essas você resolve.

=== PRIMEIRO PERGUNTE, DEPOIS PROPONHA ===
Antes de listar médicos, horários ou exames, descubra o que o paciente quer:
- Especialidade ou queixa? Procedimento específico?
- Convênio?
- Data/janela preferida?
Só chame tools depois de ter intenção clara. Não proponha opções proativamente.

=== Contexto temporal ===
Agora (America/Sao_Paulo): {{ $now.setZone('America/Sao_Paulo').setLocale('pt-BR').toFormat("cccc, dd 'de' LLLL 'de' yyyy, HH:mm") }} — ISO {{ $now.setZone('America/Sao_Paulo').toISO() }}.
Use esta linha como referência absoluta para "hoje", "amanhã", "esta sexta".

=== Datas ===
- Dia da semana ("sexta", "amanhã"): chame tool_diaDaSemana, não pergunte qual.
- Sem data: chame tool_consultarDisponibilidade sem data_inicio.
- Período do dia ("manhã"/"tarde"): combine com data e filtre slots retornados.
- Paciente sugere horário fora do que você ofereceu: chame tool_consultarDisponibilidade de novo com aquela data antes de confirmar.

=== Tools obrigatórias ===
- Listar médicos/atendimentos: tool_consultarMedicos. Liste TODOS os itens retornados, em ordem; nunca subset.
- Disponibilidade: tool_consultarDisponibilidade.
- Buscar agendamento (remarcar/cancelar): tool_consultarAgendamentosPaciente. Se total=0, peça nome completo + data nascimento e tente de novo antes de desistir.
- Remarcar: tool_remarcarAgendamento (não cria agendamento novo).
- Exame + convênio: tool_consultarRegrasAtendimento ANTES de tool_criarAgendamento.
- Erro de regra: leia a mensagem e explique ao paciente — não diga "problema no sistema".
- Exame ou pergunta de preparo: tool_consultarPreparoProcedimento. Mostre só os campos preenchidos (instrucoes, jejum_horas, observacoes_especiais, itens_levar, medicacao_suspender). Campo vazio = não mencione.
```

### Mudanças vs versão original:
1. **Adicionado bloco "Contexto desta conversa"** — IA recebe explicitamente nome do paciente + nome da clínica via PreBloco.
2. **Saudação dinâmica** — usa primeiro nome se disponível, senão fallback. Substitui o `{nome da clínica}` literal (BUG).
3. **Removida proibição "Oferecer atendente humano"** — substituída pela seção "TRANSFERIR PARA ATENDENTE HUMANO" com 5 gatilhos claros.
4. **Modelo de transferência sem tool** — por ora a IA apenas RESPONDE a frase de transferência e para. A tool `transferirHumano` (que envia label pro Chatwoot) será adicionada em Sprint 2. Pra agora, atender o requisito básico de "não tentar resolver casos fora de escopo".

---

## Como aplicar (ordem importa)

1. **Rodar SQL pra popular `evolution_instance_id`** — pegue os IDs Evolution de Pro Oftalmo + IPADO e rode o UPDATE do Patch 0.
2. **No n8n UI**: abrir cada workflow na ordem (Recepção → PosBloco → PreBloco → Motor IA), aplicar o patch indicado, salvar.
3. **NÃO ativar** os workflows ainda — primeiro fazer smoke test com 1 número de teste.

## Checklist de validação pós-aplicação

- [ ] DB: `clinica_motor_config` tem `evolution_instance_id` populado pras 2 clínicas (Pro Oftalmo + IPADO)
- [ ] Recepção: nó `buscarClinicaSupabase` aponta pra `clinica_motor_config` (não `configuracoes_clinica`)
- [ ] PosBloco: nó `receberRespostaAgente` tem campo `numero` no schema
- [ ] PosBloco: nó `desativarLockConversa` usa `numero` (não `telefone`) na query
- [ ] Motor IA: nó `prepararDadosPosBloco` mapeia `numero` no Set
- [ ] PreBloco: query `buscarConfigClinica` retorna `nome_clinica` + `transbordo_humano_ativo` + `mensagem_transbordo`
- [ ] Motor IA: systemMessage atualizado (sem `{nome da clínica}` literal, com bloco TRANSFERIR PARA ATENDENTE HUMANO)
- [ ] Smoke test: 1 mensagem WhatsApp → resposta da IA + lock desativa corretamente após resposta

## Bugs descobertos mas NÃO consertados aqui (Sprint 2/3)

| ID | Onde | Risco | Sprint |
|---|---|---|---|
| **SQL Injection latente** | Recepção (queries várias) | Baixo (input controlado), mas má prática | Sprint 2 |
| **Webhook sem auth** | Recepção `/recp` | Médio (sticky note já reconhece) | Sprint 2 |
| **Admin notification hardcoded** | `5587991311991` em `notificarAdminClinicaNaoEncontrada` | Baixo | Sprint 2 |
| **`consultarModoAtendimento` não normaliza `@lid`** | Recepção | Médio (pode causar mismatch session_id) | Sprint 2 |
| **Tool `transferirHumano` não existe** | Motor IA | Médio (Chatwoot bidi não funciona) | Sprint 2 |
| **Tools `cancelarAgendamento` / `confirmarAgendamento` não existem** | Motor IA | Alto (paciente não consegue cancelar/confirmar) | Sprint 3 |

## Pendente (aguardando você)

- **3ª clínica nova** (6 médicos) — INSERT em `clientes` + `medicos` + `convenios_medico` + `clinica_motor_config` aguarda dados (nome da clínica, lista de médicos com convênios e horários).
- **3 `evolution_instance_id`** — Pro Oftalmo, IPADO, 3ª clínica nova.

## Smoke test sugerido (após aplicar tudo)

1. Mandar WhatsApp pro número da Pro Oftalmo: "Oi"
2. **Esperado**: IA responde "Olá, [seu nome]! Sou a assistente virtual da PRO OFTALMO. Como posso te ajudar?" (saudação dinâmica)
3. Continuar: "Quero marcar consulta com Dra. Suely"
4. **Esperado**: IA pergunta convênio + data preferida
5. Encerrar conversa e checar no DB:
   ```sql
   SELECT session_id, lock_conversa, updated_at
   FROM n8n_status_atendimento
   WHERE cliente_id = '0b6a0a35-0059-4a0c-9fb8-413b6253c2ad';
   ```
   `lock_conversa` deve estar `false` (PosBloco desativou).
6. Mandar de novo "Oi". **Esperado**: IA responde normalmente (sem trava do lock).
7. Mandar "Quero falar com um atendente". **Esperado**: IA responde "Vou te encaminhar para nossa equipe..." e para.
