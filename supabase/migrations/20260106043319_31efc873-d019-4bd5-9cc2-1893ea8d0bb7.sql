
-- Atualizar dados completos do Dr. Aristófilo Coelho
UPDATE medicos SET
  nome = 'Dr. Aristófilo Coelho',
  especialidade = 'Cardiologista',
  idade_minima = 15,
  idade_maxima = NULL,
  convenios_aceitos = ARRAY['Mineração', 'Fusex', 'Particular', 'Medprev', 'Agenda Vale', 'Dr. Exames', 'Clincenter', 'MED CENTER', 'Camed'],
  convenios_restricoes = '{"Camed": {"atendimentos_permitidos": ["TESTE ERGOMÉTRICO"]}}'::jsonb,
  observacoes = 'CARDIOLOGISTA - FAZ ECOCARDIOGRAMA (diferente de Dr. Diego, Heverson e Max Koki)

DIFERENCIAL EXCLUSIVO: Único cardiologista que aceita agendamentos combinados (consulta+teste+eco, consulta+eco, consulta+teste, teste+eco). Os outros médicos não permitem misturar.

EXAMES: MAPA, Holter, ECO, TESTE ERGOMÉTRICO, ECG

RESTRIÇÕES:
- ECO (Ecocardiograma): a partir de 18 anos
- Teste Ergométrico: +18 anos, até 150kg
- ECG: a partir de 15 anos

MAPA/HOLTER:
- Agendar na agenda de JOANA
- NÃO agendar para dia antes de feriado (retirada no dia seguinte)
- Paciente não pode fazer hemodiálise no mesmo dia

PRAZOS ENTREGA:
- Holter: 3 dias úteis
- Mapa: até 5 dias úteis (depende do médico)
- ECO/Teste: mesmo dia
- ECG: mesmo dia ou até 3 dias úteis

VALORES:
- Consulta: R$ 280,00
- Pacote ECG + Consulta: R$ 350,00
- ECG: R$ 80,00 (Unimed 40%=R$9,30 | 20%=R$4,65)
- Mapa: R$ 220,00
- Holter: R$ 220,00
- Teste Ergométrico: R$ 250,00 (Unimed 40%=R$53,38 | 20%=R$26,69)
- ECO: R$ 300,00',
  updated_at = now()
WHERE cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
  AND nome ILIKE '%aristófilo%'
  AND ativo = true;

-- Atualizar business_rules com configuração completa
UPDATE business_rules SET
  config = '{
    "idade_minima": 15,
    "idade_maxima": null,
    "tipo_agendamento": "ordem_chegada",
    "permite_online": true,
    "limite_procedimentos_turno": 12,
    "permite_combinacoes": true,
    "combinacoes_permitidas": [
      "Consulta + TESTE ERGOMÉTRICO + ECO",
      "Consulta + ECO",
      "Consulta + TESTE ERGOMÉTRICO",
      "TESTE ERGOMÉTRICO + ECO",
      "Consulta + ECG"
    ],
    "convenios_restricoes": {
      "Camed": {"atendimentos_permitidos": ["TESTE ERGOMÉTRICO"]}
    },
    "servicos": {
      "ECG": {
        "nome": "ECG (Eletrocardiograma)",
        "tipo": "exame",
        "disponivel_online": true,
        "idade_minima": 15,
        "valor_particular": 80,
        "coparticipacao_unimed": {"40": 9.30, "20": 4.65},
        "dias_atendimento": ["quarta"],
        "periodos": {
          "manha": {"ativo": true, "inicio": "07:00", "fim": "07:30", "limite": 1, "distribuicao_fichas": "07:00"},
          "tarde": {"ativo": true, "inicio": "13:00", "fim": "14:00", "limite": 7, "distribuicao_fichas": "12:45 às 14:00"}
        }
      },
      "Consulta": {
        "nome": "Consulta Cardiológica",
        "tipo": "consulta",
        "disponivel_online": true,
        "idade_minima": 15,
        "valor_particular": 280,
        "dias_atendimento": ["quarta"],
        "periodos": {
          "manha": {"ativo": true, "inicio": "08:00", "fim": "09:00", "limite": 5, "distribuicao_fichas": "08:00 às 09:30"},
          "tarde": {"ativo": true, "inicio": "14:00", "fim": "15:00", "limite": 4, "distribuicao_fichas": "13:45 às 15:00"}
        }
      },
      "Retorno": {
        "nome": "Retorno Cardiológico",
        "tipo": "retorno",
        "disponivel_online": true,
        "idade_minima": 15,
        "dias_atendimento": ["quarta"],
        "periodos": {
          "manha": {"ativo": true, "inicio": "09:00", "fim": "10:00", "limite": 3, "distribuicao_fichas": "08:45 às 10:00"},
          "tarde": {"ativo": true, "inicio": "14:30", "fim": "15:00", "limite": 3, "distribuicao_fichas": "14:15 às 15:00"}
        }
      },
      "ECO": {
        "nome": "Ecocardiograma (ECOTT)",
        "tipo": "exame",
        "disponivel_online": true,
        "idade_minima": 18,
        "valor_particular": 300,
        "dias_atendimento": ["quarta"],
        "periodos": {
          "manha": {"ativo": true, "inicio": "09:30", "fim": "10:50", "limite": 4},
          "tarde": {"ativo": true, "inicio": "16:00", "fim": "16:30", "limite": 2, "distribuicao_fichas": "15:45 às 16:30"}
        }
      },
      "TESTE ERGOMÉTRICO": {
        "nome": "Teste Ergométrico",
        "tipo": "exame",
        "disponivel_online": true,
        "idade_minima": 18,
        "peso_maximo_kg": 150,
        "valor_particular": 250,
        "coparticipacao_unimed": {"40": 53.38, "20": 26.69},
        "dias_atendimento": ["quarta"],
        "periodos": {
          "tarde": {"ativo": true, "inicio": "15:00", "fim": "16:00", "limite": 4, "distribuicao_fichas": "14:45 às 16:00"}
        }
      },
      "MAPA": {
        "nome": "MAPA",
        "tipo": "exame",
        "disponivel_online": true,
        "idade_minima": 15,
        "valor_particular": 220,
        "dias_atendimento": ["segunda", "quarta"],
        "agendar_na_agenda": "JOANA",
        "restricoes": ["Não agendar para dia antes de feriado", "Paciente não pode fazer hemodiálise no mesmo dia"],
        "periodos": {
          "manha": {"ativo": true, "inicio": "08:00", "fim": "08:30", "limite": 2, "observacao": "Segunda: 2 pac Dr.Aristófilo + 2 pac Dr.Diego | Quarta: 4 pac Dr.Aristófilo"}
        }
      },
      "HOLTER": {
        "nome": "Holter",
        "tipo": "exame",
        "disponivel_online": true,
        "idade_minima": 15,
        "valor_particular": 220,
        "dias_atendimento": ["segunda"],
        "agendar_na_agenda": "JOANA",
        "restricoes": ["Não agendar para dia antes de feriado", "Paciente não pode fazer hemodiálise no mesmo dia"],
        "periodos": {
          "manha": {"ativo": true, "inicio": "08:00", "fim": "08:30", "limite": 2}
        }
      }
    },
    "observacoes_gerais": "ÚNICO cardiologista que aceita combinações de procedimentos. Se sobrar vaga dentro do limite de 12 procedimentos/turno, pode encaixar qualquer procedimento."
  }'::jsonb,
  updated_at = now(),
  version = COALESCE(version, 0) + 1
WHERE cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
  AND medico_id = (
    SELECT id FROM medicos 
    WHERE cliente_id = '39e120b4-5fb7-4d6f-9f91-a598a5bbd253'
    AND nome ILIKE '%aristófilo%'
    AND ativo = true
    LIMIT 1
  );
