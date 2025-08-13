-- Verificar Dr. Max atual
SELECT 
  m.nome,
  a.nome as atendimento,
  a.tipo,
  a.ativo
FROM medicos m
JOIN atendimentos a ON a.medico_id = m.id
WHERE m.nome ILIKE '%Max%'
ORDER BY a.nome;