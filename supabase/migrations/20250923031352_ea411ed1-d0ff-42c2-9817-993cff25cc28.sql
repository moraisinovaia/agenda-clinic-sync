-- Fase 2C: Remover tabelas não utilizadas
-- Remove client_configurations e valores_procedimentos

-- Remover tabela client_configurations (apenas 3 registros não utilizados)
DROP TABLE IF EXISTS public.client_configurations CASCADE;

-- Remover tabela valores_procedimentos (49 registros não integrados ao sistema)
DROP TABLE IF EXISTS public.valores_procedimentos CASCADE;

-- Registrar operação final no log do sistema
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context,
  data
) VALUES (
  now(),
  'info',
  'Fase 2C: Limpeza final executada - Sistema reduzido para 11 tabelas essenciais',
  'DATABASE_CLEANUP_COMPLETE',
  jsonb_build_object(
    'tables_removed', jsonb_build_array('client_configurations', 'valores_procedimentos'),
    'total_tables_removed', 2,
    'final_tables_count', 11,
    'architecture_status', 'Ultra-simplificado - apenas tabelas essenciais',
    'cleanup_phases_completed', jsonb_build_array('1A', '1B', '2A', '2B', '2C'),
    'total_reduction_percentage', '54%'
  )
);