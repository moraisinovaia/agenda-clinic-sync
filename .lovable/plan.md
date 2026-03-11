

## Diagnóstico: Exclusão de Usuário Falha por FK Constraint

### Causa Raiz

A tabela `user_roles` tem uma coluna `created_by` com foreign key para `auth.users(id)` **sem `ON DELETE` action**:

```text
user_roles.created_by → auth.users(id)  (sem ON DELETE CASCADE/SET NULL)
```

Quando o admin tenta excluir o usuário `TESTE` (auth user `42eb274a-...`), esse usuário é referenciado em `user_roles.created_by` de algum outro registro. O Postgres bloqueia a exclusão com:

> "violates foreign key constraint user_roles_created_by_fkey"

A coluna `user_roles.user_id` já tem `ON DELETE CASCADE` (via a FK padrão), mas `created_by` não tem nenhuma ação definida.

### Correção

Uma migration SQL para alterar a FK `user_roles_created_by_fkey` adicionando `ON DELETE SET NULL`:

```sql
ALTER TABLE public.user_roles
  DROP CONSTRAINT user_roles_created_by_fkey,
  ADD CONSTRAINT user_roles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id)
    ON DELETE SET NULL;
```

Isso faz com que, ao deletar um usuário, os registros `user_roles` onde ele é `created_by` simplesmente tenham esse campo setado para `NULL` — preservando os roles dos outros usuários sem bloquear a exclusão.

Nenhuma alteração de código é necessária. Apenas a migration no banco.

