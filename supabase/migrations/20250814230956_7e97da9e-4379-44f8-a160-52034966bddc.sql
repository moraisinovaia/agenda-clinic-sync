-- Verificar e corrigir a extensão pg_net
-- Primeiro vamos verificar se a extensão está corretamente instalada

-- Verificar se pg_net está instalada
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Verificar a fila de requisições HTTP
SELECT * FROM net.http_request_queue;

-- Função para testar WhatsApp usando client Supabase diretamente (alternativa)
CREATE OR REPLACE FUNCTION public.enviar_whatsapp_via_invoke(
    p_agendamento_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_agendamento RECORD;
    v_response jsonb;
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
    
    -- Log da tentativa
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Tentativa de envio WhatsApp via invoke (client)', 
        'WHATSAPP_INVOKE',
        jsonb_build_object(
            'agendamento_id', p_agendamento_id,
            'paciente', v_agendamento.nome_completo,
            'celular', v_agendamento.celular,
            'method', 'supabase_client_invoke'
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'agendamento_id', p_agendamento_id,
        'paciente', v_agendamento.nome_completo,
        'celular', v_agendamento.celular,
        'medico', v_agendamento.medico_nome,
        'atendimento', v_agendamento.atendimento_nome,
        'data', v_agendamento.data_agendamento,
        'hora', v_agendamento.hora_agendamento,
        'message', 'Dados preparados para envio via client - use supabase.functions.invoke no frontend'
    );
END;
$function$;