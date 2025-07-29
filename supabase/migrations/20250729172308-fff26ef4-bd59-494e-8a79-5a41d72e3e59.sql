-- Função para validar agendamentos duplicados para o mesmo médico no mesmo horário
CREATE OR REPLACE FUNCTION public.validar_agendamento_duplicado_medico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  agendamentos_conflito INTEGER;
BEGIN
  -- Verificar se médico já tem agendamento no mesmo horário exato
  SELECT COUNT(*)
  INTO agendamentos_conflito
  FROM public.agendamentos
  WHERE medico_id = NEW.medico_id
    AND data_agendamento = NEW.data_agendamento
    AND hora_agendamento = NEW.hora_agendamento
    AND status IN ('agendado', 'confirmado')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Se encontrou conflito, impedir
  IF agendamentos_conflito > 0 THEN
    RAISE EXCEPTION 'Este horário já está ocupado para o médico selecionado';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para validar agendamento duplicado do médico
CREATE TRIGGER trigger_validar_agendamento_duplicado_medico
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_agendamento_duplicado_medico();