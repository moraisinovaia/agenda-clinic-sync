-- LIMPEZA DE DADOS DE TESTE - WISLANNY
-- Criar backup de segurança antes da exclusão

-- 1. Backup dos agendamentos que serão deletados
CREATE TEMP TABLE backup_agendamentos_teste AS
SELECT * FROM public.agendamentos 
WHERE criado_por_user_id = '0f873d8f-7d7a-4f71-8fd1-5889a2cfd4c4'
   OR paciente_id IN (
     SELECT id FROM public.pacientes 
     WHERE nome_completo IN (
       'João da Silva', 'Maria Santos', 'Pedro Costa', 
       'Ana Oliveira', 'Carlos Ferreira', 'Lucia Pereira'
     )
   );

-- 2. Backup dos pacientes que serão deletados  
CREATE TEMP TABLE backup_pacientes_teste AS
SELECT * FROM public.pacientes
WHERE nome_completo IN (
  'João da Silva', 'Maria Santos', 'Pedro Costa', 
  'Ana Oliveira', 'Carlos Ferreira', 'Lucia Pereira'
);

-- 3. Log do backup criado
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Backup de segurança criado antes da limpeza de dados de teste',
  'TEST_DATA_CLEANUP_BACKUP',
  jsonb_build_object(
    'agendamentos_backup', (SELECT COUNT(*) FROM backup_agendamentos_teste),
    'pacientes_backup', (SELECT COUNT(*) FROM backup_pacientes_teste),
    'user_id_wislanny', '0f873d8f-7d7a-4f71-8fd1-5889a2cfd4c4'
  )
);

-- 4. Exclusão controlada dos agendamentos de teste
DELETE FROM public.agendamentos 
WHERE criado_por_user_id = '0f873d8f-7d7a-4f71-8fd1-5889a2cfd4c4'
   OR paciente_id IN (
     SELECT id FROM public.pacientes 
     WHERE nome_completo IN (
       'João da Silva', 'Maria Santos', 'Pedro Costa', 
       'Ana Oliveira', 'Carlos Ferreira', 'Lucia Pereira'
     )
   );

-- 5. Exclusão controlada dos pacientes de teste
DELETE FROM public.pacientes
WHERE nome_completo IN (
  'João da Silva', 'Maria Santos', 'Pedro Costa', 
  'Ana Oliveira', 'Carlos Ferreira', 'Lucia Pereira'
);

-- 6. Log da limpeza executada
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Limpeza de dados de teste executada com sucesso',
  'TEST_DATA_CLEANUP_COMPLETED',
  jsonb_build_object(
    'agendamentos_removidos', (SELECT COUNT(*) FROM backup_agendamentos_teste),
    'pacientes_removidos', (SELECT COUNT(*) FROM backup_pacientes_teste),
    'user_cleaned', '0f873d8f-7d7a-4f71-8fd1-5889a2cfd4c4',
    'cleanup_timestamp', now()
  )
);

-- 7. Verificação final - confirmar limpeza
DO $$
DECLARE
  remaining_test_appointments INTEGER;
  remaining_test_patients INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_test_appointments
  FROM public.agendamentos 
  WHERE criado_por_user_id = '0f873d8f-7d7a-4f71-8fd1-5889a2cfd4c4';
  
  SELECT COUNT(*) INTO remaining_test_patients
  FROM public.pacientes
  WHERE nome_completo IN (
    'João da Silva', 'Maria Santos', 'Pedro Costa', 
    'Ana Oliveira', 'Carlos Ferreira', 'Lucia Pereira'
  );
  
  -- Log da verificação
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'Verificação pós-limpeza executada',
    'POST_CLEANUP_VERIFICATION',
    jsonb_build_object(
      'remaining_test_appointments', remaining_test_appointments,
      'remaining_test_patients', remaining_test_patients,
      'cleanup_successful', (remaining_test_appointments = 0 AND remaining_test_patients = 0)
    )
  );
END $$;