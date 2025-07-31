-- Corrigir o trigger validar_agendamento_duplicado_medico para permitir agendamentos múltiplos
CREATE OR REPLACE FUNCTION public.validar_agendamento_duplicado_medico()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  agendamentos_conflito INTEGER;
  agendamentos_multiplos_existentes INTEGER;
BEGIN
  -- Se for agendamento múltiplo, permitir múltiplos no mesmo horário
  IF NEW.observacoes IS NOT NULL AND NEW.observacoes ILIKE '%Agendamento múltiplo:%' THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existem agendamentos múltiplos no mesmo horário
  SELECT COUNT(*)
  INTO agendamentos_multiplos_existentes
  FROM public.agendamentos
  WHERE medico_id = NEW.medico_id
    AND data_agendamento = NEW.data_agendamento
    AND hora_agendamento = NEW.hora_agendamento
    AND status IN ('agendado', 'confirmado')
    AND observacoes IS NOT NULL 
    AND observacoes ILIKE '%Agendamento múltiplo:%';

  -- Se existem agendamentos múltiplos, permitir novos agendamentos múltiplos
  IF agendamentos_multiplos_existentes > 0 THEN
    RETURN NEW;
  END IF;

  -- Para agendamentos normais, verificar se médico já tem agendamento no mesmo horário exato
  SELECT COUNT(*)
  INTO agendamentos_conflito
  FROM public.agendamentos
  WHERE medico_id = NEW.medico_id
    AND data_agendamento = NEW.data_agendamento
    AND hora_agendamento = NEW.hora_agendamento
    AND status IN ('agendado', 'confirmado')
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    -- Excluir agendamentos múltiplos da validação
    AND (observacoes IS NULL OR observacoes NOT ILIKE '%Agendamento múltiplo:%');
  
  -- Se encontrou conflito, impedir
  IF agendamentos_conflito > 0 THEN
    RAISE EXCEPTION 'Este horário já está ocupado para o médico selecionado';
  END IF;
  
  RETURN NEW;
END;
$function$;