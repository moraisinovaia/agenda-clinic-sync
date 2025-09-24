-- Adicionar tipos de atendimentos para Dr. Alessandro Dias
-- Dr. Alessandro Dias ID: c192e08e-e216-4c22-99bf-b5992ce05e17
-- Cliente: IPADO

-- Buscar o cliente_id do IPADO
DO $$
DECLARE
    v_cliente_id UUID;
    v_medico_id UUID := 'c192e08e-e216-4c22-99bf-b5992ce05e17'::uuid;
BEGIN
    -- Buscar o cliente_id do IPADO
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Cliente IPADO não encontrado';
    END IF;
    
    -- Inserir os 4 tipos de atendimento para Dr. Alessandro Dias
    INSERT INTO public.atendimentos (
        nome, tipo, medico_id, cliente_id, ativo, created_at
    ) VALUES
    ('Consulta', 'consulta', v_medico_id, v_cliente_id, true, now()),
    ('Retorno', 'consulta', v_medico_id, v_cliente_id, true, now()),
    ('Ecocardiograma', 'exame', v_medico_id, v_cliente_id, true, now()),
    ('Exame', 'exame', v_medico_id, v_cliente_id, true, now());
    
    -- Log da operação
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Adicionados tipos de atendimento para Dr. Alessandro Dias',
        'DOCTOR_SERVICES_ADDED',
        jsonb_build_object(
            'doctor_name', 'Dr. Alessandro Dias',
            'doctor_id', v_medico_id,
            'cliente_id', v_cliente_id,
            'services_added', ARRAY['Consulta', 'Retorno', 'Ecocardiograma', 'Exame'],
            'total_services', 4
        )
    );
END $$;