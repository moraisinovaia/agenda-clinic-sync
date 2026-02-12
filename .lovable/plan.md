

# Correção: Horários gerados/apagados só aparecem após recarregar

## Problema

O estado `emptySlots` vive em `Index.tsx` e é passado como prop para `DoctorSchedule.tsx`. Existem duas instâncias do `DoctorScheduleGenerator`:

- **`Index.tsx` (linha 906)**: `onSuccess` recarrega `emptySlots` do banco -- funciona corretamente
- **`DoctorSchedule.tsx` (linha 1054)**: `onSuccess` apenas incrementa `refreshTrigger` local -- NAO atualiza `emptySlots`

Quando o usuário gera ou apaga horários de dentro da agenda do médico, a mudanca nunca sobe até `Index.tsx` para atualizar os dados.

## Solução

### 1. `src/components/scheduling/DoctorSchedule.tsx`

Adicionar prop `onSlotsChanged` e chamá-la no `onSuccess`:

```text
// Na interface DoctorScheduleProps, adicionar:
onSlotsChanged?: () => void;

// No onSuccess do DoctorScheduleGenerator (linha 1054):
onSuccess={() => {
  toast.success('Operação realizada com sucesso!');
  setRefreshTrigger(prev => prev + 1);
  onSlotsChanged?.();  // Notifica Index.tsx para recarregar
}}
```

### 2. `src/pages/Index.tsx`

Extrair a lógica de recarga para um `useCallback` reutilizável e passá-la como prop:

```text
// Criar função reutilizável:
const reloadEmptySlots = useCallback(async () => {
  if (!userClienteId) return;
  const { data, error } = await supabase
    .from('horarios_vazios')
    .select('*')
    .eq('cliente_id', userClienteId)
    .eq('status', 'disponivel')
    .gte('data', format(new Date(), 'yyyy-MM-dd'));
  if (!error && data) {
    setEmptySlots(data);
  }
}, [userClienteId]);

// Passar para DoctorSchedule:
<DoctorSchedule
  ...
  onSlotsChanged={reloadEmptySlots}
/>

// Usar também no DoctorScheduleGenerator de Index.tsx:
<DoctorScheduleGenerator
  ...
  onSuccess={reloadEmptySlots}
/>
```

## Impacto
- Ao gerar ou apagar horários de qualquer lugar, a lista atualiza imediatamente
- Código duplicado de recarga é eliminado com a função centralizada
- Nenhuma funcionalidade existente é alterada

