-- Adiciona bloqueio parcial por horário em bloqueios_agenda.
-- hora_inicio / hora_fim nullable: NULL = bloqueia o dia inteiro (comportamento atual).
-- Constraint garante que, se uma for informada, a outra também deve ser,
-- e hora_inicio < hora_fim.

ALTER TABLE public.bloqueios_agenda
  ADD COLUMN hora_inicio time NULL,
  ADD COLUMN hora_fim    time NULL;

ALTER TABLE public.bloqueios_agenda
  ADD CONSTRAINT chk_bloqueio_horas_validas CHECK (
    (hora_inicio IS NULL AND hora_fim IS NULL)
    OR
    (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_inicio < hora_fim)
  );
