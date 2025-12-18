
-- 1. Criar 10 atendimentos de USG para Dr. Pedro Francisco
-- ID do médico: 66e9310d-34cd-4005-8937-74e87125dc03
-- cliente_id IPADO: 2bfb98b5-ae41-4f96-8ba7-acc797c22054

INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES 
  ('USG Abdome Total', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Abdome Superior', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Aparelho Urinário', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Próstata', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Tireoide', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Tireoide com Doppler', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Cervical', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('Punção de Tireoide', 'procedimento', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Órgãos e Estruturas', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true),
  ('USG Estruturas Superficiais', 'exame', '2bfb98b5-ae41-4f96-8ba7-acc797c22054', '66e9310d-34cd-4005-8937-74e87125dc03', 'Dr. Pedro Francisco', true)
ON CONFLICT DO NOTHING;

-- 2. Adicionar PARTICULAR aos convênios do Dr. Pedro (se não existir)
UPDATE public.medicos 
SET convenios_aceitos = ARRAY[
  'UNIMED NACIONAL', 'UNIMED REGIONAL', 'UNIMED INTERCÂMBIO', 
  'UNIMED 40%', 'UNIMED 20%', 'MEDPREV', 'PARTICULAR'
]
WHERE id = '66e9310d-34cd-4005-8937-74e87125dc03';

-- 3. Atualizar business_rules do Dr. Pedro Francisco com configuração completa
UPDATE public.business_rules
SET config = '{
  "tipo_agendamento": "ordem_chegada",
  "permite_agendamento_online": true,
  "idade_minima": 0,
  "observacao_geral": "O Dr. começa a atender quando termina os exames, por ordem de chegada.",
  "whatsapp_secretaria": "(87) 98853-0318",
  "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"],
  "servicos": [
    {
      "nome": "Consulta",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": 4,
      "periodos": [
        {"dia": "terca", "distribuicao_fichas_inicio": "09:30", "distribuicao_fichas_fim": "10:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "Retorno",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "compartilha_limite_com": "Consulta",
      "periodos": [
        {"dia": "terca", "distribuicao_fichas_inicio": "09:30", "distribuicao_fichas_fim": "10:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Abdome Total",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "preparo": "Jejum de 8 horas + preparo intestinal + bexiga cheia",
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Abdome Superior",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "preparo": "Jejum de 8 horas + preparo intestinal",
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Aparelho Urinário",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Próstata",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Tireoide",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Tireoide com Doppler",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Cervical",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "Punção de Tireoide",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "preparo": "Levar último USG da tireoide",
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Órgãos e Estruturas",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    },
    {
      "nome": "USG Estruturas Superficiais",
      "tipo_agendamento": "ordem_chegada",
      "permite_agendamento_online": true,
      "limite": null,
      "periodos": [
        {"dia": "segunda", "inicio": "07:00", "fim": "12:00"},
        {"dia": "terca", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quarta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "quinta", "inicio": "07:00", "fim": "12:00"},
        {"dia": "sexta", "inicio": "07:00", "fim": "12:00"}
      ],
      "convenios": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV", "PARTICULAR"]
    }
  ],
  "sinonimos_servicos": {
    "usg": "USG Abdome Total",
    "ultrassom": "USG Abdome Total",
    "ultrassonografia": "USG Abdome Total",
    "eco abdominal": "USG Abdome Total",
    "clinica geral": "Consulta",
    "clínica geral": "Consulta"
  }
}'::jsonb,
updated_at = now()
WHERE medico_id = '66e9310d-34cd-4005-8937-74e87125dc03'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';
