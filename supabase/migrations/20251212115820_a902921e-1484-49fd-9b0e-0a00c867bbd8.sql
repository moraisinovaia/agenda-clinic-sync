-- ===========================================
-- POLÍTICAS RLS PARA VISUALIZAÇÃO DE PROFILES POR ADMINS
-- Permite admins globais verem todos e admins de clínica verem da sua clínica
-- ===========================================

-- 1. REMOVER POLÍTICAS ANTIGAS QUE PODEM CONFLITAR
-- ================================================
DROP POLICY IF EXISTS "Admins globais podem ver todos os profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins clinica podem ver profiles da sua clinica" ON public.profiles;
DROP POLICY IF EXISTS "Admin global pode ver todos profiles" ON public.profiles;

-- 2. CRIAR POLÍTICA PARA ADMINS GLOBAIS
-- =====================================
-- Admins globais podem ver TODOS os profiles (pendentes, aprovados, rejeitados) de TODAS as clínicas
CREATE POLICY "Admins globais podem ver todos os profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- 3. CRIAR POLÍTICA PARA ADMINS DE CLÍNICA
-- ========================================
-- Admins de clínica podem ver profiles da sua clínica (todos os status)
CREATE POLICY "Admins clinica podem ver profiles da sua clinica"
ON public.profiles FOR SELECT
USING (
  has_role(auth.uid(), 'admin_clinica') 
  AND cliente_id = get_user_cliente_id()
);