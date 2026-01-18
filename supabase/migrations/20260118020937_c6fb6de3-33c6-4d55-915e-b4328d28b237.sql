-- Adicionar campo distribuicao_fichas em todos os serviços do Dr. Marcelo D'Carli
-- para corrigir o horário exibido ao paciente (07:00 às 10:00 em vez de 07:30 às 10:00)

UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            config,
            '{servicos,Consulta Cardiológica,periodos,manha,distribuicao_fichas}',
            '"07:00 às 10:00"'
          ),
          '{servicos,Consulta Cardiológica,periodos,tarde,distribuicao_fichas}',
          '"13:00 às 15:00"'
        ),
        '{servicos,Retorno Cardiológico,periodos,manha,distribuicao_fichas}',
        '"07:00 às 10:00"'
      ),
      '{servicos,Retorno Cardiológico,periodos,tarde,distribuicao_fichas}',
      '"13:00 às 15:00"'
    ),
    '{servicos,Teste Ergométrico,periodos,manha,distribuicao_fichas}',
    '"07:00 às 10:00"'
  ),
  '{servicos,Teste Ergométrico,periodos,tarde,distribuicao_fichas}',
  '"13:00 às 15:00"'
),
updated_at = NOW()
WHERE medico_id = '1e110923-50df-46ff-a57a-29d88e372900';