-- MIGRAR BLOQUEIOS HISTÓRICOS
INSERT INTO bloqueios_agenda (
  id, medico_id, data_inicio, data_fim, motivo, status,
  criado_por, cliente_id, created_at, updated_at
)
SELECT 
  eb.bloqueio_id_original,
  COALESCE(tmm.principal_medico_id, m_fallback.id),
  eb.data_inicio,
  eb.data_fim,
  eb.motivo || ' [MIGRADO]',
  COALESCE(eb.status, 'ativo'),
  COALESCE(eb.criado_por, 'sistema_migracao'),
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'::uuid,
  eb.created_at,
  eb.updated_at
FROM endogastro_bloqueios_agenda eb
LEFT JOIN temp_medico_mapping tmm ON tmm.endogastro_medico_id = eb.medico_id
LEFT JOIN medicos m_fallback ON m_fallback.id = eb.medico_id AND m_fallback.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
WHERE NOT EXISTS (SELECT 1 FROM bloqueios_agenda ba WHERE ba.id = eb.bloqueio_id_original)
  AND COALESCE(tmm.principal_medico_id, m_fallback.id) IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- MIGRAR FILA DE ESPERA HISTÓRICA
INSERT INTO fila_espera (
  id, paciente_id, medico_id, atendimento_id, data_preferida, data_limite,
  periodo_preferido, observacoes, prioridade, status,
  cliente_id, created_at, updated_at
)
SELECT 
  ef.fila_id_original,
  ef.paciente_id,
  COALESCE(tmm.principal_medico_id, m_fallback.id),
  COALESCE(
    (SELECT id FROM atendimentos WHERE id = ef.atendimento_id AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'),
    'ae8ddec1-8f81-4fb9-b335-f6925bb821a2'::uuid
  ),
  ef.data_preferida,
  ef.data_limite,
  ef.periodo_preferido,
  COALESCE(ef.observacoes, '') || ' [MIGRADO]',
  ef.prioridade,
  COALESCE(ef.status, 'aguardando'),
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'::uuid,
  ef.created_at,
  ef.updated_at
FROM endogastro_fila_espera ef
LEFT JOIN temp_medico_mapping tmm ON tmm.endogastro_medico_id = ef.medico_id
LEFT JOIN medicos m_fallback ON m_fallback.id = ef.medico_id AND m_fallback.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
WHERE ef.paciente_id IN (SELECT id FROM pacientes)
  AND NOT EXISTS (SELECT 1 FROM fila_espera fe WHERE fe.id = ef.fila_id_original)
  AND COALESCE(tmm.principal_medico_id, m_fallback.id) IS NOT NULL
ON CONFLICT (id) DO NOTHING;