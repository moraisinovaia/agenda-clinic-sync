
-- Atualizar business_rules do Dr. Edson Batista com estrutura completa
-- A estrutura precisa ter os campos que a API espera: permite_online, tipo, atendimento_id, etc.

UPDATE business_rules
SET config = jsonb_set(
  config,
  '{servicos}',
  '{
    "Endoscopia Digestiva Alta": {
      "nome": "Endoscopia Digestiva Alta",
      "tipo": "exame",
      "permite_online": true,
      "permite_agendamento_online": true,
      "tipo_agendamento": "ordem_chegada",
      "atendimento_id": "786f9f52-12fa-4389-8688-fdf3044e038f",
      "preparo": "preparo_endoscopia_simples",
      "dias_semana": [2],
      "periodos": {
        "manha": {
          "dias_especificos": [2],
          "inicio": "08:00",
          "fim": "09:00",
          "limite": 15,
          "atendimento_inicio": "08:00",
          "distribuicao_fichas": "08:00 às 09:00"
        }
      }
    },
    "Consulta Gastroenterológica": {
      "nome": "Consulta Gastroenterológica",
      "tipo": "consulta",
      "permite_online": true,
      "permite_agendamento_online": true,
      "tipo_agendamento": "ordem_chegada",
      "atendimento_id": "3db2f8fb-b5bf-481b-983a-33f34aa20696",
      "dias_semana": [2],
      "periodos": {
        "manha": {
          "dias_especificos": [2],
          "inicio": "09:30",
          "fim": "10:00",
          "limite": 10,
          "atendimento_inicio": null,
          "distribuicao_fichas": "09:30 às 10:00",
          "observacao": "Atendimento inicia após término dos exames"
        }
      }
    },
    "Retorno Gastroenterológico": {
      "nome": "Retorno Gastroenterológico",
      "tipo": "retorno",
      "permite_online": true,
      "permite_agendamento_online": true,
      "tipo_agendamento": "ordem_chegada",
      "compartilha_limite_com": "Consulta Gastroenterológica",
      "atendimento_id": "fed57dd9-9731-450b-8328-696e249416fd",
      "dias_semana": [2],
      "periodos": {
        "manha": {
          "dias_especificos": [2],
          "inicio": "09:30",
          "fim": "10:00",
          "limite": 10,
          "atendimento_inicio": null,
          "distribuicao_fichas": "09:30 às 10:00",
          "observacao": "Junto com consultas, após término dos exames"
        }
      }
    }
  }'::jsonb
),
updated_at = now()
WHERE medico_id = 'cdbfc594-d3de-459f-a9c1-a3f29842273e';
