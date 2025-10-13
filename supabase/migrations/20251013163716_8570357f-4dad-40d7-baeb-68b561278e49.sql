-- Remove a função antiga sem parâmetros para eliminar ambiguidade
DROP FUNCTION IF EXISTS public.buscar_agendamentos_otimizado();

-- A função com parâmetros opcionais já existe e continuará funcionando
-- Esta migration apenas garante que não há duplicatas