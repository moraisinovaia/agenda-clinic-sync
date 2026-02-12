

# Correcao: Botao "Gerar Horarios" sempre desabilitado

## Problema
O botao permanece cinza com "Nenhum horario sera gerado" mesmo com medico selecionado, datas preenchidas e dias da semana ativos. Isso acontece porque o calculo de preview esta "congelado" nos valores iniciais.

## Causa raiz
Na linha 182-191 do `DoctorScheduleGenerator.tsx`, o `useMemo` tem dependencias vazias (`[]`). Isso faz a funcao `calculatePreview()` capturar o estado inicial (medico vazio, nenhum dia ativo) e nunca atualizar, retornando sempre 0.

## Solucao
Substituir o `useMemo` com dependencias vazias e o `useEffect` que o chama por um unico `useEffect` com debounce inline que acessa os valores atuais do estado.

## Alteracao

### Arquivo: `src/components/scheduling/DoctorScheduleGenerator.tsx`

**Remover** (linhas 182-191):
```text
const debouncedCalculatePreview = useMemo(() => {
  let timeoutId: NodeJS.Timeout | null = null;
  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      const count = calculatePreview();
      setPreviewCount(count);
    }, 300);
  };
}, []);
```

**Substituir o useEffect** (linhas 224-227) por:
```text
useEffect(() => {
  const timeoutId = setTimeout(() => {
    const count = calculatePreview();
    setPreviewCount(count);
  }, 300);
  return () => clearTimeout(timeoutId);
}, [selectedDoctor, dataInicio, dataFim, intervaloMinutos, schedules]);
```

## Resultado esperado
- Ao selecionar medico, datas e dias da semana, o botao mostrara "Gerar X Horarios" com o numero correto
- O botao ficara clicavel (azul) quando houver horarios a gerar
- O debounce de 300ms e mantido para evitar lag ao digitar

