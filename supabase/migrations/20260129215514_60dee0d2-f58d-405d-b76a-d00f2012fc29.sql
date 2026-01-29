-- Corrigir registro 592bfe3b com limite 13 e dias/horários corretos
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
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
      '{servicos,Teste Ergométrico,periodos,tarde,atendimento_inicio}', '"13:30"'::jsonb),
    '{servicos,Teste Ergométrico,periodos,manha,distribuicao_fichas}', '"07:00 às 10:30 para fazer a ficha"'::jsonb),
  '{servicos,Teste Ergométrico,periodos,tarde,distribuicao_fichas}', '"13:00 às 15:30 para fazer a ficha"'::jsonb
),
    updated_at = now(),
    version = version + 1
WHERE id = '592bfe3b-08d2-4bea-81c2-07f5fb8b1c06';