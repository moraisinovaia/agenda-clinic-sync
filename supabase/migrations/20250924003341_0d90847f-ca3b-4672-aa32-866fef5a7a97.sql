-- Corrigir duplicação da Dra. Adriana - Abordagem mais segura
-- IDs identificados:
-- Primeiro registro (manter): 03c9bc04-e6cd-4f20-929d-03c3b0dac9fb
-- Segundo registro (remover): 5eea03a0-1b3b-40c2-9a7a-48ae8c05c809

-- Etapa 1: Mover todos os agendamentos do segundo médico para o primeiro
UPDATE public.agendamentos 
SET medico_id = '03c9bc04-e6cd-4f20-929d-03c3b0dac9fb'::uuid
WHERE medico_id = '5eea03a0-1b3b-40c2-9a7a-48ae8c05c809'::uuid;

-- Etapa 2: Mover fila de espera se houver
UPDATE public.fila_espera 
SET medico_id = '03c9bc04-e6cd-4f20-929d-03c3b0dac9fb'::uuid
WHERE medico_id = '5eea03a0-1b3b-40c2-9a7a-48ae8c05c809'::uuid;

-- Etapa 3: Mover bloqueios de agenda se houver
UPDATE public.bloqueios_agenda 
SET medico_id = '03c9bc04-e6cd-4f20-929d-03c3b0dac9fb'::uuid
WHERE medico_id = '5eea03a0-1b3b-40c2-9a7a-48ae8c05c809'::uuid;

-- Etapa 4: Remover TODOS os atendimentos do segundo médico (que são duplicados)
DELETE FROM public.atendimentos 
WHERE medico_id = '5eea03a0-1b3b-40c2-9a7a-48ae8c05c809'::uuid;

-- Etapa 5: Remover o segundo médico duplicado
DELETE FROM public.medicos 
WHERE id = '5eea03a0-1b3b-40c2-9a7a-48ae8c05c809'::uuid;

-- Etapa 6: Log da operação
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Removida duplicação da Dra. Adriana Carla de Sena',
  'DOCTOR_DUPLICATE_REMOVED',
  jsonb_build_object(
    'doctor_name', 'Dra. Adriana Carla de Sena',
    'kept_id', '03c9bc04-e6cd-4f20-929d-03c3b0dac9fb',
    'removed_id', '5eea03a0-1b3b-40c2-9a7a-48ae8c05c809',
    'action', 'removed_duplicate_doctor_and_services'
  )
);