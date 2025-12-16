-- Corrigir status da clínica IPADO para ativo
UPDATE public.clientes 
SET ativo = true, updated_at = now()
WHERE nome = 'IPADO';