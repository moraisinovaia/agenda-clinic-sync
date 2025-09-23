-- Fase 2B Final: Remover todas as views restantes
-- Remove as duas últimas views do sistema

-- Remover view vw_agente_medicos
DROP VIEW IF EXISTS public.vw_agente_medicos;

-- Remover view vw_agente_preparos  
DROP VIEW IF EXISTS public.vw_agente_preparos;

-- Registrar operação no log do sistema
INSERT INTO public.system_logs (
  timestamp,
  level,
  message,
  context,
  data
) VALUES (
  now(),
  'info',
  'Fase 2B Final: Remoção completa das views executada - Sistema simplificado para 13 tabelas essenciais',
  'DATABASE_CLEANUP_FINAL',
  jsonb_build_object(
    'views_removed', jsonb_build_array('vw_agente_medicos', 'vw_agente_preparos'),
    'total_views_removed', 2,
    'final_objects_count', 13,
    'architecture_simplification', '100% views removed - Pure table architecture'
  )
);