
## Correcao: check-patient mostrando hora exata em vez do periodo para ordem de chegada

### Problema
O endpoint `/check-patient` retorna `"hora_agendamento": "08:05:00"` e mensagem `"Consulta agendada para 03/03/2026 as 08:05:00"` para Dr. Hermann Madeiro, que usa **ordem de chegada**. Isso confunde o paciente, que pensa ter hora marcada.

### Causa raiz
A funcao `formatarConsultaComContexto` (linha 1256) tenta encontrar o servico do agendamento nas regras de negocio do medico (linha 1270-1273). O atendimento e "Retorno", mas nas business_rules do Dr. Hermann nao existe um servico chamado "Retorno" -- so existem "Consulta Completa Eletiva", "Curva Tensional", etc.

Quando o servico nao e encontrado, a funcao cai no fallback (linha 1276) que simplesmente mostra a hora exata:
```
mensagem: "Consulta agendada para 03/03/2026 as 08:05:00"
```

### Solucao
Quando o servico especifico nao for encontrado nas regras, verificar se o medico tem `tipo_agendamento: ordem_chegada` no nivel geral. Se sim, usar o periodo correspondente ao horario do agendamento (manha/tarde) de **qualquer** servico configurado como fallback, em vez de mostrar a hora exata.

### Mudancas no codigo

**Arquivo:** `supabase/functions/llm-agent-api/index.ts`

**Funcao `formatarConsultaComContexto`** (linhas ~1275-1297):

Logica atual nos fallbacks:
```
Se servicoKey nao encontrado → mostra hora exata
Se periodo nao encontrado → mostra hora exata
```

Nova logica:
```
Se servicoKey nao encontrado:
  1. Verificar se regras.tipo_agendamento === 'ordem_chegada'
  2. Se sim: buscar primeiro servico que tenha periodos configurados
  3. Classificar periodo pelo horario do agendamento
  4. Montar mensagem com distribuicao_fichas e atendimento_inicio
  5. Se nao encontrar nenhum periodo: fallback para hora exata

Se periodo nao encontrado:
  (mesma logica acima como fallback)
```

### Detalhes da implementacao

No bloco que hoje retorna o fallback simples (linha 1275-1281), substituir por:

```
if (!servicoKey) {
  // Fallback: se medico e ordem_chegada, tentar usar periodos de qualquer servico
  if (regras.tipo_agendamento === 'ordem_chegada') {
    // Buscar primeiro servico com periodos configurados
    const primeiroServicoComPeriodos = Object.values(regras.servicos)
      .find(s => s.periodos && Object.keys(s.periodos).length > 0);
    
    if (primeiroServicoComPeriodos) {
      const periodo = classificarPeriodoAgendamento(
        agendamento.hora_agendamento, 
        primeiroServicoComPeriodos.periodos
      );
      if (periodo) {
        const periodoConfig = primeiroServicoComPeriodos.periodos[periodo];
        const mensagem = montarMensagemConsulta(agendamento, regras, periodoConfig, true);
        return {
          ...agendamento,
          periodo: periodoConfig.distribuicao_fichas || ...,
          atendimento_inicio: periodoConfig.atendimento_inicio,
          tipo_agendamento: 'ordem_chegada',
          mensagem
        };
      }
    }
  }
  // Fallback final: hora exata (para hora_marcada ou sem config)
  return { ...agendamento, horario_formatado: ..., mensagem: ... };
}
```

### Resultado esperado

Antes:
```json
{
  "hora_agendamento": "08:05:00",
  "horario_formatado": "08:05:00",
  "mensagem": "Consulta agendada para 03/03/2026 as 08:05:00."
}
```

Depois:
```json
{
  "hora_agendamento": "08:05:00",
  "periodo": "a partir das 08:00",
  "atendimento_inicio": "08:00",
  "tipo_agendamento": "ordem_chegada",
  "mensagem": "O(a) paciente GABRIELA LIMA DE MORAIS tem uma consulta agendada para o dia 03/03/2026 no horario de a partir das 08:00. Dr. Hermann Madeiro comeca a atender as 08:00, por ordem de chegada."
}
```

### Impacto
- Todos os atendimentos de medicos com ordem_chegada mostrarao o periodo correto, mesmo que o tipo de atendimento especifico nao esteja listado nas business_rules
- Medicos com hora_marcada continuam mostrando a hora exata normalmente
- Nenhuma mudanca de banco de dados necessaria
