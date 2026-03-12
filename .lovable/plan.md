

# Correção: Adicionar UNIMED VSF ao Dr. Guilherme Lucena Moura

## Diagnóstico

Dr. Guilherme (medico_id: `f9a5aab1-5ae1-4b9e-8e26-153beb3f88da`) está faltando o convênio **UNIMED VSF** em dois locais:

1. `medicos.convenios_aceitos` (array de texto)
2. `business_rules.config` (campos `convenios` e `convenios_aceitos` dentro do JSON)

Business rule ID: `b255fe45-82a2-48eb-b0f1-46bb2700c7d1`

## Plano

Uma única migração SQL que:

1. Adiciona `'UNIMED VSF'` ao array `convenios_aceitos` na tabela `medicos`
2. Atualiza o JSON `config` na tabela `business_rules` para incluir `UNIMED VSF` tanto em `config.convenios` quanto em `config.convenios_aceitos`

```sql
-- 1. Atualizar medicos.convenios_aceitos
UPDATE medicos 
SET convenios_aceitos = array_append(convenios_aceitos, 'UNIMED VSF'),
    updated_at = now()
WHERE id = 'f9a5aab1-5ae1-4b9e-8e26-153beb3f88da';

-- 2. Atualizar business_rules.config (ambos arrays JSON)
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    config,
    '{convenios}',
    (config->'convenios') || '"UNIMED VSF"'::jsonb
  ),
  '{convenios_aceitos}',
  (config->'convenios_aceitos') || '"UNIMED VSF"'::jsonb
),
updated_at = now()
WHERE id = 'b255fe45-82a2-48eb-b0f1-46bb2700c7d1';
```

Nenhuma alteração no frontend necessária.

