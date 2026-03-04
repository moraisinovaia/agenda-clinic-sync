-- Atualizar constraint para incluir novos status
ALTER TABLE public.fila_notificacoes DROP CONSTRAINT fila_notificacoes_status_envio_check;
ALTER TABLE public.fila_notificacoes ADD CONSTRAINT fila_notificacoes_status_envio_check 
  CHECK (status_envio::text = ANY (ARRAY['enviado', 'erro', 'pendente', 'pending_n8n', 'expirado']::text[]));

-- Recriar função de cleanup com status correto
CREATE OR REPLACE FUNCTION public.reset_fila_notificados_expirados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reset_count INTEGER;
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
  
  -- Marcar notificações expiradas
  UPDATE public.fila_notificacoes
  SET status_envio = 'expirado'
  WHERE status_envio IN ('pendente', 'enviado', 'pending_n8n')
    AND tempo_limite < now()
    AND resposta_paciente = 'sem_resposta';
  
  RETURN jsonb_build_object('reset_count', reset_count, 'timestamp', now());
END;
$$;