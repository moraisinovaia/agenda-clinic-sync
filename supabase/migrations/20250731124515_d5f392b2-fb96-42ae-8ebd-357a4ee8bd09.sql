-- Remover constraint UNIQUE que impede agendamentos múltiplos
-- Os triggers existentes já fazem a validação correta permitindo agendamentos múltiplos
ALTER TABLE public.agendamentos DROP CONSTRAINT IF EXISTS unique_agendamento_medico_data_hora;