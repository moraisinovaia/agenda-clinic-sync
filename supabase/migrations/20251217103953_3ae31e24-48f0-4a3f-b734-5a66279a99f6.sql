-- Inserir configuração da clínica ENDOGASTRO
INSERT INTO llm_clinic_config (
  cliente_id,
  nome_clinica,
  dias_busca_inicial,
  dias_busca_expandida,
  mensagem_bloqueio_padrao,
  ativo
) VALUES (
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'ENDOGASTRO',
  14,
  45,
  'No momento não há disponibilidade para agendamento. Entre em contato com a recepção.',
  true
) ON CONFLICT (cliente_id) DO UPDATE SET
  nome_clinica = EXCLUDED.nome_clinica,
  dias_busca_inicial = EXCLUDED.dias_busca_inicial,
  dias_busca_expandida = EXCLUDED.dias_busca_expandida,
  mensagem_bloqueio_padrao = EXCLUDED.mensagem_bloqueio_padrao,
  updated_at = now();

-- Inserir business rules para Dr. Heverson Alex
INSERT INTO business_rules (
  cliente_id,
  medico_id,
  config,
  ativo,
  version
) VALUES (
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'fdb7862c-e83d-4294-a36c-a61f177c9487',
  '{
    "tipo_agendamento": "ordem_chegada",
    "convenios": ["UNIMED", "MED PREV", "AGENDA VALE", "DR.EXAMES", "CLINCENTER", "MED CENTER", "MINERAÇÃO"],
    "idade_minima": 15,
    "servicos": {
      "consulta": true,
      "ecg": true,
      "teste_ergometrico": true,
      "mapa": true,
      "holter": true,
      "ecocardiograma": false
    },
    "restricoes": {
      "ecg_teste_intervalo_dias": 15,
      "unimed_consulta_com_ecg": true,
      "holter_mapa_nao_aceita_unimed": true,
      "ordem_agendamento": "exames_primeiro"
    },
    "horarios": {
      "segunda": {
        "consulta": { "inicio": "09:00", "fim": "09:30", "limite": 6, "distribuicao_fichas": { "inicio": "08:00", "fim": "09:30" } },
        "ecg": { "inicio": "07:00", "fim": "09:00", "limite": 7, "distribuicao_fichas": { "inicio": "07:00", "fim": "09:00" } }
      },
      "quinta": {
        "teste_ergometrico": { "inicio": "14:00", "fim": "15:00", "limite": 4, "distribuicao_fichas": { "inicio": "13:30", "fim": "15:20" } },
        "ecg": { "inicio": "13:00", "fim": "15:00", "limite": 7, "distribuicao_fichas": { "inicio": "13:00", "fim": "15:00" } },
        "consulta": { "inicio": "15:30", "fim": "16:30", "limite": 5, "distribuicao_fichas": { "inicio": "15:45", "fim": "16:30" } },
        "retorno": { "inicio": "15:30", "fim": "16:30", "limite": 3, "distribuicao_fichas": { "inicio": "15:45", "fim": "16:30" } }
      },
      "terca": {
        "mapa": { "inicio": "08:00", "limite": 2 },
        "holter": { "inicio": "08:00", "limite": 2 }
      }
    },
    "mapa_holter_schedule": {
      "terca": { "mapa": 2, "holter": 0 },
      "quinta": { "mapa": 2, "holter": 2 }
    },
    "notas": "ECG + Teste Ergométrico: intervalo mínimo de 15 dias. UNIMED sempre faz consulta + ECG juntos. MAPA/Holter NÃO aceita pela UNIMED."
  }'::jsonb,
  true,
  1
) ON CONFLICT (medico_id, cliente_id) DO UPDATE SET
  config = EXCLUDED.config,
  updated_at = now(),
  version = business_rules.version + 1;

-- Inserir business rules para Dr. Max Koki
INSERT INTO business_rules (
  cliente_id,
  medico_id,
  config,
  ativo,
  version
) VALUES (
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '84f434dc-21f6-41a9-962e-9b0722a0e2d4',
  '{
    "tipo_agendamento": "ordem_chegada",
    "convenios": ["PARTICULAR", "MED PREV", "AGENDA VALE", "DR.EXAMES", "CLINCENTER", "MED CENTER"],
    "idade_minima": 15,
    "idade_minima_eco": 18,
    "servicos": {
      "consulta": true,
      "ecg": true,
      "teste_ergometrico": true,
      "mapa": true,
      "holter": true,
      "ecocardiograma": false
    },
    "restricoes": {
      "nao_aceita_unimed": true,
      "nao_mistura_exames": true,
      "consulta_ecg_permitido": true,
      "ordem_agendamento": "exames_primeiro"
    },
    "horarios": {
      "terca": {
        "consulta": { "inicio": "14:00", "fim": "15:00", "limite": 5, "distribuicao_fichas": { "inicio": "14:00", "fim": "15:00" } },
        "retorno": { "inicio": "14:30", "fim": "15:00", "limite": 3, "distribuicao_fichas": { "inicio": "14:30", "fim": "15:00" } },
        "ecg": { "inicio": "13:00", "fim": "16:00", "limite": 8, "distribuicao_fichas": { "inicio": "13:00", "fim": "16:00" } },
        "teste_ergometrico": { "inicio": "15:00", "fim": "16:00", "limite": 3, "distribuicao_fichas": { "inicio": "15:00", "fim": "16:00" } },
        "mapa": { "inicio": "08:00", "limite": 2 },
        "holter": { "inicio": "08:00", "limite": 2 }
      },
      "quinta": {
        "consulta": { "inicio": "09:00", "fim": "11:00", "limite": 5, "distribuicao_fichas": { "inicio": "09:00", "fim": "11:00" } },
        "retorno": { "inicio": "10:00", "fim": "11:00", "limite": 3, "distribuicao_fichas": { "inicio": "10:00", "fim": "11:00" } },
        "ecg": { "inicio": "13:00", "fim": "16:00", "limite": 8, "distribuicao_fichas": { "inicio": "13:00", "fim": "16:00" } },
        "teste_ergometrico": { "inicio": "15:00", "fim": "16:20", "limite": 3, "distribuicao_fichas": { "inicio": "15:00", "fim": "16:20" } },
        "mapa": { "inicio": "08:00", "limite": 2 },
        "holter": { "inicio": "08:00", "limite": 2 }
      }
    },
    "mapa_holter_schedule": {
      "terca": { "mapa": 2, "holter": 0 },
      "quinta": { "mapa": 2, "holter": 0 },
      "quarta": { "holter": 2, "mapa": 0 }
    },
    "notas": "NÃO aceita UNIMED. NÃO mistura exames (só Consulta + ECG é permitido). ECO: idade mínima 18 anos."
  }'::jsonb,
  true,
  1
) ON CONFLICT (medico_id, cliente_id) DO UPDATE SET
  config = EXCLUDED.config,
  updated_at = now(),
  version = business_rules.version + 1;