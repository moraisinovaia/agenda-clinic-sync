-- =====================================================
-- IMPLEMENTAÇÃO COMPLETA: DR. SYDNEY RIBEIRO - IPADO
-- =====================================================

-- Variáveis de referência
DO $$
DECLARE
  v_cliente_id UUID := '2bfb98b5-ae41-4f96-8ba7-acc797c22054'; -- IPADO
  v_medico_id UUID;
  v_atendimento_ids RECORD;
BEGIN

-- =====================================================
-- FASE 1: CRIAR MÉDICO
-- =====================================================
INSERT INTO medicos (
  nome,
  especialidade,
  cliente_id,
  idade_minima,
  idade_maxima,
  ativo,
  convenios_aceitos,
  observacoes
) VALUES (
  'Dr. Sydney Ribeiro',
  'Gastroenterologia',
  v_cliente_id,
  18,
  NULL,
  true,
  ARRAY['UNIMED REGIONAL', 'UNIMED NACIONAL', 'UNIMED INTERCÂMBIO', 'PARTICULAR', 'GEAP', 'CASSI', 'PLANSERV', 'BRADESCO SAÚDE', 'AMIL', 'HAPVIDA', 'NOSSA SAÚDE'],
  'Exames: Segunda e Quinta (manhã). Consultas: Terça e Quinta (tarde). Idade mínima: 18 anos.'
)
ON CONFLICT DO NOTHING
RETURNING id INTO v_medico_id;

-- Se já existir, buscar o ID
IF v_medico_id IS NULL THEN
  SELECT id INTO v_medico_id FROM medicos 
  WHERE nome = 'Dr. Sydney Ribeiro' AND cliente_id = v_cliente_id;
END IF;

RAISE NOTICE 'Médico criado/encontrado com ID: %', v_medico_id;

-- =====================================================
-- FASE 2: CRIAR ATENDIMENTOS (8 serviços)
-- =====================================================

-- 1. Consulta Gastroenterológica
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Consulta Gastroenterológica', 'consulta', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

-- 2. Retorno Gastroenterológico
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Retorno Gastroenterológico', 'retorno', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

-- 3. Endoscopia Digestiva Alta
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Endoscopia Digestiva Alta', 'exame', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

-- 4. Colonoscopia
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Colonoscopia', 'exame', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

-- 5. Colono + EDA
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Colono + EDA', 'exame', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

-- 6. Polipectomia do Cólon
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Polipectomia do Cólon', 'procedimento', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

-- 7. Polipectomia Gástrica
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Polipectomia Gástrica', 'procedimento', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

-- 8. Retossigmoidoscopia
INSERT INTO atendimentos (nome, tipo, cliente_id, medico_id, medico_nome, ativo)
VALUES ('Retossigmoidoscopia', 'exame', v_cliente_id, v_medico_id, 'Dr. Sydney Ribeiro', true)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Atendimentos criados para Dr. Sydney Ribeiro';

-- =====================================================
-- FASE 3: CRIAR BUSINESS RULES
-- =====================================================
INSERT INTO business_rules (
  medico_id,
  cliente_id,
  ativo,
  config
) VALUES (
  v_medico_id,
  v_cliente_id,
  true,
  '{
    "idade_minima": 18,
    "tipo_agendamento": "misto",
    "permite_agendamento_online": true,
    "convenios": [
      "UNIMED REGIONAL",
      "UNIMED NACIONAL", 
      "UNIMED INTERCÂMBIO",
      "PARTICULAR",
      "GEAP",
      "CASSI",
      "PLANSERV",
      "BRADESCO SAÚDE",
      "AMIL",
      "HAPVIDA",
      "NOSSA SAÚDE"
    ],
    "servicos": {
      "Endoscopia Digestiva Alta": {
        "tipo": "ordem_chegada",
        "permite_online": true,
        "dias_semana": [1, 4],
        "periodos": {
          "manha": {
            "inicio": "07:00",
            "fim": "09:00",
            "distribuicao_fichas": "07:00 às 09:00",
            "atendimento_inicio": "08:00",
            "limite": null
          }
        }
      },
      "Polipectomia Gástrica": {
        "tipo": "ordem_chegada",
        "permite_online": true,
        "dias_semana": [1, 4],
        "compartilha_preparo_com": "Endoscopia Digestiva Alta",
        "periodos": {
          "manha": {
            "inicio": "07:00",
            "fim": "09:00",
            "distribuicao_fichas": "07:00 às 09:00",
            "atendimento_inicio": "08:00",
            "limite": null
          }
        }
      },
      "Colonoscopia": {
        "tipo": "hora_marcada",
        "permite_online": true,
        "dias_semana": [1, 4],
        "intervalo_minutos": 20,
        "periodos": {
          "manha": {
            "inicio": "10:00",
            "fim": "12:00",
            "limite": 6
          }
        }
      },
      "Colono + EDA": {
        "tipo": "hora_marcada",
        "permite_online": true,
        "dias_semana": [1, 4],
        "intervalo_minutos": 20,
        "compartilha_limite_com": "Colonoscopia",
        "periodos": {
          "manha": {
            "inicio": "10:00",
            "fim": "12:00",
            "limite": 6
          }
        }
      },
      "Polipectomia do Cólon": {
        "tipo": "hora_marcada",
        "permite_online": true,
        "dias_semana": [1, 4],
        "intervalo_minutos": 20,
        "compartilha_limite_com": "Colonoscopia",
        "periodos": {
          "manha": {
            "inicio": "10:00",
            "fim": "12:00",
            "limite": 6
          }
        }
      },
      "Retossigmoidoscopia": {
        "tipo": "hora_marcada",
        "permite_online": true,
        "dias_semana": [1, 4],
        "intervalo_minutos": 20,
        "compartilha_limite_com": "Colonoscopia",
        "periodos": {
          "manha": {
            "inicio": "10:00",
            "fim": "12:00",
            "limite": 6
          }
        }
      },
      "Consulta Gastroenterológica": {
        "tipo": "ordem_chegada",
        "permite_online": true,
        "dias_semana": [2, 4],
        "periodos": {
          "tarde": {
            "inicio": "13:00",
            "fim": "15:00",
            "distribuicao_fichas": "13:00 às 15:00",
            "atendimento_inicio": "15:00",
            "limite": 7
          }
        }
      },
      "Retorno Gastroenterológico": {
        "tipo": "ordem_chegada",
        "permite_online": true,
        "dias_semana": [2, 4],
        "compartilha_limite_com": "Consulta Gastroenterológica",
        "periodos": {
          "tarde": {
            "inicio": "13:00",
            "fim": "15:00",
            "distribuicao_fichas": "13:00 às 15:00",
            "atendimento_inicio": "15:00",
            "limite": 7
          }
        }
      }
    }
  }'::jsonb
)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Business rules criadas para Dr. Sydney Ribeiro';

-- =====================================================
-- FASE 4: CRIAR PREPAROS
-- =====================================================

-- Preparo 1: Endoscopia Digestiva Alta / Polipectomia Gástrica (simples)
INSERT INTO preparos (
  nome,
  exame,
  cliente_id,
  jejum_horas,
  itens_levar,
  observacoes_especiais,
  medicacao_suspender,
  instrucoes
) VALUES (
  'Preparo Endoscopia - Dr. Sydney',
  'Endoscopia Digestiva Alta, Polipectomia Gástrica',
  v_cliente_id,
  12,
  'Documento com foto, acompanhante adulto obrigatório',
  'Vestir roupas leves (nada apertado)',
  'Suspender todos os medicamentos, inclusive para Diabetes. EXCEÇÃO: Remédio para PRESSÃO - tomar às 6h30 com apenas 50mL de água.',
  '{
    "titulo": "PREPARO PARA ENDOSCOPIA DIGESTIVA ALTA",
    "medico": "Dr. Sydney Ribeiro",
    "resumo": "Jejum de 12 horas. Vir acompanhado com adulto.",
    "dia_exame": {
      "jejum": "12 horas de jejum absoluto",
      "acompanhante": "Obrigatório vir acompanhado de adulto",
      "vestimenta": "Roupas leves (nada apertado)",
      "medicacoes": {
        "pressao": {
          "instrucao": "Tomar apenas o remédio para Pressão com 50mL de água às 6h30 da manhã",
          "observacao": "O remédio é apenas para quem já toma"
        },
        "suspender": "Suspender todos os outros remédios, inclusive o remédio para Diabetes"
      }
    }
  }'::jsonb
)
ON CONFLICT DO NOTHING;

-- Preparo 2: Colonoscopia / Colono+EDA / Polipectomia Cólon / Retossigmoidoscopia (IMOLAC)
INSERT INTO preparos (
  nome,
  exame,
  cliente_id,
  jejum_horas,
  itens_levar,
  observacoes_especiais,
  medicacao_suspender,
  restricoes_alimentares,
  instrucoes
) VALUES (
  'Preparo Colonoscopia IMOLAC - Dr. Sydney',
  'Colonoscopia, Colono + EDA, Polipectomia do Cólon, Retossigmoidoscopia',
  v_cliente_id,
  12,
  'Documento com foto, acompanhante adulto obrigatório',
  'Usar ducha higiênica ao invés de papel higiênico. Caminhar para facilitar evacuação.',
  'Suspender todos os medicamentos, inclusive para Diabetes. EXCEÇÃO: Remédio para PRESSÃO - tomar às 6h30 com apenas 50mL de água.',
  'PROIBIDO: Arroz, pão integral, linhaça, cereais, aveia, centeio, escarola, espinafre, brócolis, repolho, couve-flor, maçã, mamão, manga, banana, leite e derivados, bebidas alcoólicas.',
  '{
    "titulo": "PREPARO PARA COLONOSCOPIA - SOLUÇÃO IMOLAC",
    "medico": "Dr. Sydney Ribeiro",
    "resumo": "Dieta líquida na véspera + solução IMOLAC no dia do exame",
    
    "vespera_exame": {
      "titulo": "DIA ANTERIOR AO EXAME - DIETA LÍQUIDA",
      "refeicoes": {
        "cafe_manha": {
          "horario": "Café da manhã",
          "permitido": ["Café ou chá sem leite", "Pão francês com margarina ou geleia", "Torrada simples", "Biscoito água e sal ou maisena"]
        },
        "almoco": {
          "horario": "Almoço",
          "permitido": ["Arroz branco bem cozido", "Macarrão sem molho vermelho", "Carne branca grelhada (frango ou peixe)", "Batata cozida", "Caldo de legumes coado"]
        },
        "entre_refeicoes": {
          "horario": "Entre as refeições",
          "permitido": ["Água", "Água de coco", "Suco de fruta coado", "Chá sem leite", "Gelatina (exceto vermelha ou roxa)", "Picolé de fruta"]
        },
        "jantar": {
          "horario": "Jantar (até 19h)",
          "permitido": ["Sopa de legumes COADA (apenas o caldo)", "Caldo de carne coado", "Gelatina incolor ou amarela"]
        }
      },
      "medicacao_16h": {
        "medicamento": "DUCOLAX",
        "quantidade": "2 comprimidos",
        "horario": "16:00",
        "complemento": "Ingerir 1 a 2 litros de líquidos após tomar"
      },
      "alimentos_proibidos": [
        "Arroz",
        "Pão integral ou com grãos",
        "Linhaça",
        "Cereais",
        "Aveia",
        "Centeio",
        "Escarola",
        "Espinafre",
        "Brócolis",
        "Repolho",
        "Couve-flor",
        "Maçã",
        "Mamão",
        "Manga",
        "Banana",
        "Leite e derivados",
        "Bebidas alcoólicas"
      ]
    },
    
    "dia_exame": {
      "titulo": "DIA DO EXAME",
      "jejum": "Jejum absoluto (não comer nada sólido)",
      "acompanhante": "Obrigatório vir acompanhado de adulto",
      "vestimenta": "Roupas leves (nada apertado)",
      
      "protocolo": [
        {
          "horario": "05:30",
          "acao": "Tomar 1 comprimido de Vonau 8mg OU Plasil 10mg",
          "objetivo": "Prevenir náuseas"
        },
        {
          "horario": "06:00",
          "acao": "Iniciar ingestão da solução IMOLAC",
          "preparo_solucao": {
            "ingredientes": [
              "400mL de IMOLAC",
              "500mL de bebida isotônica (Gatorade) OU água gelada"
            ],
            "total": "900mL de solução",
            "dica": "A solução deve estar bem gelada para facilitar a ingestão"
          },
          "modo_ingestao": {
            "quantidade": "200mL (1 copo)",
            "intervalo": "A cada 15 minutos",
            "prazo": "Terminar até às 08:00"
          }
        }
      ],
      
      "medicacoes": {
        "pressao": {
          "instrucao": "Tomar apenas o remédio para Pressão com 50mL de água às 6h30 da manhã",
          "observacao": "O remédio é apenas para quem já toma"
        },
        "suspender": "Suspender todos os outros remédios, inclusive o remédio para Diabetes"
      },
      
      "orientacoes_importantes": [
        "Caminhar pela casa para facilitar a evacuação",
        "Usar ducha higiênica ao invés de papel higiênico",
        "As evacuações devem ficar claras como água de coco",
        "Se as evacuações não clarearem, avisar no dia do exame"
      ]
    }
  }'::jsonb
)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Preparos criados para Dr. Sydney Ribeiro';

-- =====================================================
-- FASE 5: CRIAR MENSAGEM DE BLOQUEIO
-- =====================================================
INSERT INTO llm_mensagens (
  cliente_id,
  medico_id,
  tipo,
  mensagem,
  ativo
) VALUES (
  v_cliente_id,
  v_medico_id,
  'bloqueio_agenda',
  'A agenda do Dr. Sydney Ribeiro está bloqueada para essa data. Para verificar disponibilidade ou encaixe, entre em contato com a recepção pelo telefone (87) 3861-3022.',
  true
)
ON CONFLICT DO NOTHING;

RAISE NOTICE 'Mensagem de bloqueio criada para Dr. Sydney Ribeiro';

RAISE NOTICE '✅ Implementação completa do Dr. Sydney Ribeiro finalizada!';

END $$;