

## Plano: Intervalo independente por periodo (Manha / Tarde)

### Problema
O campo "Intervalo entre horarios" e unico e global. O mesmo valor se aplica a todos os periodos. Para configurar intervalos diferentes entre manha e tarde, o usuario precisa gerar um periodo por vez.

### Solucao
Mover o intervalo de global para **por periodo, por dia**, permitindo configurar valores independentes para manha e tarde.

### Alteracoes

**1. `src/types/schedule-generator.ts`** -- Adicionar `intervalo_minutos` ao `DaySchedule`
- Adicionar campo `intervalo_minutos` dentro de cada periodo do `DaySchedule` (manha/tarde), com valor padrao 15

**2. `src/components/scheduling/DoctorScheduleGenerator.tsx`**

- Remover o state global `intervaloMinutos` (linha 83)
- Remover o Select global de intervalo (linhas 558-579)
- Adicionar ao estado inicial de cada periodo em `schedules`: `intervalo_minutos: 15`
- Adicionar um mini-select de intervalo ao lado dos inputs de horario de cada periodo (dentro do grid de cada dia, linhas ~667-720), visivel apenas quando o periodo esta ativo
- Atualizar `updateSchedule` para suportar o campo `intervalo_minutos`
- Atualizar `handleGenerate` (linha ~418-433) para usar `sched[periodo].intervalo_minutos` em vez do global
- Atualizar `calculatePreview` (linha ~149-179) para usar o intervalo do periodo correspondente
- Atualizar `applyQuickConfig` para incluir `intervalo_minutos: 15` nos presets

**3. Layout do grid por dia**

Cada linha de periodo (manha/tarde) ficara assim:

```text
[x] 08:00  ate  12:00  | a cada [15 min v]
```

O select de intervalo sera compacto (dropdown pequeno) ao lado dos horarios, ocupando espaço minimo.

### Impacto
- Nenhuma alteracao no banco de dados (o intervalo ja e resolvido no frontend antes do insert)
- O hook `useScheduleGenerator` ja recebe `intervalo_minutos` por configuracao individual, entao funciona sem mudancas
- A funcao `generateTimeSlotsForPeriod` ja recebe intervalo por config, sem mudancas

