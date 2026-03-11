
Objetivo: isolar por que a exclusão continua falhando após a correção anterior e definir uma solução definitiva (nível produção).

Diagnóstico confirmado
- O erro atual NÃO é mais `user_roles_created_by_fkey` (esse já está corrigido com `ON DELETE SET NULL`).
- O bloqueio atual é: `profiles_aprovado_por_fkey`.
- Evidência dos logs de Auth:
  - `ERROR: update or delete on table "profiles" violates foreign key constraint "profiles_aprovado_por_fkey" on table "profiles" (SQLSTATE 23503)`
- Evidência de banco:
  - Constraint atual: `FOREIGN KEY (aprovado_por) REFERENCES profiles(id)` (sem `ON DELETE`).
  - Usuário alvo (`42eb274a-...`, profile `892445da-...`) é referenciado em `profiles.aprovado_por` por 4 registros.
- Conclusão: ao deletar `auth.users`, o cascade remove `profiles.user_id`, mas a auto-FK de `profiles.aprovado_por` bloqueia a exclusão do profile aprovador.

Do I know what the issue is?
- Sim. A causa raiz é relacional (FK sem política de deleção) e está reproduzida em logs + constraints atuais.

Plano de correção definitiva e profissional

1) Corrigir FK principal que está bloqueando agora (obrigatório)
- Criar migration para recriar `profiles_aprovado_por_fkey` com `ON DELETE SET NULL`.
- SQL:
  - `ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_aprovado_por_fkey;`
  - `ALTER TABLE public.profiles ADD CONSTRAINT profiles_aprovado_por_fkey FOREIGN KEY (aprovado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;`

2) Hardening preventivo para não “quebrar no próximo usuário”
- Ajustar também FK `audit_logs_user_id_fkey` para `ON DELETE SET NULL` (hoje está sem ação; usuários com histórico podem falhar no futuro).
- SQL:
  - `ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;`
  - `ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;`

3) Melhorar retorno de erro da exclusão (profissional/operacional)
- No `user-management`:
  - padronizar resposta estruturada sem stack completa para o cliente;
  - incluir `error_code` e mensagem amigável de integridade referencial;
  - manter log técnico completo apenas no Edge log.
- No frontend (`UserApprovalPanel`):
  - ler payload da Function quando vier non-2xx e exibir mensagem real, não só “Edge Function returned non-2xx”.

4) Validação pós-correção (aceite)
- Verificar constraints no banco (`pg_constraint`) com `ON DELETE SET NULL` nas duas FKs.
- Repetir exclusão do usuário que falhou.
- Testar exclusão de um usuário com histórico de `audit_logs` para garantir que não há novo bloqueio.
- Confirmar integridade:
  - `profiles.aprovado_por` dos aprovados vira `NULL`;
  - demais dados permanecem consistentes;
  - sem erro 500 no endpoint `/admin/users/:id`.

Detalhes técnicos (resumo)
- O problema é de modelagem de FK, não de RLS nem de permissão.
- A escolha correta aqui é `SET NULL` (preserva histórico e evita perda de registros dependentes).
- A abordagem em banco elimina a classe de erro de forma permanente, sem depender de “workaround” no código.
