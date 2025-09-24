-- Corrigir especialidade da Dra. Adriana Carla de Sena
-- Remover redundância "(apenas adultos)" da especialidade

DO $$
DECLARE
    v_medico_id UUID;
    v_cliente_id UUID;
BEGIN
    -- Buscar o cliente_id do IPADO
    SELECT id INTO v_cliente_id 
    FROM public.clientes 
    WHERE nome = 'IPADO' 
    LIMIT 1;
    
    IF v_cliente_id IS NULL THEN
        RAISE EXCEPTION 'Cliente IPADO não encontrado';
    END IF;
    
    -- Buscar e atualizar a Dra. Adriana Carla de Sena
    SELECT id INTO v_medico_id
    FROM public.medicos 
    WHERE nome = 'Dra. Adriana Carla de Sena'
    AND cliente_id = v_cliente_id
    AND especialidade = 'Endocrinologista (apenas adultos)'
    LIMIT 1;
    
    IF v_medico_id IS NULL THEN
        RAISE EXCEPTION 'Dra. Adriana Carla de Sena não encontrada com especialidade "Endocrinologista (apenas adultos)"';
    END IF;
    
    -- Atualizar a especialidade removendo a redundância
    UPDATE public.medicos 
    SET especialidade = 'Endocrinologista'
    WHERE id = v_medico_id;
    
    -- Log da operação
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info', 
        'Especialidade da Dra. Adriana Carla de Sena corrigida',
        'DOCTOR_SPECIALTY_CORRECTION',
        jsonb_build_object(
            'medico_id', v_medico_id,
            'medico_nome', 'Dra. Adriana Carla de Sena',
            'especialidade_anterior', 'Endocrinologista (apenas adultos)',
            'especialidade_nova', 'Endocrinologista',
            'observacao', 'Removida redundância - restrição de idade mantida no campo idade_minima',
            'idade_minima_mantida', 18,
            'cliente_id', v_cliente_id
        )
    );
    
    RAISE NOTICE 'Especialidade da Dra. Adriana Carla de Sena corrigida de "Endocrinologista (apenas adultos)" para "Endocrinologista"';
    
END $$;