

# Corrigir parceiro da Clinica Orion e aplicar fix de RLS

## Problema
A Clinica Orion esta marcada como `GT INOVA`, mas deveria ser `INOVAIA`. Apenas a Clinica Olhos pertence a GT INOVA.

## Alteracoes

### 1. Migracão SQL (um unico arquivo)

```sql
-- Corrigir parceiro da Clinica Orion para INOVAIA
UPDATE clientes 
SET parceiro = 'INOVAIA', updated_at = now()
WHERE nome = 'Clínica Orion';

-- Corrigir RLS da partner_branding (politicas restritivas -> permissivas)
DROP POLICY IF EXISTS "Anyone can read partner branding" ON public.partner_branding;
DROP POLICY IF EXISTS "Super admin can manage partner branding" ON public.partner_branding;

CREATE POLICY "Anyone can read partner branding"
  ON public.partner_branding
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Super admin can manage partner branding"
  ON public.partner_branding
  FOR ALL
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
```

### Resultado esperado

| Cliente | Parceiro |
|---------|----------|
| IPADO | INOVAIA |
| ENDOGASTRO | INOVAIA |
| Clinica Venus | INOVAIA |
| Clinica Orion | INOVAIA |
| Clinica Olhos | GT INOVA |

### 2. Fix de RLS (incluso acima)
A correcao das politicas da `partner_branding` de RESTRICTIVE para PERMISSIVE resolve o problema de branding na tela de login -- sem isso, o dominio `gt.inovaia-automacao.com.br` sempre mostra INOVAIA por erro de permissao.

## Passos
1. Criar a migracao SQL com ambas as alteracoes
2. Publicar o projeto
3. Verificar que Clinica Orion aparece sob INOVAIA
4. Verificar que o dominio GT INOVA exibe o branding correto na tela de login

