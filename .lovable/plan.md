

## Bug Encontrado: Limite de Agendamentos NÃO É Respeitado

### Problema

Na validação de limite de vagas (linha 2371 e 2421 do `llm-agent-api/index.ts`), a query que conta agendamentos existentes tem um filtro **incorreto**:

```sql
.gte('created_at', cincMinutosAtras)
```

Isso filtra para contar **apenas agendamentos criados nos últimos 5 minutos**, ignorando todos os outros. No caso da data 2026-03-17, existem **19 agendamentos** (limite é 15), mas a API reportou "✅ Vagas disponíveis: 15" porque nenhum deles foi criado nos últimos 5 minutos.

### Evidência

- Data 2026-03-17: 19 consultas ativas para Dr. Marcelo (18 manhã + 1 às 08:00 recém-criada)
- Limite configurado: 15 por período
- Log da API: `✅ Vagas disponíveis: 15` — contou 0 ocupados porque o filtro `created_at >= 5min atrás` excluiu os 18 agendamentos antigos

### Correção

Remover o filtro `.gte('created_at', cincMinutosAtras)` em **3 locais** do `handleSchedule`:

1. **Linha ~2361-2371**: Query de validação de limite antes de criar
2. **Linha ~2411-2421**: Query de busca de datas alternativas (dentro do loop de 60 dias)
3. Verificar se há mais ocorrências do mesmo padrão

O filtro `excluido_em IS NULL`, `cancelado_em IS NULL` e `status IN ('agendado','confirmado')` já são suficientes para excluir agendamentos cancelados/excluídos. O `created_at` nunca deveria ter sido incluído.

### Impacto

- **Crítico**: Qualquer data com agendamentos criados há mais de 5 minutos será tratada como "vazia", permitindo overbooking ilimitado
- A correção não tem efeitos colaterais negativos — apenas remove um filtro que nunca deveria existir

### Implementação

1. Editar `supabase/functions/llm-agent-api/index.ts` — remover as 3+ linhas com `.gte('created_at', cincMinutosAtras)` nas queries de contagem de limite
2. Redeploy da edge function

