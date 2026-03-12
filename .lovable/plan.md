

# Diagnóstico: A migração quebrou o acesso admin no frontend

## Problema Crítico Encontrado

A função RPC `get_user_auth_data` (usada pelo `useStableAuth` no frontend) ainda verifica `role = 'admin'` para determinar se o usuário é admin:

```sql
SELECT EXISTS(
  SELECT 1 FROM user_roles 
  WHERE user_id = p_user_id AND role = 'admin'  -- ← BUG
) INTO v_is_admin;
```

Mas `gabworais@gmail.com` agora tem `role = 'super_admin'`, **não** `admin`. Resultado: o frontend recebe `is_admin: false` e o painel administrativo inteiro fica inacessível para o super admin.

## Segundo Problema

A policy de `backup_migracao_endogastro` ainda usa `has_role(auth.uid(), 'admin'::app_role)` sem `OR is_super_admin()` — o super admin perdeu acesso a essa tabela.

## O que as RLS policies fazem certo

As policies das tabelas críticas estão OK porque usam `has_role(..., 'admin') OR has_role(..., 'admin_clinica')` combinado com `is_super_admin()` separado. O super admin acessa dados via a policy `*_super_admin`. Isso funciona.

## Plano de Correção (2 itens)

### 1. Corrigir a RPC `get_user_auth_data` (banco)

Alterar para incluir `super_admin` na verificação de admin:

```sql
SELECT EXISTS(
  SELECT 1 FROM user_roles 
  WHERE user_id = p_user_id AND role IN ('admin', 'super_admin')
) INTO v_is_admin;
```

Isso faz o frontend tratar `super_admin` como admin (acesso ao painel completo), sem precisar alterar nenhum componente React.

### 2. Corrigir fallback no `useStableAuth.ts`

A linha 72 do fallback também checa `has_role` com `_role: 'admin'`. Precisa verificar `super_admin` também. Alterar para chamar `is_super_admin` em vez de `has_role(..., 'admin')` no fallback, ou adicionar uma segunda checagem.

### 3. (Menor) Corrigir policy de `backup_migracao_endogastro`

Adicionar `OR is_super_admin()` nas policies dessa tabela.

## Impacto

- Sem essas correções, `gabworais@gmail.com` **não consegue acessar** o painel admin
- Nenhum componente React precisa mudar (o `isAdmin` do hook já controla tudo)
- Todas as demais funcionalidades (recepcionistas, admin_clinica) estão funcionando normalmente

