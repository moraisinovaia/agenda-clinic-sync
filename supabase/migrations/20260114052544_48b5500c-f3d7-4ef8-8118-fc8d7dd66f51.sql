-- =============================================
-- CORREÇÃO DE FUNCTION SEARCH PATH
-- Adicionar search_path às funções customizadas
-- =============================================

-- 1. get_clinic_recent_activity - sem argumentos
ALTER FUNCTION public.get_clinic_recent_activity() 
SET search_path = public;

-- 2. update_confirmacoes_updated_at - trigger function
ALTER FUNCTION public.update_confirmacoes_updated_at() 
SET search_path = public;

-- 3. classify_period - com argumento time
ALTER FUNCTION public.classify_period(time without time zone) 
SET search_path = public;

-- 4. day_name_to_number - com argumento text
ALTER FUNCTION public.day_name_to_number(text) 
SET search_path = public;