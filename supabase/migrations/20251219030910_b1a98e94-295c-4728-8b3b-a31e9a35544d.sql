-- Atualizar business rules do Dr. Edson Batista
UPDATE business_rules 
SET config = '{
  "nome": "Dr. Edson Batista",
  "idade_minima": 18,
  "idade_maxima": null,
  "tipo_agendamento": "ordem_chegada",
  "permite_agendamento_online": true,
  "convenios": [
    "UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", 
    "UNIMED 40%", "UNIMED 20%", "PARTICULAR", "SAÚDE BRADESCO", 
    "CASSI", "CAPSAUDE", "POSTAL SAÚDE", "CAMED", "MINERAÇÃO CARAÍBA", 
    "FACHESF", "FUSEX", "ASSEFAZ", "CODEVASF", "CASSIC", "ASFEB", 
    "COMPESA", "CASSEB"
  ],
  "servicos": {
    "Endoscopia Digestiva Alta": {
      "tipo": "ordem_chegada",
      "dias_semana": [2],
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "08:00",
          "fim": "09:00",
          "limite": 4,
          "atendimento_inicio": "08:00",
          "distribuicao_fichas": "08:00 às 09:00"
        }
      }
    },
    "Consulta Gastroenterológica": {
      "tipo": "ordem_chegada",
      "dias_semana": [2],
      "permite_online": true,
      "periodos": {
        "manha": {
          "inicio": "09:30",
          "fim": "10:00",
          "limite": 8,
          "atendimento_inicio": "Após exames",
          "distribuicao_fichas": "09:30 às 10:00"
        }
      }
    },
    "Retorno Gastroenterológico": {
      "tipo": "ordem_chegada",
      "dias_semana": [2],
      "permite_online": true,
      "compartilha_limite_com": "Consulta Gastroenterológica",
      "periodos": {
        "manha": {
          "inicio": "09:30",
          "fim": "10:00",
          "limite": 8,
          "atendimento_inicio": "Após exames",
          "distribuicao_fichas": "09:30 às 10:00"
        }
      }
    }
  }
}'::jsonb,
updated_at = now()
WHERE medico_id = 'cdbfc594-d3de-459f-a9c1-a3f29842273e'
AND cliente_id = '2bfb98b5-ae41-4f96-8ba7-acc797c22054';