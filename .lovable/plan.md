

## Remover Restrição de Data Mínima de Agendamento

### Problema Atual
A API LLM usa o campo `data_minima_agendamento` para bloquear agendamentos antes de uma data específica, exibindo mensagens de "migração" confusas como *"Agendamentos disponíveis a partir de janeiro/2026"*. Isso afeta todas as clínicas e não faz mais sentido operacionalmente.

### Clínicas Afetadas

| Clínica | data_minima atual | telefone | whatsapp |
|---------|-------------------|----------|----------|
| Clínica Olhos | 2026-01-01 | vazio | vazio |
| ENDOGASTRO | 2026-01-01 | vazio | vazio |
| IPADO | 2026-01-01 | preenchido | preenchido |
| Dr. Marcelo D'Carli | 2026-01-01 | preenchido | preenchido |
| Clínica Orion | 2025-01-20 | preenchido | preenchido |
| Clínica Vênus | 2025-12-17 | preenchido | preenchido |

### O que será feito

**1. Banco de Dados - Atualizar `llm_clinic_config`**
- Setar `data_minima_agendamento` para `NULL` em TODAS as clínicas (removendo a restrição)
- Preencher telefone/whatsapp da Clínica Olhos e ENDOGASTRO (será necessário confirmar os números)

**2. Edge Function `llm-agent-api` - Remover lógica de data mínima**
- Remover o fallback `FALLBACK_MINIMUM_BOOKING_DATE = '2026-01-01'`
- Modificar `getMinimumBookingDate()` para retornar `null` quando não configurado
- Remover todos os bloqueios de data mínima no endpoint `/availability` (linhas ~4176-4178)
- Remover bloqueio no endpoint `/schedule` (linhas ~2109-2118)
- Remover bloqueio no endpoint `/reschedule` (linhas ~3662-3671)
- Remover mensagens de "migração" em `/check-patient` (linhas ~3390-3398)
- Remover a função `getMigrationBlockMessage()` (ou torná-la inativa)
- Remover `getMinDateDisplayText()` já que não será mais necessária
- Limpar referências a "Sistema em migração" nas respostas

**3. Coluna no banco**
- Alterar o default da coluna `data_minima_agendamento` de `'2026-01-01'` para `NULL`

### Detalhes Técnicos

Pontos de código que serão modificados no `llm-agent-api/index.ts`:

- **Linha 686**: Remover `FALLBACK_MINIMUM_BOOKING_DATE`
- **Linhas 694-696**: `getMinimumBookingDate()` retorna `null` em vez de fallback
- **Linhas 702-713**: Remover `getMinDateDisplayText()`
- **Linhas 800-858**: Remover/simplificar `getMigrationBlockMessage()`
- **Linhas 2109-2118**: Remover bloqueio de data no `/schedule`
- **Linhas 2336-2341**: Remover skip de datas no loop de busca
- **Linhas 3388-3398**: Remover mensagem de migração no `/check-patient`
- **Linhas 3662-3671**: Remover bloqueio de data no `/reschedule`
- **Linhas 4175-4178**: Remover ajuste de data mínima no `/availability`
- Respostas do `/availability` não incluirão mais campos `data_minima` e `observacao` de migração

### Pergunta pendente
Preciso dos números de telefone e WhatsApp da **Clínica Olhos** e **ENDOGASTRO** para preencher no banco. Se não souber agora, posso deixar em branco e você preenche depois pelo painel admin.

