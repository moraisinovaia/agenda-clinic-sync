-- Fase 1: Adicionar super_admin ao enum app_role
-- Operação aditiva e idempotente — não quebra nada existente
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
