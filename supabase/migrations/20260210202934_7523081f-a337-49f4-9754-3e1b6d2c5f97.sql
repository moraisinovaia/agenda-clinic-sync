
-- 1. Criar médico Dr. Guilherme Lucena Moura
INSERT INTO public.medicos (
  cliente_id, nome, especialidade, crm, rqe, ativo,
  idade_minima, idade_maxima, atende_criancas, atende_adultos,
  convenios_aceitos, observacoes
)
SELECT id, 'Dr. Guilherme Lucena Moura', 'Oftalmologia', null, null, true,
  0, null, true, true,
  ARRAY['UNIMED','MEDSAUDE','MEDCLIN','CASSI','GEAP','CPP','SAUDE CAIXA','MINERAÇÃO CARAÍBA','CAMED','PARTICULAR','DR VISÃO','HGU'],
  'Oftalmologia geral, catarata, retina clínica e cirúrgica. HGU: apenas encaminhados para cirurgia catarata e tratamento retina. DR VISÃO: cortesia dos médicos da casa. Pacientes DM agendados diretamente com ele, dilata no ato. Pós-op retina: encaixes. Exames: agendar mesmo dia.'
FROM public.clientes WHERE nome = 'Clínica Olhos';

-- 2. Atendimentos
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Completa Eletiva', 'consulta', true,
  'Dilatação: 0-39 dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata. Todo paciente DM dilata no ato.'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Cirurgia de Retina', 'procedimento', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Cirurgia de Catarata', 'procedimento', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Fotocoagulação a Laser', 'procedimento', true, 'Tratamento em retina com lasers'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Ultrassonografia do Globo Ocular', 'exame', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Teste do Olhinho', 'exame', true, 'A partir de 20 dias de nascido(a). Não realiza sempre.'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Curva Tensional', 'exame', true, 'Até 03 curvas, apenas quando ele solicita'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Gonioscopia', 'exame', true, 'Apenas quando ele solicita'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'YAG Laser', 'procedimento', true, 'Realiza dele e de médicos solicitantes'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Mapeamento de Retina', 'exame', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Acuidade Visual - Laudo Concurso', 'consulta', true, 'Para laudo de concurso'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Tratamento Uveíte', 'consulta', true, 'Tratamento especializado'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Tratamento Retina', 'consulta', true, 'Pós-operatório sempre com encaixes'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Diabetes Mellitus', 'consulta', true, 'Pacientes DM agendados diretamente. Dilata no ato da consulta.'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';

-- 3. Business rules
INSERT INTO public.business_rules (cliente_id, medico_id, config_id, config, ativo, version)
SELECT c.id, m.id, lc.id,
  '{
    "tipo_agendamento": "ordem_chegada",
    "permite_agendamento_online": true,
    "idade_minima": 0,
    "idade_maxima": null,
    "atende_criancas": true,
    "atende_adultos": true,
    "convenios_aceitos": ["UNIMED","MEDSAUDE","MEDCLIN","CASSI","GEAP","CPP","SAUDE CAIXA","MINERAÇÃO CARAÍBA","CAMED","PARTICULAR","DR VISÃO","HGU"],
    "convenios_restricoes": {
      "HGU": "Apenas pacientes encaminhados para cirurgia de catarata e tratamento em retina",
      "DR VISÃO": "Cortesia dos médicos da casa que realizam encaminhamento"
    },
    "servicos": {
      "Consulta Completa Eletiva": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true, "atendimento_inicio": "08:00", "limite": 25,
            "distribuicao_fichas": "08:00 às 10:30",
            "inicio": "08:00", "fim": "10:30",
            "contagem_inicio": "07:00", "contagem_fim": "12:00",
            "dias_especificos": [1, 2, 4, 5]
          },
          "tarde": {
            "ativo": true, "atendimento_inicio": "14:00", "limite": 25,
            "distribuicao_fichas": "14:00 às 16:30",
            "inicio": "14:00", "fim": "16:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00",
            "dias_especificos": [2]
          }
        }
      },
      "Cirurgia de Retina": {"ativo": true, "tipo_agendamento": "hora_marcada", "permite_online": false},
      "Cirurgia de Catarata": {"ativo": true, "tipo_agendamento": "hora_marcada", "permite_online": false},
      "Fotocoagulação a Laser": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Tratamento em retina com lasers",
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Ultrassonografia do Globo Ocular": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Teste do Olhinho": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "idade_minima_dias": 20, "observacao": "A partir de 20 dias de nascido. Não realiza sempre.",
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Curva Tensional": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": false,
        "limite_curvas": 3, "observacao": "Apenas quando ele solicita",
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Gonioscopia": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": false,
        "observacao": "Apenas quando ele solicita",
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "YAG Laser": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Realiza dele e de médicos solicitantes",
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Mapeamento de Retina": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Consulta Acuidade Visual - Laudo Concurso": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Tratamento Uveíte": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Tratamento Retina": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Pós-operatório sempre com encaixes",
        "permite_encaixe_pos_op": true,
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Consulta Diabetes Mellitus": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Pacientes DM agendados diretamente com Dr. Guilherme. Dilata no ato da consulta.",
        "dilata_sempre": true,
        "dias_semana": [1, 2, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 25, "distribuicao_fichas": "08:00 às 10:30", "inicio": "08:00", "fim": "10:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 2, 4, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 25, "distribuicao_fichas": "14:00 às 16:30", "inicio": "14:00", "fim": "16:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      }
    },
    "dilatacao": {
      "regra": "0-39 anos: dilata (exceto ceratocone). 40-59 anos: não dilata (exceto diabéticos). 60+ anos: sempre dilata. Pacientes DM: SEMPRE dilata.",
      "faixas": [
        {"idade_min": 0, "idade_max": 39, "dilata": true, "excecao": "ceratocone não dilata"},
        {"idade_min": 40, "idade_max": 59, "dilata": false, "excecao": "diabéticos dilata"},
        {"idade_min": 60, "idade_max": null, "dilata": true, "excecao": null}
      ],
      "diabetes_mellitus": "Sempre dilata independente da idade"
    },
    "orientacoes_especiais": {
      "diabetes_mellitus": "Todo paciente DM é agendado diretamente para Dr. Guilherme Moura com dilatação no ato",
      "retina_pos_op": "Pós-operatório de retina sempre com encaixes",
      "exames_mesmo_dia": "Pacientes com exames para mostrar ao médico são agendados no mesmo dia dos exames"
    },
    "observacoes": "Possui RQE. Especialidade em retina clínica e cirúrgica. HGU apenas encaminhados para catarata/retina. DR VISÃO: cortesia dos médicos da casa."
  }'::jsonb,
  true, 1
FROM clientes c
JOIN medicos m ON m.cliente_id = c.id
JOIN llm_clinic_config lc ON lc.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. Guilherme Lucena Moura';
