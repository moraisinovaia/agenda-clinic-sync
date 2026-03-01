

## Problema: Inconsistência de Naming entre Handlers

O `handleAdicionarFila` espera **camelCase** mas o `handleResponderFila` e todos os outros endpoints da API usam **snake_case**. A documentação que foi fornecida também usava snake_case. Isso vai causar campos vazios no n8n.

### Solução: Normalizar `handleAdicionarFila` para snake_case

Alinhar com o padrão do resto da API e da documentação.

### Mudança no `supabase/functions/llm-agent-api/index.ts`

**Linhas 4107-4116** — alterar o destructuring e validação:

```
// DE:
const { nomeCompleto, dataNascimento, convenio, celular, medicoId, atendimentoId, dataPreferida, periodoPreferido, observacoes, prioridade } = body;
if (!nomeCompleto || !medicoId || !atendimentoId || !dataPreferida) {
  return errorResponse('Campos obrigatórios: nomeCompleto, medicoId, atendimentoId, dataPreferida');
}

// PARA:
const nomeCompleto = body.nome_completo || body.nomeCompleto;
const dataNascimento = body.data_nascimento || body.dataNascimento;
const convenio = body.convenio;
const celular = body.celular;
const medicoId = body.medico_id || body.medicoId;
const atendimentoId = body.atendimento_id || body.atendimentoId;
const dataPreferida = body.data_preferida || body.dataPreferida;
const periodoPreferido = body.periodo_preferido || body.periodoPreferido;
const observacoes = body.observacoes;
const prioridade = body.prioridade;

if (!nomeCompleto || !medicoId || !atendimentoId || !dataPreferida) {
  return errorResponse('Campos obrigatórios: nome_completo, medico_id, atendimento_id, data_preferida');
}
```

Aceita **ambos os formatos** (snake_case e camelCase) com prioridade para snake_case. Assim o n8n pode mandar `nome_completo` e funciona, mas se alguém já mandou `nomeCompleto` também não quebra.

O resto do código interno continua usando as variáveis locais — zero impacto nas queries ao banco.

### Escopo
- 1 arquivo, ~15 linhas alteradas
- Deploy automático da edge function

