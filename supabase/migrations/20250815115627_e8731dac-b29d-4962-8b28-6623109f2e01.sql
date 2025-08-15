-- Limpar agendamentos de teste anteriores
DELETE FROM public.agendamentos 
WHERE observacoes ILIKE '%teste%' 
   OR observacoes ILIKE '%test%'
   OR criado_por ILIKE '%teste%'
   OR criado_por ILIKE '%test%';

-- Limpar pacientes de teste que não têm mais agendamentos
DELETE FROM public.pacientes 
WHERE nome_completo ILIKE '%teste%' 
   OR nome_completo ILIKE '%test%'
   AND NOT EXISTS (
     SELECT 1 FROM public.agendamentos 
     WHERE paciente_id = pacientes.id
   );

-- Log da limpeza
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context
) VALUES (
  now(),
  'info',
  'Limpeza de agendamentos de teste executada',
  'CLEANUP_TEST_DATA'
);