-- Criar enfermeiras LORENA e JOANA
INSERT INTO public.medicos (nome, especialidade, convenios_aceitos, horarios, observacoes, ativo) VALUES
('LORENA', 'Enfermagem', ARRAY['Particular'], 
 '{"quinta": [{"inicio": "07:00", "fim": "08:00", "max_pacientes": 5}]}',
 'TESTE HIDROGÊNIO - Quintas às 07h, máximo 5 pacientes. Não agenda para um dia que no outro seja feriado pois tem que retirar o aparelho no dia seguinte.',
 true),
('JOANA', 'Enfermagem', ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter'],
 '{"segunda": [{"inicio": "07:00", "fim": "17:00"}], "terca": [{"inicio": "07:00", "fim": "17:00"}], "quarta": [{"inicio": "07:00", "fim": "17:00"}], "quinta": [{"inicio": "07:00", "fim": "17:00"}], "sexta": [{"inicio": "07:00", "fim": "17:00"}]}',
 'MAPA, HOLTER, ECG - Segunda a sexta. Não agenda para um dia que no outro seja feriado pois tem que retirar o aparelho no dia seguinte.',
 true);

-- Buscar IDs das enfermeiras criadas
DO $$ 
DECLARE
    lorena_id UUID;
    joana_id UUID;
BEGIN
    -- Buscar ID da LORENA
    SELECT id INTO lorena_id FROM public.medicos WHERE nome = 'LORENA' AND especialidade = 'Enfermagem' LIMIT 1;
    
    -- Buscar ID da JOANA  
    SELECT id INTO joana_id FROM public.medicos WHERE nome = 'JOANA' AND especialidade = 'Enfermagem' LIMIT 1;
    
    -- Criar atendimentos para LORENA
    INSERT INTO public.atendimentos (nome, tipo, medico_id, medico_nome, valor_particular, observacoes, ativo) VALUES
    ('TESTE HIDROGÊNIO', 'Exame', lorena_id, 'LORENA', 150.00, 
     'Quintas às 07h, máximo 5 pacientes de 07:00. Apenas particular. Não agenda para um dia que no outro seja feriado pois tem que retirar o aparelho no dia seguinte.',
     true);
    
    -- Criar atendimentos para JOANA
    INSERT INTO public.atendimentos (nome, tipo, medico_id, medico_nome, observacoes, ativo) VALUES
    ('MAPA', 'Exame', joana_id, 'JOANA', 
     'Segunda a sexta. Convênios: Mineração, Fusex, Particular, Medprev, Agenda Vale, Dr. Exames, Clincenter. Não agenda para um dia que no outro seja feriado pois tem que retirar o aparelho no dia seguinte.',
     true),
    ('HOLTER', 'Exame', joana_id, 'JOANA',
     'Segunda a sexta. Convênios: Mineração, Fusex, Particular, Medprev, Agenda Vale, Dr. Exames, Clincenter. Não agenda para um dia que no outro seja feriado pois tem que retirar o aparelho no dia seguinte.',
     true),
    ('ECG', 'Exame', joana_id, 'JOANA',
     'Segunda a sexta. Convênios: Mineração, Fusex, Particular, Medprev, Agenda Vale, Dr. Exames, Clincenter. Não agenda para um dia que no outro seja feriado pois tem que retirar o aparelho no dia seguinte.',
     true);
END $$;