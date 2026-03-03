

## Problema: Limite de 1000 linhas do Supabase

A Clínica Olhos tem **24.014 horários futuros** no banco de dados, distribuídos por 7 médicos. Porém, a query no `Index.tsx` não especifica limite, então o Supabase aplica o **limite padrão de 1000 linhas**. Isso retorna slots apenas dos primeiros médicos (ordem alfabética do banco), deixando os demais sem horários visíveis.

### Solução

Carregar os slots **apenas do médico selecionado** em vez de todos os médicos de uma vez. Isso resolve o problema de limite e também melhora a performance (buscar 1000-5000 slots de um médico vs 24.000+ de todos).

### Alterações em `src/pages/Index.tsx`

1. **Modificar `fetchEmptySlots` e `reloadEmptySlots`**: Adicionar filtro por `medico_id` do médico atualmente selecionado na agenda
2. **Adicionar dependência do médico selecionado** no useEffect para recarregar ao trocar de médico
3. **Fallback**: Se nenhum médico estiver selecionado, buscar com `.limit(5000)` para cobrir cenários sem médico específico

### Detalhes técnicos

Nas duas queries (useEffect e reloadEmptySlots), adicionar:
- `.eq('medico_id', selectedDoctorId)` quando há médico selecionado
- `.limit(5000)` como safety net quando não há filtro por médico
- Adicionar `selectedDoctorId` como dependência do useEffect

Isso reduz drasticamente o volume de dados (de 24k para ~1k-5k por médico) e garante que todos os slots do médico visualizado sejam carregados.

