

## Plano: Aceitar `medico_nome` e `atendimento_nome` no `handleAdicionarFila`

Reutilizar a mesma lógica de resolução por nome do `handleSchedule` para que o agente possa enviar nomes em vez de UUIDs.

### Mudança no `supabase/functions/llm-agent-api/index.ts`

**No `handleAdicionarFila` (linhas 4108-4124):**

1. Aceitar `medico_nome` e `atendimento_nome` além de `medico_id` e `atendimento_id`
2. Se `medico_id` não vier, resolver via fuzzy match no banco (mesma lógica do handleSchedule: buscar todos médicos ativos do cliente, normalizar nome, fazer includes bidirecional)
3. Se `atendimento_id` não vier, resolver via `ilike` no banco filtrando por `medico_id` + `cliente_id` (mesma lógica do handleSchedule)
4. Ajustar validação: exigir `medico_id || medico_nome` e `atendimento_id || atendimento_nome`
5. Na resposta, incluir `medico_nome` e `atendimento_nome` resolvidos

### Detalhes técnicos

Extração dos novos campos:
```
const medicoNome = body.medico_nome || body.medicoNome;
const atendimentoNome = body.atendimento_nome || body.atendimentoNome;
```

Resolução de médico (se não vier `medico_id`):
- Buscar todos médicos ativos com `cliente_id`
- Normalizar nome (remover acentos, pontuação, lowercase)
- `includes` bidirecional — mesmo código das linhas 2032-2063

Resolução de atendimento (se não vier `atendimento_id`):
- `ilike` em `atendimentos.nome` com `%nome%`, filtrado por `medico_id` + `cliente_id` + `ativo = true`
- Se não encontrar, retornar erro com lista de serviços disponíveis

Validação atualizada:
```
if (!nomeCompleto || (!medicoId && !medicoNome) || (!atendimentoId && !atendimentoNome) || !dataPreferida)
```

### Body aceito pelo n8n após a mudança

```json
{
  "cliente_id": "...",
  "nome_completo": "Nome do Paciente",
  "data_nascimento": "01/01/1990",
  "celular": "87999999999",
  "convenio": "SUS",
  "medico_nome": "Dr. Marcelo D'Carli",
  "atendimento_nome": "Consulta Cardiológica",
  "data_preferida": "2025-02-15",
  "periodo_preferido": "manha"
}
```

UUIDs continuam funcionando se enviados — prioridade para `medico_id`/`atendimento_id` quando presentes.

### Escopo
- 1 arquivo, ~50 linhas adicionadas no `handleAdicionarFila`
- Deploy automático da edge function

