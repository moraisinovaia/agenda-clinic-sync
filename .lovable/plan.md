

# Analise de Performance: Sistema "Trava" ao Gerar Horarios

## Problemas Encontrados

### 1. Excesso de logs no console (PRINCIPAL)
O arquivo `src/utils/scheduleGenerator.ts` possui `console.log` em praticamente **todas as linhas** do loop de geracao. Para um periodo de 30 dias com 5 dias uteis ativos e 2 periodos (manha/tarde), isso gera:
- ~300 logs so na funcao `generateTimeSlotsForPeriod` (30 dias x ~10 configs)
- Mais logs por cada cache hit/miss em `generateTimeSlots`
- Escrever centenas de logs no console bloqueia a thread principal do navegador

### 2. Busca linear de agendamentos existentes
Na linha 46-48 de `scheduleGenerator.ts`, para **cada slot de tempo** de **cada dia**, o codigo faz `existingAppointments.some(...)` -- uma busca linear em todos os agendamentos. Com ~1.461 agendamentos existentes e potencialmente centenas de slots, isso resulta em dezenas de milhares de comparacoes.

### 3. Calculo de preview sincrono
A funcao `calculatePreview()` executa de forma sincrona na thread principal, iterando todos os dias do intervalo e gerando slots para cada um. Com 30 dias, isso pode causar micro-travamentos a cada mudanca de estado.

## Solucao

### Arquivo: `src/utils/scheduleGenerator.ts`

**A) Remover console.logs excessivos** -- manter apenas 1 log no inicio e 1 no final da geracao:
- Remover os logs das linhas 27, 31, 35 (dentro do loop por dia)
- Remover log de cache hit (linha 72)
- Manter apenas o log inicial (linha 16) e adicionar um log final com o total

**B) Usar Set para busca de agendamentos** -- converter a lista de agendamentos em um `Set` de chaves `"data|hora"` antes do loop, transformando a busca de O(n) para O(1):
```text
const appointmentSet = new Set(
  existingAppointments.map(apt => `${apt.data_agendamento}|${apt.hora_agendamento}`)
);
// Depois no loop:
const hasAppointment = appointmentSet.has(`${dateStr}|${time}`);
```

### Arquivo: `src/hooks/useScheduleGenerator.ts`

**C) Inserir slots em lotes** -- dividir o upsert em blocos de 500 registros para evitar timeout e travamento:
```text
const BATCH_SIZE = 500;
for (let i = 0; i < allSlots.length; i += BATCH_SIZE) {
  const batch = allSlots.slice(i, i + BATCH_SIZE);
  await supabase.from('horarios_vazios').upsert(batch, {...});
}
```

**D) Remover console.logs excessivos** do hook -- manter apenas logs essenciais de inicio e resultado final.

### Arquivo: `src/components/scheduling/DoctorScheduleGenerator.tsx`

**E) Aumentar debounce do preview** de 300ms para 500ms para reduzir recalculos durante interacao rapida.

## Resultado esperado
- Geracao de horarios sera significativamente mais rapida (menos logs, busca O(1), lotes)
- A interface nao travara durante o calculo de preview
- Os logs ficam limpos e uteis em vez de poluidos

