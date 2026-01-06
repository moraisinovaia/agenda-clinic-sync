-- Atualizar business_rules do Dr. Max Koki com horários de consultas e retornos
UPDATE business_rules
SET 
  config = jsonb_set(
    config,
    '{servicos,Consulta Cardiológica}',
    '{
      "dias_atendimento": ["terca", "quinta"],
      "idade_minima": 15,
      "valor_particular": 280,
      "periodos": {
        "terca": {
          "periodo": "tarde",
          "consultas": {
            "quantidade": 5,
            "horario_inicio": "14:00",
            "horario_fim": "15:00"
          },
          "retornos": {
            "quantidade": 3,
            "horario_inicio": "14:30",
            "horario_fim": "15:00"
          }
        },
        "quinta": {
          "periodo": "manha",
          "consultas": {
            "quantidade": 5,
            "horario_inicio": "09:00",
            "horario_fim": "11:00"
          },
          "retornos": {
            "quantidade": 3,
            "horario_inicio": "10:00",
            "horario_fim": "11:00"
          }
        }
      }
    }'::jsonb
  ),
  updated_at = NOW(),
  version = version + 1
WHERE id = '22fdbb8b-ac75-430c-b5ff-2339663aef86';