-- Fase 1.1: Adicionar novo valor ao enum app_role (operação aditiva)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin_clinica';