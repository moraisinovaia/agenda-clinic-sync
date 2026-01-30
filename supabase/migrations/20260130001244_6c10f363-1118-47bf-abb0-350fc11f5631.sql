
-- Adicionar MRPA ao business_rules correto (config_id: 20b48124-ae41-4e54-8a7e-3e236b8b4829)
UPDATE business_rules
SET config = jsonb_set(
  config,
  '{servicos,MRPA}',
  '{
    "ativo": true,
    "tipo_agendamento": "ordem_chegada",
    "permite_online": true,
    "dias_semana": [2, 3, 4],
    "periodos": {
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
    },
    "valores": {"particular": 180, "particular_desconto": 160, "unimed_40": 54, "unimed_20": 27},
    "resultado": "7 dias após devolução",
    "duracao_exame": "4 dias consecutivos",
    "convenios_aceitos": ["PARTICULAR", "UNIMED VSF", "UNIMED REGIONAL", "UNIMED NACIONAL", "HGU"]
  }'::jsonb
),
    updated_at = now(),
    version = version + 1
WHERE id = '7e08a5cd-270d-4441-9baa-b6a97b7407e6';
