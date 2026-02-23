

## Correção: Incluir horário de chegada para fazer a ficha na mensagem

### Problema
A mensagem atual do check-patient para ordem de chegada diz apenas:
```
"...no horário de a partir das 08:00. undefined começa a atender às 08:00, por ordem de chegada."
```

Faltam duas coisas:
1. O horário que o paciente deve chegar para fazer a ficha (`contagem_inicio`, ex: 07:00)
2. O nome do médico aparece como "undefined" (bug do `regras.nome`)

### Dados disponíveis no config do Dr. Hermann (manhã)
- `contagem_inicio`: **07:00** (horário para chegar e fazer a ficha)
- `distribuicao_fichas`: **a partir das 08:00** (distribuição de fichas)
- `atendimento_inicio`: **08:00** (médico começa a atender)

### Correção na função `montarMensagemConsulta`

**Arquivo:** `supabase/functions/llm-agent-api/index.ts` (linhas 1221-1250)

Duas mudanças:

1. **Incluir `contagem_inicio` na mensagem** como horário de chegada para fazer a ficha
2. **Corrigir "undefined"** usando `agendamento.medico_nome` como fallback para `regras.nome`

Mensagem atual (ordem de chegada):
```
O(a) paciente GABRIELA... para o dia 03/03/2026 no horário de a partir das 08:00. undefined começa a atender às 08:00, por ordem de chegada.
```

Nova mensagem:
```
O(a) paciente GABRIELA... para o dia 03/03/2026. Chegar a partir das 07:00 para fazer a ficha. Dr. Hermann Madeiro começa a atender às 08:00, por ordem de chegada.
```

### Código

```typescript
if (isOrdemChegada) {
    // Horário de chegada para ficha (contagem_inicio)
    const horarioFicha = periodoConfig.contagem_inicio || periodoConfig.inicio;
    if (horarioFicha) {
      mensagem += `. Chegar a partir das ${horarioFicha} para fazer a ficha`;
    } else {
      mensagem += ` no horário de ${periodo}`;
    }
    
    // Nome do médico com fallback
    const nomeMedico = agendamento.medico_nome || regras.nome || 'O médico';
    if (periodoConfig.atendimento_inicio) {
      mensagem += `. ${nomeMedico} começa a atender às ${periodoConfig.atendimento_inicio}, por ordem de chegada`;
    } else {
      mensagem += `, por ordem de chegada`;
    }
}
```

### Resultado esperado

```json
{
  "mensagem": "O(a) paciente GABRIELA LIMA DE MORAIS tem uma consulta agendada para o dia 03/03/2026. Chegar a partir das 07:00 para fazer a ficha. Dr. Hermann Madeiro começa a atender às 08:00, por ordem de chegada."
}
```

### Impacto
- Corrige o "undefined" no nome do médico
- Inclui horário de chegada para ficha usando `contagem_inicio` do período
- Aplica-se a todos os endpoints que usam `montarMensagemConsulta` (check-patient, schedule, confirm, etc.)
- Sem mudança de banco de dados

