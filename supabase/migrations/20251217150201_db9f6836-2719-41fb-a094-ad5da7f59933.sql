-- FASE 2: POPULAR MAPEAMENTOS E PREPARAR MIGRAÇÃO

-- Popular mapeamento de médicos
INSERT INTO temp_medico_mapping (endogastro_medico_id, endogastro_nome, principal_medico_id, principal_nome, mapped)
SELECT 
  em.id,
  em.nome,
  m.id,
  m.nome,
  m.id IS NOT NULL
FROM endogastro_medicos em
LEFT JOIN medicos m ON LOWER(TRIM(m.nome)) = LOWER(TRIM(em.nome)) 
  AND m.cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- Criar atendimento genérico para agendamentos sem mapeamento
INSERT INTO atendimentos (nome, tipo, cliente_id, observacoes, ativo)
VALUES ('Serviço Histórico (Migrado)', 'historico', '39e120b4-5fb7-4d6f-9f91-a598a5bbd253', 'Atendimentos migrados do sistema anterior sem tipo específico', true)
ON CONFLICT DO NOTHING;