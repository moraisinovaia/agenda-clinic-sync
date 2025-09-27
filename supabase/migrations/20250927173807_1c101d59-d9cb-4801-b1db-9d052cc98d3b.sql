-- Remove a constraint existente que não inclui 'excluido'
ALTER TABLE public.agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check;

-- Adicionar nova constraint que inclui 'excluido' como status válido
ALTER TABLE public.agendamentos ADD CONSTRAINT agendamentos_status_check 
CHECK (status IN ('agendado', 'confirmado', 'realizado', 'cancelado', 'cancelado_bloqueio', 'falta', 'excluido'));