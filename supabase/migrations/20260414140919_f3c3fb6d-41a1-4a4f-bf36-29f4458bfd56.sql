
DO $$
DECLARE
  v_cliente_id uuid := 'd7d7b7cf-4ec0-437b-8377-d7555fc5ee6a';
  v_config_id uuid := '0572445e-b4f3-4166-972d-d883d0fdd37c';
  v_isabelle_id uuid := '625f677e-60fe-446a-8d6b-93398b175ce8';
  v_new_medico_id uuid := gen_random_uuid();
  v_convenios text[] := ARRAY['MEDSAUDE','MEDCLIN','CASSI','GEAP','CPP','SAUDE CAIXA','MINERAÇÃO CARAIBA','CAMED','PARTICULAR','MEDPREV','DR VISÃO'];
  v_config jsonb;
BEGIN
  -- 1. Deactivate Dra. Isabelle Guerra
  UPDATE medicos SET ativo = false, updated_at = now() WHERE id = v_isabelle_id;
  UPDATE business_rules SET ativo = false, updated_at = now() WHERE medico_id = v_isabelle_id;
  UPDATE atendimentos SET ativo = false WHERE medico_id = v_isabelle_id AND cliente_id = v_cliente_id;

  -- 2. Insert new doctor
  INSERT INTO medicos (id, cliente_id, nome, especialidade, crm, rqe, ativo,
    atende_adultos, atende_criancas, idade_minima, idade_maxima,
    convenios_aceitos, observacoes)
  VALUES (
    v_new_medico_id, v_cliente_id,
    'Dra. Isabela do Nascimento Fonseca',
    'Oftalmologia geral, catarata',
    '23484', '10789', true,
    true, true, 0, null,
    v_convenios,
    'Máximo 20 pacientes por turno. HGU: máximo 7 pacientes por turno. Possui RQE. Quintas manhã: bloco 09:00 (10 pac) + 10:30 (10 pac). Segundas tarde: bloco 14:00 (10 pac) + 15:30 (10 pac). Realiza YAG Laser dela e de médicos solicitantes. Teste do olhinho a partir de 20 dias. Dilatação: 0-39 dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
  );

  -- 3. Build business_rules config
  v_config := jsonb_build_object(
    'crm', '23484',
    'rqe', '10789',
    'tipo_agendamento', 'hora_marcada',
    'atende_adultos', true,
    'atende_criancas', true,
    'idade_minima', 0,
    'idade_maxima', null,
    'limite_por_turno', 20,
    'limite_hgu', 7,
    'convenio_sublimites', jsonb_build_object('HGU', 7),
    'convenios_aceitos', to_jsonb(v_convenios),
    'permite_agendamento_online', true,
    'dilatacao', jsonb_build_object(
      'regra', '0-39 anos: dilata (exceto ceratocone). 40-59 anos: não dilata (exceto diabéticos). 60+ anos: sempre dilata.',
      'faixas', jsonb_build_array(
        jsonb_build_object('idade_min', 0, 'idade_max', 39, 'dilata', true, 'excecao', 'ceratocone não dilata'),
        jsonb_build_object('idade_min', 40, 'idade_max', 59, 'dilata', false, 'excecao', 'diabéticos dilata'),
        jsonb_build_object('idade_min', 60, 'idade_max', null, 'dilata', true, 'excecao', null)
      )
    ),
    'observacoes', 'HGU: máximo 7 pacientes por turno. Possui RQE. Realiza YAG Laser dela e de médicos solicitantes. Teste do olhinho a partir de 20 dias.',
    'servicos', jsonb_build_object(
      'Consulta Completa Eletiva', jsonb_build_object(
        'ativo', true, 'tipo_agendamento', 'hora_marcada', 'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(4),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '09:00', 'fim', '10:30', 'limite', 10),
              jsonb_build_object('inicio', '10:30', 'fim', '12:00', 'limite', 10)
            ), 'inicio', '09:00', 'fim', '12:00', 'limite', 20),
          'tarde', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(1),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '14:00', 'fim', '15:30', 'limite', 10),
              jsonb_build_object('inicio', '15:30', 'fim', '17:00', 'limite', 10)
            ), 'inicio', '14:00', 'fim', '17:00', 'limite', 20)
        )
      ),
      'Cirurgia Catarata', jsonb_build_object(
        'ativo', true, 'tipo_agendamento', 'hora_marcada', 'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(4),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '09:00', 'fim', '10:30', 'limite', 10),
              jsonb_build_object('inicio', '10:30', 'fim', '12:00', 'limite', 10)
            ), 'inicio', '09:00', 'fim', '12:00', 'limite', 20),
          'tarde', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(1),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '14:00', 'fim', '15:30', 'limite', 10),
              jsonb_build_object('inicio', '15:30', 'fim', '17:00', 'limite', 10)
            ), 'inicio', '14:00', 'fim', '17:00', 'limite', 20)
        )
      ),
      'Teste do Olhinho', jsonb_build_object(
        'ativo', true, 'tipo_agendamento', 'hora_marcada', 'permite_online', true,
        'idade_minima_dias', 20, 'observacao', 'A partir de 20 dias de nascido',
        'dias_semana', jsonb_build_array(1, 4),
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(4),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '09:00', 'fim', '10:30', 'limite', 10),
              jsonb_build_object('inicio', '10:30', 'fim', '12:00', 'limite', 10)
            ), 'inicio', '09:00', 'fim', '12:00', 'limite', 20),
          'tarde', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(1),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '14:00', 'fim', '15:30', 'limite', 10),
              jsonb_build_object('inicio', '15:30', 'fim', '17:00', 'limite', 10)
            ), 'inicio', '14:00', 'fim', '17:00', 'limite', 20)
        )
      ),
      'YAG Laser', jsonb_build_object(
        'ativo', true, 'tipo_agendamento', 'hora_marcada', 'permite_online', true,
        'observacao', 'Realiza YAG Laser dela e de médicos solicitantes',
        'dias_semana', jsonb_build_array(1, 4),
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(4),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '09:00', 'fim', '10:30', 'limite', 10),
              jsonb_build_object('inicio', '10:30', 'fim', '12:00', 'limite', 10)
            ), 'inicio', '09:00', 'fim', '12:00', 'limite', 20),
          'tarde', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(1),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '14:00', 'fim', '15:30', 'limite', 10),
              jsonb_build_object('inicio', '15:30', 'fim', '17:00', 'limite', 10)
            ), 'inicio', '14:00', 'fim', '17:00', 'limite', 20)
        )
      ),
      'Mapeamento de Retina', jsonb_build_object(
        'ativo', true, 'tipo_agendamento', 'hora_marcada', 'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(4),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '09:00', 'fim', '10:30', 'limite', 10),
              jsonb_build_object('inicio', '10:30', 'fim', '12:00', 'limite', 10)
            ), 'inicio', '09:00', 'fim', '12:00', 'limite', 20),
          'tarde', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(1),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '14:00', 'fim', '15:30', 'limite', 10),
              jsonb_build_object('inicio', '15:30', 'fim', '17:00', 'limite', 10)
            ), 'inicio', '14:00', 'fim', '17:00', 'limite', 20)
        )
      ),
      'Consulta Acuidade Visual - Laudo Concurso', jsonb_build_object(
        'ativo', true, 'tipo_agendamento', 'hora_marcada', 'permite_online', true,
        'dias_semana', jsonb_build_array(1, 4),
        'periodos', jsonb_build_object(
          'manha', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(4),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '09:00', 'fim', '10:30', 'limite', 10),
              jsonb_build_object('inicio', '10:30', 'fim', '12:00', 'limite', 10)
            ), 'inicio', '09:00', 'fim', '12:00', 'limite', 20),
          'tarde', jsonb_build_object('ativo', true, 'dias_especificos', jsonb_build_array(1),
            'blocos', jsonb_build_array(
              jsonb_build_object('inicio', '14:00', 'fim', '15:30', 'limite', 10),
              jsonb_build_object('inicio', '15:30', 'fim', '17:00', 'limite', 10)
            ), 'inicio', '14:00', 'fim', '17:00', 'limite', 20)
        )
      )
    )
  );

  INSERT INTO business_rules (cliente_id, config_id, medico_id, config, ativo, version)
  VALUES (v_cliente_id, v_config_id, v_new_medico_id, v_config, true, 1);

  -- 4. Create atendimentos for the new doctor
  INSERT INTO atendimentos (cliente_id, medico_id, medico_nome, nome, tipo, ativo) VALUES
    (v_cliente_id, v_new_medico_id, 'Dra. Isabela do Nascimento Fonseca', 'Consulta Completa Eletiva', 'consulta', true),
    (v_cliente_id, v_new_medico_id, 'Dra. Isabela do Nascimento Fonseca', 'Cirurgia Catarata', 'procedimento', true),
    (v_cliente_id, v_new_medico_id, 'Dra. Isabela do Nascimento Fonseca', 'Teste do Olhinho', 'exame', true),
    (v_cliente_id, v_new_medico_id, 'Dra. Isabela do Nascimento Fonseca', 'YAG Laser', 'procedimento', true),
    (v_cliente_id, v_new_medico_id, 'Dra. Isabela do Nascimento Fonseca', 'Mapeamento de Retina', 'exame', true),
    (v_cliente_id, v_new_medico_id, 'Dra. Isabela do Nascimento Fonseca', 'Consulta Acuidade Visual - Laudo Concurso', 'consulta', true);
END $$;
