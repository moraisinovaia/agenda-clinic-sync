-- Corrigir business_rules com a configuração correta para Dr. Edson
-- Inclui todos os 3 serviços com seus limites e configurações

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
      "limite_diario": 3,
      "grupo_limite": null,
      "horario_inicio": "08:00",
      "horario_fim": "09:00",
      "dias_semana": ["terca"],
      "requer_acompanhante": true,
      "permite_online": true
    },
    "Consulta Gastroenterológica": {
      "duracao": 30,
      "preparo": null,
      "limite_diario": 8,
      "grupo_limite": "consultas",
      "horario_inicio": "09:30",
      "horario_fim": "10:00",
      "dias_semana": ["terca"],
      "requer_acompanhante": false,
      "permite_online": true
    },
    "Retorno Gastroenterológico": {
      "duracao": 20,
      "preparo": null,
      "limite_diario": 8,
      "grupo_limite": "consultas",
      "horario_inicio": "09:30",
      "horario_fim": "10:00",
      "dias_semana": ["terca"],
      "requer_acompanhante": false,
      "permite_online": true
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