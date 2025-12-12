-- ===========================================
-- CORREÇÃO DE ISOLAMENTO DE DADOS POR CLÍNICA
-- Remove políticas permissivas e cria políticas corretas
-- ===========================================

-- 1. REMOVER POLÍTICAS PERMISSIVAS (Public access)
-- ================================================

-- Remover política permissiva da tabela medicos
DROP POLICY IF EXISTS "Public access to medicos" ON public.medicos;

-- Remover política permissiva da tabela atendimentos
DROP POLICY IF EXISTS "Public access to atendimentos" ON public.atendimentos;

-- Remover política permissiva da tabela pacientes
DROP POLICY IF EXISTS "Usuários autenticados podem gerenciar pacientes" ON public.pacientes;

-- 2. CRIAR POLÍTICAS RLS CORRETAS PARA MEDICOS
-- =============================================

-- Médicos - visualizar da clínica
CREATE POLICY "Medicos - visualizar da clínica"
ON public.medicos FOR SELECT
USING (cliente_id = get_user_cliente_id());

-- Médicos - criar na clínica
CREATE POLICY "Medicos - criar na clínica"
ON public.medicos FOR INSERT
WITH CHECK (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Médicos - atualizar da clínica
CREATE POLICY "Medicos - atualizar da clínica"
ON public.medicos FOR UPDATE
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);

-- Médicos - deletar da clínica
CREATE POLICY "Medicos - deletar da clínica"
ON public.medicos FOR DELETE
USING (cliente_id = get_user_cliente_id() AND auth.uid() IS NOT NULL);