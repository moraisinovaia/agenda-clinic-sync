-- Adicionar Dr. Sydeney Ribeiro, Dra. Lívia Barreiros e Dr. Edson Batista
-- Cliente: IPADO

DO $$
DECLARE
    v_cliente_id UUID;
    v_medico_sydeney_id UUID;
    v_medico_livia_id UUID;
    v_medico_edson_id UUID;
BEGIN
    -- Buscar o cliente_id do IPADO
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Cliente IPADO não encontrado';
    END IF;
    
    -- 1. Inserir Dr. Sydeney Ribeiro (Gastroenterologista)
    INSERT INTO public.medicos (
        nome, 
        especialidade, 
        cliente_id, 
        ativo, 
        convenios_aceitos,
        created_at
    ) VALUES (
        'Dr. Sydeney Ribeiro',
        'Gastroenterologista',
        v_cliente_id,
        true,
        ARRAY['Unimed Nacional', 'Unimed Regional', 'Unimed Intercâmbio', 'Unimed 40%', 'Unimed 20%', 'Particular', 'Saúde Bradesco', 'Cassi', 'Capsaude', 'Postal saúde', 'Camed'],
        now()
    ) RETURNING id INTO v_medico_sydeney_id;
    
    -- Atendimentos para Dr. Sydeney Ribeiro
    INSERT INTO public.atendimentos (
        nome, tipo, medico_id, cliente_id, ativo, created_at
    ) VALUES
    ('Consulta', 'consulta', v_medico_sydeney_id, v_cliente_id, true, now()),
    ('Retorno', 'consulta', v_medico_sydeney_id, v_cliente_id, true, now()),
    ('Exame', 'exame', v_medico_sydeney_id, v_cliente_id, true, now()),
    ('Colonoscopia', 'exame', v_medico_sydeney_id, v_cliente_id, true, now()),
    ('Endoscopia', 'exame', v_medico_sydeney_id, v_cliente_id, true, now()),
    ('Retossigmoidoscopia', 'exame', v_medico_sydeney_id, v_cliente_id, true, now());
    
    -- 2. Inserir Dra. Lívia Barreiros (Nutricionista)
    INSERT INTO public.medicos (
        nome, 
        especialidade, 
        cliente_id, 
        ativo, 
        convenios_aceitos,
        created_at
    ) VALUES (
        'Dra. Lívia Barreiros',
        'Nutricionista',
        v_cliente_id,
        true,
        ARRAY['Particular'],
        now()
    ) RETURNING id INTO v_medico_livia_id;
    
    -- Atendimentos para Dra. Lívia Barreiros
    INSERT INTO public.atendimentos (
        nome, tipo, medico_id, cliente_id, ativo, created_at
    ) VALUES
    ('Consulta', 'consulta', v_medico_livia_id, v_cliente_id, true, now()),
    ('Retorno', 'consulta', v_medico_livia_id, v_cliente_id, true, now());
    
    -- 3. Inserir Dr. Edson Batista (Gastroenterologista)
    INSERT INTO public.medicos (
        nome, 
        especialidade, 
        cliente_id, 
        ativo, 
        convenios_aceitos,
        created_at
    ) VALUES (
        'Dr. Edson Batista',
        'Gastroenterologista',
        v_cliente_id,
        true,
        ARRAY['Unimed Nacional', 'Unimed Regional', 'Unimed Intercâmbio', 'Unimed 40%', 'Unimed 20%', 'Particular', 'Saúde Bradesco', 'Cassi', 'Capsaude', 'Postal saúde', 'Camed'],
        now()
    ) RETURNING id INTO v_medico_edson_id;
    
    -- Atendimentos para Dr. Edson Batista
    INSERT INTO public.atendimentos (
        nome, tipo, medico_id, cliente_id, ativo, created_at
    ) VALUES
    ('Consulta', 'consulta', v_medico_edson_id, v_cliente_id, true, now()),
    ('Retorno', 'consulta', v_medico_edson_id, v_cliente_id, true, now()),
    ('Exame', 'exame', v_medico_edson_id, v_cliente_id, true, now()),
    ('Endoscopia', 'exame', v_medico_edson_id, v_cliente_id, true, now());
    
    -- Log da operação
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Adicionados 3 novos médicos para clínica IPADO',
        'DOCTORS_BATCH_CREATED',
        jsonb_build_object(
            'doctors_added', ARRAY[
                jsonb_build_object('name', 'Dr. Sydeney Ribeiro', 'id', v_medico_sydeney_id, 'specialty', 'Gastroenterologista', 'services', 6),
                jsonb_build_object('name', 'Dra. Lívia Barreiros', 'id', v_medico_livia_id, 'specialty', 'Nutricionista', 'services', 2),
                jsonb_build_object('name', 'Dr. Edson Batista', 'id', v_medico_edson_id, 'specialty', 'Gastroenterologista', 'services', 4)
            ],
            'total_doctors_added', 3,
            'total_services_added', 12,
            'new_specialties', ARRAY['Nutricionista'],
            'new_convenios', ARRAY['Saúde Bradesco', 'Cassi', 'Capsaude', 'Postal saúde', 'Camed'],
            'cliente_id', v_cliente_id
        )
    );
END $$;