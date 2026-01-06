-- Corrigir business_rules com o formato correto de dias (periodos ao invés de dias_semana)
-- A API espera: servicos > Serviço > periodos > manha/tarde > dias_especificos

UPDATE business_rules 
SET config = '{
  "nome": "Dr. Edson Batista",
  "tipo_agendamento": "ordem_chegada",
  "permite_agendamento_online": true,
  "idade_minima": 18,
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
          "inicio": "08:00:00",
          "fim": "09:00:00",
          "limite": 3,
          "dias_especificos": [2]
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
        "manha": {
          "inicio": "09:30:00",
          "fim": "10:00:00",
          "limite": 8,
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
        "manha": {
          "inicio": "09:30:00",
          "fim": "10:00:00",
          "limite": 8,
          "dias_especificos": [2]
        }
      }
    }
  },
  "periodos": {
    "manha_exames": {
      "inicio": "08:00",
      "fim": "09:00",
      "servicos": ["Endoscopia Digestiva Alta"],
      "limite_pacientes": 3,
      "dias": [2]
    },
    "manha_consultas": {
      "inicio": "09:30",
      "fim": "10:00",
      "servicos": ["Consulta Gastroenterológica", "Retorno Gastroenterológico"],
      "limite_pacientes": 8,
      "dias": [2]
    }
  }
}'::jsonb
WHERE medico_id = 'cdbfc594-d3de-459f-a9c1-a3f29842273e';