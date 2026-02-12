

# Correção Definitiva: Travamento ao Alterar Datas

## Problema Restante

O cálculo `daysInPeriod` (linhas 634-639) executa `eachDayOfInterval()` **7 vezes por render** dentro do `.map()` da tabela de horários. Cada tecla digitada no campo de data causa re-render, disparando 7x esse cálculo pesado.

## Solução

### Arquivo: `src/components/scheduling/DoctorScheduleGenerator.tsx`

**A) Memoizar `daysInPeriod` fora do `.map()`** -- calcular uma única vez com `useMemo`:

```text
// ANTES (dentro do .map, roda 7x por render):
schedules.map((sched, idx) => {
  const daysInPeriod = dataInicio && dataFim ? (() => {
    const start = toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE);
    const end = toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE);
    if (!isValid(start) || !isValid(end)) return [];
    return eachDayOfInterval({ start, end }).map(d => getDay(d));
  })() : [];
  ...
});

// DEPOIS (fora do .map, roda 1x e só quando datas mudam):
const daysInPeriodSet = useMemo(() => {
  if (!dataInicio || !dataFim || dataInicio.length !== 10 || dataFim.length !== 10) {
    return new Set<number>();
  }
  try {
    const start = toZonedTime(parseISO(dataInicio + 'T12:00:00'), BRAZIL_TIMEZONE);
    const end = toZonedTime(parseISO(dataFim + 'T12:00:00'), BRAZIL_TIMEZONE);
    if (!isValid(start) || !isValid(end) || start > end) return new Set<number>();
    const days = eachDayOfInterval({ start, end });
    return new Set(days.map(d => getDay(d)));
  } catch {
    return new Set<number>();
  }
}, [dataInicio, dataFim]);

// No .map:
schedules.map((sched, idx) => {
  const dayExistsInPeriod = daysInPeriodSet.has(idx);
  ...
});
```

Isso reduz de 7 chamadas `eachDayOfInterval` por render para apenas 1, e usando `Set` a busca é O(1). Além disso, com a validação de `length !== 10`, datas parciais nem disparam o cálculo.

**B) Usar `selectedDoctorData` no JSX** -- substituir as 3 ocorrências de `doctors.find(doc => doc.id === selectedDoctor)?.nome` pelo valor já memoizado `selectedDoctorData?.nome`.

**C) Memoizar `getActiveDaysSummary`** com `useMemo` para evitar recriação a cada render.

## Impacto
- **Nenhuma funcionalidade alterada** -- apenas otimização de renderização
- **Campos de data** responderão instantaneamente
- **Risco zero** -- são mudanças puramente de memoização

## Resultado Esperado
- Digitar datas será fluido, sem travamento
- Render do componente será ~7x mais rápido ao alterar datas

