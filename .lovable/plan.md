

# Correcao de Performance: Travamento ao Alterar Datas

## Problema
Ao digitar ou alterar datas nos campos "Data Inicio" e "Data Fim", o sistema trava porque:
1. Cada tecla digitada dispara um setState, causando re-render de um componente com 1078 linhas
2. Calculos pesados como agrupamento de slots e resumo de dias rodam em **cada render**, mesmo quando nao mudaram
3. O `calculatePreview` dispara a cada mudanca de estado, mesmo com datas parciais/invalidas

## Impacto no Sistema
- **Interface congela** por 200-500ms a cada tecla digitada no campo de data
- **Experiencia do usuario** e severamente prejudicada -- parece que o sistema "travou"
- **Nao afeta dados** -- o problema e puramente de renderizacao no navegador
- **Outras funcionalidades nao sao afetadas** -- apenas a tela de geracao de horarios

## Solucao

### Arquivo: `src/components/scheduling/DoctorScheduleGenerator.tsx`

**A) Memoizar calculos pesados** que rodam em cada render sem necessidade:

Transformar `groupedSlots`, `sortedDates` e `hasActiveConfig` em `useMemo`:

```text
// Antes (roda a cada render):
const groupedSlots = slots.reduce(...)
const sortedDates = Object.keys(groupedSlots).sort()
const hasActiveConfig = schedules.some(...)

// Depois (roda apenas quando dependencias mudam):
const groupedSlots = useMemo(() => slots.reduce(...), [slots])
const sortedDates = useMemo(() => Object.keys(groupedSlots).sort(), [groupedSlots])
const hasActiveConfig = useMemo(() => schedules.some(...), [schedules])
```

**B) Validar datas antes de calcular preview** -- adicionar uma checagem rapida no `useEffect` para ignorar datas invalidas/parciais sem nem chamar `calculatePreview`:

```text
useEffect(() => {
  // Validacao rapida antes do debounce
  if (!selectedDoctor || !dataInicio || !dataFim || 
      dataInicio.length !== 10 || dataFim.length !== 10) {
    setPreviewCount(0);
    return;
  }
  
  const timeoutId = setTimeout(() => {
    const count = calculatePreview();
    setPreviewCount(count);
  }, 500);
  return () => clearTimeout(timeoutId);
}, [selectedDoctor, dataInicio, dataFim, intervaloMinutos, schedules]);
```

Isso evita que datas parciais como `"2026-0"` ou `"2026-02-"` disparem o calculo completo.

**C) Memoizar `calculatePreview` com useCallback** para evitar recriacao da funcao a cada render:

```text
const calculatePreview = useCallback(() => {
  if (!selectedDoctor) return 0;
  // ... resto da logica
}, [selectedDoctor, dataInicio, dataFim, intervaloMinutos, schedules]);
```

**D) Memoizar `selectedDoctorData`** (linha 433):

```text
const selectedDoctorData = useMemo(
  () => doctors.find(d => d.id === selectedDoctor),
  [doctors, selectedDoctor]
);
```

## Resultado Esperado
- Campos de data respondem instantaneamente sem travar
- Calculos pesados so executam quando seus dados realmente mudam
- Preview so calcula com datas completas e validas (10 caracteres no formato YYYY-MM-DD)
- Nenhuma funcionalidade sera alterada -- apenas a performance da renderizacao melhora

## Riscos
Nenhum risco funcional. As mudancas sao puramente de otimizacao de renderizacao usando `useMemo` e `useCallback`, que sao padroes estabelecidos do React.

