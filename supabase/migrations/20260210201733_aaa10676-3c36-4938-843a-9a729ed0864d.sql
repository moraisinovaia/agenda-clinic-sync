
-- 1. Criar médica Dra. Isabelle Guerra
INSERT INTO public.medicos (
  cliente_id, nome, especialidade, crm, rqe, ativo,
  idade_minima, idade_maxima, atende_criancas, atende_adultos,
  convenios_aceitos, observacoes
)
SELECT id, 'Dra. Isabelle Guerra', 'Oftalmologia', '23167', '16159', true,
  5, null, true, true,
  ARRAY['MEDSAUDE','MEDCLIN','CASSI','GEAP','CPP','SAUDE CAIXA','MINERAÇÃO CARAIBA','CAMED','PARTICULAR','HGU'],
  'Oftalmologia geral, córnea. HGU: máximo 8 pacientes por turno. Máximo 12 pacientes por turno. Dilatação: 0-39 dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
FROM public.clientes WHERE nome = 'Clínica Olhos';

-- 2. Atendimentos
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Completa Eletiva', 'consulta', true,
  'Dilatação: 0-39 dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Isabelle Guerra';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Teste do Olhinho', 'exame', true, 'A partir de 20 dias de nascido(a)'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Isabelle Guerra';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Curva Tensional', 'exame', true, 'Realiza até 03 curvas'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Isabelle Guerra';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Gonioscopia', 'exame', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Isabelle Guerra';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Acuidade Visual - Laudo Concurso', 'consulta', true, 'Para laudo de concurso'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Isabelle Guerra';

-- 3. Business rules
INSERT INTO public.business_rules (cliente_id, medico_id, config_id, config, ativo, version)
SELECT c.id, m.id, lc.id,
  '{
    "tipo_agendamento": "ordem_chegada",
    "permite_agendamento_online": true,
    "idade_minima": 5,
    "idade_maxima": null,
    "atende_criancas": true,
    "atende_adultos": true,
    "convenios_aceitos": ["MEDSAUDE","MEDCLIN","CASSI","GEAP","CPP","SAUDE CAIXA","MINERAÇÃO CARAIBA","CAMED","PARTICULAR","HGU"],
    "limite_hgu": 8,
    "limite_por_turno": 12,
    "crm": "23167",
    "rqe": "16159",
    "servicos": {
      "Consulta Completa Eletiva": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [2, 3],
        "periodos": {
          "manha": {
            "ativo": true, "atendimento_inicio": "08:00", "limite": 12,
            "distribuicao_fichas": "a partir das 08:00",
            "inicio": "08:00", "fim": "12:00",
            "contagem_inicio": "07:00", "contagem_fim": "12:00",
            "dias_especificos": [3]
          },
          "tarde": {
            "ativo": true, "atendimento_inicio": "13:30", "limite": 12,
            "distribuicao_fichas": "13:30 às 14:40",
            "inicio": "13:30", "fim": "14:40",
            "contagem_inicio": "12:00", "contagem_fim": "18:00",
            "dias_especificos": [2]
          }
        }
      },
      "Teste do Olhinho": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "idade_minima_dias": 20, "observacao": "A partir de 20 dias de nascido",
        "dias_semana": [2, 3],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 12, "distribuicao_fichas": "a partir das 08:00", "inicio": "08:00", "fim": "12:00", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [3]},
          "tarde": {"ativo": true, "atendimento_inicio": "13:30", "limite": 12, "distribuicao_fichas": "13:30 às 14:40", "inicio": "13:30", "fim": "14:40", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Curva Tensional": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "limite_curvas": 3,
        "dias_semana": [2, 3],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 12, "distribuicao_fichas": "a partir das 08:00", "inicio": "08:00", "fim": "12:00", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [3]},
          "tarde": {"ativo": true, "atendimento_inicio": "13:30", "limite": 12, "distribuicao_fichas": "13:30 às 14:40", "inicio": "13:30", "fim": "14:40", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Gonioscopia": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [2, 3],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 12, "distribuicao_fichas": "a partir das 08:00", "inicio": "08:00", "fim": "12:00", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [3]},
          "tarde": {"ativo": true, "atendimento_inicio": "13:30", "limite": 12, "distribuicao_fichas": "13:30 às 14:40", "inicio": "13:30", "fim": "14:40", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      },
      "Consulta Acuidade Visual - Laudo Concurso": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [2, 3],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 12, "distribuicao_fichas": "a partir das 08:00", "inicio": "08:00", "fim": "12:00", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [3]},
          "tarde": {"ativo": true, "atendimento_inicio": "13:30", "limite": 12, "distribuicao_fichas": "13:30 às 14:40", "inicio": "13:30", "fim": "14:40", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [2]}
        }
      }
    },
    "dilatacao": {
      "regra": "0-39 anos: dilata (exceto ceratocone). 40-59 anos: não dilata (exceto diabéticos). 60+ anos: sempre dilata.",
      "faixas": [
        {"idade_min": 0, "idade_max": 39, "dilata": true, "excecao": "ceratocone não dilata"},
        {"idade_min": 40, "idade_max": 59, "dilata": false, "excecao": "diabéticos dilata"},
        {"idade_min": 60, "idade_max": null, "dilata": true, "excecao": null}
      ]
    },
    "observacoes": "HGU: máximo 8 pacientes por turno. Possui RQE. Especialidade em córnea."
  }'::jsonb,
  true, 1
FROM clientes c
JOIN medicos m ON m.cliente_id = c.id
JOIN llm_clinic_config lc ON lc.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Isabelle Guerra';
