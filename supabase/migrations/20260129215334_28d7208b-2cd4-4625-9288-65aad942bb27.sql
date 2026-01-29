-- Atualizar business_rules do Dr. Marcelo (medico principal) com limite 13 e dias corretos do documento
UPDATE business_rules
SET config = config || '{
  "servicos": {
    "Teste Ergométrico": {
      "periodos": {
        "manha": {
          "limite": 13,
          "dias_especificos": [3, 5],
          "atendimento_inicio": "07:30",
          "distribuicao_fichas": "07:00 às 10:30 para fazer a ficha"
        },
        "tarde": {
          "limite": 13,
          "dias_especificos": [2, 4],
          "atendimento_inicio": "13:30",
          "distribuicao_fichas": "13:00 às 15:30 para fazer a ficha"
        }
      },
      "valores": {
        "particular": 240,
        "particular_minimo": 220,
        "unimed_40_porcento": 54,
        "unimed_20_porcento": 26
      },
      "resultado": "No mesmo dia"
    }
  }
}'::jsonb,
    updated_at = now(),
    version = version + 1
WHERE id = '592bfe3b-08d2-4bea-81c2-07f5fb8b1c06';

-- Atualizar também o registro do Teste Ergométrico específico
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(config, 
            '{servicos,Teste Ergométrico,periodos,manha,limite}', '13'::jsonb),
          '{servicos,Teste Ergométrico,periodos,tarde,limite}', '13'::jsonb),
        '{servicos,Teste Ergométrico,periodos,manha,dias_especificos}', '[3, 5]'::jsonb),
      '{servicos,Teste Ergométrico,periodos,tarde,dias_especificos}', '[2, 4]'::jsonb),
    '{servicos,Teste Ergométrico,periodos,manha,atendimento_inicio}', '"07:30"'::jsonb),
  '{servicos,Teste Ergométrico,periodos,tarde,atendimento_inicio}', '"13:30"'::jsonb
),
    updated_at = now(),
    version = version + 1
WHERE id = '7e08a5cd-270d-4441-9baa-b6a97b7407e6';

-- Também atualizar o registro do Teste Ergométrico - Dr. Marcelo (atendimento específico)
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(COALESCE(config, '{}'::jsonb), 
            '{servicos,Teste Ergométrico,periodos,manha,limite}', '13'::jsonb),
          '{servicos,Teste Ergométrico,periodos,tarde,limite}', '13'::jsonb),
        '{servicos,Teste Ergométrico,periodos,manha,dias_especificos}', '[3, 5]'::jsonb),
      '{servicos,Teste Ergométrico,periodos,tarde,dias_especificos}', '[2, 4]'::jsonb),
    '{servicos,Teste Ergométrico,periodos,manha,atendimento_inicio}', '"07:30"'::jsonb),
  '{servicos,Teste Ergométrico,periodos,tarde,atendimento_inicio}', '"13:30"'::jsonb
),
    updated_at = now(),
    version = version + 1
WHERE id = '7273a6cc-5867-41b8-8551-2f2b30e217c0';