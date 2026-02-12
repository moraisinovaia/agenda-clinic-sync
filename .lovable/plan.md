

# Correcao: Permissao RLS na tabela clientes para branding

## Problema identificado
A query do hook `useClinicBranding` para buscar `nome` e `logo_url` da tabela `clientes` retorna **HTTP 403** com erro `permission denied for table clientes`. A politica de RLS atual nao permite SELECT para usuarios autenticados nessa tabela.

## Solucao
Criar uma politica RLS de SELECT na tabela `clientes` que permita cada usuario ler apenas os dados da sua propria clinica (baseado no `cliente_id` do perfil).

## Passo unico

### Adicionar politica RLS via migracao SQL

Criar uma nova migracao que adiciona uma policy de SELECT na tabela `clientes`:

```text
CREATE POLICY "Users can read own clinic data"
ON public.clientes
FOR SELECT
TO authenticated
USING (id = get_user_cliente_id());
```

Isso garante que:
- Cada usuario so consegue ler os dados da clinica a qual pertence
- A funcao `get_user_cliente_id()` ja existe e e usada em outras tabelas
- Nenhum dado de outras clinicas e exposto
- O hook `useClinicBranding` vai funcionar sem alteracoes no codigo

## Arquivos modificados
| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Adicionar RLS policy de SELECT na tabela `clientes` |

## Risco
Nenhum - apenas adiciona permissao de leitura restrita ao proprio cliente, seguindo o mesmo padrao de RLS ja usado no sistema.
