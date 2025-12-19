
-- 1. Criar atendimentos de Nutrição para IPADO (Dra. Lívia Barreiros)
INSERT INTO atendimentos (cliente_id, nome, tipo, medico_id, medico_nome, ativo)
VALUES 
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'Consulta Nutricional', 'consulta', 'fe51b62b-c688-40ab-b9a6-977e3bd13229', 'Dra. Lívia Barreiros', true),
  ('2bfb98b5-ae41-4f96-8ba7-acc797c22054', 'Retorno Nutricional', 'consulta', 'fe51b62b-c688-40ab-b9a6-977e3bd13229', 'Dra. Lívia Barreiros', true);

-- 2. Atualizar business_rules da Dra. Lívia Barreiros
UPDATE business_rules
SET 
  config = '{
    "servicos": {
      "Consulta Nutricional": {
        "duracao_minutos": 30,
        "descricao": "Consulta com nutricionista"
      },
      "Retorno Nutricional": {
        "duracao_minutos": 20,
        "descricao": "Retorno nutricional"
      }
    },
    "periodos": {
      "terca": [
        {
          "inicio": "13:00",
          "fim": "18:00",
          "servicos": ["Consulta Nutricional", "Retorno Nutricional"]
        }
      ],
      "quarta": [
        {
          "inicio": "13:00",
          "fim": "18:00",
          "servicos": ["Consulta Nutricional", "Retorno Nutricional"]
        }
      ]
    },
    "convenios": ["PARTICULAR"],
    "idade_minima": 0,
    "tipo_agendamento": "hora_marcada",
    "permite_agendamento_online": false,
    "telefone_agendamento": "8730241274",
    "mensagem_agendamento": "Para agendar consulta nutricional com a Dra. Lívia Barreiros, por favor entre em contato pelo telefone (87) 3024-1274. Ela atende às terças e quartas-feiras à tarde."
  }'::jsonb,
  updated_at = now()
WHERE medico_id = 'fe51b62b-c688-40ab-b9a6-977e3bd13229';
