-- Adicionar Dr. Dilson Pereira e seus tipos de atendimento
-- Proctologista e Gastroenterologista, apenas maiores de 18 anos
-- Cliente: IPADO

DO $$
DECLARE
    v_cliente_id UUID;
    v_medico_id UUID;
BEGIN
    -- Buscar o cliente_id do IPADO
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Cliente IPADO não encontrado';
    END IF;
    
    -- Inserir Dr. Dilson Pereira
    INSERT INTO public.medicos (
        nome, 
        especialidade, 
        cliente_id, 
        ativo, 
        idade_minima,
        convenios_aceitos,
        created_at
    ) VALUES (
        'Dr. Dilson Pereira',
        'Proctologista e Gastroenterologista',
        v_cliente_id,
        true,
        18, -- Apenas maiores de 18 anos
        ARRAY['Unimed Nacional', 'Unimed Regional', 'Unimed Intercâmbio', 'Unimed 40%', 'Unimed 20%', 'Particular'],
        now()
    ) RETURNING id INTO v_medico_id;
    
    -- Inserir os 7 tipos de atendimento para Dr. Dilson Pereira
    INSERT INTO public.atendimentos (
        nome, tipo, medico_id, cliente_id, ativo, created_at
    ) VALUES
    ('Consulta', 'consulta', v_medico_id, v_cliente_id, true, now()),
    ('Retorno', 'consulta', v_medico_id, v_cliente_id, true, now()),
    ('Exame', 'exame', v_medico_id, v_cliente_id, true, now()),
    ('Colonoscopia', 'exame', v_medico_id, v_cliente_id, true, now()),
    ('Endoscopia', 'exame', v_medico_id, v_cliente_id, true, now()),
    ('Retossigmoidoscopia', 'exame', v_medico_id, v_cliente_id, true, now()),
    ('Ligadura de Hemorroidas', 'procedimento', v_medico_id, v_cliente_id, true, now());
    
    -- Log da operação
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Adicionado Dr. Dilson Pereira e seus tipos de atendimento',
        'DOCTOR_CREATED',
        jsonb_build_object(
            'doctor_name', 'Dr. Dilson Pereira',
            'doctor_id', v_medico_id,
            'specialties', 'Proctologista e Gastroenterologista',
            'age_restriction', 18,
            'cliente_id', v_cliente_id,
            'services_added', ARRAY['Consulta', 'Retorno', 'Exame', 'Colonoscopia', 'Endoscopia', 'Retossigmoidoscopia', 'Ligadura de Hemorroidas'],
            'total_services', 7,
            'convenios_aceitos', ARRAY['Unimed Nacional', 'Unimed Regional', 'Unimed Intercâmbio', 'Unimed 40%', 'Unimed 20%', 'Particular']
        )
    );
END $$;