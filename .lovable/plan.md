## ✅ Concluído: Remover Restrição de Data Mínima de Agendamento

### O que foi feito

1. **Banco de Dados**: `data_minima_agendamento` setado para `NULL` em todas as clínicas e default da coluna alterado para `NULL`
2. **Edge Function `llm-agent-api`**: Removidos todos os bloqueios de data mínima, mensagens de migração, e funções helper (`FALLBACK_MINIMUM_BOOKING_DATE`, `getMinDateDisplayText`, bloqueios em `/schedule`, `/reschedule`, `/availability`, `/check-patient`)
3. Respostas da API não incluem mais campos `data_minima` e `observacao` de migração

### Pendente
- Preencher telefone/whatsapp da **Clínica Olhos** e **ENDOGASTRO** (via painel admin)
