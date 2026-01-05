
-- Atualizar horário do Dr. Edson para incluir período completo
-- O período "manhã" vai de 08:00 às 10:00 (exames + consultas)
UPDATE horarios_configuracao
SET 
  hora_fim = '10:00',
  limite_pacientes = 25,
  updated_at = now()
WHERE id = '70bddfcb-b7d5-49e0-9f2d-5f91ce8a9b0c';
