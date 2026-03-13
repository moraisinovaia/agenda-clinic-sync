

## Diagnóstico: "Erro ao confirmar / desconfirmar"

### Causa raiz (duas falhas combinadas)

**1. Sem permissão de execução (GRANT EXECUTE)**
Nenhuma das 4 RPCs de operações tem `GRANT EXECUTE` para o role `authenticated`:
- `confirmar_agendamento`
- `desconfirmar_agendamento`
- `cancelar_agendamento_soft`
- `excluir_agendamento_soft`

Resultado: Supabase retorna erro genérico ao tentar chamá-las.

**2. Parâmetros incompatíveis (frontend vs banco)**
O frontend envia 3 parâmetros, mas as funções só aceitam 1:

```text
Frontend:                              Banco:
confirmar_agendamento(                 confirmar_agendamento(
  p_agendamento_id,                      p_agendamento_id  ← só este
  p_confirmado_por,        ← não existe
  p_confirmado_por_user_id ← não existe
)
```

Mesmo problema em `desconfirmar_agendamento`, `cancelar_agendamento_soft` e `excluir_agendamento_soft`.

Além disso, as funções atuais fazem UPDATE mas **não gravam os campos de auditoria** (confirmado_por, cancelado_por, excluido_por, etc.).

### Plano de correção

**1. Migration SQL — Recriar as 4 RPCs com parâmetros corretos + GRANTs**

Cada função será recriada para:
- Aceitar os parâmetros de auditoria que o frontend já envia
- Gravar os campos de auditoria no UPDATE (confirmado_por, confirmado_em, etc.)
- Manter a lógica de segurança existente (auth.uid(), verificação de cliente_id, admin check)
- Ter `GRANT EXECUTE` para `authenticated`

Assinaturas atualizadas:
- `confirmar_agendamento(p_agendamento_id, p_confirmado_por, p_confirmado_por_user_id)`
- `desconfirmar_agendamento(p_agendamento_id, p_desconfirmado_por, p_desconfirmado_por_user_id)`
- `cancelar_agendamento_soft(p_agendamento_id, p_cancelado_por, p_cancelado_por_user_id)`
- `excluir_agendamento_soft(p_agendamento_id, p_excluido_por, p_excluido_por_user_id)`

**2. Nenhuma mudança no frontend** — o código em `useAppointmentsList.ts` já envia os parâmetros corretos, só precisa que o banco os aceite.

### Risco
- Baixo. Funções SECURITY DEFINER com mesma lógica de autorização existente.
- Sem alteração de schema, RLS ou triggers.
- Frontend permanece inalterado.

