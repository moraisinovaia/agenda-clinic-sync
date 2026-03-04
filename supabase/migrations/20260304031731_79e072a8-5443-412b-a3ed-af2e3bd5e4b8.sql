CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notificar_fila_webhook()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  payload jsonb;
  paciente_record RECORD;
BEGIN
  SELECT p.nome_completo as paciente_nome, p.celular as paciente_celular,
         m.nome as medico_nome, a.nome as atendimento_nome, fe.cliente_id
  INTO paciente_record
  FROM fila_espera fe
  JOIN pacientes p ON fe.paciente_id = p.id
  JOIN medicos m ON fe.medico_id = m.id
  JOIN atendimentos a ON fe.atendimento_id = a.id
  WHERE fe.id = NEW.fila_id;

  payload := jsonb_build_object(
    'notif_id', NEW.id,
    'fila_id', NEW.fila_id,
    'cliente_id', paciente_record.cliente_id,
    'paciente_nome', paciente_record.paciente_nome,
    'paciente_celular', paciente_record.paciente_celular,
    'medico_nome', paciente_record.medico_nome,
    'atendimento_nome', paciente_record.atendimento_nome,
    'data_agendamento', NEW.data_agendamento,
    'hora_agendamento', NEW.hora_agendamento,
    'tempo_limite', NEW.tempo_limite
  );

  PERFORM net.http_post(
    url := 'https://n8n-medical.inovaia-automacao.com.br/webhook/fila-espera-notificar',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notificar_fila_webhook ON public.fila_notificacoes;

CREATE TRIGGER trigger_notificar_fila_webhook
AFTER INSERT ON public.fila_notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.notificar_fila_webhook();