
-- Configurar business_rules para Teste Ergométrico - Dr. Marcelo
INSERT INTO public.business_rules (
  cliente_id,
  medico_id,
  ativo,
  config,
  version
)
VALUES (
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054',  -- IPADO (correto)
  '9d5d0e63-098b-4282-aa03-db3c7e012579',  -- Teste Ergométrico - Dr. Marcelo (correto)
  true,
  '{
    "tipo_agendamento": "ordem_chegada",
    "permite_agendamento_online": true,
    "servicos": {
      "Teste Ergométrico": {
        "ativo": true,
        "dias": [2, 3, 4],
        "periodos": {
          "manha": {
            "ativo": true,
            "inicio": "07:00",
            "fim": "12:00",
            "limite": 9,
            "dias_especificos": [3]
          },
          "tarde": {
            "ativo": true,
            "inicio": "13:00",
            "fim": "17:00",
            "limite": 9,
            "dias_especificos": [2, 4]
          },
          "noite": {
            "ativo": false
          }
        }
      }
    }
  }'::jsonb,
  1
)
ON CONFLICT (medico_id, cliente_id) 
DO UPDATE SET
  config = EXCLUDED.config,
  ativo = true,
  updated_at = now(),
  version = business_rules.version + 1;
