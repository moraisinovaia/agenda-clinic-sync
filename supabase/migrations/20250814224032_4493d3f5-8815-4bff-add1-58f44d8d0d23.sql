-- Corrigir a função enviar_confirmacao_whatsapp para remover o log problemático
CREATE OR REPLACE FUNCTION public.enviar_confirmacao_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_paciente_record RECORD;
    v_medico_record RECORD;
    v_atendimento_record RECORD;
    v_celular TEXT;
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
            -- Fazer chamada HTTP para edge function (simplificada para evitar problemas)
            PERFORM net.http_post(
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
            );
            
            -- Log simples de sucesso
            INSERT INTO public.system_logs (
                timestamp, level, message, context
            ) VALUES (
                now(), 'info', 
                'Confirmação WhatsApp enviada para: ' || v_paciente_record.nome_completo, 
                'AUTO_CONFIRMATION_WITH_PREP'
            );
            
        ELSE
            -- Log de celular inválido
            INSERT INTO public.system_logs (
                timestamp, level, message, context
            ) VALUES (
                now(), 'warning', 
                'Agendamento criado mas celular inválido: ' || COALESCE(v_celular, 'NULL'), 
                'AUTO_CONFIRMATION'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;