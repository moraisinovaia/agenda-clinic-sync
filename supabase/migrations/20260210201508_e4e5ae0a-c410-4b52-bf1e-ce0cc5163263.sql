
-- 1. Criar o cliente Clínica Olhos
INSERT INTO public.clientes (id, nome, ativo)
VALUES (gen_random_uuid(), 'Clínica Olhos', true);

-- 2. Criar configuração LLM para a clínica
INSERT INTO public.llm_clinic_config (cliente_id, nome_clinica, ativo, dias_busca_inicial, dias_busca_expandida)
SELECT id, 'Clínica Olhos', true, 7, 30
FROM public.clientes WHERE nome = 'Clínica Olhos';

-- 3. Criar o médico Dr. João Miranda Filho
INSERT INTO public.medicos (
  cliente_id, nome, especialidade, crm, rqe, ativo,
  idade_minima, idade_maxima, atende_criancas, atende_adultos,
  convenios_aceitos, observacoes
)
SELECT 
  id,
  'Dr. João Miranda Filho',
  'Oftalmologia',
  '22618',
  '11035',
  true,
  0,
  null,
  true,
  true,
  ARRAY['MEDSAUDE','MEDCLIN','CASSI','GEAP','CPP','SAUDE CAIXA','MINERAÇÃO CARAIBA','CAMED','PARTICULAR','HGU'],
  'Oftalmologia geral, catarata, pterígio. HGU: máximo 3 pacientes por turno. Máximo 25 pacientes por turno. Dilatação: 0-39 anos dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
FROM public.clientes WHERE nome = 'Clínica Olhos';

-- 4. Criar atendimentos do médico
-- Consulta Completa Eletiva
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Completa Eletiva', 'consulta', true,
  'Dilatação: 0-39 anos dilata (exceto ceratocone), 40-59 não dilata (exceto diabéticos), 60+ sempre dilata.'
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- Cirurgia de Catarata
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Cirurgia de Catarata', 'procedimento', true
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- Cirurgia de Pterígio
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Cirurgia de Pterígio', 'procedimento', true
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- Teste do Olhinho
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Teste do Olhinho', 'exame', true, 'A partir de 20 dias de nascido(a)'
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- Curva Tensional
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Curva Tensional', 'exame', true, 'Realiza até 05 curvas'
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- Gonioscopia
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Gonioscopia', 'exame', true
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- YAG Laser
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'YAG Laser', 'procedimento', true, 'Realiza dele e de médicos solicitantes'
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- Mapeamento de Retina
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo)
SELECT c.id, m.id, 'Mapeamento de Retina', 'exame', true
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- Consulta Acuidade Visual (Laudo Concurso)
INSERT INTO public.atendimentos (cliente_id, medico_id, nome, tipo, ativo, observacoes)
SELECT c.id, m.id, 'Consulta Acuidade Visual - Laudo Concurso', 'consulta', true, 'Para laudo de concurso'
FROM public.clientes c JOIN public.medicos m ON m.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';

-- 5. Criar business_rules completo
INSERT INTO public.business_rules (cliente_id, medico_id, config_id, config, ativo, version)
SELECT 
  c.id, 
  m.id,
  lc.id,
  '{
    "tipo_agendamento": "ordem_chegada",
    "permite_agendamento_online": true,
    "idade_minima": 0,
    "idade_maxima": null,
    "atende_criancas": true,
    "atende_adultos": true,
    "convenios_aceitos": ["MEDSAUDE","MEDCLIN","CASSI","GEAP","CPP","SAUDE CAIXA","MINERAÇÃO CARAIBA","CAMED","PARTICULAR","HGU"],
    "limite_hgu": 3,
    "limite_por_turno": 25,
    "crm": "22618",
    "rqe": "11035",
    "servicos": {
      "Consulta Completa Eletiva": {
        "ativo": true,
        "tipo_agendamento": "ordem_chegada",
        "permite_online": true,
        "dias_semana": [3, 4],
        "periodos": {
          "tarde": {
            "ativo": true,
            "atendimento_inicio": "13:00",
            "limite": 25,
            "distribuicao_fichas": "13:00 às 14:30",
            "inicio": "13:00",
            "fim": "14:30",
            "contagem_inicio": "12:00",
            "contagem_fim": "18:00"
          }
        }
      },
      "Cirurgia de Catarata": {
        "ativo": true, "tipo_agendamento": "hora_marcada", "permite_online": false
      },
      "Cirurgia de Pterígio": {
        "ativo": true, "tipo_agendamento": "hora_marcada", "permite_online": false
      },
      "Teste do Olhinho": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "idade_minima_dias": 20, "observacao": "A partir de 20 dias de nascido",
        "dias_semana": [3, 4],
        "periodos": {
          "tarde": {
            "ativo": true, "atendimento_inicio": "13:00", "limite": 25,
            "distribuicao_fichas": "13:00 às 14:30", "inicio": "13:00", "fim": "14:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00"
          }
        }
      },
      "Curva Tensional": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "limite_curvas": 5,
        "dias_semana": [3, 4],
        "periodos": {
          "tarde": {
            "ativo": true, "atendimento_inicio": "13:00", "limite": 25,
            "distribuicao_fichas": "13:00 às 14:30", "inicio": "13:00", "fim": "14:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00"
          }
        }
      },
      "Gonioscopia": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [3, 4],
        "periodos": {
          "tarde": {
            "ativo": true, "atendimento_inicio": "13:00", "limite": 25,
            "distribuicao_fichas": "13:00 às 14:30", "inicio": "13:00", "fim": "14:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00"
          }
        }
      },
      "YAG Laser": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "observacao": "Realiza dele e de médicos solicitantes",
        "dias_semana": [3, 4],
        "periodos": {
          "tarde": {
            "ativo": true, "atendimento_inicio": "13:00", "limite": 25,
            "distribuicao_fichas": "13:00 às 14:30", "inicio": "13:00", "fim": "14:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00"
          }
        }
      },
      "Mapeamento de Retina": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [3, 4],
        "periodos": {
          "tarde": {
            "ativo": true, "atendimento_inicio": "13:00", "limite": 25,
            "distribuicao_fichas": "13:00 às 14:30", "inicio": "13:00", "fim": "14:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00"
          }
        }
      },
      "Consulta Acuidade Visual - Laudo Concurso": {
        "ativo": true, "tipo_agendamento": "ordem_chegada", "permite_online": true,
        "dias_semana": [3, 4],
        "periodos": {
          "tarde": {
            "ativo": true, "atendimento_inicio": "13:00", "limite": 25,
            "distribuicao_fichas": "13:00 às 14:30", "inicio": "13:00", "fim": "14:30",
            "contagem_inicio": "12:00", "contagem_fim": "18:00"
          }
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
    "observacoes": "HGU: máximo 3 pacientes por turno. Possui RQE."
  }'::jsonb,
  true,
  1
FROM public.clientes c 
JOIN public.medicos m ON m.cliente_id = c.id
JOIN public.llm_clinic_config lc ON lc.cliente_id = c.id
WHERE c.nome = 'Clínica Olhos' AND m.nome = 'Dr. João Miranda Filho';
