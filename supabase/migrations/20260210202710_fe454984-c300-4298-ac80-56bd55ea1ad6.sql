
-- 1. Criar médica Dra. Camila Leite de Carvalho Moura
INSERT INTO public.medicos (
  cliente_id, nome, especialidade, crm, rqe, ativo,
  idade_minima, idade_maxima, atende_criancas, atende_adultos,
  convenios_aceitos, observacoes
)
SELECT id, 'Dra. Camila Leite de Carvalho Moura', 'Oftalmologia', null, null, true,
  0, null, true, true,
  ARRAY['UNIMED','MEDSAUDE','MEDCLIN','MEDREV','CASSI','GEAP','CPP','SAUDE CAIXA','MINERAÇÃO CARAÍBA','CAMED','PARTICULAR'],
  'Oftalmologia geral, córnea, lentes de contato e refrativa. Ceratocone: autoriza exames no dia da consulta. Refrativa: orientar pentacam no ato da consulta. Dilatação: 0-39 dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
FROM public.clientes WHERE nome = 'Clínica Olhos';

-- 2. Atendimentos
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Completa Eletiva', 'consulta', true,
  'Dilatação: 0-39 dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Teste de Lentes de Contato', 'exame', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Cirurgia Refrativa', 'procedimento', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Crosslinking Corneano', 'procedimento', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Tratamento Ceratocone', 'consulta', true, 'Autoriza exames no dia da consulta para análise imediata'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Teste do Olhinho', 'exame', true, 'A partir de 20 dias de nascido(a)'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Curva Tensional', 'exame', true, 'Realiza até 03 curvas por turno'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Gonioscopia', 'exame', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'YAG Laser', 'procedimento', true, 'Realiza dela e de médicos solicitantes'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Mapeamento de Retina', 'exame', true
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Acuidade Visual - Laudo Concurso', 'consulta', true, 'Para laudo de concurso'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Avaliação Refrativa', 'consulta', true, 'Orientar pentacam no ato da consulta'
FROM clientes c JOIN medicos m ON m.cliente_id = c.id WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';

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
    "convenios_aceitos": ["UNIMED","MEDSAUDE","MEDCLIN","MEDREV","CASSI","GEAP","CPP","SAUDE CAIXA","MINERAÇÃO CARAÍBA","CAMED","PARTICULAR"],
    "servicos": {
      "Consulta Completa Eletiva": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true, "atendimento_inicio": "08:00", "limite": 20,
            "distribuicao_fichas": "08:00 às 09:30",
            "inicio": "08:00", "fim": "09:30",
            "contagem_inicio": "07:00", "contagem_fim": "12:00",
            "dias_especificos": [1, 3, 5]
          },
          "tarde": {
            "ativo": true, "atendimento_inicio": "14:00", "limite": 20,
            "distribuicao_fichas": "14:00 às 15:30",
            "inicio": "14:00", "fim": "15:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00",
            "dias_especificos": [3, 4]
          }
        },
        "bloco_horario": {
          "ativo": true,
          "dias_especificos": [2],
          "descricao": "Terças: bloco de 20 pacientes às 08:00, se preenchido mais 20 às 10:00",
          "blocos": [
            {"horario": "08:00", "limite": 20},
            {"horario": "10:00", "limite": 20}
          ]
        }
      },
      "Teste de Lentes de Contato": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "Cirurgia Refrativa": {
        "ativo": true, "tipo_agendamento": "hora_marcada", "permite_online": false
      },
      "Crosslinking Corneano": {
        "ativo": true, "tipo_agendamento": "hora_marcada", "permite_online": false
      },
      "Tratamento Ceratocone": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Autoriza exames no dia da consulta para análise imediata. NÃO dilata ceratocone.",
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "Teste do Olhinho": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "idade_minima_dias": 20, "observacao": "A partir de 20 dias de nascido",
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "Curva Tensional": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "limite_curvas": 3,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "Gonioscopia": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "YAG Laser": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Realiza dela e de médicos solicitantes",
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "Mapeamento de Retina": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "Consulta Acuidade Visual - Laudo Concurso": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
        }
      },
      "Avaliação Refrativa": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Orientar pentacam no ato da consulta",
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {"ativo": true, "atendimento_inicio": "08:00", "limite": 20, "distribuicao_fichas": "08:00 às 09:30", "inicio": "08:00", "fim": "09:30", "contagem_inicio": "07:00", "contagem_fim": "12:00", "dias_especificos": [1, 3, 5]},
          "tarde": {"ativo": true, "atendimento_inicio": "14:00", "limite": 20, "distribuicao_fichas": "14:00 às 15:30", "inicio": "14:00", "fim": "15:30", "contagem_inicio": "12:00", "contagem_fim": "18:00", "dias_especificos": [3, 4]}
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
    "orientacoes_especiais": {
      "ceratocone": "Autoriza exames no dia da consulta para análise imediata pela médica",
      "refrativa": "Orientar pentacam no ato da consulta"
    },
    "observacoes": "Possui RQE. Especialidade em córnea, lentes de contato e refrativa."
  }'::jsonb,
  true, 1
FROM clientes c
JOIN medicos m ON m.cliente_id = c.id
JOIN llm_clinic_config lc ON lc.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dra. Camila Leite de Carvalho Moura';
