
# Correção Definitiva: "Erro de Verificação" em todos os domínios

## Causa Raiz Identificada

A política RLS **"Super admin access"** na tabela `profiles` contém uma consulta direta à tabela `auth.users`:

```text
EXISTS (SELECT 1 FROM auth.users WHERE users.id = auth.uid() AND users.email = 'gabworais@gmail.com')
```

O role `authenticated` **nao tem permissao SELECT em `auth.users`** (confirmado: `has_table_privilege = false`). O PostgreSQL avalia TODAS as politicas permissivas de uma tabela para cada consulta. Quando esta politica tenta acessar `auth.users`, ela gera um **ERROR** (nao apenas false), que derruba a consulta inteira.

### Efeito Cascata

O problema se propaga assim:

```text
DomainGuard
  -> useDomainPartnerValidation
    -> SELECT parceiro FROM clientes WHERE id = ?
      -> RLS "Approved users can view clientes"
        -> Subquery: SELECT 1 FROM profiles WHERE user_id = auth.uid()
          -> RLS "Super admin access" em profiles
            -> SELECT 1 FROM auth.users  (ERRO: permission denied)
              -> Toda a cadeia falha
                -> userPartner = null
                  -> "Erro de Verificacao"
```

### Por que isto e redundante

Ja existe a politica **"Super admin can access all profiles"** que usa `is_super_admin()`, uma funcao SECURITY DEFINER que consulta `user_roles` (tabela publica, sem problemas de permissao). Portanto a politica "Super admin access" e completamente desnecessaria.

## Solucao

Uma unica migration SQL:

1. **Remover** a politica "Super admin access" da tabela `profiles` (a que consulta `auth.users` diretamente)
2. A politica "Super admin can access all profiles" (que usa `is_super_admin()`) continuara funcionando corretamente

## O que NAO precisa mudar

- Nenhum arquivo de codigo (Auth.tsx, AuthGuard.tsx, hooks) precisa ser alterado
- As demais politicas RLS de `profiles` e `clientes` estao corretas
- Os GRANTs estao corretos (SELECT em profiles e clientes para authenticated)
- A funcao `is_super_admin()` e SECURITY DEFINER e funciona corretamente

## Resultado Esperado

1. Todas as consultas que envolvem `profiles` (direta ou via subquery) param de dar erro
2. Login funciona em `gt.inovaia-automacao.com.br` (GT INOVA)
3. Login funciona em `inovaia-automacao.com.br` (INOVAIA)
4. DomainGuard consegue buscar `clientes.parceiro` corretamente
5. Isolamento entre parceiros continua funcionando

## Detalhes Tecnicos

| Item | Alteracao |
|------|-----------|
| Migration SQL | `DROP POLICY "Super admin access" ON public.profiles;` |
| Tabelas afetadas | `profiles` (e indiretamente `clientes` via subquery RLS) |
| Risco | Nenhum - politica redundante com "Super admin can access all profiles" |
