-- FASE 2: MIGRAR PACIENTES HISTÓRICOS
-- Migrar pacientes do endogastro_pacientes para pacientes (com cliente_id correto do ENDOGASTRO)

INSERT INTO pacientes (id, nome_completo, data_nascimento, convenio, telefone, celular, cliente_id, created_at, updated_at)
SELECT 
  ep.paciente_id_original,
  UPPER(TRIM(ep.nome_completo)),
  ep.data_nascimento,
  UPPER(ep.convenio),
  ep.telefone,
  COALESCE(ep.celular, ''),
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'::uuid, -- cliente_id correto do ENDOGASTRO
  ep.created_at,
  ep.updated_at
FROM endogastro_pacientes ep
WHERE NOT EXISTS (
  SELECT 1 FROM pacientes p WHERE p.id = ep.paciente_id_original
)
ON CONFLICT (id) DO NOTHING;