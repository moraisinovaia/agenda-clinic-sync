-- Corrigir horário de início do atendimento da manhã do Teste Ergométrico
-- De 08:45 para 07:45 conforme especificado pelo cliente

UPDATE business_rules
SET config = jsonb_set(
  config,
  '{servicos,Teste Ergométrico,periodos,manha,atendimento_inicio}',
  '"07:45"'
),
updated_at = now()
WHERE id = '7273a6cc-5867-41b8-8551-2f2b30e217c0';