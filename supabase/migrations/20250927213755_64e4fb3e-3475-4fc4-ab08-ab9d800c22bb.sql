-- Buscar o cliente_id do IPADO para usar nos novos atendimentos
DO $$
DECLARE
    v_cliente_ipado_id UUID;
    v_medico_id UUID;
    v_atendimento_mapa_original UUID;
BEGIN
    -- Buscar cliente IPADO
    SELECT id INTO v_cliente_ipado_id FROM public.clientes WHERE nome = 'IPADO' LIMIT 1;
    
    -- Buscar médico associado ao MAPA original
    SELECT medico_id INTO v_medico_id FROM public.atendimentos WHERE nome = 'MAPA' LIMIT 1;
    
    -- Buscar ID do atendimento MAPA original
    SELECT id INTO v_atendimento_mapa_original FROM public.atendimentos WHERE nome = 'MAPA' LIMIT 1;
    
    -- Criar novo atendimento MAPA 24H
    INSERT INTO public.atendimentos (
        nome,
        tipo,
        medico_id,
        cliente_id,
        ativo,
        codigo,
        valor_particular,
        forma_pagamento,
        observacoes,
        restricoes,
        horarios,
        coparticipacao_unimed_20,
        coparticipacao_unimed_40
    )
    SELECT 
        'MAPA 24H',
        tipo,
        medico_id,
        cliente_id,
        ativo,
        codigo || '_24H',
        valor_particular,
        forma_pagamento,
        observacoes,
        restricoes,
        horarios,
        coparticipacao_unimed_20,
        coparticipacao_unimed_40
    FROM public.atendimentos 
    WHERE nome = 'MAPA' 
    LIMIT 1;
    
    -- Criar novo atendimento MAPA MRPA
    INSERT INTO public.atendimentos (
        nome,
        tipo,
        medico_id,
        cliente_id,
        ativo,
        codigo,
        valor_particular,
        forma_pagamento,
        observacoes,
        restricoes,
        horarios,
        coparticipacao_unimed_20,
        coparticipacao_unimed_40
    )
    SELECT 
        'MAPA MRPA',
        tipo,
        medico_id,
        cliente_id,
        ativo,
        codigo || '_MRPA',
        valor_particular,
        forma_pagamento,
        observacoes,
        restricoes,
        horarios,
        coparticipacao_unimed_20,
        coparticipacao_unimed_40
    FROM public.atendimentos 
    WHERE nome = 'MAPA' 
    LIMIT 1;
    
    -- Migrar agendamentos existentes baseado nas observações
    -- Atualizar agendamentos que contêm "24H" nas observações para MAPA 24H
    UPDATE public.agendamentos 
    SET atendimento_id = (SELECT id FROM public.atendimentos WHERE nome = 'MAPA 24H' LIMIT 1)
    WHERE atendimento_id = v_atendimento_mapa_original
    AND (
        UPPER(observacoes) LIKE '%24H%' 
        OR UPPER(observacoes) LIKE '%MAPA 24H%'
        OR observacoes IS NULL 
        OR TRIM(observacoes) = ''
    );
    
    -- Atualizar agendamentos que contêm "MRPA" nas observações para MAPA MRPA  
    UPDATE public.agendamentos 
    SET atendimento_id = (SELECT id FROM public.atendimentos WHERE nome = 'MAPA MRPA' LIMIT 1)
    WHERE atendimento_id = v_atendimento_mapa_original
    AND (
        UPPER(observacoes) LIKE '%MRPA%' 
        OR UPPER(observacoes) LIKE '%MAPA MRPA%'
    );
    
    -- Limpar observações redundantes após migração
    UPDATE public.agendamentos 
    SET observacoes = TRIM(REPLACE(REPLACE(REPLACE(REPLACE(
        observacoes, 
        'MAPA 24H', ''), 
        'Mapa 24H', ''),
        'mapa 24h', ''),
        'MAPA MRPA', ''))
    WHERE atendimento_id IN (
        SELECT id FROM public.atendimentos WHERE nome IN ('MAPA 24H', 'MAPA MRPA')
    )
    AND observacoes IS NOT NULL;
    
    -- Log da migração
    INSERT INTO public.system_logs (
        timestamp, level, message, context, data
    ) VALUES (
        now(), 'info',
        'Migração MAPA separado em 24H e MRPA concluída',
        'MAPA_MIGRATION',
        jsonb_build_object(
            'mapa_original_id', v_atendimento_mapa_original,
            'cliente_id', v_cliente_ipado_id,
            'medico_id', v_medico_id
        )
    );
    
END $$;