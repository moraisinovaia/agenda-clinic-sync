-- =====================================================
-- CONFIGURAÇÃO COMPLETA DR. PEDRO FRANCISCO
-- Ultrassonografista e Clínico Geral
-- ID: 66e9310d-34cd-4005-8937-74e87125dc03
-- =====================================================

-- 1. Atualizar dados do médico
UPDATE medicos SET
  convenios_aceitos = ARRAY[
    'PARTICULAR', 'UNIMED NACIONAL', 'UNIMED REGIONAL', 
    'UNIMED INTERCÂMBIO', 'UNIMED 40%', 'UNIMED 20%', 'MEDPREV'
  ],
  telefone_alternativo = '87988530318',
  observacoes = 'Ultrassonografista e Clínico Geral. Consultas/Retornos apenas Terças e Quintas (necessário agendar) - atendimento APÓS os exames de ultrassom. Exames USG Seg-Sex (não precisa agendar). Contato secretaria: (87) 98853-0318'
WHERE id = '66e9310d-34cd-4005-8937-74e87125dc03';

-- 2. Atualizar business_rules com config completa
UPDATE business_rules SET
  config = '{
    "nome": "Dr. Pedro Francisco",
    "tipo_agendamento": "ordem_chegada",
    "permite_agendamento_online": true,
    "idade_minima": 0,
    "convenios_aceitos": ["PARTICULAR", "UNIMED NACIONAL", "UNIMED REGIONAL", "UNIMED INTERCÂMBIO", "UNIMED 40%", "UNIMED 20%", "MEDPREV"],
    "servicos": {
      "Consulta": {
        "tipo": "ordem_chegada",
        "permite_online": true,
        "dias_semana": [2, 4],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "09:30",
            "horario_fim": "10:00",
            "limite": 4
          }
        },
        "mensagem_apos_agendamento": "Consulta agendada. Compareça entre 9h30 e 10h para retirada de ficha. O atendimento será realizado APÓS a conclusão dos exames de ultrassom, por ordem de chegada."
      },
      "Retorno": {
        "tipo": "ordem_chegada",
        "permite_online": true,
        "dias_semana": [2, 4],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "09:30",
            "horario_fim": "10:00",
            "limite": 4
          }
        },
        "limite_compartilhado_com": ["Consulta"],
        "mensagem_apos_agendamento": "Retorno agendado. Compareça entre 9h30 e 10h para retirada de ficha. O atendimento será realizado APÓS a conclusão dos exames de ultrassom, por ordem de chegada."
      },
      "USG Abdome Total": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha.",
        "preparo_referencia": "USG Abdome Total"
      },
      "USG Abdome Superior": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha.",
        "preparo_referencia": "USG Abdome Superior"
      },
      "USG Aparelho Urinario": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha."
      },
      "USG Prostata": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha."
      },
      "USG Tireoide": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha."
      },
      "USG Tireoide com Doppler": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha."
      },
      "USG Cervical": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha."
      },
      "Puncao de Tireoide": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha. IMPORTANTE: Trazer último exame de ultrassom da tireoide.",
        "observacao": "Necessário levar último exame de ultrassom da tireoide"
      },
      "USG Orgaos e Estruturas": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha."
      },
      "USG Estruturas Superficiais": {
        "tipo": "ordem_chegada",
        "permite_online": false,
        "dias_semana": [1, 2, 3, 4, 5],
        "periodos": {
          "manha": {
            "ativo": true,
            "horario_inicio": "08:00",
            "horario_fim": "10:00",
            "atendimento_inicio": "10:00"
          }
        },
        "mensagem": "Este exame não requer agendamento. Compareça de Segunda a Sexta das 8h às 10h para retirada de ficha."
      }
    }
  }'::jsonb,
  updated_at = now()
WHERE id = '031a5945-5208-4f40-8921-f8acf818c35e';

-- 3. Atualizar valores nos atendimentos
UPDATE atendimentos SET 
  codigo = '40901122', valor_particular = 250.00, 
  coparticipacao_unimed_20 = 30.00, coparticipacao_unimed_40 = 60.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = 'b1edc27d-cf80-4986-b131-1336ae18c5b8';

UPDATE atendimentos SET 
  codigo = '40901130', valor_particular = 230.00, 
  coparticipacao_unimed_20 = 20.00, coparticipacao_unimed_40 = 40.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = '4ce8592c-d716-41e7-a4f5-da0a9c553243';

UPDATE atendimentos SET 
  codigo = '40901769', valor_particular = 200.00, 
  coparticipacao_unimed_20 = 20.00, coparticipacao_unimed_40 = 40.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = 'b16cdfa7-1beb-43f6-970c-c9d71ac25789';

UPDATE atendimentos SET 
  codigo = '40901173', valor_particular = 200.00, 
  coparticipacao_unimed_20 = 20.00, coparticipacao_unimed_40 = 40.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = 'c701a09d-3570-4219-980d-e6650377dc1d';

UPDATE atendimentos SET 
  codigo = '40901203', valor_particular = 200.00, 
  coparticipacao_unimed_20 = 15.00, coparticipacao_unimed_40 = 30.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = '5f92a191-c0c7-4c97-8d25-af0072314280';

UPDATE atendimentos SET 
  codigo = '40901386', valor_particular = 300.00, 
  coparticipacao_unimed_20 = 40.00, coparticipacao_unimed_40 = 80.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = 'bfd9cea5-e872-4146-a586-b2c2fcec93b9';

UPDATE atendimentos SET 
  codigo = '40901211', valor_particular = 200.00, 
  coparticipacao_unimed_20 = 15.00, coparticipacao_unimed_40 = 30.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = 'e279bcea-71d0-48c7-82c7-4f830ec51629';

UPDATE atendimentos SET 
  codigo = '40901072', valor_particular = 270.00, 
  coparticipacao_unimed_20 = 40.00, coparticipacao_unimed_40 = 80.00,
  forma_pagamento = 'Espécie e Pix',
  observacoes = 'Necessário levar o último exame de ultrassom da tireoide. Valor por nódulo.'
WHERE id = 'ea4d206e-bddf-4ba0-b336-0375e3aa4551';

UPDATE atendimentos SET 
  codigo = '40901203', valor_particular = 200.00, 
  coparticipacao_unimed_20 = 15.00, coparticipacao_unimed_40 = 30.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = '9f3fe6db-19e3-4211-a616-9c4e64605de6';

UPDATE atendimentos SET 
  codigo = '40901203', valor_particular = 200.00, 
  coparticipacao_unimed_20 = 20.00, coparticipacao_unimed_40 = 40.00,
  forma_pagamento = 'Espécie e Pix'
WHERE id = '0b75b486-5d88-41c5-b838-e65a615ea99f';

-- 4. Criar preparos para os exames de USG
INSERT INTO preparos (nome, exame, jejum_horas, restricoes_alimentares, medicacao_suspender, itens_levar, observacoes_especiais, cliente_id)
VALUES 
(
  'Preparo USG Abdome Total (Adulto) - Dr. Pedro',
  'USG Abdome Total',
  8,
  NULL,
  '40 gotas de Flagass ou Luftal a cada 4 horas no dia anterior ao exame. Para pacientes com peso maior que 70kg: 2 comprimidos de Lactopurga às 18h do dia anterior.',
  'Documentos pessoais, pedido médico, carteirinha do convênio (se aplicável)',
  'JEJUM OBRIGATÓRIO. BEXIGA CHEIA. Não urinar por pelo menos 2 horas antes do exame.',
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
),
(
  'Preparo USG Abdome Superior (Adulto) - Dr. Pedro',
  'USG Abdome Superior',
  8,
  NULL,
  '40 gotas de Flagass ou Luftal a cada 4 horas no dia anterior ao exame.',
  'Documentos pessoais, pedido médico, carteirinha do convênio (se aplicável)',
  'JEJUM OBRIGATÓRIO.',
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
),
(
  'Preparo USG Abdome Total (Crianças) - Dr. Pedro',
  'USG Abdome Total Infantil',
  NULL,
  NULL,
  'NÃO usar laxantes ou medicamentos como Luftal/Flagass (exceto se médico pedir). Em crianças, NÃO se usa Lactopurga.',
  'Documentos pessoais, pedido médico, carteirinha do convênio (se aplicável), fraldas se bebê',
  'JEJUM OBRIGATÓRIO por idade: Até 1 ano = 3 horas, 1 a 5 anos = 4 horas, Acima de 5 anos = 6 horas. BEXIGA CHEIA: Oferecer 1 copo de água (100-150ml) 1 hora antes do exame.',
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
),
(
  'Preparo USG Abdome Superior (Crianças) - Dr. Pedro',
  'USG Abdome Superior Infantil',
  NULL,
  NULL,
  'Luftal/Flagass em geral não é obrigatório.',
  'Documentos pessoais, pedido médico, carteirinha do convênio (se aplicável), fraldas se bebê',
  'JEJUM OBRIGATÓRIO por idade: Até 1 ano = 3 horas, 1 a 5 anos = 4 horas, Acima de 5 anos = 6 horas. NÃO é necessário encher a bexiga.',
  '2bfb98b5-ae41-4f96-8ba7-acc797c22054'
);