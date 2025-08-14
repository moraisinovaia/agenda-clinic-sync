-- Corrigir a função de fallback
CREATE OR REPLACE FUNCTION public.enviar_whatsapp_fallback(
    p_agendamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_agendamento RECORD;
    v_result jsonb;
BEGIN
    -- Buscar dados completos do agendamento
    SELECT a.*, p.nome_completo, p.celular, m.nome as medico_nome, at.nome as atendimento_nome
    INTO v_agendamento
    FROM public.agendamentos a
    JOIN public.pacientes p ON a.paciente_id = p.id
    JOIN public.medicos m ON a.medico_id = m.id
    JOIN public.atendimentos at ON a.atendimento_id = at.id
    WHERE a.id = p_agendamento_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Agendamento não encontrado'
        );
    END IF;
    
    -- Validar celular
    IF v_agendamento.celular IS NULL OR TRIM(v_agendamento.celular) = '' OR LENGTH(TRIM(v_agendamento.celular)) < 10 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Celular inválido ou não informado'
        );
    END IF;
    
    -- Log de tentativa
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Tentativa de envio WhatsApp via fallback', 
        'WHATSAPP_FALLBACK',
        jsonb_build_object(
            'agendamento_id', p_agendamento_id,
            'paciente', v_agendamento.nome_completo,
            'celular', v_agendamento.celular
        )
    );
    
    -- Usar a extensão net (que está disponível) para chamar a edge function
    SELECT net.http_post(
        url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/whatsapp-confirmacao',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.06peJhh69PHQO_yd8jl8ipINVElZo6VsPllPFx_IjzU'
        ),
        body := jsonb_build_object(
            'agendamento_id', v_agendamento.id,
            'paciente_nome', v_agendamento.nome_completo,
            'paciente_celular', TRIM(v_agendamento.celular),
            'medico_nome', v_agendamento.medico_nome,
            'atendimento_nome', v_agendamento.atendimento_nome,
            'atendimento_id', v_agendamento.atendimento_id,
            'data_agendamento', v_agendamento.data_agendamento,
            'hora_agendamento', v_agendamento.hora_agendamento,
            'observacoes', COALESCE(v_agendamento.observacoes, '')
        )
    ) INTO v_result;
    
    -- Log do resultado
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 
        CASE WHEN v_result->>'status_code' = '200' THEN 'info' ELSE 'error' END,
        'Resultado do envio WhatsApp via fallback', 
        'WHATSAPP_FALLBACK_RESULT',
        jsonb_build_object(
            'agendamento_id', p_agendamento_id,
            'result', v_result
        )
    );
    
    RETURN jsonb_build_object(
        'success', CASE WHEN v_result->>'status_code' = '200' THEN true ELSE false END,
        'status_code', v_result->>'status_code',
        'response', v_result,
        'message', CASE 
            WHEN v_result->>'status_code' = '200' THEN 'WhatsApp enviado com sucesso via fallback'
            ELSE 'Erro no envio via fallback: ' || COALESCE(v_result->>'error', 'Erro desconhecido')
        END
    );
END;
$function$;