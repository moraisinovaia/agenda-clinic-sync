-- Padronizar TODOS os business_rules da IPADO para formato correto da API
-- Formato esperado: servicos > Serviço > periodos > manha/tarde > dias_especificos (numérico)

-- 1. Dr. Alessandro Dias - Converter dias_semana para periodos.dias_especificos
UPDATE business_rules 
SET config = jsonb_set(
  jsonb_set(
    config,
    '{servicos,Ecocardiograma,periodos}',
    '{
      "manha": {
        "inicio": "07:00",
        "fim": "12:00",
        "limite": 12,
        "dias_especificos": [1]
      }
    }'::jsonb
  ),
  '{servicos,Ecocardiograma}',
  (config->'servicos'->'Ecocardiograma') - 'dias_semana' || '{"periodos": {"manha": {"inicio": "07:00", "fim": "12:00", "limite": 12, "dias_especificos": [1]}}}'::jsonb
)
WHERE medico_id = 'c192e08e-e216-4c22-99bf-b5992ce05e17';

-- 2. Dr. Sydney Ribeiro - Converter todos os serviços para formato correto
UPDATE business_rules 
SET config = '{
  "nome": "Dr. Sydney Ribeiro",
  "tipo_agendamento": "ordem_chegada",
  "permite_agendamento_online": true,
  "idade_minima": null,
  "idade_maxima": null,
  "convenios_aceitos": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "PARTICULAR", "SAÚDE BRADESCO", "CASSI", "CAPSAUDE", "POSTAL SAÚDE", "CAMED", "MINERAÇÃO CARAÍBA", "FACHESF", "FUSEX", "ASSEFAZ", "CODEVASF", "CASSIC", "ASFEB", "COMPESA", "CASSEB"],
  "servicos": {
    "Colonoscopia": {
      "duracao": 30,
      "preparo": "colonoscopia_padrao",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 8,
          "dias_especificos": [1, 4]
        }
      }
    },
    "Endoscopia Digestiva Alta": {
      "duracao": 20,
      "preparo": "jejum_8h",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 8,
          "dias_especificos": [1, 4]
        }
      }
    },
    "Colonoscopia + Endoscopia": {
      "duracao": 45,
      "preparo": "colonoscopia_padrao",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 8,
          "dias_especificos": [1, 4]
        }
      }
    },
    "Retossigmoidoscopia": {
      "duracao": 20,
      "preparo": "fleet_enema",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 8,
          "dias_especificos": [1, 4]
        }
      }
    },
    "Polipectomias": {
      "duracao": 30,
      "preparo": "colonoscopia_padrao",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 8,
          "dias_especificos": [1, 4]
        }
      }
    },
    "Consulta Gastroenterológica": {
      "duracao": 30,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Retorno Gastroenterológico",
      "periodos": {
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 12,
          "dias_especificos": [2, 4]
        }
      }
    },
    "Retorno Gastroenterológico": {
      "duracao": 20,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Consulta Gastroenterológica",
      "periodos": {
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 12,
          "dias_especificos": [2, 4]
        }
      }
    }
  }
}'::jsonb
WHERE medico_id = '380fc7d2-9587-486b-a968-46556dfc7401';

-- 3. Dra. Adriana Carla de Sena - Converter dias_semana para periodos.dias_especificos
UPDATE business_rules 
SET config = '{
  "nome": "Dra. Adriana Carla de Sena",
  "tipo_agendamento": "hora_marcada",
  "permite_agendamento_online": true,
  "idade_minima": null,
  "idade_maxima": null,
  "convenios_aceitos": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "PARTICULAR", "SAÚDE BRADESCO", "CASSI", "CAPSAUDE", "POSTAL SAÚDE", "CAMED", "MINERAÇÃO CARAÍBA", "FACHESF", "FUSEX", "ASSEFAZ", "CODEVASF", "CASSIC", "ASFEB", "COMPESA", "CASSEB"],
  "servicos": {
    "Consulta Gastroenterológica": {
      "duracao": 30,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Retorno Gastroenterológico",
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 8,
          "dias_especificos": [1, 2, 3, 4, 5]
        },
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 8,
          "dias_especificos": [2, 3]
        }
      }
    },
    "Retorno Gastroenterológico": {
      "duracao": 20,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Consulta Gastroenterológica",
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 8,
          "dias_especificos": [1, 2, 3, 4, 5]
        },
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 8,
          "dias_especificos": [2, 3]
        }
      }
    }
  }
}'::jsonb
WHERE medico_id = '32d30887-b876-4502-bf04-e55d7fb55b50';

-- 4. Dr. Dilson Pereira - Adicionar periodos.dias_especificos dentro de cada serviço
UPDATE business_rules 
SET config = '{
  "nome": "Dr. Dilson Pereira",
  "tipo_agendamento": "ordem_chegada",
  "permite_agendamento_online": true,
  "idade_minima": null,
  "idade_maxima": null,
  "convenios_aceitos": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "PARTICULAR", "SAÚDE BRADESCO", "CASSI", "CAPSAUDE", "POSTAL SAÚDE", "CAMED", "MINERAÇÃO CARAÍBA", "FACHESF", "FUSEX", "ASSEFAZ", "CODEVASF", "CASSIC", "ASFEB", "COMPESA", "CASSEB"],
  "servicos": {
    "Endoscopia Digestiva Alta": {
      "duracao": 20,
      "preparo": "jejum_8h",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 10,
          "dias_especificos": [3, 5, 6]
        }
      }
    },
    "Colonoscopia": {
      "duracao": 30,
      "preparo": "colonoscopia_padrao",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 10,
          "dias_especificos": [2, 3, 5, 6]
        }
      }
    },
    "Colonoscopia + Endoscopia": {
      "duracao": 45,
      "preparo": "colonoscopia_padrao",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 10,
          "dias_especificos": [2, 3, 5, 6]
        }
      }
    },
    "Consulta Proctológica": {
      "duracao": 30,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Retorno Proctológico",
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 12,
          "dias_especificos": [1, 3, 5]
        }
      }
    },
    "Retorno Proctológico": {
      "duracao": 20,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Consulta Proctológica",
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 12,
          "dias_especificos": [1, 3, 5]
        }
      }
    },
    "Retossigmoidoscopia": {
      "duracao": 20,
      "preparo": "fleet_enema",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 10,
          "dias_especificos": [2, 3, 5, 6]
        }
      }
    },
    "Ligadura Elástica": {
      "duracao": 20,
      "preparo": "fleet_enema",
      "requer_acompanhante": true,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 10,
          "dias_especificos": [2, 3, 5, 6]
        }
      }
    }
  }
}'::jsonb
WHERE medico_id = '20046e90-52cf-44d7-9586-748f55884bd2';

-- 5. Dr. Marcelo D'Carli - Converter de array para objeto e dias string para numérico
UPDATE business_rules 
SET config = '{
  "nome": "Dr. Marcelo DCarli",
  "tipo_agendamento": "hora_marcada",
  "permite_agendamento_online": true,
  "idade_minima": null,
  "idade_maxima": null,
  "convenios_aceitos": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "PARTICULAR", "SAÚDE BRADESCO", "CASSI", "CAPSAUDE", "POSTAL SAÚDE", "CAMED", "MINERAÇÃO CARAÍBA", "FACHESF", "FUSEX", "ASSEFAZ", "CODEVASF", "CASSIC", "ASFEB", "COMPESA", "CASSEB"],
  "servicos": {
    "Consulta Cardiológica": {
      "duracao": 30,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Retorno Cardiológico",
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 12,
          "dias_especificos": [1, 2, 3, 4, 5]
        },
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 8,
          "dias_especificos": [1, 3]
        }
      }
    },
    "Retorno Cardiológico": {
      "duracao": 20,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Consulta Cardiológica",
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 12,
          "dias_especificos": [1, 2, 3, 4, 5]
        },
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 8,
          "dias_especificos": [1, 3]
        }
      }
    },
    "Parecer Cardiológico": {
      "duracao": 30,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 12,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    },
    "Exame Cardiológico": {
      "duracao": 30,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "12:00",
          "limite": 12,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    }
  }
}'::jsonb
WHERE medico_id = '1e110923-50df-46ff-a57a-29d88e372900';

-- 6. Dr. Pedro Francisco - Converter de array para objeto e dias string para numérico
UPDATE business_rules 
SET config = '{
  "nome": "Dr. Pedro Francisco",
  "tipo_agendamento": "hora_marcada",
  "permite_agendamento_online": true,
  "idade_minima": null,
  "idade_maxima": null,
  "convenios_aceitos": ["UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "PARTICULAR", "SAÚDE BRADESCO", "CASSI", "CAPSAUDE", "POSTAL SAÚDE", "CAMED", "MINERAÇÃO CARAÍBA", "FACHESF", "FUSEX", "ASSEFAZ", "CODEVASF", "CASSIC", "ASFEB", "COMPESA", "CASSEB"],
  "servicos": {
    "Consulta Gastroenterológica": {
      "duracao": 30,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Retorno Gastroenterológico",
      "periodos": {
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 12,
          "dias_especificos": [2]
        }
      }
    },
    "Retorno Gastroenterológico": {
      "duracao": 20,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "compartilha_limite_com": "Consulta Gastroenterológica",
      "periodos": {
        "tarde": {
          "inicio": "14:00",
          "fim": "18:00",
          "limite": 12,
          "dias_especificos": [2]
        }
      }
    },
    "USG Abdome Total": {
      "duracao": 30,
      "preparo": "jejum_8h",
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 15,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    },
    "USG Abdome Superior": {
      "duracao": 20,
      "preparo": "jejum_8h",
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 15,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    },
    "USG Vias Urinárias": {
      "duracao": 20,
      "preparo": "bexiga_cheia",
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 15,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    },
    "USG Próstata": {
      "duracao": 20,
      "preparo": "bexiga_cheia",
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 15,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    },
    "USG Tireoide": {
      "duracao": 20,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 15,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    },
    "USG Pélvica": {
      "duracao": 20,
      "preparo": "bexiga_cheia",
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 15,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    },
    "USG Mama": {
      "duracao": 20,
      "preparo": null,
      "requer_acompanhante": false,
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "07:00",
          "fim": "12:00",
          "limite": 15,
          "dias_especificos": [1, 2, 3, 4, 5]
        }
      }
    }
  }
}'::jsonb
WHERE medico_id = '66e9310d-34cd-4005-8937-74e87125dc03';