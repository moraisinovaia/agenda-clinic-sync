-- Remover índice único que impede agendamentos múltiplos para o mesmo paciente
-- Os triggers existentes já fazem a validação correta permitindo agendamentos múltiplos
DROP INDEX IF EXISTS public.idx_agendamento_paciente_data_hora;