
-- Atualizar configuração do Dr. Aristófilo para contagem por procedimentos
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    jsonb_set(
      config,
      '{tipo_agendamento}',
      '"procedimentos"'
    ),
    '{contagem_por}',
    '"procedimento"'
  ),
  '{limite_total_turno}',
  '12'
),
updated_at = now()
WHERE id = 'aa224613-09ad-42a9-b23b-421b8dad299b';
