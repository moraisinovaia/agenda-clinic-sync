

# Correcao: Politica RLS da tabela `clientes` deve ser PERMISSIVE

## Problema
Todas as politicas RLS na tabela `clientes` sao do tipo **RESTRICTIVE**. No PostgreSQL, politicas restrictive funcionam como um filtro AND **sobre** politicas permissive. Se nao existe nenhuma politica permissive, o acesso e sempre negado -- independente das politicas restrictive existentes.

Isso explica por que a logo da Clinica Olhos nao aparece: a query ao `clientes` sempre retorna vazio/erro, e o hook `useClinicBranding` cai no fallback INOVAIA.

## Solucao
Remover a politica restrictive "Users can read own clinic data" e recria-la como **PERMISSIVE**. Isso resolve o acesso para usuarios autenticados lerem dados da sua propria clinica.

## Alteracao

### Migracao SQL

```text
-- Remover politica restrictive existente
DROP POLICY IF EXISTS "Users can read own clinic data" ON public.clientes;

-- Recriar como PERMISSIVE
CREATE POLICY "Users can read own clinic data"
ON public.clientes
FOR SELECT
TO authenticated
USING (id = get_user_cliente_id());
```

Por padrao, `CREATE POLICY` cria politicas **PERMISSIVE**, que e o comportamento desejado.

## Resultado esperado
- Usuarios autenticados conseguirao ler os dados da sua clinica
- O hook `useClinicBranding` vai retornar nome e logo corretos
- A logo da Clinica Olhos (gt-inova-logo.jpeg) vai aparecer no dashboard

## Risco
Nenhum -- a politica continua restringindo leitura apenas ao proprio cliente via `get_user_cliente_id()`.
