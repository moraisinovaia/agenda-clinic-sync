

## Bug: `dispararWebhookFilaEspera` retorna `hora_marcada` para Dr. Marcelo (deveria ser `ordem_chegada`)

### Causa raiz

A função `dispararWebhookFilaEspera` usa `getMedicoRules(config, medicoId, BUSINESS_RULES.medicos[medicoId])` para buscar as regras do médico. No entanto:

1. O `BUSINESS_RULES.medicos` é um objeto vazio `{}` (fallback desativado), então o hardcoded é sempre `undefined`
2. O `config` (DynamicConfig) carrega apenas os médicos do `config_id` padrão (`20b48124-...`), que contém apenas 3 médicos
3. Dr. Marcelo está cadastrado com outro `config_id` (`a1b2c3d4-...`), então **não está presente** no `config.business_rules`
4. `getMedicoRules` retorna `undefined` → o bloco `if (regras)` é pulado → `tipo_agenda` fica no default `'hora_marcada'`

### Correção

Na função `dispararWebhookFilaEspera`, quando `getMedicoRules` retorna null, fazer uma consulta direta à tabela `business_rules` para buscar as regras do médico:

```typescript
let regras = getMedicoRules(config, medicoId, BUSINESS_RULES.medicos[medicoId]);

// Fallback: buscar direto do banco se não encontrou no cache
if (!regras) {
  try {
    const { data: brData } = await supabase
      .from('business_rules')
      .select('config')
      .eq('medico_id', medicoId)
      .eq('cliente_id', clienteId)
      .eq('ativo', true)
      .maybeSingle();
    if (brData?.config) {
      regras = brData.config;
    }
  } catch (e) {
    console.warn('⚠️ [WEBHOOK-FILA] Erro ao buscar business_rules fallback');
  }
}
```

Adicionalmente, a lógica de matching de períodos precisa de um fallback para chaves simples (`"manha"`, `"tarde"`) quando as chaves não contêm o nome do dia. Atualmente, ela busca `pKeyNorm.includes(diaNome)` que falha para chaves como `"manha"`. Adicionar um fallback final que faz match apenas pelo período:

```typescript
// Fallback final: match apenas pelo período (chaves simples como "manha", "tarde")
if (!periodoConfig) {
  for (const [_nomeServico, sConfig] of Object.entries(servicos)) {
    if (sConfig?.periodos?.[periodoNome]) {
      periodoConfig = sConfig.periodos[periodoNome];
      servicoConfig = sConfig;
      break;
    }
  }
}
```

### Escopo
- 1 arquivo: `supabase/functions/llm-agent-api/index.ts`
- Adicionar query fallback ao banco na `dispararWebhookFilaEspera`
- Adicionar fallback de matching por período simples
- Nenhuma migração SQL necessária

