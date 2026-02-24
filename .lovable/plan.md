

## Correção: Busca de disponibilidade retornando "sem vagas" para serviços não cadastrados

### Problema

Quando o paciente pede disponibilidade para "Retorno" com Dr. Hermann Madeiro, a API retorna "sem vagas nos próximos 45 dias" mesmo havendo vagas. Isso acontece porque:

1. O serviço "Retorno" **não existe** nas `business_rules` do Dr. Hermann (só existem "Consulta Completa Eletiva", "Curva Tensional", etc.)
2. A variável `servico` fica `null`
3. Todo o loop de busca de períodos depende de `servico?.periodos?.manha` e `servico?.periodos?.tarde`, que são `null`
4. Nenhum período é encontrado em nenhum dia, resultando em 0 datas

### Solução

Quando `servico` é `null` (serviço não encontrado nas regras) e o médico é `ordem_chegada`, usar os períodos de **qualquer serviço configurado** como fallback -- exatamente a mesma lógica já aplicada com sucesso no `formatarConsultaComContexto`.

### Mudanças no código

**Arquivo:** `supabase/functions/llm-agent-api/index.ts`

**Após a resolução do serviço (linha ~4415-4420):** Adicionar bloco de fallback:

```typescript
// Se serviço não encontrado e médico é ordem_chegada, usar períodos de qualquer serviço
if (!servico && regras?.tipo_agendamento === 'ordem_chegada' && regras?.servicos) {
  const primeiroServicoComPeriodos = Object.values(regras.servicos)
    .find((s: any) => s?.periodos && Object.keys(s.periodos).length > 0);
  
  if (primeiroServicoComPeriodos) {
    servico = normalizarServicoPeriodos(primeiroServicoComPeriodos);
    console.log(`🔄 [FALLBACK] Serviço "${atendimento_nome}" não encontrado. Usando períodos de outro serviço configurado para ordem de chegada.`);
  }
}
```

Isso resolve o problema na raiz: tanto o loop principal (linhas 4642-4719) quanto o loop de retry (linhas 4782-4807) passarão a ter `servico.periodos` preenchido, encontrando as vagas corretamente.

### Impacto

- Corrige a busca de disponibilidade para qualquer serviço não cadastrado explicitamente (ex: "Retorno", "Revisão") em médicos com ordem de chegada
- Não afeta médicos com hora marcada (que continuam exigindo serviço específico)
- Não afeta serviços que já existem nas business_rules
- Aplica-se a todas as clínicas automaticamente
- Sem mudança de banco de dados

### Resultado esperado

Em vez de "sem vagas nos próximos 45 dias", retornará as próximas datas disponíveis com os períodos corretos do médico.

