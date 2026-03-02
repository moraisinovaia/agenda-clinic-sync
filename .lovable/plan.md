

## Plano: Blindagem de concorrência no `handleResponderFila`

### Mudanças no arquivo `supabase/functions/llm-agent-api/index.ts`

**A) Receber e validar `notif_id`** (linha ~4453)
- Extrair `notif_id` do body junto com os demais campos
- Tornar `notif_id` obrigatório na validação

**B) Lock por `notif_id` + `tempo_limite`** (após buscar `filaItem`, ~linha 4477)
- Buscar notificação por `id = notif_id` com `.single()`
- Validar: `fila_id` bate, `tempo_limite >= now()`, `resposta_paciente = 'sem_resposta'`, `status_envio = 'pendente'`
- Retornar erro específico se expirou ou já foi processada

**C) Atualizar `fila_notificacoes` por `notif_id`** (não mais por `fila_id`)
- No caminho SIM (~linha 4530-4537): trocar `.eq('fila_id', fila_id)` por `.eq('id', notif_id)`
- No caminho NAO/TIMEOUT (~linha 4569-4576): trocar `.eq('fila_id', fila_id)` por `.eq('id', notif_id)`
- Manter `.eq('resposta_paciente', 'sem_resposta')` como guard de concorrência

**D) Cascata: capturar ID da notificação inserida** (~linha 4617-4629)
- Adicionar `.select('id').single()` no insert de `fila_notificacoes`
- Usar `notifNova.id` no payload do webhook em vez de `notif_id: ''`
- Incluir `notif_id` no objeto `proximoNotificado` retornado ao cliente

### Detalhes técnicos

Todas as alterações são no mesmo arquivo. Nenhuma migração SQL necessária. A mudança garante que dois eventos concorrentes (ex: TIMEOUT + resposta manual) não processem a mesma notificação duas vezes, pois o update com `eq('resposta_paciente', 'sem_resposta')` funciona como lock otimista.

