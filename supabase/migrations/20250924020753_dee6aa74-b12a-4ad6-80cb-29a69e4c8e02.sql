-- Adicionar Dra. Lara Eline de Souza Menezes e Dr. André Ribeiro Costa ao sistema IPADO

DO $$
DECLARE
    v_cliente_id UUID;
    v_dra_lara_id UUID;
    v_dr_andre_id UUID;
    v_atendimento_id UUID;
BEGIN
    -- Buscar o cliente_id do IPADO
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Cliente IPADO não encontrado';
    END IF;
    
    -- Inserir Dra. Lara Eline de Souza Menezes
    INSERT INTO public.medicos (
        nome,
        especialidade,
        cliente_id,
        convenios_aceitos,
        ativo,
        idade_minima,
        idade_maxima
    ) VALUES (
        'Dra. Lara Eline de Souza Menezes',
        'Gastroenterologista e Hepatologista',
        v_cliente_id,
        ARRAY['Particular', 'Saúde Bradesco', 'Cassi', 'Capsaude', 'Postal Saúde', 'Casembrapa'],
        true,
        NULL,
        NULL
    ) RETURNING id INTO v_dra_lara_id;
    
    -- Inserir Dr. André Ribeiro Costa
    INSERT INTO public.medicos (
        nome,
        especialidade,
        cliente_id,
        convenios_aceitos,
        ativo,
        idade_minima,
        idade_maxima
    ) VALUES (
        'Dr. André Ribeiro Costa',
        'Pneumologista e Broncoscopista',
        v_cliente_id,
        ARRAY['Cassi', 'Geap', 'Casembrapa', 'Você Total', 'Amil', 'Mineração Caraíba', 'Compesa', 'Fachesf', 'Casec', 'Camed', 'HGU Saúde', 'Saúde Caixa', 'Medeprev'],
        true,
        NULL,
        NULL
    ) RETURNING id INTO v_dr_andre_id;
    
    -- Criar atendimentos para Dra. Lara (6 tipos)
    -- Consulta
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Consulta', v_dra_lara_id, v_cliente_id, 'consulta', true
    );
    
    -- Retorno
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Retorno', v_dra_lara_id, v_cliente_id, 'retorno', true
    );
    
    -- Exame
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Exame', v_dra_lara_id, v_cliente_id, 'exame', true
    );
    
    -- Endoscopia
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Endoscopia', v_dra_lara_id, v_cliente_id, 'procedimento', true
    );
    
    -- Colonoscopia
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Colonoscopia', v_dra_lara_id, v_cliente_id, 'procedimento', true
    );
    
    -- Retossigmoidoscopia
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Retossigmoidoscopia', v_dra_lara_id, v_cliente_id, 'procedimento', true
    );
    
    -- Criar atendimentos para Dr. André (2 tipos)
    -- Consulta
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Consulta', v_dr_andre_id, v_cliente_id, 'consulta', true
    );
    
    -- Retorno
    INSERT INTO public.atendimentos (
        nome, medico_id, cliente_id, tipo, ativo
    ) VALUES (
        'Retorno', v_dr_andre_id, v_cliente_id, 'retorno', true
    );
    
    -- Log das operações
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Novos médicos adicionados ao sistema IPADO',
        'DOCTORS_ADDITION',
        jsonb_build_object(
            'dra_lara_id', v_dra_lara_id,
            'dr_andre_id', v_dr_andre_id,
            'cliente_id', v_cliente_id,
            'total_atendimentos_criados', 8,
            'medicos_adicionados', jsonb_build_array(
                jsonb_build_object(
                    'nome', 'Dra. Lara Eline de Souza Menezes',
                    'especialidade', 'Gastroenterologista e Hepatologista',
                    'convenios_count', 6,
                    'atendimentos_count', 6
                ),
                jsonb_build_object(
                    'nome', 'Dr. André Ribeiro Costa',
                    'especialidade', 'Pneumologista e Broncoscopista',
                    'convenios_count', 13,
                    'atendimentos_count', 2
                )
            )
        )
    );
    
    RAISE NOTICE 'Médicos adicionados com sucesso: Dra. Lara (% atendimentos) e Dr. André (% atendimentos)', 6, 2;
    
END $$;