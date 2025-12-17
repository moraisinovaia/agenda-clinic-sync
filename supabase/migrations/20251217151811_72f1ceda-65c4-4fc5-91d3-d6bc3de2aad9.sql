-- Remover pacientes migrados incorretamente
DELETE FROM pacientes WHERE cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- Migrar pacientes com ID correto (id da tabela endogastro_pacientes)
INSERT INTO pacientes (id, nome_completo, data_nascimento, convenio, telefone, celular, cliente_id, created_at, updated_at)
SELECT 
  ep.id, -- Usar o id correto
  UPPER(TRIM(ep.nome_completo)),
  ep.data_nascimento,
  UPPER(ep.convenio),
  ep.telefone,
  COALESCE(ep.celular, ''),
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'::uuid,
  ep.created_at,
  ep.updated_at
FROM endogastro_pacientes ep
WHERE NOT EXISTS (
  SELECT 1 FROM pacientes p WHERE p.id = ep.id
)
ON CONFLICT (id) DO NOTHING;