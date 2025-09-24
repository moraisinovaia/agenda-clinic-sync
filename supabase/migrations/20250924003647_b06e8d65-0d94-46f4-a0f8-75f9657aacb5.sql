-- Corrigir duplicação atual da Dra. Adriana Carla de Sena
-- IDs identificados na análise atual:
-- Primeiro registro (manter): 32d30887-b876-4502-bf04-e55d7fb55b50
-- Segundo registro (remover): e49a7d0e-0a89-4e07-8456-acad4f12f864

-- Etapa 1: Transferir todos os agendamentos do segundo médico para o primeiro
UPDATE public.agendamentos 
SET medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'::uuid
WHERE medico_id = 'e49a7d0e-0a89-4e07-8456-acad4f12f864'::uuid;

-- Etapa 2: Transferir fila de espera se houver
UPDATE public.fila_espera 
SET medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'::uuid
WHERE medico_id = 'e49a7d0e-0a89-4e07-8456-acad4f12f864'::uuid;

-- Etapa 3: Transferir bloqueios de agenda se houver
UPDATE public.bloqueios_agenda 
SET medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50'::uuid
WHERE medico_id = 'e49a7d0e-0a89-4e07-8456-acad4f12f864'::uuid;

-- Etapa 4: Remover TODOS os atendimentos duplicados do segundo médico
DELETE FROM public.atendimentos 
WHERE medico_id = 'e49a7d0e-0a89-4e07-8456-acad4f12f864'::uuid;

-- Etapa 5: Remover o segundo médico duplicado
DELETE FROM public.medicos 
WHERE id = 'e49a7d0e-0a89-4e07-8456-acad4f12f864'::uuid;

-- Etapa 6: Criar índice único para prevenir duplicação futura
-- (Nome + Especialidade + Cliente devem ser únicos quando ativo = true)
CREATE UNIQUE INDEX IF NOT EXISTS idx_medicos_unique_active_name_specialty 
ON public.medicos (LOWER(nome), LOWER(especialidade), cliente_id) 
WHERE ativo = true;

-- Etapa 7: Log da operação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Corrigida duplicação atual da Dra. Adriana Carla de Sena',
  'DOCTOR_DUPLICATE_FIX_CURRENT',
  jsonb_build_object(
    'doctor_name', 'Dra. Adriana Carla de Sena',
    'kept_id', '32d30887-b876-4502-bf04-e55d7fb55b50',
    'removed_id', 'e49a7d0e-0a89-4e07-8456-acad4f12f864',
    'action', 'consolidated_and_removed_current_duplicate',
    'unique_constraint_added', true
  )
);