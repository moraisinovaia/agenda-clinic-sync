

# Correção: "permission denied" nas tabelas profiles e clientes

## Causa raiz real

Os logs do PostgreSQL mostram repetidamente:
- `permission denied for table profiles`
- `permission denied for table clientes`

Isso **não é um problema de RLS**. As políticas RLS que corrigimos estão corretas, mas o role `authenticated` não possui `GRANT SELECT` nessas tabelas. Sem o GRANT, o PostgreSQL nem avalia as políticas RLS — simplesmente nega o acesso.

Provavelmente os GRANTs foram removidos durante uma hardening de segurança anterior.

## Solução

Executar uma migration SQL com:

```text
-- Permitir que usuários autenticados acessem as tabelas
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.clientes TO authenticated;

-- Manter permissões de INSERT/UPDATE que já existiam para profiles
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
```

Isso é seguro porque as políticas RLS continuam filtrando quais linhas cada usuário pode ver (própria clínica, próprio perfil, etc.). O GRANT apenas permite que o PostgreSQL chegue até a avaliação das políticas.

## Arquivos a modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova migration SQL | Adicionar GRANT SELECT em profiles e clientes para authenticated |

## Resultado esperado

1. Usuários autenticados conseguem consultar `clientes.parceiro` (validação de domínio funciona)
2. Usuários conseguem carregar seu próprio perfil (`profiles`)
3. GT INOVA entra em `gt.inovaia-automacao.com.br`
4. INOVAIA entra em `inovaia-automacao.com.br`
5. Isolamento entre parceiros continua funcionando via RLS
