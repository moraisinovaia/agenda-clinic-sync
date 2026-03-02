

## Criar trigger webhook para fila_notificacoes via pg_net

### Migração SQL

Uma única migração que:
1. Habilita a extensão `pg_net` (se não existir)
2. Cria a função `notificar_fila_webhook()` conforme especificado
3. Cria o trigger `trigger_notificar_fila_webhook` AFTER INSERT na `fila_notificacoes`

O código SQL é exatamente o fornecido pelo usuário, precedido por `CREATE EXTENSION IF NOT EXISTS pg_net;`.

### Escopo
- 1 migração SQL
- Nenhuma alteração em código frontend ou edge functions

