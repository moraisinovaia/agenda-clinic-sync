-- Adicionar "Retorno" para todos os médicos que não têm
INSERT INTO atendimentos (medico_id, nome, tipo, ativo, valor_particular)
SELECT 
  m.id,
  'Retorno',
  'retorno',
  true,
  50.00
FROM medicos m
WHERE m.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM atendimentos a 
    WHERE a.medico_id = m.id 
    AND LOWER(a.tipo) = 'retorno' 
    AND a.ativo = true
  );