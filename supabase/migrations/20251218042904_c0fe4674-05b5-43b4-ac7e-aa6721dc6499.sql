
-- Inserir business_rules para os médicos da Clínica Vênus
-- Baseado no BUSINESS_RULES_VENUS hardcoded em llm-agent-api-venus

-- Dr. João Silva - Cardiologista
INSERT INTO business_rules (cliente_id, medico_id, config, ativo, version)
VALUES (
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a', -- Clínica Vênus
  '25440cf9-7832-4034-9e2a-9d8ee9b4d12d', -- Dr. João Silva
  '{
    "nome": "DR. JOÃO SILVA",
    "especialidade": "Cardiologista",
    "tipo_agendamento": "hora_marcada",
    "servicos": {
      "Consulta Cardiológica": {
        "permite_online": true,
        "tipo": "hora_marcada",
        "dias_semana": [1, 3, 5],
        "periodos": {
          "tarde": {
            "inicio": "14:00",
            "fim": "19:00",
            "intervalo_minutos": 30,
            "limite": 6,
            "dias_especificos": [1, 3]
          },
          "manha": {
            "inicio": "08:00",
            "fim": "12:00",
            "intervalo_minutos": 30,
            "limite": 3,
            "dias_especificos": [5]
          }
        },
        "valor": 300.00,
        "retorno_gratuito_dias": 30,
        "convenios_aceitos": ["PARTICULAR", "UNIMED 40%", "UNIMED 20%", "UNIMED REGIONAL", "UNIMED INTERCAMBIO", "UNIMED NACIONAL"]
      },
      "Eletrocardiograma": {
        "permite_online": true,
        "tipo": "hora_marcada",
        "dias_semana": [1, 3, 5],
        "periodos": {
          "tarde": {
            "inicio": "14:00",
            "fim": "19:00",
            "intervalo_minutos": 20,
            "limite": 6,
            "dias_especificos": [1, 3]
          },
          "manha": {
            "inicio": "08:00",
            "fim": "12:00",
            "intervalo_minutos": 20,
            "limite": 3,
            "dias_especificos": [5]
          }
        },
        "valor": 150.00,
        "convenios_aceitos": ["PARTICULAR", "UNIMED 40%", "UNIMED 20%", "UNIMED REGIONAL", "UNIMED INTERCAMBIO", "UNIMED NACIONAL"]
      }
    }
  }'::jsonb,
  true,
  1
)
ON CONFLICT (medico_id, cliente_id) WHERE ativo = true 
DO UPDATE SET 
  config = EXCLUDED.config,
  version = business_rules.version + 1,
  updated_at = now();

-- Dra. Gabriela Batista - Gastroenterologista
INSERT INTO business_rules (cliente_id, medico_id, config, ativo, version)
VALUES (
  '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a', -- Clínica Vênus
  '4361d620-4c9b-4602-aab1-e835cc63c8a2', -- Dra. Gabriela Batista
  '{
    "nome": "DRA. GABRIELA BATISTA",
    "especialidade": "Gastroenterologista",
    "tipo_agendamento": "hora_marcada",
    "servicos": {
      "Consulta Gastroenterológica": {
        "permite_online": true,
        "tipo": "hora_marcada",
        "dias_semana": [2, 4, 6],
        "periodos": {
          "integral": {
            "inicio": "08:00",
            "fim": "16:00",
            "intervalo_minutos": 30,
            "limite": 8,
            "dias_especificos": [2, 4]
          },
          "manha": {
            "inicio": "08:00",
            "fim": "12:00",
            "intervalo_minutos": 30,
            "limite": 4,
            "dias_especificos": [6]
          }
        },
        "valor": 280.00,
        "retorno_gratuito_dias": 20,
        "convenios_aceitos": ["PARTICULAR", "UNIMED 40%", "UNIMED 20%", "UNIMED REGIONAL", "UNIMED INTERCAMBIO", "UNIMED NACIONAL"]
      },
      "Endoscopia Digestiva Alta": {
        "permite_online": true,
        "tipo": "hora_marcada",
        "dias_semana": [2, 4, 6],
        "periodos": {
          "integral": {
            "inicio": "08:00",
            "fim": "16:00",
            "intervalo_minutos": 30,
            "limite": 8,
            "dias_especificos": [2, 4]
          },
          "manha": {
            "inicio": "08:00",
            "fim": "12:00",
            "intervalo_minutos": 30,
            "limite": 4,
            "dias_especificos": [6]
          }
        },
        "valor": 500.00,
        "convenios_aceitos": ["PARTICULAR", "UNIMED 40%", "UNIMED 20%", "UNIMED REGIONAL", "UNIMED INTERCAMBIO", "UNIMED NACIONAL"],
        "requer_preparo": true
      }
    }
  }'::jsonb,
  true,
  1
)
ON CONFLICT (medico_id, cliente_id) WHERE ativo = true 
DO UPDATE SET 
  config = EXCLUDED.config,
  version = business_rules.version + 1,
  updated_at = now();

-- Atualizar llm_clinic_config com informações completas
UPDATE llm_clinic_config
SET 
  endereco = 'Rua das Orquídeas, 210 – Centro, Cidade Vênus – SP',
  whatsapp = '(11) 90000-0000',
  telefone = '(11) 4000-0000',
  mensagem_bloqueio_padrao = 'Para agendamento fora do horário online, entre em contato pelo WhatsApp: (11) 90000-0000',
  updated_at = now()
WHERE cliente_id = '20747f3c-8fa1-4f7e-8817-a55a8a6c8e0a';
