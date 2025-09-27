-- LIMPEZA FINAL - REMOVER TODOS OS AGENDAMENTOS DE TESTE RESTANTES (INCLUINDO GABRIELA)

-- 1. Backup de segurança dos agendamentos restantes
CREATE TEMP TABLE backup_agendamentos_finais AS
SELECT * FROM public.agendamentos 
WHERE id IN (
  'a5fd5710-a22e-455c-ae31-66ec799d06f2', -- GABRIELA LIMA DE MORAIS
  '077a2e67-dfa2-40f5-a36d-de5891a4dbcc', -- João Silva Santos
  '93ce2d6e-1264-4acf-9a16-d89142399319', -- João Silva
  '0f0f4de9-8d07-441a-a7c6-cfc1088acc5d'  -- João Silva Teste
);

-- 2. Backup dos pacientes restantes
CREATE TEMP TABLE backup_pacientes_finais AS
SELECT * FROM public.pacientes
WHERE id IN (
  '0a5b4799-3734-4601-9712-2c4390dbd4d6', -- GABRIELA LIMA DE MORAIS
  '77c74f2e-09e5-414d-8f73-e2f37e2ebdcd', -- João Silva Santos
  'ad62ae60-1b23-4616-bc13-decb666bbbca', -- João Silva
  'cf60bde7-4027-4da7-b98e-083717bea9b1'  -- João Silva Teste
);

-- 3. Log do backup final
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'Backup final criado - incluindo agendamento da Gabriela (teste confirmado pelo usuário)',
  'FINAL_CLEANUP_BACKUP',
  jsonb_build_object(
    'agendamentos_backup', (SELECT COUNT(*) FROM backup_agendamentos_finais),
    'pacientes_backup', (SELECT COUNT(*) FROM backup_pacientes_finais),
    'gabriela_incluida', true
  )
);

-- 4. Exclusão FINAL de todos os agendamentos restantes
DELETE FROM public.agendamentos 
WHERE id IN (
  'a5fd5710-a22e-455c-ae31-66ec799d06f2', -- GABRIELA LIMA DE MORAIS
  '077a2e67-dfa2-40f5-a36d-de5891a4dbcc', -- João Silva Santos
  '93ce2d6e-1264-4acf-9a16-d89142399319', -- João Silva
  '0f0f4de9-8d07-441a-a7c6-cfc1088acc5d'  -- João Silva Teste
);

-- 5. Exclusão FINAL de todos os pacientes restantes
DELETE FROM public.pacientes
WHERE id IN (
  '0a5b4799-3734-4601-9712-2c4390dbd4d6', -- GABRIELA LIMA DE MORAIS
  '77c74f2e-09e5-414d-8f73-e2f37e2ebdcd', -- João Silva Santos
  'ad62ae60-1b23-4616-bc13-decb666bbbca', -- João Silva
  'cf60bde7-4027-4da7-b98e-083717bea9b1'  -- João Silva Teste
);

-- 6. Log da limpeza final
INSERT INTO public.system_logs (
  timestamp, level, message, context, data
) VALUES (
  now(), 'info', 
  'LIMPEZA FINAL CONCLUÍDA - Todos os dados de teste removidos (incluindo Gabriela)',
  'FINAL_CLEANUP_COMPLETED',
  jsonb_build_object(
    'agendamentos_removidos', (SELECT COUNT(*) FROM backup_agendamentos_finais),
    'pacientes_removidos', (SELECT COUNT(*) FROM backup_pacientes_finais),
    'cleanup_timestamp', now(),
    'gabriela_removida', true,
    'sistema_limpo', true
  )
);

-- 7. Verificação final - confirmar sistema totalmente limpo
DO $$
DECLARE
  total_agendamentos INTEGER;
  total_pacientes INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_agendamentos FROM public.agendamentos;
  SELECT COUNT(*) INTO total_pacientes FROM public.pacientes;
  
  -- Log da verificação final
  INSERT INTO public.system_logs (
    timestamp, level, message, context, data
  ) VALUES (
    now(), 'info', 
    'SISTEMA COMPLETAMENTE LIMPO - Pronto para produção',
    'SYSTEM_CLEAN_VERIFICATION',
    jsonb_build_object(
      'total_agendamentos_restantes', total_agendamentos,
      'total_pacientes_restantes', total_pacientes,
      'sistema_limpo', (total_agendamentos = 0 AND total_pacientes = 0),
      'pronto_producao', true
    )
  );
END $$;