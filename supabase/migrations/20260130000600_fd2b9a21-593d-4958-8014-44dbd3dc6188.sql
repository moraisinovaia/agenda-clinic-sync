
-- Corrigir estrutura de periodos do MRPA para ser compatível com a API
UPDATE business_rules
SET config = jsonb_set(
  config,
  '{servicos,MRPA,periodos}',
  '{
    "manha": {
      "ativo": true,
      "atendimento_inicio": "08:00",
      "limite": 5,
      "dias_especificos": [2, 3, 4],
      "distribuicao_fichas": "07:00 às 09:00 para fazer a ficha",
      "inicio": "07:00",
      "fim": "09:00",
      "contagem_inicio": "07:00",
      "contagem_fim": "12:00"
    },
    "tarde": {
      "ativo": true,
      "atendimento_inicio": "13:30",
      "limite": 5,
      "dias_especificos": [2, 3, 4],
      "distribuicao_fichas": "13:00 às 15:00 para fazer a ficha",
      "inicio": "13:00",
      "fim": "15:00",
      "contagem_inicio": "12:00",
      "contagem_fim": "18:00"
    }
  }'::jsonb
),
    updated_at = now(),
    version = version + 1
WHERE id = '592bfe3b-08d2-4bea-81c2-07f5fb8b1c06';

-- Adicionar campo ativo ao serviço MRPA
UPDATE business_rules
SET config = jsonb_set(config, '{servicos,MRPA,ativo}', 'true'::jsonb),
    updated_at = now()
WHERE id = '592bfe3b-08d2-4bea-81c2-07f5fb8b1c06';
