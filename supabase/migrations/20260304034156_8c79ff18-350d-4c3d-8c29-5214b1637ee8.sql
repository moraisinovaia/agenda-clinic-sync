-- 1) Atualizar processar_fila_cancelamento para resetar candidatos "notificado" expirados antes de buscar
CREATE OR REPLACE FUNCTION public.processar_fila_cancelamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  fila_record RECORD;
  reset_count INTEGER;
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    
    -- PASSO 1: Resetar candidatos "notificado" cujo tempo_limite já expirou
    WITH expired_notifications AS (
      SELECT DISTINCT fe.id as fila_id
      FROM public.fila_espera fe
      JOIN public.fila_notificacoes fn ON fn.fila_id = fe.id
      WHERE fe.medico_id = NEW.medico_id
        AND fe.cliente_id = NEW.cliente_id
        AND fe.status = 'notificado'
        AND fn.tempo_limite < now()
        AND fn.resposta_paciente = 'sem_resposta'
    )
    UPDATE public.fila_espera 
    SET status = 'aguardando'
    WHERE id IN (SELECT fila_id FROM expired_notifications);
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    IF reset_count > 0 THEN
      RAISE LOG '[FILA] Resetados % candidatos notificado->aguardando (expirados)', reset_count;
    END IF;
    
    -- PASSO 2: Buscar candidato aguardando (agora incluindo os recém-resetados)
    SELECT fe.*, p.nome_completo, p.celular, m.nome as medico_nome, a.nome as atendimento_nome
    INTO fila_record
    FROM public.fila_espera fe
    JOIN public.pacientes p ON fe.paciente_id = p.id
    JOIN public.medicos m ON fe.medico_id = m.id
    JOIN public.atendimentos a ON fe.atendimento_id = a.id
    WHERE fe.medico_id = NEW.medico_id
      AND fe.atendimento_id = NEW.atendimento_id
      AND fe.cliente_id = NEW.cliente_id
      AND fe.data_preferida <= NEW.data_agendamento
      AND fe.status = 'aguardando'
      AND (fe.data_limite IS NULL OR fe.data_limite >= NEW.data_agendamento)
    ORDER BY fe.prioridade DESC, fe.created_at ASC
    LIMIT 1;
    
    IF FOUND THEN
      INSERT INTO public.fila_notificacoes (
        fila_id, cliente_id, horario_disponivel,
        data_agendamento, hora_agendamento, tempo_limite
      ) VALUES (
        fila_record.id, NEW.cliente_id, now(),
        NEW.data_agendamento, NEW.hora_agendamento,
        now() + interval '2 hours'
      );
      
      UPDATE public.fila_espera 
      SET status = 'notificado', 
          ultimo_contato = now(),
          tentativas_contato = tentativas_contato + 1
      WHERE id = fila_record.id;
      
      RAISE LOG '[FILA] Candidato % notificado para vaga do agendamento %', fila_record.id, NEW.id;
    ELSE
      RAISE LOG '[FILA] Nenhum candidato encontrado para agendamento % (medico=%, atendimento=%, cliente=%)', 
        NEW.id, NEW.medico_id, NEW.atendimento_id, NEW.cliente_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2) Criar função para cleanup periódico de notificados expirados
CREATE OR REPLACE FUNCTION public.reset_fila_notificados_expirados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reset_count INTEGER;
  result jsonb;
BEGIN
  WITH expired AS (
    SELECT DISTINCT fe.id as fila_id
    FROM public.fila_espera fe
    JOIN public.fila_notificacoes fn ON fn.fila_id = fe.id
    WHERE fe.status = 'notificado'
      AND fn.tempo_limite < now()
      AND fn.resposta_paciente = 'sem_resposta'
  )
  UPDATE public.fila_espera 
  SET status = 'aguardando'
  WHERE id IN (SELECT fila_id FROM expired);
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  
  UPDATE public.fila_notificacoes
  SET status_envio = 'expirado'
  WHERE status_envio IN ('pendente', 'enviado', 'pending_n8n')
    AND tempo_limite < now()
    AND resposta_paciente = 'sem_resposta';
  
  result := jsonb_build_object(
    'reset_count', reset_count,
    'timestamp', now()
  );
  
  RETURN result;
END;
$$;