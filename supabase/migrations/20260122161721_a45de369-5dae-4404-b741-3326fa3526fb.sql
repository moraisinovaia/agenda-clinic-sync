-- Atualizar business_rules para Teste Ergométrico - Dr. Marcelo
-- 1. Remover mensagem_apos_agendamento
-- 2. Adicionar prefixo_mensagem = "Teste ergométrico agendado"
-- 3. Mover conteúdo para orientacoes
UPDATE business_rules
SET config = jsonb_set(
  jsonb_set(
    config #- '{servicos,Teste Ergométrico,mensagem_apos_agendamento}',
    '{servicos,Teste Ergométrico,prefixo_mensagem}',
    '"Teste ergométrico agendado"'
  ),
  '{servicos,Teste Ergométrico,orientacoes}',
  '"Orientações sobre o teste ergométrico:\n\n• O paciente deve vir com roupa apropriada para prática de esportes.\n• Vir com sapato fechado sem salto. Evitar sandálias ou calçados com salto.\n• Caso o paciente deseje, pode fazer o exame descalço.\n• Não pode estar de jejum e evitar alimentos de difícil digestão 2 horas antes do exame.\n• Evitar ingesta de café no dia do exame.\n• Não fumar no dia do exame.\n• Não ingerir bebida alcoólica no dia do exame.\n• Homens com pelos no peito devem vir com o peito raspado.\n• Não usar creme corporal, hidratante ou protetor solar na região do torax no dia do exame.\n• Mulheres gestantes não devem fazer o exame. Avise ao seu médico caso haja a suspeita.\n• Evitar fazer exercícios no dia do exame.\n• Se você faz uso de alguma medicação, pergunte ao seu médico se deve fazer o exame em uso delas ou se deverá suspender antes do exame."'
),
updated_at = now()
WHERE id = '7273a6cc-5867-41b8-8551-2f2b30e217c0';