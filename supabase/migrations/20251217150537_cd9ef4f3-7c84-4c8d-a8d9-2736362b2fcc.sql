-- Criar médica faltante (Dra. Adriana Carla de Sena)
INSERT INTO medicos (nome, especialidade, cliente_id, ativo, convenios_aceitos)
SELECT DISTINCT
  em.nome,
  em.especialidade,
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'::uuid,
  true,
  em.convenios_aceitos
FROM endogastro_medicos em
WHERE em.nome = 'Dra. Adriana Carla de Sena'
  AND NOT EXISTS (
    SELECT 1 FROM medicos m 
    WHERE LOWER(TRIM(m.nome)) = LOWER(TRIM(em.nome))
    AND m.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
  )
LIMIT 1;

-- Atualizar mapeamento para a nova médica
UPDATE temp_medico_mapping tmm
SET 
  principal_medico_id = m.id,
  principal_nome = m.nome,
  mapped = true
FROM medicos m
WHERE tmm.endogastro_nome = 'Dra. Adriana Carla de Sena'
  AND m.nome = 'Dra. Adriana Carla de Sena'
  AND m.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';