

# Corrigir migração do partner_branding para funcionar em produção

## Problema raiz

A migração que atualiza o `domain_pattern` da GT INOVA usa um UUID fixo (`WHERE id = '258368b8-...'`). Esse UUID foi gerado automaticamente no banco de **Test** e e diferente no banco de **Live** (producao). Como resultado, o UPDATE nao encontra nenhum registro em producao, e o `domain_pattern` continua como `'gtinova'` -- que nao faz match com o hostname `gt.inovaia-automacao.com.br`.

## Solucao

Criar uma nova migracao que usa `WHERE partner_name = 'GT INOVA'` em vez do UUID. Isso garante que funcione em ambos os ambientes.

## Arquivo a criar

`supabase/migrations/[timestamp]_fix_gt_inova_domain_pattern.sql`

```sql
UPDATE partner_branding 
SET domain_pattern = 'gt.inovaia-automacao', 
    subtitle = 'Soluções Inovadoras',
    updated_at = now()
WHERE partner_name = 'GT INOVA';
```

## Passos

1. Criar a migracao SQL acima
2. Publicar o projeto
3. Verificar no dominio `GT.inovaia-automacao.com.br` que a logo e o branding da GT INOVA aparecem corretamente

## Detalhes tecnicos

- A coluna `partner_name` tem constraint `UNIQUE`, entao o `WHERE partner_name = 'GT INOVA'` e seguro e especifico
- A logica de matching no `usePartnerBranding.ts` (filter + sort por tamanho) ja esta correta e nao precisa de alteracao
- Nao ha alteracao de codigo, apenas de dados no banco

