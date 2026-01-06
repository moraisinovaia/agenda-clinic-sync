
-- =====================================================
-- CONFIGURAÇÃO COMPLETA: Dra. Juliana Gama e Dra. Lara Eline Menezes
-- Cliente: ENDOGASTRO (39e120b4-5fb7-4d6f-9f91-a598a5bbd253)
-- =====================================================

-- =====================================================
-- PARTE 1: ATENDIMENTOS PARA DRA. JULIANA GAMA
-- =====================================================

-- Consulta Gastroenterológica e Hepatologia
INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, valor_particular, ativo)
SELECT 
  'Consulta Gastroenterológica e Hepatologia',
  'consulta',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'efc2ec87-21dd-4e10-b327-50d83df7daac',
  'Dra. Juliana Gama',
  500.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Consulta Gastroenterológica e Hepatologia' 
  AND medico_id = 'efc2ec87-21dd-4e10-b327-50d83df7daac'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- Endoscopia (EDA)
INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, valor_particular, ativo)
SELECT 
  'Endoscopia (EDA)',
  'exame',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'efc2ec87-21dd-4e10-b327-50d83df7daac',
  'Dra. Juliana Gama',
  500.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Endoscopia (EDA)' 
  AND medico_id = 'efc2ec87-21dd-4e10-b327-50d83df7daac'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- Colonoscopia
INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, valor_particular, ativo)
SELECT 
  'Colonoscopia',
  'exame',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  'efc2ec87-21dd-4e10-b327-50d83df7daac',
  'Dra. Juliana Gama',
  700.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Colonoscopia' 
  AND medico_id = 'efc2ec87-21dd-4e10-b327-50d83df7daac'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- =====================================================
-- PARTE 2: ATENDIMENTOS PARA DRA. LARA ELINE MENEZES
-- =====================================================

-- Consulta Gastroenterológica e Hepatologia
INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, valor_particular, ativo)
SELECT 
  'Consulta Gastroenterológica e Hepatologia',
  'consulta',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '3dd16059-102a-4626-a2ac-2517f0e5c195',
  'Dra. Lara Eline Menezes',
  500.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Consulta Gastroenterológica e Hepatologia' 
  AND medico_id = '3dd16059-102a-4626-a2ac-2517f0e5c195'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- Retorno
INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, valor_particular, ativo)
SELECT 
  'Retorno',
  'consulta',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '3dd16059-102a-4626-a2ac-2517f0e5c195',
  'Dra. Lara Eline Menezes',
  0.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Retorno' 
  AND medico_id = '3dd16059-102a-4626-a2ac-2517f0e5c195'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- Endoscopia (EDA)
INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, valor_particular, ativo)
SELECT 
  'Endoscopia (EDA)',
  'exame',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '3dd16059-102a-4626-a2ac-2517f0e5c195',
  'Dra. Lara Eline Menezes',
  500.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Endoscopia (EDA)' 
  AND medico_id = '3dd16059-102a-4626-a2ac-2517f0e5c195'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- Colonoscopia
INSERT INTO public.atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, valor_particular, ativo)
SELECT 
  'Colonoscopia',
  'exame',
  '39e120b4-5fb7-4d6f-9f91-a598a5bbd253',
  '3dd16059-102a-4626-a2ac-2517f0e5c195',
  'Dra. Lara Eline Menezes',
  700.00,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.atendimentos 
  WHERE nome = 'Colonoscopia' 
  AND medico_id = '3dd16059-102a-4626-a2ac-2517f0e5c195'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
);

-- =====================================================
-- PARTE 3: ATUALIZAR MÉDICOS
-- =====================================================

-- Dra. Juliana Gama
UPDATE public.medicos
SET 
  idade_minima = 16,
  observacoes = 'GASTRO E HEPATO - Convênios: Bradesco, Mineração, FACHESF (exceto carteiras nº 43), FUSEX, Postal, Assefaz, Codevasf, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular, Agenda Vale, Medprev. Pagamento particular: R$ 500,00 (espécie ou PIX). COLONOSCOPIA: NÃO FAZ PELO MEDPREV. Agenda: Segunda e Quinta - EDA 08:00 (4 pac, ficha 15m antes às 09:00), Consulta 11:00-12:00 (5 pac, ficha 15m antes às 12:00), Colonoscopia 09:00 (1 pac).',
  updated_at = now()
WHERE id = 'efc2ec87-21dd-4e10-b327-50d83df7daac';

-- Dra. Lara Eline Menezes
UPDATE public.medicos
SET 
  idade_minima = 15,
  observacoes = 'GASTRO E HEPATO - A MÉDICA DÁ NOTA FISCAL. Convênios: Bradesco, Mineração, FACHESF (exceto carteiras nº 43), FUSEX, Postal, Assefaz, Codevasf, Cassi, Asfeb, Compesa, Casseb, CapSaúde, Particular, Agenda Vale, Medprev. Pagamento particular: R$ 500,00 (espécie ou PIX). COLONOSCOPIA: APENAS PACIENTES COM MENOS DE 65 ANOS. Agenda: Segunda (consultas manhã), Quarta (consultas 14:30), Quinta (consultas tarde), Sexta (particular 11h + colono 10h). EDA: Quinta/Sexta/Sábado 08:00 (8 pac). Colonoscopia em datas específicas.',
  updated_at = now()
WHERE id = '3dd16059-102a-4626-a2ac-2517f0e5c195';

-- =====================================================
-- PARTE 4: BUSINESS RULES - DRA. JULIANA GAMA
-- =====================================================

UPDATE public.business_rules
SET 
  config = '{
    "nome": "Dra. Juliana Gama",
    "especialidade": "Gastroenterologia e Hepatologia",
    "idade_minima": 16,
    "tipo_agendamento": "ordem_chegada",
    "convenios_aceitos": [
      "Bradesco",
      "Mineração",
      "FACHESF",
      "FUSEX",
      "Postal",
      "Assefaz",
      "Codevasf",
      "Cassi",
      "Asfeb",
      "Compesa",
      "Casseb",
      "CapSaúde",
      "Particular",
      "Agenda Vale",
      "Medprev"
    ],
    "restricoes": {
      "fachesf": "Não atende carteiras FACHESF que começam com nº 43"
    },
    "forma_pagamento": {
      "particular": {
        "valor": 500,
        "formas": ["Espécie", "PIX"]
      }
    },
    "agenda_fixa": false,
    "servicos": {
      "Consulta Gastroenterológica e Hepatologia": {
        "tipo": "consulta",
        "disponivel_online": true,
        "horarios_por_dia": {
          "1": {
            "manha": {
              "ativo": true,
              "hora_inicio": "11:00",
              "hora_fim": "12:30",
              "limite_pacientes": 5,
              "hora_ficha": "12:00",
              "ficha_antecedencia_minutos": 15
            }
          },
          "4": {
            "manha": {
              "ativo": true,
              "hora_inicio": "11:00",
              "hora_fim": "12:30",
              "limite_pacientes": 5,
              "hora_ficha": "12:00",
              "ficha_antecedencia_minutos": 15
            }
          }
        }
      },
      "Endoscopia (EDA)": {
        "tipo": "exame",
        "disponivel_online": true,
        "horarios_por_dia": {
          "1": {
            "manha": {
              "ativo": true,
              "hora_inicio": "08:00",
              "hora_fim": "10:00",
              "limite_pacientes": 4,
              "hora_ficha": "09:00",
              "ficha_antecedencia_minutos": 15
            }
          },
          "4": {
            "manha": {
              "ativo": true,
              "hora_inicio": "08:00",
              "hora_fim": "10:00",
              "limite_pacientes": 4,
              "hora_ficha": "09:00",
              "ficha_antecedencia_minutos": 15
            }
          }
        }
      },
      "Colonoscopia": {
        "tipo": "exame",
        "disponivel_online": true,
        "restricao_convenio": "Não faz colonoscopia pelo MedPrev",
        "convenios_excluidos": ["Medprev"],
        "horarios_por_dia": {
          "1": {
            "manha": {
              "ativo": true,
              "hora_inicio": "09:00",
              "hora_fim": "10:00",
              "limite_pacientes": 1
            }
          },
          "4": {
            "manha": {
              "ativo": true,
              "hora_inicio": "09:00",
              "hora_fim": "10:00",
              "limite_pacientes": 1
            }
          }
        }
      }
    }
  }'::jsonb,
  updated_at = now()
WHERE medico_id = 'efc2ec87-21dd-4e10-b327-50d83df7daac'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';

-- =====================================================
-- PARTE 5: BUSINESS RULES - DRA. LARA ELINE MENEZES
-- =====================================================

UPDATE public.business_rules
SET 
  config = '{
    "nome": "Dra. Lara Eline Menezes",
    "especialidade": "Gastroenterologia e Hepatologia",
    "idade_minima": 15,
    "tipo_agendamento": "ordem_chegada",
    "observacao_especial": "A médica dá nota fiscal",
    "convenios_aceitos": [
      "Bradesco",
      "Mineração",
      "FACHESF",
      "FUSEX",
      "Postal",
      "Assefaz",
      "Codevasf",
      "Cassi",
      "Asfeb",
      "Compesa",
      "Casseb",
      "CapSaúde",
      "Particular",
      "Agenda Vale",
      "Medprev"
    ],
    "restricoes": {
      "fachesf": "Não atende carteiras FACHESF que começam com nº 43"
    },
    "forma_pagamento": {
      "particular": {
        "valor": 500,
        "formas": ["Espécie", "PIX"]
      }
    },
    "agenda_fixa": false,
    "servicos": {
      "Consulta Gastroenterológica e Hepatologia": {
        "tipo": "consulta",
        "disponivel_online": true,
        "horarios_por_dia": {
          "1": {
            "manha": {
              "ativo": true,
              "hora_inicio": "08:30",
              "hora_fim": "10:00",
              "limite_pacientes": 4,
              "hora_ficha": "08:30",
              "ficha_antecedencia_minutos": 30
            }
          },
          "3": {
            "tarde": {
              "ativo": true,
              "hora_inicio": "14:30",
              "hora_fim": "16:00",
              "limite_pacientes": 4,
              "hora_ficha": "14:00",
              "ficha_antecedencia_minutos": 30
            }
          },
          "4": {
            "tarde": {
              "ativo": true,
              "hora_inicio": "14:30",
              "hora_fim": "16:00",
              "limite_pacientes": 4,
              "hora_ficha": "14:30",
              "ficha_antecedencia_minutos": 15
            }
          }
        }
      },
      "Retorno": {
        "tipo": "consulta",
        "disponivel_online": true,
        "horarios_por_dia": {
          "1": {
            "manha": {
              "ativo": true,
              "hora_inicio": "09:00",
              "hora_fim": "10:30",
              "limite_pacientes": 4,
              "hora_ficha": "09:00",
              "ficha_antecedencia_minutos": 30
            }
          },
          "3": {
            "tarde": {
              "ativo": true,
              "hora_inicio": "15:00",
              "hora_fim": "16:00",
              "limite_pacientes": 4,
              "hora_ficha": "15:00",
              "ficha_antecedencia_minutos": 30,
              "observacao": "Ficha só até 15:00"
            }
          },
          "4": {
            "tarde": {
              "ativo": true,
              "hora_inicio": "15:00",
              "hora_fim": "16:00",
              "limite_pacientes": 4,
              "hora_ficha": "15:00",
              "ficha_antecedencia_minutos": 15
            }
          }
        }
      },
      "Consulta Particular": {
        "tipo": "consulta",
        "disponivel_online": true,
        "apenas_particular": true,
        "horarios_por_dia": {
          "5": {
            "manha": {
              "ativo": true,
              "hora_inicio": "11:00",
              "hora_fim": "13:00",
              "limite_pacientes": 4,
              "hora_ficha": "12:00",
              "ficha_antecedencia_minutos": 30
            }
          }
        }
      },
      "Endoscopia (EDA)": {
        "tipo": "exame",
        "disponivel_online": true,
        "horarios_por_dia": {
          "4": {
            "manha": {
              "ativo": true,
              "hora_inicio": "08:00",
              "hora_fim": "10:00",
              "limite_pacientes": 8,
              "pacientes_por_hora": 4,
              "hora_ficha_inicio": "07:30",
              "hora_ficha_fim": "09:00"
            }
          },
          "5": {
            "manha": {
              "ativo": true,
              "hora_inicio": "08:00",
              "hora_fim": "10:00",
              "limite_pacientes": 8,
              "pacientes_por_hora": 4,
              "hora_ficha_inicio": "07:30",
              "hora_ficha_fim": "09:00"
            }
          },
          "6": {
            "manha": {
              "ativo": true,
              "hora_inicio": "08:00",
              "hora_fim": "10:00",
              "limite_pacientes": 8,
              "pacientes_por_hora": 4,
              "hora_ficha_inicio": "07:30",
              "hora_ficha_fim": "09:00"
            }
          }
        }
      },
      "Colonoscopia": {
        "tipo": "exame",
        "disponivel_online": true,
        "restricao_idade": "Apenas pacientes com menos de 65 anos",
        "idade_maxima": 64,
        "observacao": "Sempre verificar agenda - colonoscopia em datas específicas",
        "horarios_por_dia": {
          "1": {
            "tarde": {
              "ativo": true,
              "hora_inicio": "13:00",
              "hora_fim": "14:00",
              "limite_pacientes": 3,
              "datas_especificas": ["2024-11-17", "2024-11-24", "2024-12-08", "2024-12-22", "2024-12-29"]
            }
          },
          "3": {
            "tarde": {
              "ativo": true,
              "hora_inicio": "13:00",
              "hora_fim": "14:00",
              "limite_pacientes": 2,
              "datas_especificas": ["2024-11-19", "2024-11-26"]
            }
          },
          "5": {
            "manha": {
              "ativo": true,
              "hora_inicio": "10:00",
              "hora_fim": "11:00",
              "limite_pacientes": 1
            },
            "tarde": {
              "ativo": true,
              "hora_inicio": "13:00",
              "hora_fim": "14:30",
              "limite_pacientes": 4,
              "datas_especificas": ["2024-11-14", "2024-11-21", "2024-11-28"]
            }
          }
        }
      }
    }
  }'::jsonb,
  updated_at = now()
WHERE medico_id = '3dd16059-102a-4626-a2ac-2517f0e5c195'
  AND cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253';
