-- Alterar o trigger para permitir agendamentos múltiplos
CREATE OR REPLACE FUNCTION public.validar_agendamento_duplicado_paciente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  agendamentos_conflito INTEGER;
BEGIN
  -- Se for agendamento múltiplo, permitir múltiplos no mesmo horário
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes ILIKE '%Agendamento múltiplo:%' THEN
    RETURN NEW;
  END IF;

  -- Para agendamentos normais, verificar se paciente já tem agendamento no mesmo horário
  SELECT COUNT(*)
  INTO agendamentos_conflito
  FROM public.agendamentos
  WHERE paciente_id = NEW.paciente_id
    AND data_agendamento = NEW.data_agendamento
    AND hora_agendamento = NEW.hora_agendamento
    AND status IN ('agendado', 'confirmado')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    -- Excluir outros agendamentos múltiplos já existentes da validação
    AND (observacoes IS NULL OR observacoes NOT ILIKE '%Agendamento múltiplo:%');
  
  -- Se encontrou conflito, impedir
  IF agendamentos_conflito > 0 THEN
    RAISE EXCEPTION 'Paciente já possui agendamento neste horário';
  END IF;
  
  RETURN NEW;
END;
$function$