-- =====================================================
-- PLANO COMPLETO PARA CORRIGIR WHATSAPP CONFIRMAÇÃO
-- =====================================================

-- 1. CRIAR FUNÇÃO DE TESTE PARA EDGE FUNCTION
CREATE OR REPLACE FUNCTION public.test_whatsapp_edge_function(
    p_celular TEXT,
    p_nome TEXT DEFAULT 'Teste',
    p_medico TEXT DEFAULT 'Dr. Teste',
    p_atendimento TEXT DEFAULT 'Consulta Teste',
    p_data DATE DEFAULT CURRENT_DATE + INTERVAL '1 day',
    p_hora TIME DEFAULT '14:00'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_response jsonb;
    v_test_id uuid;
BEGIN
    v_test_id := gen_random_uuid();
    
    -- Log do início do teste
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Iniciando teste da Edge Function WhatsApp', 
        'WHATSAPP_TEST',
        jsonb_build_object(
            'test_id', v_test_id,
            'celular', p_celular,
            'nome', p_nome
        )
    );
    
    -- Fazer chamada para edge function com dados de teste
    SELECT net.http_post(
        url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/whatsapp-confirmacao',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.06peJhh69PHQO_yd8jl8ipINVElZo6VsPllPFx_IjzU'
        ),
        body := jsonb_build_object(
            'agendamento_id', v_test_id,
            'paciente_nome', p_nome,
            'paciente_celular', p_celular,
            'medico_nome', p_medico,
            'atendimento_nome', p_atendimento,
            'atendimento_id', v_test_id,
            'data_agendamento', p_data,
            'hora_agendamento', p_hora,
            'observacoes', 'TESTE MANUAL DA FUNÇÃO WHATSAPP'
        )
    ) INTO v_response;
    
    -- Log do resultado
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 
        CASE WHEN v_response->>'status_code' = '200' THEN 'info' ELSE 'error' END,
        'Resultado do teste Edge Function WhatsApp', 
        'WHATSAPP_TEST_RESULT',
        jsonb_build_object(
            'test_id', v_test_id,
            'response', v_response,
            'celular', p_celular
        )
    );
    
    RETURN jsonb_build_object(
        'test_id', v_test_id,
        'success', CASE WHEN v_response->>'status_code' = '200' THEN true ELSE false END,
        'response', v_response,
        'message', 'Teste executado - verifique os logs para mais detalhes'
    );
END;
$function$;

-- 2. CRIAR FUNÇÃO DE FALLBACK USANDO RPC
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
    v_paciente RECORD;
    v_medico RECORD;
    v_atendimento RECORD;
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
    
    -- Usar a função invoke do Supabase para chamar a edge function
    SELECT extensions.http_post(
        'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/whatsapp-confirmacao',
        jsonb_build_object(
            'agendamento_id', v_agendamento.id,
            'paciente_nome', v_agendamento.nome_completo,
            'paciente_celular', TRIM(v_agendamento.celular),
            'medico_nome', v_agendamento.medico_nome,
            'atendimento_nome', v_agendamento.atendimento_nome,
            'atendimento_id', v_agendamento.atendimento_id,
            'data_agendamento', v_agendamento.data_agendamento,
            'hora_agendamento', v_agendamento.hora_agendamento,
            'observacoes', COALESCE(v_agendamento.observacoes, '')
        ),
        jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.06peJhh69PHQO_yd8jl8ipINVElZo6VsPllPFx_IjzU'
        )
    ) INTO v_result;
    
    -- Log do resultado
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 
        CASE WHEN v_result->>'status' = '200' THEN 'info' ELSE 'error' END,
        'Resultado do envio WhatsApp via fallback', 
        'WHATSAPP_FALLBACK_RESULT',
        jsonb_build_object(
            'agendamento_id', p_agendamento_id,
            'result', v_result
        )
    );
    
    RETURN v_result;
END;
$function$;

-- 3. CORRIGIR E MELHORAR A FUNÇÃO TRIGGER PRINCIPAL
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
    v_http_response jsonb;
    v_trigger_id uuid := gen_random_uuid();
BEGIN
    -- Só processa se é um INSERT de agendamento com status 'agendado'
    IF TG_OP = 'INSERT' AND NEW.status = 'agendado' THEN
        
        -- Log de início do trigger
        INSERT INTO public.system_logs (
            timestamp, level, message, context, data
        ) VALUES (
            now(), 'info', 
            'Trigger WhatsApp iniciado', 
            'WHATSAPP_TRIGGER_START',
            jsonb_build_object(
                'trigger_id', v_trigger_id,
                'agendamento_id', NEW.id,
                'paciente_id', NEW.paciente_id
            )
        );
        
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
            
            -- Log de tentativa de envio
            INSERT INTO public.system_logs (
                timestamp, level, message, context, data
            ) VALUES (
                now(), 'info', 
                'Tentando enviar WhatsApp via HTTP', 
                'WHATSAPP_HTTP_ATTEMPT',
                jsonb_build_object(
                    'trigger_id', v_trigger_id,
                    'agendamento_id', NEW.id,
                    'celular', v_celular,
                    'paciente', v_paciente_record.nome_completo
                )
            );
            
            -- Fazer chamada HTTP para edge function
            BEGIN
                SELECT net.http_post(
                    url := 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/whatsapp-confirmacao',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bHZ6YnZ6YWppYmR0bHpuZ2R5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDUwODkzMywiZXhwIjoyMDY2MDg0OTMzfQ.06peJhh69PHQO_yd8jl8ipINVElZo6VsPllPFx_IjzU'
                    ),
                    body := jsonb_build_object(
                        'agendamento_id', NEW.id,
                        'paciente_nome', v_paciente_record.nome_completo,
                        'paciente_celular', v_celular,
                        'medico_nome', v_medico_record.nome,
                        'atendimento_nome', v_atendimento_record.nome,
                        'atendimento_id', NEW.atendimento_id,
                        'data_agendamento', NEW.data_agendamento,
                        'hora_agendamento', NEW.hora_agendamento,
                        'observacoes', NEW.observacoes
                    )
                ) INTO v_http_response;
                
                -- Log de sucesso HTTP
                INSERT INTO public.system_logs (
                    timestamp, level, message, context, data
                ) VALUES (
                    now(), 'info', 
                    'Chamada HTTP para WhatsApp concluída', 
                    'WHATSAPP_HTTP_SUCCESS',
                    jsonb_build_object(
                        'trigger_id', v_trigger_id,
                        'agendamento_id', NEW.id,
                        'response', v_http_response
                    )
                );
                
            EXCEPTION WHEN OTHERS THEN
                -- Log de erro HTTP e tenta fallback
                INSERT INTO public.system_logs (
                    timestamp, level, message, context, data
                ) VALUES (
                    now(), 'error', 
                    'Erro na chamada HTTP WhatsApp: ' || SQLERRM, 
                    'WHATSAPP_HTTP_ERROR',
                    jsonb_build_object(
                        'trigger_id', v_trigger_id,
                        'agendamento_id', NEW.id,
                        'error', SQLERRM
                    )
                );
                
                -- Tentar fallback
                BEGIN
                    PERFORM public.enviar_whatsapp_fallback(NEW.id);
                EXCEPTION WHEN OTHERS THEN
                    INSERT INTO public.system_logs (
                        timestamp, level, message, context, data
                    ) VALUES (
                        now(), 'error', 
                        'Fallback WhatsApp também falhou: ' || SQLERRM, 
                        'WHATSAPP_FALLBACK_ERROR',
                        jsonb_build_object(
                            'trigger_id', v_trigger_id,
                            'agendamento_id', NEW.id,
                            'error', SQLERRM
                        )
                    );
                END;
            END;
            
        ELSE
            -- Log de celular inválido
            INSERT INTO public.system_logs (
                timestamp, level, message, context, data
            ) VALUES (
                now(), 'warning', 
                'Agendamento criado mas celular inválido', 
                'WHATSAPP_INVALID_PHONE',
                jsonb_build_object(
                    'trigger_id', v_trigger_id,
                    'agendamento_id', NEW.id,
                    'celular', COALESCE(v_celular, 'NULL'),
                    'paciente', v_paciente_record.nome_completo
                )
            );
        END IF;
        
        -- Log de fim do trigger
        INSERT INTO public.system_logs (
            timestamp, level, message, context, data
        ) VALUES (
            now(), 'info', 
            'Trigger WhatsApp finalizado', 
            'WHATSAPP_TRIGGER_END',
            jsonb_build_object(
                'trigger_id', v_trigger_id,
                'agendamento_id', NEW.id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$function$;

-- 4. CRIAR FUNÇÃO PARA TESTAR CONECTIVIDADE E CONFIGURAÇÕES
CREATE OR REPLACE FUNCTION public.diagnosticar_whatsapp_sistema()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    v_resultado jsonb;
    v_net_extension boolean := false;
    v_http_extension boolean := false;
    v_test_response jsonb;
BEGIN
    -- Verificar se extensão net está disponível
    BEGIN
        PERFORM net.http_get('https://httpbin.org/get');
        v_net_extension := true;
    EXCEPTION WHEN OTHERS THEN
        v_net_extension := false;
    END;
    
    -- Verificar se extensão http está disponível
    BEGIN
        SELECT extensions.http_get('https://httpbin.org/get') INTO v_test_response;
        v_http_extension := true;
    EXCEPTION WHEN OTHERS THEN
        v_http_extension := false;
    END;
    
    -- Compilar resultado do diagnóstico
    v_resultado := jsonb_build_object(
        'timestamp', now(),
        'extensoes', jsonb_build_object(
            'net_available', v_net_extension,
            'http_available', v_http_extension
        ),
        'configuracao', jsonb_build_object(
            'edge_function_url', 'https://qxlvzbvzajibdtlzngdy.supabase.co/functions/v1/whatsapp-confirmacao',
            'trigger_exists', EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_enviar_confirmacao_whatsapp')
        ),
        'recomendacoes', jsonb_build_array(
            CASE WHEN v_net_extension THEN 'Extensão net OK' ELSE 'Extensão net não disponível' END,
            CASE WHEN v_http_extension THEN 'Extensão http OK' ELSE 'Extensão http não disponível' END,
            'Use a função test_whatsapp_edge_function() para testar',
            'Use a função enviar_whatsapp_fallback() como alternativa'
        )
    );
    
    -- Log do diagnóstico
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Diagnóstico do sistema WhatsApp executado', 
        'WHATSAPP_DIAGNOSTIC',
        v_resultado
    );
    
    RETURN v_resultado;
END;
$function$;