-- 1. Atualizar business_rules da agenda "MAPA - Dr. Marcelo" para não permitir agendamento online
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    config,
    '{permite_agendamento_online}',
    'false'
  ),
  '{servicos}',
  '{
    "MAPA 24H": {
      "permite_online": false,
      "mensagem": "Para marcar MAPA 24H com o Dr. Marcelo é apenas com a secretária Jeniffer pelo WhatsApp: 87981126744 (não recebe ligação)."
    },
    "MAPA MRPA": {
      "permite_online": false,
      "mensagem": "Para marcar MAPA MRPA com o Dr. Marcelo é apenas com a secretária Jeniffer pelo WhatsApp: 87981126744 (não recebe ligação)."
    }
  }'::jsonb
),
updated_at = now()
WHERE medico_id = 'e6453b94-840d-4adf-ab0f-fc22be7cd7f5';

-- 2. Adicionar mensagem de encaixe para Dr. Marcelo D'Carli
INSERT INTO llm_mensagens (cliente_id, medico_id, tipo, mensagem, ativo)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  '1e110923-50df-46ff-a57a-29d88e372900',
  'encaixe',
  'Para tentar encaixe com o Dr. Marcelo é apenas com a secretária Jeniffer pelo WhatsApp: 87981126744 (não recebe ligação).',
  true
);

-- 3. Adicionar mensagem global para serviço MAPA não agendável
INSERT INTO llm_mensagens (cliente_id, medico_id, tipo, mensagem, ativo)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',
  'e6453b94-840d-4adf-ab0f-fc22be7cd7f5',
  'servico_nao_agendavel',
  'Para marcar MAPA com o Dr. Marcelo é apenas com a secretária Jeniffer pelo WhatsApp: 87981126744 (não recebe ligação).',
  true
);