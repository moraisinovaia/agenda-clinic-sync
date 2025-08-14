-- 1. Primeiro vamos criar o trigger para enviar confirmação WhatsApp automaticamente
DROP TRIGGER IF EXISTS trigger_enviar_confirmacao_whatsapp ON public.agendamentos;

CREATE TRIGGER trigger_enviar_confirmacao_whatsapp
  AFTER INSERT ON public.agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.enviar_confirmacao_whatsapp();

-- 2. Atualizar a função para incluir dados do atendimento (necessário para buscar preparos)
CREATE OR REPLACE FUNCTION public.enviar_confirmacao_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_paciente_record RECORD;
    v_medico_record RECORD;
    v_atendimento_record RECORD;
    v_celular TEXT;
    v_request_id UUID;
BEGIN
    -- Só processa se é um INSERT de agendamento com status 'agendado'
    IF TG_OP = 'INSERT' AND NEW.status = 'agendado' THEN
        
        -- Buscar dados do paciente
        SELECT nome_completo, celular INTO v_paciente_record
        FROM public.pacientes 
        WHERE id = NEW.paciente_id;
        
        -- Buscar dados do médico
        SELECT nome, especialidade INTO v_medico_record
        FROM public.medicos 
        WHERE id = NEW.medico_id;
        
        -- Buscar dados do atendimento
        SELECT nome, tipo INTO v_atendimento_record
        FROM public.atendimentos 
        WHERE id = NEW.atendimento_id;
        
        -- Validar se tem celular
        v_celular := TRIM(v_paciente_record.celular);
        
        IF v_celular IS NOT NULL AND v_celular != '' AND LENGTH(v_celular) >= 10 THEN
            -- Fazer chamada HTTP para edge function (incluindo atendimento_id para buscar preparos)
            SELECT net.http_post(
                url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/whatsapp-confirmacao',
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.06peJhh69PHQO_yd8jl8ipINVElZo6VsPllPFx_IjzU"}'::jsonb,
                body := json_build_object(
                    'agendamento_id', NEW.id,
                    'paciente_nome', v_paciente_record.nome_completo,
                    'paciente_celular', v_celular,
                    'medico_nome', v_medico_record.nome,
                    'atendimento_nome', v_atendimento_record.nome,
                    'atendimento_id', NEW.atendimento_id,
                    'data_agendamento', NEW.data_agendamento,
                    'hora_agendamento', NEW.hora_agendamento,
                    'observacoes', NEW.observacoes
                )::jsonb
            ) INTO v_request_id;
            
            -- Log da tentativa
            INSERT INTO public.system_logs (
                timestamp, level, message, context, data
            ) VALUES (
                now(), 'info', 
                'Solicitação de confirmação WhatsApp enviada com preparos', 
                'AUTO_CONFIRMATION_WITH_PREP',
                json_build_object(
                    'agendamento_id', NEW.id,
                    'paciente', v_paciente_record.nome_completo,
                    'celular', v_celular,
                    'atendimento', v_atendimento_record.nome,
                    'request_id', v_request_id
                )::jsonb
            );
            
        ELSE
            -- Log de celular inválido
            INSERT INTO public.system_logs (
                timestamp, level, message, context, data
            ) VALUES (
                now(), 'warning', 
                'Agendamento criado mas celular inválido para WhatsApp', 
                'AUTO_CONFIRMATION',
                json_build_object(
                    'agendamento_id', NEW.id,
                    'paciente', v_paciente_record.nome_completo,
                    'celular', v_celular
                )::jsonb
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;