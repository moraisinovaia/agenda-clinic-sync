

## Diagnóstico

O erro "sem vagas em 45 dias" é causado porque **as regras de negócio do Dr. Marcelo não estão sendo carregadas** pela API.

### Cadeia causal:
1. n8n envia `cliente_id: 2bfb98b5...` (IPADO)
2. A RPC `load_llm_config_for_clinic` pega o primeiro `llm_clinic_config` com `LIMIT 1` → retorna `config_id: 20b48124...` (IPADO geral)
3. A RPC filtra `business_rules WHERE config_id = 20b48124...` → carrega apenas 3 médicos (os do IPADO geral)
4. Dr. Marcelo tem `config_id: a1b2c3d4...` (config dedicada) → **suas regras ficam de fora**
5. `getMedicoRules()` retorna `null` → `servico = null` → ambos os loops de busca iteram `periodos` de um objeto null → 0 resultados

### Evidência nos logs:
- `business_rules carregadas: 3 médicos` (deveria ser 6 — 3 IPADO + 3 Dr. Marcelo)
- `config_id_used: 20b48124...` (não é o do Dr. Marcelo)
- `Serviço: não encontrado ainda` (porque regras não existem no config carregado)

## Solução

Alterar a RPC `load_llm_config_for_clinic` para carregar business_rules de **TODOS os config_ids** pertencentes ao mesmo `cliente_id`, não apenas do primeiro.

### Alteração na RPC (SQL):

Substituir:
```sql
WHERE br.config_id = v_config_id AND br.ativo = true
```

Por:
```sql
WHERE br.cliente_id = COALESCE(p_cliente_id, (SELECT cliente_id FROM llm_clinic_config WHERE id = v_config_id))
  AND br.ativo = true
```

Fazer o mesmo para a query de `llm_mensagens`.

Isso garante que quando n8n envia o `cliente_id` do IPADO, todas as regras (incluindo as do Dr. Marcelo com config dedicado) são carregadas.

### Também corrigir a mensagem de erro:

Na `llm-agent-api/index.ts`, linha ~5676: mudar "45 dias" para usar o valor real (`quantidade_dias` que pode ser 100).

## Impacto

- Zero impacto em outras clínicas (que têm apenas 1 config_id por cliente_id)
- Resolve o problema para Dr. Marcelo e qualquer futuro médico com config dedicada dentro do IPADO
- Backward-compatible: quando `p_config_id` é passado diretamente (via proxy), ainda funciona

