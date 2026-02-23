

## Corrigir filtro fuzzy de celular no check-patient

### Problema
O filtro fuzzy de celular no endpoint `/check-patient` está descartando pacientes que foram encontrados por nome + data de nascimento, apenas porque o numero de WhatsApp usado e diferente do cadastrado. Isso causa falsos negativos -- o sistema diz "sem consultas futuras" mesmo quando existem agendamentos.

### Caso concreto
- Paciente: GABRIELA LIMA DE MORAIS (03/04/2001)
- Celular no banco: (87) 9913-1191 (ultimos 4: 1191)
- WhatsApp de origem: 558792017974 (ultimos 4: 7974)
- Diferenca: 6783 (muito acima da tolerancia de 5)
- Resultado: paciente descartada, agendamento de 03/03/2026 nao apareceu

### Solucao
Mudar a logica do filtro fuzzy de celular para que ele **nao elimine** pacientes quando ja houve match por **nome + data de nascimento**. O celular passa a ser usado apenas como criterio de **desempate/ranking**, nao como filtro eliminatorio.

### Mudancas no codigo

**Arquivo:** `supabase/functions/llm-agent-api/index.ts` (linhas ~3369-3406)

Logica atual:
```
Se celular fornecido E celular >= 10 digitos:
  Filtrar pacientes removendo os que tem diff > 5 nos ultimos 4 digitos
  → Pode zerar a lista mesmo com match de nome+nascimento
```

Nova logica:
```
Se celular fornecido E celular >= 10 digitos:
  SE tem match por nome + nascimento (nome E data_nascimento fornecidos):
    → NAO eliminar ninguem pelo celular
    → Apenas ordenar: pacientes com celular mais proximo ficam primeiro
    → Log: "Celular diferente mas mantido por match nome+nascimento"
  SENAO (busca apenas por celular ou sem nome/nascimento):
    → Manter o filtro fuzzy atual (diff <= 5)
```

### Detalhes da implementacao

1. Verificar se a busca original incluiu `pacienteNomeNormalizado` E `dataNascimento` (ambos presentes)
2. Se sim: o filtro fuzzy de celular vira apenas um **sort** (ordenacao), nao um **filter** (eliminacao)
3. Se nao: manter comportamento atual para evitar falsos positivos em buscas apenas por celular
4. Adicionar log explicativo quando celular difere mas paciente e mantido

### Resultado esperado

Antes:
```json
{
  "encontrado": true,
  "paciente_cadastrado": true,
  "consultas": {
    "message": "nao possui consultas futuras agendadas",
    "total": 0
  }
}
```

Depois:
```json
{
  "encontrado": true,
  "paciente_cadastrado": true,
  "consultas": {
    "total": 1,
    "futuras": [{
      "agendamento_id": "e475ec15-...",
      "data": "2026-03-03",
      "hora": "08:05",
      "status": "agendado"
    }]
  }
}
```

### Impacto
- Pacientes que mandam mensagem de numeros diferentes do cadastrado serao encontrados corretamente
- Buscas apenas por celular (sem nome/nascimento) continuam com filtro rigoroso
- Nenhuma mudanca de banco de dados necessaria
