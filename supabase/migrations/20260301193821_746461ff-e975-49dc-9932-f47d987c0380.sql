CREATE OR REPLACE FUNCTION public.processar_fila_cancelamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fila_record RECORD;
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status != 'cancelado' THEN
    
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
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;