-- Atualiza o limite diário de agendamentos por médico de 20 para 40
CREATE OR REPLACE FUNCTION public.validar_limite_agendamentos_medico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  limite_diario INTEGER := 40; -- Máximo 40 pacientes por médico por dia
  total_agendamentos INTEGER;
BEGIN
  -- Contar agendamentos do médico na data
  SELECT COUNT(*)
  INTO total_agendamentos
  FROM public.agendamentos
  WHERE medico_id = NEW.medico_id
    AND data_agendamento = NEW.data_agendamento
    AND status IN ('agendado', 'confirmado');
  
  -- Verificar se excede o limite
  IF total_agendamentos >= limite_diario THEN
    RAISE EXCEPTION 'Limite de % agendamentos por dia excedido para este médico', limite_diario;
  END IF;
  
  RETURN NEW;
END;
$$;