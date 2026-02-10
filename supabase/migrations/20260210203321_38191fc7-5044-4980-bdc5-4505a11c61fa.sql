
-- 1. Inserir Dra. Marina Tozzi na tabela medicos
INSERT INTO public.medicos (
  cliente_id, nome, especialidade, crm, rqe, ativo,
  atende_adultos, atende_criancas,
  idade_minima, idade_maxima,
  convenios_aceitos,
  observacoes
) VALUES (
  'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a',
  'Dra. Marina Tozzi',
  'Oftalmologia Geral, Oftalmopediatra e Estrabismo',
  '36716',
  '15362',
  true,
  true,
  true,
  0, 120,
  ARRAY['MEDSAUDE','MEDCLIN','CASSI','GEAP','CPP','SAUDE CAIXA','MINERAÇÃO CARAIBA','CAMED','PARTICULAR'],
  'Oftalmopediatra mas também atende eletivas em adultos. NÃO atende HGU.'
);

-- 2. Buscar o ID da médica recém-inserida
DO $$
DECLARE
  v_medico_id UUID;
  v_cliente_id UUID := 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a';
  v_config_id UUID := '0572445e-b4f3-4166-972d-d883d0fdd37c';
BEGIN
  SELECT id INTO v_medico_id FROM public.medicos
  WHERE cliente_id = v_cliente_id AND crm = '36716' LIMIT 1;

  -- 3. Inserir atendimentos
  INSERT INTO public.atendimentos (cliente_id, medico_id, medico_nome, nome, tipo, ativo) VALUES
    (v_cliente_id, v_medico_id, 'Dra. Marina Tozzi', 'Consulta Completa Eletiva', 'consulta', true),
    (v_cliente_id, v_medico_id, 'Dra. Marina Tozzi', 'Cirurgia de Estrabismo', 'procedimento', true),
    (v_cliente_id, v_medico_id, 'Dra. Marina Tozzi', 'Teste do Olhinho', 'exame', true),
    (v_cliente_id, v_medico_id, 'Dra. Marina Tozzi', 'Yag Laser', 'procedimento', true),
    (v_cliente_id, v_medico_id, 'Dra. Marina Tozzi', 'Mapeamento de Retina', 'exame', true),
    (v_cliente_id, v_medico_id, 'Dra. Marina Tozzi', 'Consulta Acuidade Visual (Laudo Concurso)', 'consulta', true);

  -- 4. Inserir business_rules
  INSERT INTO public.business_rules (
    cliente_id, config_id, medico_id, ativo, version, config
  ) VALUES (
    v_cliente_id,
    v_config_id,
    v_medico_id,
    true,
    1,
    jsonb_build_object(
      'tipo_agendamento', 'ordem_chegada',
      'permite_agendamento_online', true,
      'limite_por_turno', 12,
      'hgu', jsonb_build_object('atende', false),
      'periodos', jsonb_build_object(
        'manha', jsonb_build_object(
          'ativo', true,
          'dias', jsonb_build_array(1),
          'hora_inicio', '08:00',
          'hora_fim', '12:00',
          'limite_pacientes', 12
        ),
        'tarde', jsonb_build_object(
          'ativo', true,
          'dias', jsonb_build_array(4),
          'hora_inicio', '13:30',
          'hora_fim', '17:30',
          'limite_pacientes', 12
        ),
        'noite', jsonb_build_object('ativo', false)
      ),
      'servicos', jsonb_build_object(
        'Consulta Completa Eletiva', jsonb_build_object('tipo', 'consulta', 'disponivel_online', true),
        'Cirurgia de Estrabismo', jsonb_build_object('tipo', 'procedimento', 'disponivel_online', false),
        'Teste do Olhinho', jsonb_build_object('tipo', 'exame', 'disponivel_online', true, 'idade_minima_dias', 15),
        'Yag Laser', jsonb_build_object('tipo', 'procedimento', 'disponivel_online', true, 'aceita_solicitantes_externos', true),
        'Mapeamento de Retina', jsonb_build_object('tipo', 'exame', 'disponivel_online', true),
        'Consulta Acuidade Visual (Laudo Concurso)', jsonb_build_object('tipo', 'consulta', 'disponivel_online', true)
      ),
      'convenios', jsonb_build_object(
        'aceitos', jsonb_build_array('MEDSAUDE','MEDCLIN','CASSI','GEAP','CPP','SAUDE CAIXA','MINERAÇÃO CARAIBA','CAMED','PARTICULAR'),
        'restricoes', jsonb_build_object()
      ),
      'dilatacao', jsonb_build_object(
        'regra', '0-39: sim (exceto ceratocone); 40-59: não (exceto diabéticos); 60+: sim',
        'faixas', jsonb_build_array(
          jsonb_build_object('idade_min', 0, 'idade_max', 39, 'dilata', true, 'excecao', 'ceratocone não dilata'),
          jsonb_build_object('idade_min', 40, 'idade_max', 59, 'dilata', false, 'excecao', 'diabéticos dilata'),
          jsonb_build_object('idade_min', 60, 'idade_max', 120, 'dilata', true, 'excecao', null)
        )
      ),
      'observacoes', 'Oftalmopediatra mas também atende eletivas em adultos. NÃO atende HGU. Yag Laser aceita pacientes de médicos solicitantes.'
    )
  );
END $$;
