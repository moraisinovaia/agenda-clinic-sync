-- 1. Criar atendimentos faltantes para Dr. Marcelo D'Carli
-- ID do médico: 1e110923-50df-46ff-a57a-29d88e372900
-- cliente_id IPADO: 2bfb98b5-ae41-4f96-8ba7-acc797c22054

INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES 
  ('Retorno Cardiológico', 'consulta', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '1e110923-50df-46ff-a57a-29d88e372900', 'Dr. Marcelo D''Carli', true),
  ('Exame Cardiológico', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '1e110923-50df-46ff-a57a-29d88e372900', 'Dr. Marcelo D''Carli', true),
  ('Parecer Cardiológico', 'consulta', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '1e110923-50df-46ff-a57a-29d88e372900', 'Dr. Marcelo D''Carli', true)
ON CONFLICT DO NOTHING;

-- 2. Sincronizar convênios do Dr. Marcelo D'Carli (adicionar ASSEFAZ, CODEVASF, CASEMBRAPA)
UPDATE public.medicos 
SET convenios_aceitos = ARRAY[
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 
  'UNIMED 40%', 'UNIMED 20%', 'PARTICULAR', 'SAÚDE BRADESCO', 
  'CASSI', 'CAPSAUDE', 'GEAP', 'POSTAL SAÚDE', 
  'ASSEFAZ', 'CODEVASF', 'CASEMBRAPA'
]
WHERE id = '1e110923-50df-46ff-a57a-29d88e372900';

-- 3. Atualizar business_rules do Dr. Marcelo D'Carli com os novos serviços
UPDATE public.business_rules
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      config,
      '{servicos}',
      (COALESCE(config->'servicos', '[]'::jsonb) || '[
        {
          "nome": "Retorno Cardiológico",
          "tipo_agendamento": "ordem_chegada",
          "compartilha_limite_com": "Consulta Cardiológica",
          "periodos": [
            {"dia": "segunda", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"},
            {"dia": "quarta", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"},
            {"dia": "quinta", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"}
          ]
        },
        {
          "nome": "Exame Cardiológico",
          "tipo_agendamento": "ordem_chegada",
          "limite": null,
          "sinonimos": ["ECG", "Eletro", "Eletrocardiograma"],
          "periodos": [
            {"dia": "segunda", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"},
            {"dia": "quarta", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"},
            {"dia": "quinta", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"}
          ]
        },
        {
          "nome": "Parecer Cardiológico",
          "tipo_agendamento": "ordem_chegada",
          "compartilha_limite_com": "Consulta Cardiológica",
          "descricao": "Consulta + ECG incluso",
          "periodos": [
            {"dia": "segunda", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"},
            {"dia": "quarta", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"},
            {"dia": "quinta", "inicio": "08:00", "fim": "12:00", "distribuicao_fichas": "07:00"}
          ]
        }
      ]'::jsonb)
    ),
    '{convenios}',
    '["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "PARTICULAR", "SAÚDE BRADESCO", "CASSI", "CAPSAUDE", "GEAP", "POSTAL SAÚDE", "ASSEFAZ", "CODEVASF", "CASEMBRAPA"]'::jsonb
  ),
  '{sinonimos_servicos}',
  '{"ECG": "Exame Cardiológico", "Eletro": "Exame Cardiológico", "Eletrocardiograma": "Exame Cardiológico"}'::jsonb
),
updated_at = now()
WHERE medico_id = '1e110923-50df-46ff-a57a-29d88e372900'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';